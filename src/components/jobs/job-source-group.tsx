"use client";

import { useState } from "react";
import { JobCard } from "./job-card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Globe, Plus as PlusIcon, Sparkles, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/database";

interface SourceConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const SOURCE_CONFIGS: SourceConfig[] = [
  { key: "indeed", label: "From Indeed", icon: Globe, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "linkedin", label: "From LinkedIn", icon: Briefcase, color: "text-sky-600 bg-sky-50 border-sky-200" },
  { key: "manual", label: "Added Manually", icon: PlusIcon, color: "text-gray-600 bg-gray-50 border-gray-200" },
  { key: "ai_recommended", label: "Recommended for You", icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-200" },
];

export function JobSourceGroups({ jobs }: { jobs: Job[] }) {
  const groups = SOURCE_CONFIGS.map((config) => ({
    ...config,
    jobs: jobs
      .filter((j) => {
        if (config.key === "ai_recommended") return (j.match_score ?? 0) >= 80 && j.source !== "manual";
        return j.source === config.key;
      })
      .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)),
  })).filter((g) => g.jobs.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <SourceSection
          key={group.key}
          label={group.label}
          icon={group.icon}
          color={group.color}
          jobs={group.jobs}
          count={group.jobs.length}
        />
      ))}
    </div>
  );
}

function SourceSection({
  label,
  icon: Icon,
  color,
  jobs,
  count,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  jobs: Job[];
  count: number;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border bg-white">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <div className={cn("flex items-center justify-center h-6 w-6 rounded border", color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {count}
        </Badge>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
