import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeDropzone } from "@/components/onboarding/resume-dropzone";
import { safeNext } from "@/lib/utils";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user already has a resume
  const { data: resume } = await supabase
    .from("resume_data")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (resume) {
    redirect(next);
  }

  return <ResumeDropzone next={next} />;
}
