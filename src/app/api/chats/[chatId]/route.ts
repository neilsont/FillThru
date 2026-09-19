import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, resolveUser } from "@/lib/auth-request";
import { deleteChat, getChat } from "@/lib/chats";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { user } = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  const { chatId } = await params;
  const chat = await getChat(user.id, chatId);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
  return NextResponse.json({ chat }, { headers: CORS_HEADERS });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { user } = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  const { chatId } = await params;
  const deleted = await deleteChat(user.id, chatId);
  return NextResponse.json({ deleted }, { headers: CORS_HEADERS });
}
