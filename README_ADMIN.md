# Results Ingestion & Administration Engine

This directory contains the JNTU Results Ingestion and Processing Engine. Built with **Streamlit**, it provides a premium administrative dashboard to clean, parse, and synchronize academic results directly into the `StudentResultPortal-1` web application.

---

## Features

1. **PDF → CSV Converter**: 
   - Supports both old-style flat tables (JNTU PDFs) and new-style alternating student-subject rows.
   - Extracts roll numbers, grades, credits, subject names, and internals.
2. **Core Processing Engine**:
   - Cleans results by filtering out non-calculative subject codes.
   - Standardizes grade scales depending on the batch year (supports `R20` with `A+` scale and `R23` with `S` scale).
   - Merges supplementary and regular phases automatically.
   - Saves all intermediate steps under `csv/`.
   - **Sync**: Automatically maps and writes finalized student grades to `data/semesters/{batch}/semester{sem_num}.csv`.
3. **CGPA Analysis**:
   - Weighted CGPA estimator that respects entry differences (e.g., Lateral Entry student calculations beginning at semester 3).
   - Generates supplementary counts represented by `*` signs.
   - **Sync**: Automatically updates `data/cgpa_data_{batch}.csv`.
4. **Hall of Fame**:
   - Extracts overall top 10 and branch-specific toppers (CSE, ECE, EEE, MEC, CE).
   - **Sync**: Automatically updates `data/toppers_{batch}.csv`.

---

## Setup & Running Instructions

### 1. Install Dependencies
Ensure you have the required libraries installed in your Python environment. Run the following command from the project root:

```bash
pip install -r requirements.txt
```

*(This will install `streamlit`, `pdfplumber`, `pandas`, and other required libraries.)*

### 2. Start the Admin Dashboard
Launch the Streamlit interface using:

```bash
streamlit run admin_engine/app.py
```

Streamlit will compile and open the interface automatically in your web browser (typically at `http://localhost:8501`).

---

## Data Synchronization Flow

Every time you execute a pipeline step inside the dashboard, results are automatically synced to the Flask portal database (`data/` folder).

```mermaid
graph TD
    pdf[JNTU Results PDF] -->|PDF to CSV| raw_csv[Raw CSV]
    raw_csv -->|Upload to Core Engine| clean_engine[Core Engine]
    
    clean_engine -->|Save Archive| arch[csv/{batch}/{semester}/]
    clean_engine -->|Auto Sync| flask_sem[data/semesters/{batch}/semester{sem_num}.csv]
    
    clean_engine -->|Calculate CGPA| cgpa_engine[CGPA Aggregator]
    cgpa_engine -->|Auto Sync| flask_cgpa[data/cgpa_data_{batch}.csv]
    
    cgpa_engine -->|Extract Rankings| topper_engine[Toppers Engine]
    topper_engine -->|Auto Sync| flask_toppers[data/toppers_{batch}.csv]

    flask_sem -->|Read| flask_app[Flask Web Portal]
    flask_cgpa -->|Read| flask_app
    flask_toppers -->|Read| flask_app
```

### Semester Mapping Directory:
- **1-1** $\rightarrow$ `semester1.csv`
- **1-2** $\rightarrow$ `semester2.csv`
- **2-1** $\rightarrow$ `semester3.csv`
- **2-2** $\rightarrow$ `semester4.csv`
- **3-1** $\rightarrow$ `semester5.csv`
- **3-2** $\rightarrow$ `semester6.csv`
- **4-1** $\rightarrow$ `semester7.csv`
- **4-2** $\rightarrow$ `semester8.csv`
- **Honors/Minors** $\rightarrow$ `semester9.csv`

---

## Ingesting a New Batch

If you are ingesting a brand-new batch of students (e.g., batch `2025` with roll number prefix `25031A` or lateral prefix `26035A`), you will need to add their mapping inside the Flask portal configuration:

1. Open `main.py`.
2. Locate the `id_prefix_mapping` dictionary at the top of the file:
   ```python
   id_prefix_mapping = {
       '21031A': ('data/cgpa_data_2021.csv', '2021-25', 'R20'),
       # ...
   }
   ```
3. Append the prefix, file path, batch year range, and syllabus regulation (e.g., `'25031A': ('data/cgpa_data_2025.csv', '2025-29', 'R23')`).
4. Run the Streamlit pipelines for batch `2025` — the data will sync and load instantly.
