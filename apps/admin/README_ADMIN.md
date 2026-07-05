# Results Ingestion & Administration Engine

This project serves the public JNTUK UCEN results portal and includes an admin dashboard for ingesting result PDFs/CSVs.

The storage model is now split deliberately:

- `csv/` in Cloudflare R2 remains the admin processing workspace and archive.
- Cloudflare D1 is the public portal database for CGPA records, semester results, toppers, and notifications.
- The old R2 `data/` folder is used only as a one-time migration source by `apps.admin.scripts.migrate_r2_data_to_d1`.

## Runtime Data Tables

The portal reads public data only from D1:

- `student_cgpa`: one row per student, including official semester SGPA/credits, total credits, CGPA, batch, regulation, and supplementary appearance marks.
- `student_academic_summary`: one row per student with backend/D1-derived percentage, division, progress bar class, and supplementary count.
- `semester_results`: subject rows for semester `1` through `9`; semester `9` is honors/minors.
- `toppers`: overall and branch-wise rankings per batch.
- `notifications`: homepage/admin notifications.

The public semester results frontend displays SGPA and semester credits from `student_cgpa` through the backend response. It does not calculate SGPA in the browser.
The public CGPA frontend displays percentage, division, progress color, and supplementary count from `student_academic_summary`. It does not apply regulation formulas in the browser.

## Setup

Install dependencies:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r apps\admin\requirements.txt
```

Configure `apps/admin/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
ADMIN_USERNAME=your_admin_username_here
ADMIN_PASSWORD=your_admin_password_here

R2_ACCOUNT_ID=your_cloudflare_account_id_here
R2_BUCKET_NAME=your_r2_bucket_name_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_CSV_PREFIX=csv
R2_EDITABLE_ROOTS=csv

D1_ACCOUNT_ID=your_cloudflare_account_id_here
D1_DATABASE_ID=your_d1_database_id_here
D1_API_TOKEN=your_cloudflare_d1_api_token_here
D1_DATABASE_NAME=your_cloudflare_d1_database_name_for_wrangler_here
PORTAL_DB_CACHE_TTL_SECONDS=300
PUBLIC_APP_URL=http://localhost:3000
```

Configure `apps/public/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
D1_ACCOUNT_ID=your_cloudflare_account_id_here
D1_DATABASE_ID=your_d1_database_id_here
D1_API_TOKEN=your_cloudflare_d1_api_token_here
PORTAL_DB_CACHE_TTL_SECONDS=300
```

## One-Time Migration From Existing R2 `data/`

Run this once after D1 credentials are configured:

```powershell
.venv\Scripts\python.exe -m apps.admin.scripts.migrate_r2_data_to_d1
```

The script:

- applies `apps/admin/migrations/d1_schema.sql`
- imports `data/cgpa_data_{year}.csv` into `student_cgpa`
- refreshes `student_academic_summary` from `student_cgpa`
- imports `data/semesters/{year}/semester{n}.csv` into `semester_results`
- imports `data/toppers_{year}.csv` into `toppers`
- imports `data/notifications.json` into `notifications`

To migrate selected years:

```powershell
.venv\Scripts\python.exe -m apps.admin.scripts.migrate_r2_data_to_d1 --years 2021,2022,2023
```

For a faster file-based import through Wrangler, generate SQL files from the same R2 `data/` source:

```powershell
.venv\Scripts\python.exe -m apps.admin.scripts.generate_d1_wrangler_import_sql --years 2021
```

Then run selected generated files with Wrangler:

```powershell
npx wrangler d1 execute <your-d1-database-name> --remote --file=apps\admin\d1_import\2021_08_semester7.sql
```

If `D1_DATABASE_NAME` is set, the generator also writes `apps\admin\d1_import\run_wrangler_import.ps1`. Wrangler imports are faster than the REST migration script, but they still count toward D1 rows written. The generated SQL uses `INSERT OR IGNORE`, so rerunning a file is resume-safe.

For a fresh empty D1 database, you can generate one combined SQL import file:

```powershell
.venv\Scripts\python.exe -m apps.admin.scripts.generate_d1_wrangler_import_sql --database-name jntunresultsdb --single-file
npx wrangler d1 execute jntunresultsdb --remote --file=apps\admin\d1_import\full_import.sql
```

D1 cannot ingest a raw `.sqlite3` file directly; the import input is still a SQLite-compatible `.sql` dump.

If CGPA rows were already migrated before `student_academic_summary` existed, run this D1-only backfill:

```powershell
.venv\Scripts\python.exe -m apps.admin.scripts.add_academic_summary_to_d1
```

## Uploading Admin CSV Workspace To R2

Only the `csv/` processing workspace should be uploaded to R2:

```powershell
.venv\Scripts\python.exe -m apps.admin.scripts.upload_csv_to_r2
```

This script no longer uploads a `data/` folder.

## Admin Dashboard

Start the admin Flask app:

```powershell
python -m apps.admin.app
```

Open:

```text
http://localhost:5001/login
```

## Split App Entrypoints

The project now runs as two separate apps:

- Public results app: Next.js in `apps/public/`
- Admin engine app: `apps.admin.app:app`
- Public app assets live in `apps/public/public/`
- Admin Flask templates/assets live in `apps/admin/templates/` and `apps/admin/static/`
- Admin routes/utilities/migrations live in `apps/admin/`
- Admin scripts and generated D1 import SQL live in `apps/admin/scripts/` and `apps/admin/d1_import/`

Local public app:

```powershell
cd apps\public
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Local admin app:

