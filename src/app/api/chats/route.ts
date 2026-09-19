import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, resolveUser } from "@/lib/auth-request";
import { deleteAllChats, listChats, upsertChat } from "@/lib/chats";

// Conversation history. Website (cookie) and extension (bearer) share this.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { user } = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50;
  try {
    return NextResponse.json({ chats: await listChats(user.id, limit) }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("listChats failed:", err);
    return NextResponse.json({ error: "Could not load chat history" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId.slice(0, 64) : "";
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(chatId)) {
    return NextResponse.json({ error: "chatId is required" }, { status: 400, headers: CORS_HEADERS });
  }
  try {
    return NextResponse.json({ chat: await upsertChat(user.id, chatId, body) }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("upsertChat failed:", err);
    return NextResponse.json({ error: "Could not save the conversation" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function DELETE(request: NextRequest) {
  const { user } = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  try {
    return NextResponse.json({ deleted: await deleteAllChats(user.id) }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("deleteAllChats failed:", err);
    return NextResponse.json({ error: "Could not clear chat history" }, { status: 500, headers: CORS_HEADERS });
  }
}
