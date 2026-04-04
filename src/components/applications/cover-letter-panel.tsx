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
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No cover letter yet. Click &ldquo;Generate Cover Letter&rdquo; above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          className="font-serif text-sm"
        />
        <Button size="sm" className="mt-2" onClick={handleSave} disabled={updateApp.isPending}>
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
