import pandas as pd
import pdfplumber
import re
import os
import io
from utils.r2_storage import write_text_key

SEM_MAP = {
    "1-1": "1", "1-2": "2", "2-1": "3", "2-2": "4",
    "3-1": "5", "3-2": "6", "4-1": "7", "4-2": "8"
}

def get_grade_mapping(batch):
    """Returns mapping based on batch year."""
    try:
        year = int(batch)
    except (ValueError, TypeError):
        year = 0

    # Base mapping for common grades
    mapping = {
        'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5, 
        'F': 0, 'ABSENT': 0, 'AB': 0
    }

    if year >= 2023:
        mapping['S'] = 10
    elif 2021 <= year <= 2022:
        mapping['A+'] = 10
    else:
        # Fallback for other batches: Include both just in case
        mapping['S'] = 10
        mapping['A+'] = 10
        
    return mapping

def get_batch(student_id):
    """
    Extracts batch year from student ID.
    21031A... -> 2021
    22035A... -> 2021 (Lateral Entry)
    """
    try:
        student_id = str(student_id).upper()
        year_code = int(student_id[:2])
        entry_type = student_id[4] 
        batch = year_code - 1 if entry_type == '5' else year_code
        return f"20{batch}"
    except (ValueError, IndexError):
        return "Unknown"

def calculate_sgpa_summary(file_path, batch, semester, base_path):
    """
    Calculates SGPA and Credits, saving it as {sem_num}.csv in the batch folder.
    """
    sem_num = SEM_MAP.get(semester)
    if not sem_num: return None

    df = pd.read_csv(file_path)
    
    # Filter out non-calculative grades
    df = df[(df['Grade'] != 'COMPLE') & (df['Grade'] != 'NOT CO')]
    
    # Mapping
    grade_mapping = get_grade_mapping(batch)
    df['Grade Points'] = df['Grade'].map(grade_mapping).fillna(0)
    df['Credits'] = pd.to_numeric(df['Credits'], errors='coerce').fillna(0)
    df['Total Grade Points'] = df['Grade Points'] * df['Credits']

    # Aggregations
    summary = df.groupby('ID').agg({
        'Total Grade Points': 'sum',
        'Credits': 'sum'
    }).reset_index()

    # SGPA Calculation
    summary[f'SGPA_{sem_num}'] = (summary['Total Grade Points'] / summary['Credits']).fillna(0).round(2)
    
    # Fail logic: If any subject is F/AB/ABSENT, SGPA is 0
    fail_ids = df[df['Grade'].isin(['F', 'AB', 'ABSENT'])]['ID'].unique()
    summary.loc[summary['ID'].isin(fail_ids), f'SGPA_{sem_num}'] = 0
    
    # Final Columns
    summary.rename(columns={'Credits': f'Credits_{sem_num}'}, inplace=True)
    result = summary[['ID', f'SGPA_{sem_num}', f'Credits_{sem_num}']]
    
    # Save Path
    output_path = os.path.join(base_path, batch, f"{sem_num}.csv")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    result.to_csv(output_path, index=False)
    
    return output_path

def merge_supply_logic(initial_data, updated_data):
    """Applies supplementary merge logic."""
    mapping_dict = {
        (row["ID"], row["Subject Code"]): (row["Grade"], row["Credits"]) 
        for _, row in updated_data.iterrows() if pd.notna(row["Grade"])
    }

    def update_row(row):
        key = (row["ID"], row["Subject Code"])
        if key in mapping_dict and mapping_dict[key][0] != "ABSENT":
            return mapping_dict[key]
        return row["Grade"], row["Credits"]

    res = initial_data.apply(update_row, axis=1, result_type='expand')
    initial_data["Grade"] = res[0]
    initial_data["Credits"] = res[1]

    initial_keys = set(zip(initial_data["ID"], initial_data["Subject Code"]))
    new_rows = updated_data[~updated_data.apply(lambda r: (r['ID'], r['Subject Code']) in initial_keys, axis=1)]

    return pd.concat([initial_data, new_rows], ignore_index=True)

