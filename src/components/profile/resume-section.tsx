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
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <EditableField label="Name" value={resume.personal.name} onSave={(v) => handleSave("personal.name", v)} />
            <EditableField label="Email" value={resume.personal.email} onSave={(v) => handleSave("personal.email", v)} />
            <EditableField label="Phone" value={resume.personal.phone} onSave={(v) => handleSave("personal.phone", v)} />
            <EditableField label="Location" value={resume.personal.location} onSave={(v) => handleSave("personal.location", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{resume.summary || "No summary provided"}</p>
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Experience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resume.experience.map((exp, i) => (
            <div key={i} className="border-l-2 border-primary/20 pl-4">
              <p className="font-semibold">{exp.title}</p>
              <p className="text-sm text-muted-foreground">
                {exp.company} &middot; {exp.location}
              </p>
              <p className="text-xs text-muted-foreground">
                {exp.start_date} &mdash; {exp.end_date || "Present"}
              </p>
              <ul className="mt-2 space-y-1">
                {exp.bullets.map((bullet, j) => (
                  <li key={j} className="text-sm text-muted-foreground">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Education
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resume.education.map((edu, i) => (
            <div key={i}>
              <p className="font-semibold">{edu.degree}</p>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill, i) => (
              <Badge key={i} variant="secondary">{skill}</Badge>
            ))}
            {resume.skills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills listed</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Certifications */}
      {resume.certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {resume.certifications.map((cert, i) => (
                <Badge key={i} variant="outline">{cert}</Badge>
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
        />
      ) : (
        <p
          className="text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
          onClick={() => setEditing(true)}
        >
          {value || <span className="text-muted-foreground italic">Click to edit</span>}
        </p>
      )}
    </div>
  );
}
