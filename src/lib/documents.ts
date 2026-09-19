// Text extraction for uploaded documents (résumés and chat attachments).

export const DOCUMENT_TYPES = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  text: ["text/plain", "text/markdown", "text/csv", "application/json"],
} as const;

export type DocumentKind = keyof typeof DOCUMENT_TYPES;

export function detectDocumentKind(file: { type: string; name: string }): DocumentKind | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (DOCUMENT_TYPES.pdf.includes(file.type as never) || ext === "pdf") return "pdf";
  if (DOCUMENT_TYPES.docx.includes(file.type as never) || ext === "docx" || ext === "doc") return "docx";
  if (DOCUMENT_TYPES.text.includes(file.type as never) || ["txt", "md", "csv", "json"].includes(ext)) return "text";
  return null;
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

export async function extractDocumentText(kind: DocumentKind, buffer: Buffer): Promise<string> {
  switch (kind) {
    case "pdf": return extractTextFromPDF(buffer);
    case "docx": return extractTextFromDOCX(buffer);
    case "text": return buffer.toString("utf8").trim();
  }
}