def save_honors_minors(df, batch, ignore_list, base_path):
    """Saves honors/minors data and combines them."""
    honors_filter = [c for c in ignore_list if c != "Subcode"]
    honors_df = df[df['Subject Code'].isin(honors_filter)]
    if honors_df.empty: return None
        
    honors_dir = os.path.join(base_path, batch, "honors-minors")
    os.makedirs(honors_dir, exist_ok=True)
    
    existing_files = [f for f in os.listdir(honors_dir) if f.endswith('.csv') and f[:-4].isdigit()]
    next_no = max([int(f[:-4]) for f in existing_files]) + 1 if existing_files else 1
    
    individual_path = os.path.join(honors_dir, f"{next_no}.csv")
    honors_df.to_csv(individual_path, index=False)
    
    all_files = [os.path.join(honors_dir, f) for f in os.listdir(honors_dir) if f.endswith('.csv') and f[:-4].isdigit()]
    combined_df = pd.concat([pd.read_csv(f) for f in all_files], ignore_index=True)
    combined_df.drop_duplicates(subset=['ID', 'Subject Code'], keep='last', inplace=True)
    
    combined_path = os.path.join(honors_dir, "combined_honors.csv")
    combined_df.to_csv(combined_path, index=False)
    return [individual_path, combined_path]

def save_processed_csv(df, batch, semester, base_path, ignore_list):
    """Saves files and triggers SGPA calculation summary."""
    sem_folder = semester.replace("-", "_")
    target_dir = os.path.join(base_path, batch, sem_folder)
    os.makedirs(target_dir, exist_ok=True)
    
    existing_files = [f for f in os.listdir(target_dir) if f.endswith('.csv') and f[:-4].isdigit()]
    n = max([int(f[:-4]) for f in existing_files]) + 1 if existing_files else 1
    saved_paths = []
    
    # 1. Honors Extraction
    honors_paths = None
    if n == 1:
        honors_paths = save_honors_minors(df, batch, ignore_list, base_path)
        if honors_paths: saved_paths.extend(honors_paths)

    # 2. Regular Filter & Save
    processed_df = df[~df['Subject Code'].isin(ignore_list)]
    file_n_path = os.path.join(target_dir, f"{n}.csv")
    processed_df.to_csv(file_n_path, index=False)
    saved_paths.append(file_n_path)
    
    latest_file_path = file_n_path

    # 3. Supply Merge Logic
    if n % 2 == 0 and n > 1:
        prev_file_path = os.path.join(target_dir, f"{n-1}.csv")
        if os.path.exists(prev_file_path):
            initial_data = pd.read_csv(prev_file_path)
            merged_df = merge_supply_logic(initial_data, processed_df)
            next_n = n + 1
            file_next_n_path = os.path.join(target_dir, f"{next_n}.csv")
            merged_df.to_csv(file_next_n_path, index=False)
            saved_paths.append(file_next_n_path)
            latest_file_path = file_next_n_path # The merged file is the latest

    # 4. Trigger SGPA Summary for the latest file
    sgpa_summary_path = calculate_sgpa_summary(latest_file_path, batch, semester, base_path)
    if sgpa_summary_path:
        saved_paths.append(f"SGPA Summary: {sgpa_summary_path}")
            
    # --- Auto Sync to Flask Portal ---
    sync_ok, sync_msg = sync_semester_to_flask(batch, semester, base_path)
    if sync_ok:
        saved_paths.append(f"Portal Sync: {sync_msg}")
    else:
        saved_paths.append(f"Portal Sync Error: {sync_msg}")

    if honors_paths:
        h_sync_ok, h_sync_msg = sync_semester_to_flask(batch, "honors-minors", base_path)
        if h_sync_ok:
            saved_paths.append(f"Portal Sync (Honors): {h_sync_msg}")
        else:
            saved_paths.append(f"Portal Sync (Honors) Error: {h_sync_msg}")

    return saved_paths

