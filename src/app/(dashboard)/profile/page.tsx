"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ResumeSection } from "@/components/profile/resume-section";
import { SupplementalForm } from "@/components/profile/supplemental-form";
import { AIModelSelector } from "@/components/profile/ai-model-selector";
import { AutoApplySettings } from "@/components/profile/auto-apply-settings";
import { PlanCard } from "@/components/profile/plan-card";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="My Profile" description="Manage your resume and application preferences" />
      <div className="mb-6">
        <PlanCard />
      </div>
      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="supplemental">Supplemental Info</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="resume">
          <ResumeSection />
        </TabsContent>
        <TabsContent value="supplemental">
          <SupplementalForm />
        </TabsContent>
        <TabsContent value="settings">
          <AIModelSelector />
          <AutoApplySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
