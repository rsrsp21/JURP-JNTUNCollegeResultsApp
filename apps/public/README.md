<div align="center">
  <img src="public/images/logo-light.svg" alt="JURP logo" width="88">
  <h1>JURP Public Portal</h1>
  <p>
    Next.js student-facing portal for JNTUK UCEN results, CGPA, toppers, notifications, PDFs, and AI assistance.
  </p>
</div>

## Purpose

The public app is the main student experience for JURP. It reads normalized academic data from Cloudflare D1 and presents it through fast roll-number search, polished result pages, PDF exports, toppers rankings, and an AI assistant for academic questions.

## Feature Map

| Page | Route | What students can do |
| --- | --- | --- |
| Home | `/` | See latest notifications, quick links, portal highlights, and public actions. |
| CGPA | `/cgpa` | Search by roll number for CGPA, credits, percentage, class/division, and SGPA trend. |
| Semester Results | `/results` and `/semester_results` | View subject-wise grades, semester SGPA, credits, and downloadable PDFs. |
| Ask AI | `/ask-ai` | Ask result questions, compare students, check backlogs, and get portal help. |
| Toppers | `/toppers` | Browse overall and branch-wise rankings by batch. |

## Production URLs

Live public portal deployments:

- `https://jurp.vercel.app`
- `https://jntunresults.vercel.app`
- `https://jntunresults.up.railway.app`
- `https://jntunresults.onrender.com`

Related admin portal:

- `https://jntunresultsadmin.onrender.com`

## Tech Stack

- Next.js 14 App Router
- React 18
- Framer Motion for UI transitions
- Server route handlers for public data APIs
- Cloudflare D1 REST API as the data source
- Gemini API for AI answers
- jsPDF and jspdf-autotable for downloadable reports
- Custom CSS in `app/globals.css`
- Vercel, Railway, or Render for production hosting

## Folder Structure

```text
apps/public/
+-- app/                    # Next.js routes and API handlers
|   +-- api/                # D1 and AI-backed API routes
|   +-- ask-ai/
|   +-- cgpa/
|   +-- results/
|   +-- semester_results/
|   +-- toppers/
+-- components/             # Shared React UI components
+-- lib/                    # D1, AI, PDF, env, and result data helpers
+-- public/                 # Static images and legacy CSS assets
+-- scripts/clean-next.mjs  # Removes local Next.js build artifacts
+-- package.json
+-- .env.example
```

## Local Setup

From this folder:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Useful scripts:

```powershell
npm run dev          # Start Next.js on port 3000
npm run dev:clean    # Clean .next first, then start dev
npm run clean        # Remove local Next.js build output
npm run build        # Production build
npm run start        # Start production server on port 3000
```

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

| Variable | Required | Purpose |
| --- | --- | --- |
| `D1_ACCOUNT_ID` | Yes for data APIs | Cloudflare account ID. |
| `D1_DATABASE_ID` | Yes for data APIs | D1 database ID. |
| `D1_API_TOKEN` | Yes for data APIs | Cloudflare API token with D1 query access. |
| `D1_API_BASE_URL` | Optional | Override for the Cloudflare API base URL. |
| `D1_QUERY_CACHE_TTL_MS` | Optional | In-memory cache TTL for D1 SELECT queries. |
| `GEMINI_API_KEY` | For AI | Enables `/api/ask-ai` and `/api/chat-ai`. |
| `GEMINI_MODEL` | Optional | Gemini model name. Defaults to `gemini-2.5-flash`. |

The sample file also includes deployment-oriented links. If production domains or community links change, update the constants in `components/AppShell.jsx` and `app/page.jsx` as well.

## API Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/cgpa/[studentId]` | `GET` | Returns CGPA and academic summary for one student. |
| `/api/student-results/[studentId]` | `GET` | Returns CGPA plus grouped semester result rows. |
| `/api/semester/[semester]?student_id=<roll>` | `GET` | Downloads a semester CSV for the student's batch. |
| `/api/batch-data/[batchYear]` | `GET` | Returns complete batch data for bulk PDF generation. |
| `/api/toppers?year=<batch>` | `GET` | Returns overall and branch-wise toppers for a batch. |
| `/api/notifications?limit=3` | `GET` | Returns latest portal notifications. |
| `/api/ask-ai` | `POST` | Answers a question for one active student context. |
| `/api/chat-ai` | `POST` | Conversational AI endpoint with roll-number detection and comparison support. |

## Data Expectations

The app expects the D1 schema from `../admin/migrations/d1_schema.sql` to be applied. Important tables are:

- `student_cgpa`
- `student_academic_summary`
- `semester_results`
- `toppers`
- `notifications`

Most UI pages handle empty or missing data gracefully, but production search requires those tables to be populated by the admin workflows.

## Deployment

This app is ready for a standard Next.js deployment.

```powershell
npm run build
npm run start
```

For Vercel or another managed Next.js host:

- Set the project root to `apps/public`.
- Add D1 and Gemini environment variables as deployment secrets.
- Current public deployments are `https://jurp.vercel.app`, `https://jntunresults.vercel.app`, `https://jntunresults.up.railway.app`, and `https://jntunresults.onrender.com`.
- Current admin deployment is `https://jntunresultsadmin.onrender.com`.
- Keep the admin portal URL and public links aligned with production domains.
- Confirm `/api/notifications`, `/api/cgpa/<roll_number>`, and `/api/toppers` return data after deploy.
