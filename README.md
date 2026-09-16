This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Data layer

CareerLaunch uses two databases, each for what it's good at:

| Store | Holds | Why |
|---|---|---|
| **Supabase (Postgres)** | Auth, `jobs`, `applications`, `resume_data`, `supplemental_answers`, `flagged_questions`, `user_subscriptions` | Relational, user-owned data. Row Level Security enforces multi-tenant isolation at the database — every policy checks `auth.uid()`. |
| **MongoDB Atlas** | `generations` — every AI output (cover letters, question answers, field mappings) | Heterogeneous, append-heavy documents with no joins. A discriminated union (`src/types/generation.ts`) maps onto documents cleanly; `$facet` aggregations power per-user usage stats. |

MongoDB has no RLS, so tenant isolation for `generations` lives in the data-access layer (`src/lib/generations.ts`): every function takes the caller's verified `userId` from the Supabase session and every filter includes it. Writes happen inside Next's `after()` so persisting a generation never adds latency to — or can fail — the AI request.

Setup: create a free Atlas cluster, set `MONGODB_URI` / `MONGODB_DB`, then run `npm run mongo:indexes` once to create the compound indexes.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
