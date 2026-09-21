import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";

// Server half of /chat and /chat/[chatId]: resolves the signed-in user and
// hands the client view what it needs to greet them.
export async function ChatPage({ chatId }: { chatId: string | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(chatId ? `/chat/${chatId}` : "/chat")}`);

  let name: string | null =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    null;
  if (!name) {
    const { data } = await supabase.from("resume_data").select("parsed_json").eq("user_id", user.id).maybeSingle();
    name = ((data?.parsed_json as { personal?: { name?: string } } | null)?.personal?.name) || null;
  }
  const firstName = name?.trim().split(/\s+/)[0] || null;

  return <ChatView key={chatId ?? "new"} initialChatId={chatId} email={user.email ?? ""} firstName={firstName} />;
}
