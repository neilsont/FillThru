export interface ParsedResume {
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    website?: string;
  };
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    start_date: string;
    end_date: string | null;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    graduation_date: string;
    gpa?: string;
  }>;
  skills: string[];
  certifications: string[];
}
