import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USER_EMAIL = "demo@careerlaunch.app";
const DEMO_USER_PASSWORD = "demo123456";

async function seed() {
  console.log("Seeding CareerLaunch database...\n");

  // Create or get demo user
  let userId: string;
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === DEMO_USER_EMAIL
  );

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Using existing demo user: ${userId}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error("Failed to create user:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`Created demo user: ${userId}`);
  }

  // Seed resume data
  const parsedResume = {
    personal: {
      name: "Alex Johnson",
      email: "alex.johnson@email.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
      linkedin: "https://linkedin.com/in/alexjohnson",
      website: "https://alexjohnson.dev",
    },
    summary:
      "Full-stack software engineer with 6+ years of experience building scalable web applications. Proficient in React, TypeScript, Node.js, and cloud infrastructure. Passionate about developer experience and AI-powered tools.",
    experience: [
      {
        title: "Senior Software Engineer",
        company: "TechCorp",
        location: "San Francisco, CA",
        start_date: "2022-01",
        end_date: null,
        bullets: [
          "Led the migration of a monolithic application to a microservices architecture, reducing deployment time by 70%",
          "Built a real-time collaboration feature serving 50K+ daily active users using WebSockets and Redis",
          "Mentored 3 junior engineers and established code review best practices for the team",
        ],
      },
      {
        title: "Software Engineer",
        company: "StartupXYZ",
        location: "Remote",
        start_date: "2019-06",
        end_date: "2021-12",
        bullets: [
          "Developed a customer-facing dashboard using React and TypeScript, improving user engagement by 40%",
          "Implemented CI/CD pipelines with GitHub Actions, reducing release cycles from 2 weeks to daily",
          "Designed and built RESTful APIs serving 1M+ requests per day",
        ],
      },
      {
        title: "Junior Developer",
        company: "WebAgency",
        location: "New York, NY",
        start_date: "2018-01",
        end_date: "2019-05",
        bullets: [
          "Built responsive websites for 20+ clients using React and CSS-in-JS",
          "Contributed to an open-source component library with 500+ GitHub stars",
        ],
      },
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        institution: "University of California, Berkeley",
        graduation_date: "2017-12",
        gpa: "3.7",
      },
    ],
    skills: [
      "TypeScript", "React", "Next.js", "Node.js", "Python",
      "PostgreSQL", "Redis", "AWS", "Docker", "Kubernetes",
      "GraphQL", "REST APIs", "CI/CD", "System Design",
    ],
    certifications: ["AWS Solutions Architect Associate", "Google Cloud Professional Developer"],
  };

  await supabase.from("resume_data").upsert({
    user_id: userId,
    raw_text: "Alex Johnson — Senior Software Engineer...",
    parsed_json: parsedResume,
    file_path: `${userId}/resume.pdf`,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  console.log("Seeded resume data");

  // Seed supplemental answers
  const supplementalAnswers = [
    { question_key: "work_authorization", question_label: "Are you authorized to work in the US?", answer: "Yes" },
    { question_key: "sponsorship_needed", question_label: "Will you now or in the future require sponsorship?", answer: "No" },
    { question_key: "salary_expectation", question_label: "Desired salary", answer: "$180,000 - $220,000" },
    { question_key: "willing_to_relocate", question_label: "Willing to relocate?", answer: "Depends on location" },
    { question_key: "work_arrangement", question_label: "Preferred work arrangement", answer: "Remote" },
    { question_key: "linkedin_url", question_label: "LinkedIn URL", answer: "https://linkedin.com/in/alexjohnson" },
    { question_key: "github_url", question_label: "GitHub URL", answer: "https://github.com/alexjohnson" },
    { question_key: "portfolio_url", question_label: "Portfolio URL", answer: "https://alexjohnson.dev" },
    { question_key: "gender", question_label: "Gender", answer: "Non-binary" },
    { question_key: "pronouns", question_label: "Pronouns", answer: "they/them" },
    { question_key: "veteran_status", question_label: "Veteran status", answer: "No" },
  ];

  for (const answer of supplementalAnswers) {
    await supabase.from("supplemental_answers").upsert(
      { user_id: userId, ...answer, source: "manual" },
      { onConflict: "user_id,question_key" }
    );
  }
  console.log(`Seeded ${supplementalAnswers.length} supplemental answers`);

  // Seed jobs
  const jobs = [
    { title: "Senior Frontend Engineer", company: "Stripe", location: "San Francisco, CA", job_type: "Full-time", status: "discovered" as const, match_score: 92, description: "We're looking for a Senior Frontend Engineer to join our Dashboard team. You'll work on the tools that millions of businesses use to manage their payments, subscriptions, and financial operations.\n\nRequirements:\n- 5+ years of experience with React and TypeScript\n- Experience with large-scale frontend applications\n- Strong understanding of web performance optimization\n- Experience with design systems and component libraries", url: "https://stripe.com/jobs/senior-frontend" },
    { title: "Full Stack Engineer", company: "Vercel", location: "Remote", job_type: "Full-time", status: "discovered" as const, match_score: 88, description: "Join Vercel to build the future of web development. As a Full Stack Engineer, you'll work across our platform, from the dashboard to the deployment infrastructure.\n\nRequirements:\n- Strong experience with Next.js and React\n- Backend experience with Node.js\n- Experience with serverless architectures\n- Passion for developer tools", url: "https://vercel.com/careers/full-stack" },
    { title: "Staff Software Engineer", company: "Anthropic", location: "San Francisco, CA", job_type: "Full-time", status: "in_progress" as const, match_score: 85, description: "Build the AI systems that power Claude. We're looking for a Staff Engineer to lead the development of our user-facing applications and APIs.\n\nRequirements:\n- 8+ years of software engineering experience\n- Experience building AI-powered applications\n- Strong systems design skills\n- Python and/or TypeScript expertise", url: "https://anthropic.com/careers/staff-engineer" },
    { title: "Senior Software Engineer, Platform", company: "Notion", location: "San Francisco, CA", job_type: "Full-time", status: "in_progress" as const, match_score: 82, description: "Help build the platform infrastructure that powers Notion's collaborative workspace.\n\nRequirements:\n- 5+ years building scalable backend systems\n- Experience with distributed systems\n- Strong with databases and data modeling\n- TypeScript/JavaScript expertise preferred" },
    { title: "Engineering Manager", company: "Figma", location: "San Francisco, CA", job_type: "Full-time", status: "applied" as const, match_score: 75, description: "Lead a team of 6-8 engineers building Figma's real-time collaboration features." },
    { title: "Principal Engineer", company: "Netflix", location: "Los Gatos, CA", job_type: "Full-time", status: "applied" as const, match_score: 78 },
    { title: "Senior Full Stack Developer", company: "Shopify", location: "Remote", job_type: "Full-time", status: "interviewing" as const, match_score: 90, description: "Build commerce experiences that serve millions of merchants worldwide." },
    { title: "Lead Frontend Engineer", company: "Linear", location: "Remote", job_type: "Full-time", status: "interviewing" as const, match_score: 93, description: "Lead the frontend team building the best project management tool for software teams." },
    { title: "Software Engineer II", company: "Airbnb", location: "San Francisco, CA", job_type: "Full-time", status: "rejected" as const, match_score: 70 },
    { title: "Senior Backend Engineer", company: "Plaid", location: "San Francisco, CA", job_type: "Full-time", status: "rejected" as const, match_score: 65 },
    { title: "Staff Frontend Engineer", company: "Coinbase", location: "Remote", job_type: "Full-time", status: "offer" as const, match_score: 87, description: "Build the next generation of crypto trading interfaces. You'll lead the frontend architecture for our consumer trading platform." },
    { title: "React Developer", company: "Freelance Client", location: "Remote", job_type: "Contract", status: "discovered" as const, match_score: 60, source: "manual" as const },
    { title: "Frontend Tech Lead", company: "Datadog", location: "New York, NY", job_type: "Full-time", status: "discovered" as const, match_score: 84 },
    { title: "Senior Engineer, AI Products", company: "OpenAI", location: "San Francisco, CA", job_type: "Full-time", status: "discovered" as const, match_score: 80 },
    { title: "Software Engineer, Growth", company: "Supabase", location: "Remote", job_type: "Full-time", status: "in_progress" as const, match_score: 91 },
  ];

  const insertedJobs: { id: string; title: string; status: string }[] = [];
  for (const job of jobs) {
    const { data } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        title: job.title,
        company: job.company,
        location: job.location,
        job_type: job.job_type,
        status: job.status,
        match_score: job.match_score,
        description: job.description || null,
        url: job.url || null,
        source: (job as { source?: string }).source || "indeed",
      })
      .select("id, title, status")
      .single();

    if (data) insertedJobs.push(data);
  }
  console.log(`Seeded ${insertedJobs.length} jobs`);

  // Seed applications for jobs that are applied/interviewing/rejected/offer
  const appStatuses = ["applied", "interviewing", "rejected", "offer"];
  const applyJobs = insertedJobs.filter((j) => appStatuses.includes(j.status));

  for (const job of applyJobs) {
    const status =
      job.status === "offer"
        ? "ready"
        : job.status === "rejected"
          ? "submitted"
          : job.status === "applied"
            ? "submitted"
            : "draft";

    await supabase.from("applications").insert({
      user_id: userId,
      job_id: job.id,
      status,
      cover_letter:
        status !== "draft"
          ? `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${job.title} position. With over 6 years of experience in software engineering and a proven track record of building scalable web applications, I believe I would be a valuable addition to your team.\n\nMy experience at TechCorp leading microservices migrations and building real-time features has prepared me well for the challenges of this role. I am particularly excited about the opportunity to contribute to your team's mission.\n\nI look forward to discussing how my skills and experience align with your needs.\n\nBest regards,\nAlex Johnson`
          : null,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
      notes: job.status === "interviewing" ? "Phone screen went well. Technical round next week." : null,
    });
  }
  console.log(`Seeded ${applyJobs.length} applications`);

  // Seed flagged questions
  const inProgressJobs = insertedJobs.filter((j) => j.status === "in_progress");
  const flaggedQuestions = [
    { question_text: "How many years of Python experience do you have?", field_key: "years_python", resolved: false },
    { question_text: "Are you comfortable with on-call rotations?", field_key: "on_call_comfort", resolved: false },
    { question_text: "What is your expected start date?", field_key: "start_date", resolved: true, answer: "2 weeks notice" },
    { question_text: "Do you have experience with Kubernetes in production?", field_key: "k8s_experience", resolved: false },
    { question_text: "What timezone do you primarily work in?", field_key: "timezone", resolved: true, answer: "Pacific (PT)" },
  ];

  for (let i = 0; i < flaggedQuestions.length; i++) {
    const jobIdx = i % inProgressJobs.length;
    const q = flaggedQuestions[i];
    await supabase.from("flagged_questions").insert({
      user_id: userId,
      job_id: inProgressJobs[jobIdx]?.id || null,
      question_text: q.question_text,
      field_key: q.field_key,
      resolved: q.resolved,
      answer: q.answer || null,
    });
  }
  console.log(`Seeded ${flaggedQuestions.length} flagged questions`);

  console.log("\nSeed complete!");
  console.log(`\nDemo credentials:`);
  console.log(`  Email: ${DEMO_USER_EMAIL}`);
  console.log(`  Password: ${DEMO_USER_PASSWORD}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