def apply_revaluation(rev_df, batch, semester, base_path):
    """
    Applies revaluation updates to existing regular/supplementary CSVs.
    Automatically detects the phase and recalculates SGPA and syncs.
    """
    sem_folder = semester.replace("-", "_")
    target_dir = os.path.join(base_path, batch, sem_folder)
    
    if not os.path.exists(target_dir):
        return None, f"Semester folder {target_dir} not found. Cannot revaluate."
        
    existing_files = [f for f in os.listdir(target_dir) if f.endswith('.csv') and f[:-4].isdigit()]
    if not existing_files:
        return None, "No existing result files found to update."
        
    nums = [int(f[:-4]) for f in existing_files]
    max_n = max(nums)
    
    mapping_dict = {
        (row["ID"], row["Subject Code"]): (row["Grade"], row["Credits"]) 
        for _, row in rev_df.iterrows() 
        if pd.notna(row.get("Grade")) and str(row.get("Grade")).strip().upper() not in ["NO CHANGE", "NOCHANGE"]
    }
    
    if not mapping_dict:
        return [], "No valid revaluation records found in uploaded file."

    def update_df(df_path):
        if not os.path.exists(df_path): return False
        df = pd.read_csv(df_path)
        
        def update_row(row):
            key = (row["ID"], row["Subject Code"])
            if key in mapping_dict:
                return mapping_dict[key]
            return row["Grade"], row["Credits"]
            
        res = df.apply(update_row, axis=1, result_type='expand')
        df["Grade"] = res[0]
        df["Credits"] = res[1]
        df.to_csv(df_path, index=False)
        return True

    updated_files = []
    
    if max_n == 1:
        # Regular Revaluation
        p = os.path.join(target_dir, "1.csv")
        if update_df(p):
            updated_files.append(f"Updated Regular File: {p}")
            sgpa_path = calculate_sgpa_summary(p, batch, semester, base_path)
            if sgpa_path: updated_files.append(f"Updated SGPA Summary: {sgpa_path}")
            
            # Sync update
            sync_ok, sync_msg = sync_semester_to_flask(batch, semester, base_path)
            updated_files.append(f"Portal Sync: {sync_msg}")
    else:
        # Supplementary Revaluation
        p_even = os.path.join(target_dir, f"{max_n - 1}.csv")
        if update_df(p_even):
            updated_files.append(f"Updated Supply File: {p_even}")
            
        p_odd = os.path.join(target_dir, f"{max_n}.csv")
        if update_df(p_odd):
            updated_files.append(f"Updated Merged File: {p_odd}")
            sgpa_path = calculate_sgpa_summary(p_odd, batch, semester, base_path)
            if sgpa_path: updated_files.append(f"Updated SGPA Summary: {sgpa_path}")
            
            # Sync update
            sync_ok, sync_msg = sync_semester_to_flask(batch, semester, base_path)
            updated_files.append(f"Portal Sync: {sync_msg}")
                
    return updated_files, "Success"

def merge_all_semesters(year, base_path):
    """
    Merges all semester SGPA summaries {1..8}.csv for a year 
    and calculates weighted Average CGPA.
    """
    folder_path = os.path.join(base_path, year)
    if not os.path.exists(folder_path):
        return None, "Year folder not found."

    files = sorted(
        [f for f in os.listdir(folder_path) if f.endswith(".csv") and f.split('.')[0].isdigit()],
        key=lambda x: int(x.split('.')[0])
    )

    if not files:
        return None, "No semester summary files ({1..8}.csv) found."

    dfs = [pd.read_csv(os.path.join(folder_path, file)) for file in files]
    
    merged_df = dfs[0]
    for i in range(1, len(dfs)):
        merged_df = pd.merge(merged_df, dfs[i], on="ID", how="outer")

    max_sem = max([int(f.split('.')[0]) for f in files])

    credit_cols = [f"Credits_{i}" for i in range(1, max_sem + 1) if f"Credits_{i}" in merged_df.columns]
    merged_df["Total Credits"] = merged_df[credit_cols].sum(axis=1)

    def calculate_average_cgpa(row):
        try:
            student_id = str(row["ID"])
            is_lateral = student_id[4] == "5" if len(student_id) > 4 else False
        except:
            is_lateral = False
            
        start_sem = 3 if is_lateral else 1
        
        cgpa_values = []
        credits_values = []
        
        for i in range(start_sem, max_sem + 1):
            s_col = f"SGPA_{i}"
            c_col = f"Credits_{i}"
            if s_col in row and c_col in row:
                cgpa_values.append(row[s_col])
                credits_values.append(row[c_col])
        
        if any(v == 0 for v in cgpa_values):
            return 0.0

        total_points = sum(s * c for s, c in zip(cgpa_values, credits_values))
        total_creds = sum(credits_values)
        return round(total_points / total_creds, 2) if total_creds > 0 else 0.0

    merged_df["Average CGPA"] = merged_df.apply(calculate_average_cgpa, axis=1)
    
    output_file = os.path.join(folder_path, "merged_cgpas1.csv")
    merged_df.to_csv(output_file, index=False)
    return output_file, "Success"

