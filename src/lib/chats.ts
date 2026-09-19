import type { Collection } from "mongodb";
import { getDb } from "./mongodb";

// Conversations from the extension's in-page assistant. The extension keeps a
// per-tab copy for instant restore; this is the durable history the user can
// browse (in the panel and on the website), reopen anywhere, and clear.

export interface ChatMessageRecord {
  kind: "user" | "assistant";
  text: string;
  error?: boolean;
  textActions?: boolean;
  file?: { name: string; size?: number; type?: string; role?: string } | null;
  at?: number;
}

export interface ChatDoc {
  userId: string;
  chatId: string;
  host: string;
  url?: string;
  title: string;
  preview: string;
  messageCount: number;
  messages: ChatMessageRecord[];
  history: { role: "user" | "assistant"; content: string }[];
  pendingQuestions: { id: string | null; question: string }[];
  attachmentNames: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ChatSummary = Pick<ChatDoc, "chatId" | "host" | "url" | "title" | "preview" | "messageCount" | "updatedAt" | "createdAt">;

const MAX_MESSAGES = 200;
const MAX_TEXT = 6000;

async function collection(): Promise<Collection<ChatDoc>> {
  const db = await getDb();
  return db.collection<ChatDoc>("chats");
}

export async function ensureChatIndexes(): Promise<void> {
  const col = await collection();
  await Promise.all([
    col.createIndex({ userId: 1, chatId: 1 }, { unique: true, name: "user_chat" }),
    col.createIndex({ userId: 1, updatedAt: -1 }, { name: "user_recent" }),
  ]);
}

function clean(input: Partial<ChatDoc>): Omit<ChatDoc, "userId" | "chatId" | "createdAt" | "updatedAt"> {
  const messages = (Array.isArray(input.messages) ? input.messages : [])
    .filter((m) => m && (m.kind === "user" || m.kind === "assistant"))
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      kind: m.kind,
      text: String(m.text ?? "").slice(0, MAX_TEXT),
      error: Boolean(m.error) || undefined,
      textActions: Boolean(m.textActions) || undefined,
      file: m.file && m.file.name ? { name: String(m.file.name).slice(0, 200), size: Number(m.file.size) || undefined, type: String(m.file.type ?? "").slice(0, 100), role: m.file.role === "resume" ? "resume" : "file" } : null,
      at: typeof m.at === "number" ? m.at : undefined,
    }));
  const lastText = [...messages].reverse().find((m) => m.text)?.text ?? "";
  const firstUser = messages.find((m) => m.kind === "user" && (m.text || m.file));
  return {
    host: String(input.host ?? "").slice(0, 120),
    url: input.url ? String(input.url).slice(0, 500) : undefined,
    title: String(input.title || firstUser?.text || firstUser?.file?.name || "Conversation").slice(0, 120),
    preview: lastText.replace(/\s+/g, " ").slice(0, 160),
    messageCount: messages.length,
    messages,
    history: (Array.isArray(input.history) ? input.history : [])
      .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
      .slice(-40)
      .map((h) => ({ role: h.role, content: h.content.slice(0, 4000) })),
    pendingQuestions: (Array.isArray(input.pendingQuestions) ? input.pendingQuestions : [])
      .filter((q) => q && q.question)
      .slice(0, 10)
      .map((q) => ({ id: typeof q.id === "string" ? q.id : null, question: String(q.question).slice(0, 500) })),
    attachmentNames: (Array.isArray(input.attachmentNames) ? input.attachmentNames : []).map((n) => String(n).slice(0, 200)).slice(0, 10),
  };
}

export async function upsertChat(userId: string, chatId: string, input: Partial<ChatDoc>): Promise<ChatSummary> {
  const col = await collection();
  const now = new Date();
  const doc = clean(input);
  await col.updateOne(
    { userId, chatId },
    { $set: { ...doc, updatedAt: now }, $setOnInsert: { userId, chatId, createdAt: now } },
    { upsert: true }
  );
  return { chatId, host: doc.host, url: doc.url, title: doc.title, preview: doc.preview, messageCount: doc.messageCount, updatedAt: now, createdAt: now };
}

export async function listChats(userId: string, limit = 50): Promise<ChatSummary[]> {
  const col = await collection();
  return col
    .find({ userId }, { projection: { _id: 0, chatId: 1, host: 1, url: 1, title: 1, preview: 1, messageCount: 1, updatedAt: 1, createdAt: 1 } })
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit, 200))
    .toArray() as Promise<ChatSummary[]>;
}

export async function getChat(userId: string, chatId: string): Promise<ChatDoc | null> {
  const col = await collection();
  return col.findOne({ userId, chatId }, { projection: { _id: 0 } });
}

export async function deleteChat(userId: string, chatId: string): Promise<boolean> {
  const col = await collection();
  const res = await col.deleteOne({ userId, chatId });
  return res.deletedCount > 0;
}

export async function deleteAllChats(userId: string): Promise<number> {
  const col = await collection();
  const res = await col.deleteMany({ userId });
  return res.deletedCount;
}