```powershell
python -m apps.admin.app
```

Open:

```text
http://localhost:5001/admin
```

Render start commands:

```text
cd apps/public && npm install && npm run build && npm start
gunicorn apps.admin.app:app
```

Set these URLs when the apps are deployed separately:

```env
PUBLIC_APP_URL=https://your-public-domain.example
ADMIN_APP_URL=https://your-admin-domain.example
```

The split keeps public code, admin code, shared utilities, migrations, scripts, and generated import files under `apps/`.

## Data Synchronization Flow

```mermaid
graph TD
    pdf[JNTU Results PDF] -->|PDF to CSV| raw_csv[Raw CSV]
    raw_csv -->|Upload to Core Engine| clean_engine[Core Engine]

    clean_engine -->|Save archive/process files| r2_csv[R2 csv/{batch}/{semester}/]
    clean_engine -->|Sync final semester rows| d1_sem[D1 semester_results]

    clean_engine -->|Calculate SGPA summaries| csv_summary[R2 csv/{batch}/{sem_num}.csv]
    csv_summary -->|Merge CGPA| cgpa_engine[CGPA Aggregator]
    cgpa_engine -->|Sync official CGPA rows| d1_cgpa[D1 student_cgpa]

    cgpa_engine -->|Extract rankings| topper_engine[Toppers Engine]
    topper_engine -->|Save archive| r2_toppers[R2 csv/{batch}/top_10_students.csv]
    topper_engine -->|Sync rankings| d1_toppers[D1 toppers]

    d1_sem -->|Read| flask_app[Flask Web Portal]
    d1_cgpa -->|Read| flask_app
    d1_toppers -->|Read| flask_app
```

## Semester Mapping

- `1-1` -> `semester_number = 1`
- `1-2` -> `semester_number = 2`
- `2-1` -> `semester_number = 3`
- `2-2` -> `semester_number = 4`
- `3-1` -> `semester_number = 5`
- `3-2` -> `semester_number = 6`
- `4-1` -> `semester_number = 7`
- `4-2` -> `semester_number = 8`
- Honors/Minors -> `semester_number = 9`

## Adding A New Batch

For a new batch, add the prefix metadata in `apps/admin/utils/portal_db.py` under `BATCH_CONFIG`, then run the admin ingestion/report pipeline. Final portal data will sync to D1; `csv/` archive files will remain in R2.
