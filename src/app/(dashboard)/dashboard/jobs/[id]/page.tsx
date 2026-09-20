"use client";

import { use } from "react";
import { JobSummary } from "@/components/jobs/job-summary";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <JobSummary jobId={id} />;
}