def calculate_supple_appearances(year, base_path):
    """
    Calculates '*' marks for each supplementary appearance and syncs CGPA to Flask.
    """
    base_dir = os.path.join(base_path, year)
    merged_file = os.path.join(base_dir, "merged_cgpas1.csv")
    
    if not os.path.exists(merged_file):
        return None, "merged_cgpas1.csv not found. Run CGPA merge first."

    folders = ['1_1', '1_2', '2_1', '2_2', '3_1', '3_2', '4_1', '4_2']
    supplementary_dfs = []

    for folder in folders:
        folder_path = os.path.join(base_dir, folder)
        if not os.path.exists(folder_path):
            continue
        
        for file_name in os.listdir(folder_path):
            if file_name.endswith(".csv"):
                num_part = file_name.split('.')[0]
                if num_part.isdigit() and int(num_part) % 2 == 0:
                    supplementary_dfs.append(pd.read_csv(os.path.join(folder_path, file_name)))

    merged_df = pd.read_csv(merged_file)
    
    def get_stars(row):
        tid = row['ID']
        count = 0
        for df in supplementary_dfs:
            if tid in df['ID'].values:
                count += 1
        return '*' * count

    merged_df['Supplementary Appearances'] = merged_df.apply(get_stars, axis=1)
    
    output_file = os.path.join(base_dir, "merged_cgpas2.csv")
    merged_df.to_csv(output_file, index=False)

    # --- Auto Sync CGPA Master Report to Flask Portal ---
    sync_ok, sync_msg = sync_cgpa_to_flask(year, base_path)
    print(f"CGPA Sync Status: {sync_msg}")

    return output_file, "Success"

def get_toppers_list(year, base_path):
    """
    Identifies top 10 students overall and per branch, and syncs toppers to Flask.
    """
    input_file = os.path.join(base_path, year, "merged_cgpas2.csv")
    if not os.path.exists(input_file):
        return None, "merged_cgpas2.csv not found. Please run CGPA calculation first."

    df = pd.read_csv(input_file)
    
    branch_map = {
        "1": "ce",
        "2": "eee",
        "3": "mec",
        "4": "ece",
        "5": "cse"
    }

    results = []

    # Overall Top 10
    overall_top = df.sort_values('Average CGPA', ascending=False).head(10)
    for _, row in overall_top.iterrows():
        results.append(["overall", row['ID'], row['Average CGPA']])

    # Branch-wise Top 10
    for branch_num, branch_name in branch_map.items():
        branch_students = df[df['ID'].astype(str).str[7] == branch_num]
        branch_top = branch_students.sort_values('Average CGPA', ascending=False).head(10)
        
        for _, row in branch_top.iterrows():
            results.append([branch_name, row['ID'], row['Average CGPA']])

    output_df = pd.DataFrame(results, columns=["category", "roll_number", "cgpa"])
    output_file = os.path.join(base_path, year, "top_10_students.csv")
    output_df.to_csv(output_file, index=False)

    # --- Auto Sync Toppers to Flask Portal ---
    sync_ok, sync_msg = sync_toppers_to_flask(year, base_path)
    print(f"Toppers Sync Status: {sync_msg}")
    
    return output_file, output_df


# ─── PDF TO CSV CONVERSION ─────────────────────────────────────────────────────

_ROLL_PATTERN = re.compile(r'\b(\d{2}\d{3}[A-Za-z]\d{4})\b')

def _open_pdf(pdf_source):
    """Opens a PDF from a file path or file-like object."""
    if isinstance(pdf_source, str):
        return pdfplumber.open(pdf_source)
    else:
        pdf_bytes = pdf_source.read()
        pdf_source.seek(0)
        return pdfplumber.open(io.BytesIO(pdf_bytes))

def _extract_raw_rows(pdf):
    """Extracts all raw table rows from every page of the PDF."""
    all_rows = []
    page_stats = []
    
    for page_num, page in enumerate(pdf.pages, 1):
        tables = page.extract_tables({
            "vertical_strategy": "lines_strict",
            "horizontal_strategy": "lines_strict",
            "snap_tolerance": 5,
            "join_tolerance": 5,
            "edge_min_length": 10,
            "min_words_vertical": 1,
            "min_words_horizontal": 1,
        })
        
        if not tables:
            tables = page.extract_tables({
                "vertical_strategy": "text",
                "horizontal_strategy": "text",
                "snap_tolerance": 8,
                "join_tolerance": 8,
            })
        
        page_row_count = 0
        for table in tables:
            if table and len(table) > 0:
                for row in table:
                    if row and any(cell and str(cell).strip() for cell in row):
                        cleaned = [
                            str(cell).strip().replace('\n', ' ') if cell else ''
                            for cell in row
                        ]
                        all_rows.append(cleaned)
                        page_row_count += 1
        
        page_stats.append({"page": page_num, "rows_extracted": page_row_count})
    
    return all_rows, page_stats

