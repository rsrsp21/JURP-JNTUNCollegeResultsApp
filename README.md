<div align="center">
  <img src="apps/public/public/images/logo-light.svg" alt="JURP logo" width="96">
  <h1>JURP - JNTUK UCEN Results Portal</h1>
  <p>
    A two-app results platform for publishing, searching, analyzing, and managing JNTUK UCEN academic results.
  </p>
</div>

## Overview

JURP stands for JNTUK UCEN Results Portal. The project is organized as a small monorepo with two independently deployed applications:

| App | Path | Runtime | Purpose |
| --- | --- | --- | --- |
| Public portal | `apps/public` | Next.js 14, React | Student-facing results lookup, CGPA view, semester results, toppers, PDF export, notifications, and AI help. |
| Admin portal | `apps/admin` | Flask, Python | Protected operations console for PDF parsing, CSV ingestion, report generation, R2 CSV editing, D1 sync, and notifications. |

The public app reads normalized result data from Cloudflare D1. The admin app owns the operational workflows that convert source result files into clean CSV data and sync that data into D1.

## What It Does

- Lets students search by roll number for CGPA, semester-wise results, credits, percentage, and academic classification.
- Exports individual semester, CGPA, and all-semester PDFs.
- Shows batch-wise and branch-wise toppers.
- Displays portal notifications managed from the admin panel.
- Provides an AI assistant for result questions, backlog checks, comparisons, toppers, and portal help.
- Gives admins tools to convert result PDFs, ingest CSVs, generate reports, edit stored CSVs, and manage public notifications.

## Production URLs

Public portal deployments:

- `https://jurp.vercel.app`
- `https://jntunresults.vercel.app`
- `https://jntunresults.up.railway.app`
- `https://jntunresults.onrender.com`

Admin portal deployment:

- `https://jntunresultsadmin.onrender.com`

## Tech Stack

| Layer | Technology |
| --- | --- |
| Public frontend | Next.js 14 App Router, React 18, Framer Motion |
| Public APIs | Next.js route handlers |
| Admin backend | Flask 3, Python, Gunicorn |
| Data processing | Pandas, pdfplumber, custom result parsing logic |
| Storage | Cloudflare D1 for normalized portal data, Cloudflare R2 for CSV/object storage |
| AI | Gemini API |
| PDF export | jsPDF and jspdf-autotable |
| Deployment | Vercel, Railway, and Render |

## Data Flow

```text
University PDFs / CSVs
        |
        v
Admin portal: parse, clean, ingest, generate reports
        |
        +--> Cloudflare R2 CSV workspace
        |
        +--> Cloudflare D1 normalized tables
                 |
                 v
Public portal APIs and pages
```

Main D1 tables are defined in `apps/admin/migrations/d1_schema.sql`:

- `student_cgpa`
- `student_academic_summary`
- `semester_results`
- `toppers`
- `notifications`

## Repository Layout

```text
.
+-- apps/
|   +-- admin/          # Flask admin portal and data-processing scripts
|   +-- public/         # Next.js public portal
+-- .gitignore
+-- README.md
```

## Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- Cloudflare D1 database and API token for full data access
- Cloudflare R2 bucket and access keys for admin CSV workflows
- Gemini API key for AI chat features

The apps can boot locally without every production credential, but data-backed features need the matching environment variables.

## Local Development

Run the two apps in separate terminals.

### Admin Portal

```powershell
cd apps/admin
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python run.py
```

Admin local URL: `http://localhost:5001/login`

### Public Portal

```powershell
cd apps/public
npm install
Copy-Item .env.example .env.local
npm run dev
```

Public local URL: `http://localhost:3000`

## Environment Files

Each app ships with its own sample environment file:

- `apps/admin/.env.example`
- `apps/public/.env.example`

Use real credentials only in local `.env` or `.env.local` files. Those files are ignored by Git.

## Documentation

- Admin portal guide: `apps/admin/README.md`
- Public portal guide: `apps/public/README.md`

## Deployment Notes

- Deploy `apps/public` to a Next.js host such as Vercel.
- Deploy `apps/admin` to a Python host such as Render, using `gunicorn`.
- Current public production URLs are `https://jurp.vercel.app`, `https://jntunresults.vercel.app`, `https://jntunresults.up.railway.app`, and `https://jntunresults.onrender.com`.
- Current admin production URL is `https://jntunresultsadmin.onrender.com`.
- Apply the D1 schema before using public APIs in production.
- Keep admin credentials, Cloudflare tokens, and Gemini keys in deployment secrets.
- Update production URLs consistently in environment variables and app link constants when changing domains.

## Credits

Developed by Sri Ram Sai Pavan Relangi.

If you like this project, please give it a star ⭐ and connect with me on LinkedIn:

- https://linkedin.com/in/sriramsaipavanrelangi
