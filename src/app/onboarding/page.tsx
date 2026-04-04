import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeDropzone } from "@/components/onboarding/resume-dropzone";

export default async function OnboardingPage() {
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
    redirect("/dashboard");
  }

  return <ResumeDropzone />;
}
