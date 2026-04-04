"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ResumeSection } from "@/components/profile/resume-section";
import { SupplementalForm } from "@/components/profile/supplemental-form";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="My Profile" description="Manage your resume and application preferences" />
      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="supplemental">Supplemental Info</TabsTrigger>
        </TabsList>
        <TabsContent value="resume">
          <ResumeSection />
        </TabsContent>
        <TabsContent value="supplemental">
          <SupplementalForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
