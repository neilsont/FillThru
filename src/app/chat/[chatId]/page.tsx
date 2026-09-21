import { notFound } from "next/navigation";
import { ChatPage } from "@/components/chat/chat-page";

export default async function ExistingChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(chatId)) notFound();
  return <ChatPage chatId={chatId} />;
}