def _find_roll_number(row):
    """Checks if a row contains a JNTU roll number. Returns it or None."""
    for cell in row:
        match = _ROLL_PATTERN.search(str(cell))
        if match:
            return match.group(1).upper()
    return None

def _is_header_row(row):
    """Checks if a row is the table header (SlNo, SubCode, SubName, etc.)."""
    header_keywords = ['slno', 'subcode', 'subname', 'grade', 'credits', 'im', 'res']
    text = ' '.join(str(c).lower() for c in row)
    return sum(1 for kw in header_keywords if kw in text) >= 3

def _is_info_row(row):
    """Checks if a row is a college/branch info header (non-data)."""
    text = ' '.join(str(c).strip() for c in row if c)
    info_patterns = [
        'B.Tech', 'UNIVERSITY', 'COLLEGE', 'ENGINEERING', 
        'Semester', 'Regular', 'Supplementary', 'CIVIL', 'CSE',
        'ECE', 'EEE', 'MECHANICAL', 'MECH', 'IT '
    ]
    return any(p.lower() in text.lower() for p in info_patterns) and not _ROLL_PATTERN.search(text)

def _is_subject_data_row(row):
    """Checks if a row contains subject data."""
    cells = [str(c).strip() for c in row if str(c).strip()]
    if len(cells) < 3:
        return False
    subcode_pattern = re.compile(r'[A-Za-z]?\d{5,6}[A-Za-z]{0,2}')
    has_subcode = any(subcode_pattern.search(c) for c in cells)
    valid_grades = {'S', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'AB', 'ABSENT', 'P', 'COMPLE', 'NOT CO'}
    has_grade = any(c.upper() in valid_grades for c in cells)
    return has_subcode or has_grade

def extract_tables_from_pdf(pdf_source, required_columns=None, model="new"):
    """Extracts tables from a JNTU results PDF and returns a cleaned DataFrame using the coordinate alignment model."""
    with _open_pdf(pdf_source) as pdf:
        total_pages = len(pdf.pages)
    
    with _open_pdf(pdf_source) as pdf2:
        df, page_stats = _extract_new_model_from_text(pdf2)
    method_name = "new_model_parser"
    
    if df.empty:
        return pd.DataFrame(), {
            "total_pages": total_pages,
            "total_rows": 0,
            "method": method_name,
            "page_stats": page_stats,
            "message": "Could not parse student records from the PDF."
        }
    
    if required_columns:
        available = [col for col in required_columns if col in df.columns]
        if available:
            df = df[available]
    
    stats = {
        "total_pages": total_pages,
        "total_rows": len(df),
        "columns_found": list(df.columns),
        "method": method_name,
        "page_stats": page_stats,
        "message": f"Successfully extracted {len(df)} rows across {total_pages} pages."
    }
    
    return df, stats

def _extract_old_model(all_rows):
    """Old Model PDF parser."""
    col_mappings = {
        'SNO': None, 'S.NO': None, 'SL.NO': None, 'SLNO': None, 'S NO': None, 'SL NO': None,
        'HTNO': 'ID', 'HT NO': 'ID', 'HTNO.': 'ID', 'HALL TICKET NO': 'ID',
        'HALLTICKETNO': 'ID', 'ROLL NO': 'ID', 'ROLL NUMBER': 'ID',
        'SUBCODE': 'Subject Code', 'SUB CODE': 'Subject Code',
        'SUBJECT CODE': 'Subject Code', 'SUBJECTCODE': 'Subject Code',
        'SUBNAME': 'Subject Name', 'SUB NAME': 'Subject Name',
        'SUBJECT NAME': 'Subject Name', 'SUBJECTNAME': 'Subject Name',
        'INTERNALS': 'Internal Marks', 'INTERNAL': 'Internal Marks',
        'INTERNAL MARKS': 'Internal Marks', 'IM': 'Internal Marks',
        'GRADE': 'Grade', 'GRD': 'Grade',
        'CREDITS': 'Credits', 'CREDIT': 'Credits', 'CR': 'Credits',
        'EXTERNAL': 'External Marks', 'EXT': 'External Marks',
        'EXTERNAL MARKS': 'External Marks',
        'TOTAL': 'Total', 'TOT': 'Total', 'TOTAL MARKS': 'Total',
        'RESULT': 'Result', 'RES': 'Result', 'STATUS': 'Result',
    }
    
    header_idx = None
    header_keywords = ['htno', 'subcode', 'subname', 'grade', 'credits', 'internals', 'sno']
    
    for i, row in enumerate(all_rows[:15]):
        text = ' '.join(str(c).lower().strip() for c in row if c)
        match_count = sum(1 for kw in header_keywords if kw in text)
        if match_count >= 3:
            header_idx = i
            break
    
    if header_idx is None:
        return pd.DataFrame()
    
    raw_headers = [str(c).strip() for c in all_rows[header_idx]]
    normalized_headers = []
    for h in raw_headers:
        upper = h.upper().strip()
        if upper in col_mappings:
            normalized_headers.append(col_mappings[upper])
        else:
            normalized_headers.append(h if h else None)
    
    data_rows = all_rows[header_idx + 1:]
    records = []
    
    for row in data_rows:
        cells = [str(c).strip() if c else '' for c in row]
        if all(c == '' for c in cells):
            continue
        
        text = ' '.join(cells).lower()
        if any(kw in text for kw in ['university', 'college', 'b.tech', 'semester', 'engineering']):
            continue
        if sum(1 for kw in header_keywords if kw in text) >= 3:
            continue
        
        while len(cells) < len(normalized_headers):
            cells.append('')
        cells = cells[:len(normalized_headers)]
        
        record = {}
        for header, cell in zip(normalized_headers, cells):
            if header is not None:
                record[header] = cell
        
        if record.get('ID', '').strip():
            records.append(record)
    
    if not records:
        return pd.DataFrame()
    
    return pd.DataFrame(records)

