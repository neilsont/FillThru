"use client";

import { use } from "react";
import { ApplicationDetail } from "@/components/applications/application-detail";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ApplicationDetail jobId={id} />;
}
