"use client";

import { useResume, useUpdateResume } from "@/hooks/use-resume";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText, Briefcase, GraduationCap } from "lucide-react";
import { useState } from "react";
import type { ParsedResume } from "@/types/resume";

export function ResumeSection() {
  const { data: resume, isLoading } = useResume();
  const updateMutation = useUpdateResume();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!resume) {
    return (
      <EmptyState
        icon={FileText}
        title="No resume uploaded"
        description="Upload your resume to see parsed data here."
        actionLabel="Upload Resume"
        actionHref="/onboarding"
      />
    );
  }

  const handleSave = (field: string, value: unknown) => {
    const parts = field.split(".");
    let update: Record<string, unknown> = {};
    const resumeAny = resume as unknown as Record<string, Record<string, unknown>>;

    if (parts.length === 2) {
      update = { [parts[0]]: { ...resumeAny[parts[0]], [parts[1]]: value } };
    } else {
      update = { [field]: value };
    }

    updateMutation.mutate(update as Partial<ParsedResume>, {
      onSuccess: () => toast({ title: "Saved" }),
    });
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Personal Info */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditableField label="Name" value={resume.personal.name} onSave={(v) => handleSave("personal.name", v)} />
            <EditableField label="Email" value={resume.personal.email} onSave={(v) => handleSave("personal.email", v)} />
            <EditableField label="Phone" value={resume.personal.phone} onSave={(v) => handleSave("personal.phone", v)} />
            <EditableField label="Location" value={resume.personal.location} onSave={(v) => handleSave("personal.location", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/80 leading-relaxed">{resume.summary || "No summary provided"}</p>
        </CardContent>
      </Card>

      {/* Experience */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Experience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resume.experience.map((exp, i) => (
            <div key={i} className="border-l-2 border-primary/20 pl-4">
              <p className="font-medium text-sm">{exp.title}</p>
              <p className="text-sm text-muted-foreground">
                {exp.company} &middot; {exp.location}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {exp.start_date} &mdash; {exp.end_date || "Present"}
              </p>
              <ul className="mt-2 space-y-1">
                {exp.bullets.map((bullet, j) => (
                  <li key={j} className="text-sm text-foreground/70 leading-relaxed">
                    &bull; {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {resume.experience.length === 0 && (
            <p className="text-sm text-muted-foreground">No experience entries</p>
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Education
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resume.education.map((edu, i) => (
            <div key={i}>
              <p className="font-medium text-sm">{edu.degree}</p>
              <p className="text-sm text-muted-foreground">
                {edu.institution} &middot; {edu.graduation_date}
              </p>
              {edu.gpa && <p className="text-xs text-muted-foreground">GPA: {edu.gpa}</p>}
            </div>
          ))}
          {resume.education.length === 0 && (
            <p className="text-sm text-muted-foreground">No education entries</p>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
            ))}
            {resume.skills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills listed</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Certifications */}
      {resume.certifications.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {resume.certifications.map((cert, i) => (
                <Badge key={i} variant="outline" className="text-xs">{cert}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {editing ? (
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (localValue !== value) onSave(localValue);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
              if (localValue !== value) onSave(localValue);
            }
          }}
          autoFocus
          className="mt-1"
        />
      ) : (
        <p
          className="text-sm cursor-pointer hover:bg-muted rounded px-2 py-1.5 -mx-2 mt-0.5 transition-colors"
          onClick={() => setEditing(true)}
        >
          {value || <span className="text-muted-foreground italic">Click to edit</span>}
        </p>
      )}
    </div>
  );
}