def _get_visual_lines(page):
    """Extracts text from a page grouped by Y-coordinate."""
    words = page.extract_words()
    if not words:
        return []
    words.sort(key=lambda w: w['top'])
    
    lines = []
    current_line = []
    current_y = words[0]['top']
    
    for w in words:
        if abs(w['top'] - current_y) <= 4:
            current_line.append(w)
        else:
            current_line.sort(key=lambda x: x['x0'])
            lines.append(" ".join(x['text'] for x in current_line))
            current_line = [w]
            current_y = w['top']
            
    if current_line:
        current_line.sort(key=lambda x: x['x0'])
        lines.append(" ".join(x['text'] for x in current_line))
        
    return lines

def _extract_new_model_from_text(pdf):
    """New Model PDF parser using text extraction."""
    records = []
    page_stats = []
    current_id = None
    pending_line = ""
    
    id_line_pattern = re.compile(r'\b(\d{2}\d{3}[A-Za-z]\d{4})\b')
    subcode_start_pattern = re.compile(r'^\s*(?:\d+\s+)?([A-Za-z]?\d{5,7}[A-Za-z]{0,2})\b')
    
    subject_line_pattern = re.compile(
        r'^\s*(?:\d+\s+)?'
        r'([A-Za-z]?\d{5,7}[A-Za-z]{0,2})\s+'
        r'(.*?)\s*'
        r'(-?\d+|---)\s+'
        r'([A-Za-z\-]+)\s+'
        r'([A-Za-z0-9\+\-]+|ABSENT|COMPLE|NOT CO|No Change|--- No Change ---|---)\s+'
        r'(\d+\.?\d*|---)\s*$',
        re.IGNORECASE
    )
    
    combined_pattern = re.compile(
        r'^\s*(?:\d+\s+)?'                  # Optional SNo
        r'(\d{2}\d{3}[A-Za-z]\d{4})\s+'     # Htno (Roll Number)
        r'([A-Za-z0-9\-]{5,10})\s+'         # Subcode
        r'(.*?)\s+'                         # Subname
        r'(-?\d+|---)\s+'                   # Internals (allows negative e.g. -4)
        r'([A-Za-z0-9\+\-]+|ABSENT|COMPLE|NOT CO|No Change|--- No Change ---)\s+' # Grade
        r'(\d+\.?\d*|---)\s*$',             # Credits
        re.IGNORECASE
    )
    
    subject_fallback_pattern = re.compile(
        r'^\s*(?:\d+\s+)?'
        r'([A-Za-z]?\d{5,7}[A-Za-z]{0,2})\s+'
        r'(.*?)\s+'
        r'([A-Za-z0-9\+\-]+|ABSENT|COMPLE|NOT CO|No Change|--- No Change ---)\s+'
        r'(\d+\.?\d*|---)\s*$',
        re.IGNORECASE
    )

    
    for page_num, page in enumerate(pdf.pages, 1):
        lines = _get_visual_lines(page)
        if not lines:
            page_stats.append({"page": page_num, "rows_extracted": 0})
            continue
        
        page_row_count = 0
        just_added_record = False
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Filter out noise lines (headers, footers, dates, line separators)
            line_upper = line.upper()
            noise_keywords = [
                'JAWAHARLAL NEHRU', 'TECHNOLOGICAL UNIVERSITY', 'KAKINADA', 
                'CONTROLLER OF EXAMINATIONS', 'DATE:', 'DATE :',
                'COLLEGE NAME:', 'COLLEGE:', 'RESULTS OF', 'RESULTS FOR',
                'SNO ', 'SLNO', 'HTNO', 'SUBCODE', 'SUBNAME', 'INTERNALS', 'GRADE', 'CREDITS',
                'PAGE ', 'PAGE:', 'EXAMINATIONS', 'UNIVERSITY COLLEGE',
                'REVALUATION', 'RECOUNTING', 'LAST DATE', 'NOTE', 'CHALLENGE', 'DISCLAIMER'
            ]
            if any(kw in line_upper for kw in noise_keywords):
                just_added_record = False
                continue
            if line.startswith('*') or line_upper.startswith('SUBJECT') or line_upper == 'SUBJECT.':
                just_added_record = False
                continue
            if re.match(r'^[\s\-_*\.]+$', line):
                just_added_record = False
                continue
            
            if just_added_record:
                id_match_temp = id_line_pattern.search(line)
                is_new_subj_temp = subcode_start_pattern.search(line)
                if not id_match_temp and not is_new_subj_temp:
                    if records:
                        records[-1]['Subject Name'] = (records[-1]['Subject Name'] + " " + line).strip()
                    just_added_record = False
                    continue
                else:
                    just_added_record = False
            
            # Try to match a combined line first
            combined_match = combined_pattern.match(line)
            if combined_match:
                current_id = combined_match.group(1).upper()
                grade_val = combined_match.group(5).upper()
                result_val = 'PASSED' if grade_val not in ['F', 'ABSENT', 'FAIL', '---'] else 'FAILED'
                records.append({
                    'ID': current_id,
                    'Subject Code': combined_match.group(2).upper(),
                    'Subject Name': combined_match.group(3).strip(),
                    'Internal Marks': combined_match.group(4),
                    'Result': result_val,
                    'Grade': grade_val,
                    'Credits': combined_match.group(6)
                })
                page_row_count += 1
                just_added_record = False
                continue
            
            id_match = id_line_pattern.search(line)
            if id_match:
                current_id = id_match.group(1).upper()
                line = id_line_pattern.sub("", line).strip()
                if not line:
                    pending_line = ""
                    continue
            
            is_new_subject = subcode_start_pattern.search(line)
            if is_new_subject:
                pending_line = line
            else:
                if pending_line:
                    pending_line += " " + line
                else:
                    # Ignore the line if there is no active subject line being reconstructed (it is likely a header/footer)
                    continue
            
            subj_match = subject_line_pattern.match(pending_line)
            if subj_match:
                if id_match and not current_id:
                     current_id = id_match.group(1).upper()
                if current_id:
                    records.append({
                        'ID': current_id,
                        'Subject Code': subj_match.group(1).upper(),
                        'Subject Name': subj_match.group(2).strip(),
                        'Internal Marks': subj_match.group(3),
                        'Result': subj_match.group(4).upper(),
                        'Grade': subj_match.group(5).upper(),
                        'Credits': subj_match.group(6)
                    })
                    page_row_count += 1
                pending_line = ""
                just_added_record = True
                continue
            
            fallback_match = subject_fallback_pattern.match(pending_line)
            if fallback_match:
                if current_id:
                    records.append({
                        'ID': current_id,
                        'Subject Code': fallback_match.group(1).upper(),
                        'Subject Name': fallback_match.group(2).strip(),
                        'Internal Marks': '',
                        'Result': '',
                        'Grade': fallback_match.group(3).upper(),
                        'Credits': fallback_match.group(4)
                    })
                    page_row_count += 1
                pending_line = ""
                just_added_record = True
                continue
        
        page_stats.append({"page": page_num, "rows_extracted": page_row_count})
    
    if not records:
        return pd.DataFrame(), page_stats
    return pd.DataFrame(records), page_stats

