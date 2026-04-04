export const resumeSchema = {
  type: "object" as const,
  properties: {
    personal: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        email: { type: "string" as const },
        phone: { type: "string" as const },
        location: { type: "string" as const },
        linkedin: { type: "string" as const },
        website: { type: "string" as const },
      },
      required: ["name", "email", "phone", "location", "linkedin", "website"] as const,
      additionalProperties: false,
    },
    summary: { type: "string" as const },
    experience: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          company: { type: "string" as const },
          location: { type: "string" as const },
          start_date: { type: "string" as const },
          end_date: { type: ["string", "null"] as const },
          bullets: { type: "array" as const, items: { type: "string" as const } },
        },
        required: ["title", "company", "location", "start_date", "end_date", "bullets"] as const,
        additionalProperties: false,
      },
    },
    education: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          degree: { type: "string" as const },
          institution: { type: "string" as const },
          graduation_date: { type: "string" as const },
          gpa: { type: "string" as const },
        },
        required: ["degree", "institution", "graduation_date", "gpa"] as const,
        additionalProperties: false,
      },
    },
    skills: { type: "array" as const, items: { type: "string" as const } },
    certifications: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["personal", "summary", "experience", "education", "skills", "certifications"] as const,
  additionalProperties: false,
};

export const fieldMappingSchema = {
  type: "object" as const,
  properties: {
    mappings: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          field_key: { type: "string" as const },
          field_label: { type: "string" as const },
          value: { type: "string" as const },
          confidence: { type: "number" as const },
          source: {
            type: "string" as const,
            enum: ["resume", "supplemental", "ai_inferred", "manual"] as const,
          },
        },
        required: ["field_key", "field_label", "value", "confidence", "source"] as const,
        additionalProperties: false,
      },
    },
  },
  required: ["mappings"] as const,
  additionalProperties: false,
};
