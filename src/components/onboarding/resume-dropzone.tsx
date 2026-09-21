"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUploadResume } from "@/hooks/use-resume";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2, CheckCircle, Brain, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadStep = "idle" | "uploading" | "extracting" | "analyzing" | "done" | "error";

const steps: { key: UploadStep; label: string; icon: React.ElementType }[] = [
  { key: "uploading", label: "Uploading file...", icon: Upload },
  { key: "extracting", label: "Extracting text...", icon: FileText },
  { key: "analyzing", label: "Analyzing with AI...", icon: Brain },
  { key: "done", label: "Done!", icon: CheckCircle },
];

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

interface ResumeDropzoneProps {
  /** Where to go once the résumé is in (or skipped). */
  next?: string;
}

export function ResumeDropzone({ next = "/dashboard" }: ResumeDropzoneProps) {
  const [step, setStep] = useState<UploadStep>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const uploadMutation = useUploadResume();
  const router = useRouter();
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: "Invalid file", description: "Please upload a PDF or Word document (.pdf, .docx).", variant: "destructive" });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
        return;
      }

      setStep("uploading");
      setErrorMessage("");

      const stepTimers = [
        setTimeout(() => setStep("extracting"), 1500),
        setTimeout(() => setStep("analyzing"), 3000),
      ];

      try {
        await uploadMutation.mutateAsync(file);
        stepTimers.forEach(clearTimeout);
        setStep("done");
        toast({ title: "Resume uploaded!", description: "Your resume has been parsed successfully." });
        setTimeout(() => router.push(next), 1500);
      } catch (err) {
        stepTimers.forEach(clearTimeout);
        const message = err instanceof Error ? err.message : "Something went wrong";
        setStep("error");
        setErrorMessage(message);
        toast({
          title: "Upload failed",
          description: message,
          variant: "destructive",
        });
      }
    },
    [uploadMutation, router, toast, next]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (step !== "idle" && step !== "error") {
    return (
      <Card className="max-w-lg mx-auto border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Processing your resume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.map((s) => {
              const stepIdx = steps.findIndex((st) => st.key === s.key);
              const currentIdx = steps.findIndex((st) => st.key === step);
              const isActive = s.key === step;
              const isDone = stepIdx < currentIdx || step === "done";

              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive ? "bg-primary/10 text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                  )}
                >
                  {isActive && step !== "done" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isDone ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <s.icon className="h-4 w-4" />
                  )}
                  <span className="font-medium text-sm">{s.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Upload your resume</CardTitle>
        <CardDescription>
          Upload a PDF or Word document and our AI will extract your information automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "error" && errorMessage && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Upload failed</p>
              <p className="text-xs mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            "border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,.docx,.doc";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFile(file);
            };
            input.click();
          }}
        >
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">
            Drag & drop your resume here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">PDF or Word document (.pdf, .docx), max 10MB</p>
        </div>
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => router.push(next)}>
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