def convert_pdf_to_csv(pdf_source, output_path=None, required_columns=None, model="old"):
    """Full pipeline: Extract tables from PDF → Clean → Save as CSV."""
    df, stats = extract_tables_from_pdf(pdf_source, required_columns, model=model)
    if df.empty:
        return None, df, stats
    
    saved_path = None
    if output_path:
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        df.to_csv(output_path, index=False)
        saved_path = output_path
        stats["saved_to"] = saved_path
    
    return saved_path, df, stats


# ─── SYNC LOGIC FOR FLASK STUDENTRESULTPORTAL-1 INTEGRATION ──────────────────────

def sync_semester_to_flask(batch, semester, base_path):
    """
    Finds the latest processed semester CSV in base_path and copies it 
    to Cloudflare R2 as data/semesters/{batch}/semester{sem_num}.csv.
    """
    # Mapping semesters
    mapping = {
        "1-1": "1", "1-2": "2", "2-1": "3", "2-2": "4",
        "3-1": "5", "3-2": "6", "4-1": "7", "4-2": "8",
        "honors-minors": "9"
    }
    sem_num = mapping.get(semester)
    if not sem_num:
        return False, f"Unknown semester mapping for {semester}"
        
    source_file = None
    if semester == "honors-minors":
        source_file = os.path.join(base_path, batch, "honors-minors", "combined_honors.csv")
    else:
        sem_folder = semester.replace("-", "_")
        target_dir = os.path.join(base_path, batch, sem_folder)
        if os.path.exists(target_dir):
            existing_files = [f for f in os.listdir(target_dir) if f.endswith('.csv') and f[:-4].isdigit()]
            if existing_files:
                max_n = max([int(f[:-4]) for f in existing_files])
                source_file = os.path.join(target_dir, f"{max_n}.csv")
                
    if not source_file or not os.path.exists(source_file):
        return False, f"Source processed file not found at {source_file}"
        
    target_key = f"data/semesters/{batch}/semester{sem_num}.csv"
    try:
        with open(source_file, 'r', encoding='utf-8-sig', newline='') as f:
            write_text_key(target_key, f.read())
        return True, f"Successfully synchronized semester {semester} to R2 {target_key}"
    except Exception as e:
        return False, f"Failed to sync semester file to R2: {str(e)}"

