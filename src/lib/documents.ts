// Text extraction for uploaded documents (résumés and chat attachments).
// Text-based files are parsed locally; images and scanned PDFs are transcribed
// by Gemini (multimodal), so screenshots and photos of documents work too.

export const DOCUMENT_TYPES = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  text: ["text/plain", "text/markdown", "text/csv", "application/json"],
  image: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"],
} as const;

export type DocumentKind = keyof typeof DOCUMENT_TYPES;

const IMAGE_EXTENSIONS: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", heic: "image/heic", heif: "image/heif",
};

export function detectDocumentKind(file: { type: string; name: string }): DocumentKind | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (DOCUMENT_TYPES.pdf.includes(file.type as never) || ext === "pdf") return "pdf";
  if (DOCUMENT_TYPES.docx.includes(file.type as never) || ext === "docx" || ext === "doc") return "docx";
  if (DOCUMENT_TYPES.text.includes(file.type as never) || ["txt", "md", "csv", "json"].includes(ext)) return "text";
  if (DOCUMENT_TYPES.image.includes(file.type as never) || ext in IMAGE_EXTENSIONS) return "image";
  return null;
}

export function imageMimeType(file: { type: string; name: string }): string {
  if (file.type.startsWith("image/")) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return IMAGE_EXTENSIONS[ext] ?? "image/png";
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // mammoth is CJS — use require() so Turbopack skips static analysis
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

const OCR_MAX_BYTES = 12 * 1024 * 1024; // inline data limit, with base64 overhead in mind
const OCR_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];

/**
 * Transcribe an image or scanned PDF with Gemini. Returns "" when the model
 * finds no text. Throws on hard failures so callers can report them.
 */
export async function transcribeWithGemini(buffer: Buffer, mimeType: string): Promise<string> {
  if (buffer.length > OCR_MAX_BYTES) {
    throw new Error("That file is too large to read as an image (12MB max). Try a smaller export.");
  }
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_STUDIO_API_KEY (or GEMINI_API_KEY) is not set");

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(key);
  const prompt =
    "Transcribe ALL of the text in this document exactly as written, in reading order. Keep headings, bullet points, and line breaks. " +
    "Do not summarise, translate, or add commentary. If a form has labels and filled values, write them as 'Label: value'. " +
    "If there is no readable text at all, reply with exactly NO_TEXT.";

  let lastError: unknown = null;
  for (const modelName of OCR_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { maxOutputTokens: 8192, temperature: 0 } });
      const result = await model.generateContent([
        { inlineData: { data: buffer.toString("base64"), mimeType } },
        prompt,
      ]);
      const text = result.response.text().trim();
      return text === "NO_TEXT" ? "" : text;
    } catch (error) {
      lastError = error;
      console.error(`OCR failed on ${modelName}:`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not read the image");
}

/**
 * Best-effort text for any supported document. Scanned PDFs (no text layer)
 * and images go through Gemini.
 */
export async function extractDocumentText(
  kind: DocumentKind,
  buffer: Buffer,
  file: { type: string; name: string }
): Promise<{ text: string; ocr: boolean }> {
  switch (kind) {
    case "docx":
      return { text: await extractTextFromDOCX(buffer), ocr: false };
    case "text":
      return { text: buffer.toString("utf8").trim(), ocr: false };
    case "image":
      return { text: await transcribeWithGemini(buffer, imageMimeType(file)), ocr: true };
    case "pdf": {
      let text = "";
      try { text = await extractTextFromPDF(buffer); } catch { text = ""; }
      // Fewer than ~40 characters means a scan (or a cover page) — read it as images.
      if (text.replace(/\s+/g, "").length >= 40) return { text, ocr: false };
      return { text: await transcribeWithGemini(buffer, "application/pdf"), ocr: true };
    }
  }
}
