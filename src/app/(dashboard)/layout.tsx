import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header email={user.email ?? ""} />
        <main className="flex-1 overflow-auto p-6 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