def sync_cgpa_to_flask(batch, base_path):
    """
    Reads merged_cgpas2.csv, renames columns to match the Flask app's cgpa_data_{batch}.csv format,
    and writes it to Cloudflare R2 under data/.
    """
    source_file = os.path.join(base_path, batch, "merged_cgpas2.csv")
    if not os.path.exists(source_file):
        return False, f"CGPA source file not found at {source_file}"
        
    try:
        df = pd.read_csv(source_file)
        
        rename_map = {
            "SGPA_1": "1-1", "Credits_1": "Credits_1-1",
            "SGPA_2": "1-2", "Credits_2": "Credits_1-2",
            "SGPA_3": "2-1", "Credits_3": "Credits_2-1",
            "SGPA_4": "2-2", "Credits_4": "Credits_2-2",
            "SGPA_5": "3-1", "Credits_5": "Credits_3-1",
            "SGPA_6": "3-2", "Credits_6": "Credits_3-2",
            "SGPA_7": "4-1", "Credits_7": "Credits_4-1",
            "SGPA_8": "4-2", "Credits_8": "Credits_4-2",
            "Average CGPA": "CGPA"
        }
        df.rename(columns=rename_map, inplace=True)
        
        standard_cols = [
            "ID", "1-1", "Credits_1-1", "1-2", "Credits_1-2",
            "2-1", "Credits_2-1", "2-2", "Credits_2-2",
            "3-1", "Credits_3-1", "3-2", "Credits_3-2",
            "4-1", "Credits_4-1", "4-2", "Credits_4-2",
            "Total Credits", "CGPA", "Supplementary Appearances"
        ]
        
        for col in standard_cols:
            if col not in df.columns:
                df[col] = ""
                
        df = df[standard_cols]
        target_key = f"data/cgpa_data_{batch}.csv"
        write_text_key(target_key, df.to_csv(index=False))
        return True, f"Successfully synchronized CGPA master report to R2 {target_key}"
    except Exception as e:
        return False, f"Failed to sync CGPA to R2: {str(e)}"

def sync_toppers_to_flask(batch, base_path):
    """
    Copies top_10_students.csv to Cloudflare R2 as data/toppers_{batch}.csv.
    """
    source_file = os.path.join(base_path, batch, "top_10_students.csv")
    if not os.path.exists(source_file):
        return False, f"Toppers source file not found at {source_file}"
        
    target_key = f"data/toppers_{batch}.csv"
    try:
        with open(source_file, 'r', encoding='utf-8-sig', newline='') as f:
            write_text_key(target_key, f.read())
        return True, f"Successfully synchronized toppers list to R2 {target_key}"
    except Exception as e:
        return False, f"Failed to sync toppers to R2: {str(e)}"
