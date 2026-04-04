"use client";

import { useState } from "react";
import { useUpdateApplication } from "@/hooks/use-applications";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export function CoverLetterPanel({
  coverLetter,
  applicationId,
}: {
  coverLetter: string | null;
  applicationId: string;
}) {
  const [text, setText] = useState(coverLetter ?? "");
  const updateApp = useUpdateApplication();
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      await updateApp.mutateAsync({ id: applicationId, cover_letter: text });
      toast({ title: "Cover letter saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  if (!coverLetter && !text) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-10 text-center">
          <div className="rounded-2xl bg-muted/80 p-4 inline-block mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No cover letter yet. Click &ldquo;Cover Letter&rdquo; above to generate one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          className="font-serif text-sm leading-relaxed"
        />
        <Button size="sm" className="mt-3" onClick={handleSave} disabled={updateApp.isPending}>
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
