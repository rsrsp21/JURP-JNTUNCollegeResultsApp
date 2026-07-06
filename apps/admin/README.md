<div align="center">
  <img src="static/images/logo-light.svg" alt="JURP logo" width="88">
  <h1>JURP Admin Portal</h1>
  <p>
    Flask operations console for maintaining the JNTUK UCEN Results Portal data pipeline.
  </p>
</div>

## Purpose

The admin app is the private side of JURP. It helps an authorized operator convert university result PDFs, ingest CSV files, generate CGPA and toppers reports, edit stored CSV data, sync normalized data into Cloudflare D1, and publish notifications used by the public portal.

## Feature Map

| Area | What it supports |
| --- | --- |
| Authentication | Username and password login for `/admin`. |
| Bulk download | Creates a ZIP of individual student result PDFs for a batch. |
| Result ingestion | Imports semester, CGPA, revaluation, supplementary, honors, and minor CSV data. |
| Report generation | Builds merged CGPA data, semester summaries, academic classifications, and toppers lists. |
| PDF to CSV | Extracts result tables from uploaded PDFs using `pdfplumber` and custom parsing logic. |
| CSV manager | Lists, opens, edits, and saves CSV files in the configured Cloudflare R2 workspace. |
| Notifications | Adds, deletes, and toggles "new" status for public portal notifications. |
| D1 migration | Provides scripts for migrating historical R2 CSV data into Cloudflare D1. |

## Tech Stack

- Python with Flask 3 for the admin application server
- Gunicorn for production serving
- Pandas for CSV processing and academic report generation
- pdfplumber for result PDF extraction
- Boto3 for Cloudflare R2-compatible object storage
- Cloudflare D1 REST API for normalized portal data
- Gemini API for AI-backed academic answers
- Bootstrap theme, Font Awesome, and custom CSS for the admin UI
- JSZip, jsPDF, and jspdf-autotable for browser-side bulk PDF and ZIP exports

## Folder Structure

```text
apps/admin/
+-- app.py                    # Flask application factory and route wiring
+-- run.py                    # Local entry point
+-- routes.py                 # Admin pages, public-compatible APIs, AI endpoints
+-- common.py                 # Shared paths, dotenv loading, Flask setup
+-- engine/logic.py           # Result parsing, merging, SGPA/CGPA/toppers logic
+-- migrations/d1_schema.sql  # Cloudflare D1 schema
+-- scripts/                  # R2 to D1 migration and verification utilities
+-- static/                   # Admin CSS, JS, and images
+-- templates/                # Login and admin panel HTML
+-- utils/                    # R2, D1, portal DB, and academic summary helpers
+-- requirements.txt
+-- .env.example
```

## Local Setup

From this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python run.py
```

Open `http://localhost:5001/login`.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_USERNAME` | Yes | Admin login username. |
| `ADMIN_PASSWORD` | Yes | Admin login password. |
| `FLASK_SECRET_KEY` | Recommended | Flask session signing key. Falls back to a development default if missing. |
| `R2_ACCOUNT_ID` | For R2 workflows | Cloudflare account ID. |
| `R2_BUCKET_NAME` | For R2 workflows | Bucket that stores CSV and data objects. |
| `R2_ACCESS_KEY_ID` | For R2 workflows | R2 access key. |
| `R2_SECRET_ACCESS_KEY` | For R2 workflows | R2 secret key. |
| `R2_CSV_PREFIX` | Optional | Prefix used by the CSV manager. Default example is `csv`. |
| `R2_EDITABLE_ROOTS` | Optional | Comma-separated roots the CSV editor can modify. |
| `D1_ACCOUNT_ID` | For D1 workflows | Cloudflare account ID for D1 API calls. |
| `D1_DATABASE_ID` | For D1 workflows | Target D1 database ID. |
| `D1_API_TOKEN` | For D1 workflows | Cloudflare API token with D1 access. |
| `D1_DATABASE_NAME` | For Wrangler imports | D1 database name used in generated Wrangler commands. |
| `PORTAL_DB_CACHE_TTL_SECONDS` | Optional | Cache TTL for D1-backed portal queries. |
| `GEMINI_API_KEY` | For AI | API key used by Ask AI endpoints. |
| `GEMINI_MODEL` | Optional | Gemini model name. Defaults to `gemini-2.5-flash`. |
| `PUBLIC_APP_URL` | Optional | Public portal base URL used for cross-links. |

## Main Routes

| Route | Purpose |
| --- | --- |
| `/login` | Admin login page. |
| `/logout` | Clears the admin session. |
| `/admin` | Admin operations console. |
| `/api/admin/convert-pdf` | Converts uploaded result PDFs to CSV. |
| `/api/admin/ingest` | Ingests result CSV files. |
| `/api/admin/generate-reports` | Generates CGPA, academic summaries, and toppers reports. |
| `/api/admin/csv-files` | Lists editable CSV files from R2. |
| `/api/admin/csv-file` | Reads or saves one CSV file. |
| `/api/admin/add-notification` | Adds a public notification. |
| `/api/admin/delete-notification/<index>` | Deletes a notification by order. |
| `/api/admin/toggle-blinking/<index>` | Toggles the public "new" marker. |

The admin app also exposes public-compatible read APIs such as `/api/cgpa/<student_id>`, `/api/student-results/<student_id>`, `/api/batch-data/<batch_year>`, `/api/toppers`, and `/api/notifications`.

## Production URL

Live admin portal:

- `https://jntunresultsadmin.onrender.com`

Related public portal deployments:

- `https://jurp.vercel.app`
- `https://jntunresults.vercel.app`
- `https://jntunresults.up.railway.app`
- `https://jntunresults.onrender.com`

## D1 Operations

Run these commands from the repository root so Python can resolve the `apps.admin` package.

Apply or refresh schema-backed academic summaries:

```powershell
python -m apps.admin.scripts.add_academic_summary_to_d1
```

Migrate current R2 `data/` objects into D1:

```powershell
python -m apps.admin.scripts.migrate_r2_data_to_d1 --years 2021,2022,2023,2024,2025
```

Verify D1 counts against R2 source data:

```powershell
python -m apps.admin.scripts.verify_d1_data_import --years 2021,2022,2023,2024,2025
```

Generate Wrangler-ready SQL files instead of using the D1 REST migration:

```powershell
python -m apps.admin.scripts.generate_d1_wrangler_import_sql --single-file
```

The generated import files are written to `apps/admin/d1_import/`.

## Deployment

A typical production command is:

```powershell
gunicorn app:app
```

Set all secrets in the hosting provider, not in committed files. The app listens on port `5001` when started with `python run.py`; production hosts often provide their own port through the process manager. The current live admin deployment is `https://jntunresultsadmin.onrender.com`.

## Operational Checklist

- Keep `.env` private and never commit credentials.
- Confirm D1 schema is applied before public launch.
- Use the admin panel to validate converted CSVs before syncing reports.
- Run D1 verification after one-time migrations.
- Test `/api/notifications`, `/api/cgpa/<roll_number>`, and `/api/toppers` after deployment.
