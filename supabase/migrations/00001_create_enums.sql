CREATE TYPE supplemental_source AS ENUM ('manual', 'ai_suggested', 'imported');
CREATE TYPE job_source AS ENUM ('manual', 'indeed', 'linkedin', 'other');
CREATE TYPE job_status AS ENUM ('discovered', 'in_progress', 'applied', 'interviewing', 'rejected', 'offer');
CREATE TYPE application_status AS ENUM ('draft', 'ready', 'submitted', 'withdrawn');
