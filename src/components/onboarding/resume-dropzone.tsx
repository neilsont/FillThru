"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUploadResume } from "@/hooks/use-resume";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2, CheckCircle, Brain } from "lucide-react";

type UploadStep = "idle" | "uploading" | "extracting" | "analyzing" | "done";

const steps: { key: UploadStep; label: string; icon: React.ElementType }[] = [
  { key: "uploading", label: "Uploading file...", icon: Upload },
  { key: "extracting", label: "Extracting text...", icon: FileText },
  { key: "analyzing", label: "Analyzing with AI...", icon: Brain },
  { key: "done", label: "Done!", icon: CheckCircle },
];

export function ResumeDropzone() {
  const [step, setStep] = useState<UploadStep>("idle");
  const [dragOver, setDragOver] = useState(false);
  const uploadMutation = useUploadResume();
  const router = useRouter();
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" });
        return;
      }

      setStep("uploading");

      // Simulate step progression (actual work happens in one API call)
      const stepTimers = [
        setTimeout(() => setStep("extracting"), 1500),
        setTimeout(() => setStep("analyzing"), 3000),
      ];

      try {
        await uploadMutation.mutateAsync(file);
        stepTimers.forEach(clearTimeout);
        setStep("done");
        toast({ title: "Resume uploaded!", description: "Your resume has been parsed successfully." });
        setTimeout(() => router.push("/dashboard"), 1500);
      } catch (err) {
        stepTimers.forEach(clearTimeout);
        setStep("idle");
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      }
    },
    [uploadMutation, router, toast]
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

  if (step !== "idle") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing your resume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((s) => {
              const stepIdx = steps.findIndex((st) => st.key === s.key);
              const currentIdx = steps.findIndex((st) => st.key === step);
              const isActive = s.key === step;
              const isDone = stepIdx < currentIdx || step === "done";

              return (
                <div
                  key={s.key}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  {isActive && step !== "done" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isDone ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <s.icon className="h-5 w-5" />
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
    <Card>
      <CardHeader>
        <CardTitle>Upload your resume</CardTitle>
        <CardDescription>
          Upload a PDF and our AI will extract your information automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFile(file);
            };
            input.click();
          }}
        >
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">
            Drag & drop your resume here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">PDF only, max 10MB</p>
        </div>
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
