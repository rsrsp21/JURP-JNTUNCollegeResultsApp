# Shared Flask route handlers for the public and admin apps.

import os
import json
import re
import pandas as pd
import requests
import io
import shutil
import time
import uuid
from contextlib import contextmanager
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from flask import Flask, current_app, send_from_directory, jsonify, request, render_template, session, redirect, url_for
from common import ADMIN_ENV_PATH, ADMIN_TEMPLATE_DIR, PUBLIC_STATIC_DIR, ROOT_DIR, external_url
from utils.r2_storage import (
    is_r2_configured,
    download_prefix_to_folder,
    hash_folder_files,
    list_csv_files as list_r2_csv_files,
    list_keys_under as list_r2_keys_under,
    read_bytes_key as read_r2_bytes_key,
    delete_key as delete_r2_key,
    read_csv_text as read_r2_csv_text,
    read_text_key,
    upload_changed_files_to_prefix,
    write_text_key,
    write_csv_text as write_r2_csv_text
)
from utils import portal_db
from utils import d1_storage
from engine.logic import (
    get_batch, save_processed_csv, apply_revaluation,
    merge_all_semesters, calculate_supple_appearances,
    get_toppers_list, convert_pdf_to_csv, extract_tables_from_pdf
)

load_dotenv(ADMIN_ENV_PATH)

R2_CACHE_TTL_SECONDS = int(os.getenv("R2_CACHE_TTL_SECONDS", "300"))
_r2_text_cache = {}
_r2_dataframe_cache = {}
PUBLIC_STATIC_DIR = str(PUBLIC_STATIC_DIR)
ADMIN_TEMPLATE_DIR = str(ADMIN_TEMPLATE_DIR)

# --- App Initialization ---
app = Flask(
    __name__,
    static_folder=PUBLIC_STATIC_DIR,
    static_url_path='/public',
    template_folder=ADMIN_TEMPLATE_DIR,
)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'jntun_results_secret_key')


@app.context_processor
def inject_template_vars():
    return {
        'main_portal_url': 'https://jurp.vercel.app'
    }

ADMIN_USER = {
    "username": os.getenv("ADMIN_USERNAME"),
    "password": os.getenv("ADMIN_PASSWORD")
}

# Fixed regex: uses lookarounds instead of \b to handle digit-letter boundaries
ROLL_NUMBER_PATTERN = re.compile(r'(?<![A-Z0-9])\d{5}A[A-Z0-9]{4}(?![A-Z0-9])', re.IGNORECASE)

ACADEMIC_CHAT_KEYWORDS = {
    'result', 'results', 'semester', 'sem', 'sgpa', 'cgpa', 'grade', 'grades',
    'credit', 'credits', 'backlog', 'backlogs', 'fail', 'failed', 'supply',
    'supplementary', 'performance', 'subject', 'subjects', 'download', 'pdf',
    'toppers', 'topper', 'rank', 'branch', 'batch', 'regulation', 'improve',
    'best', 'weak', 'attention', 'honors', 'minor', 'roll', 'number', 'marks',
    'academic', 'history', 'portal', 'compare', 'comparison', 'vs', 'versus'
}

GREETING_KEYWORDS = {'hi', 'hello', 'hey', 'help'}

# --- Helper Functions ---

def get_batch_folder_from_id(student_id):
    return portal_db.batch_year_from_student_id(student_id)

def _cache_get(cache, key):
    item = cache.get(key)
    if not item:
        return None

    created_at, value = item
    if time.time() - created_at > R2_CACHE_TTL_SECONDS:
        cache.pop(key, None)
        return None

    return value

def _cache_set(cache, key, value):
    cache[key] = (time.time(), value)
    return value

def clear_r2_runtime_cache():
    _r2_text_cache.clear()
    _r2_dataframe_cache.clear()

def read_r2_text_or_none(key):
    if not is_r2_configured():
        return None
    cached = _cache_get(_r2_text_cache, key)
    if cached is not None:
        return cached

    try:
        _, content = read_text_key(key)
        return _cache_set(_r2_text_cache, key, content)
    except Exception:
        return None

def read_r2_dataframe(key):
    cached = _cache_get(_r2_dataframe_cache, key)
    if cached is not None:
        return cached.copy()

    content = read_r2_text_or_none(key)
    if content is None:
        return None

    df = pd.read_csv(io.StringIO(content), encoding='utf-8-sig')
    _cache_set(_r2_dataframe_cache, key, df)
    return df.copy()

def csv_workspace_prefixes_for_ingest(batches, semester, result_type):
    sem_folder = semester.replace("-", "_")
    prefixes = []

    for batch in batches:
        prefixes.append(f"{batch}/{sem_folder}")
        if result_type == "Standard Phase (Regular/Supply)":
            prefixes.append(f"{batch}/honors-minors")

    return prefixes


@contextmanager
def r2_csv_workspace(relative_prefixes=None):
    if not is_r2_configured():
        raise RuntimeError('Cloudflare R2 is not configured')

    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '.r2_work'))
    workspace = os.path.join(workspace_root, str(uuid.uuid4()))
    os.makedirs(workspace, exist_ok=True)
    try:
        prefixes = []
        if relative_prefixes:
            seen = set()
            for prefix in relative_prefixes:
                normalized = str(prefix).strip('/').replace('\\', '/')
                if normalized and normalized not in seen:
                    prefixes.append(normalized)
                    seen.add(normalized)

        if prefixes:
            for prefix in prefixes:
                local_folder = os.path.join(workspace, *prefix.split('/'))
                download_prefix_to_folder(f"csv/{prefix}", local_folder)
        else:
            download_prefix_to_folder('csv', workspace)

        previous_hashes = hash_folder_files(workspace)
        yield workspace
        upload_changed_files_to_prefix(workspace, 'csv', previous_hashes)
        clear_r2_runtime_cache()
    finally:
        shutil.rmtree(workspace, ignore_errors=True)

def get_student_cgpa_data(student_id):
    """Helper to get a single student's CGPA record from D1."""
    return portal_db.get_student_cgpa(student_id.strip().upper())

def get_student_ids_by_batch(batch_year):
    """Fetch student IDs for a specific batch from D1."""
    return portal_db.get_student_ids_by_batch(batch_year)

def get_student_semester_records(student_id):
    """Retrieve semester rows for one roll number from D1."""
    return portal_db.get_student_semester_records(student_id.strip().upper())

def get_student_semester_raw_records(student_id):
    """Retrieve raw semester rows for the browser-facing semester results page."""
    return portal_db.get_student_semester_raw_records(student_id.strip().upper())

def get_toppers_rag_data():
    """Load the top overall and branch toppers for all available batches."""
    return portal_db.get_toppers_rag_data()

def generate_toppers_from_r2_merged(year):
    df = read_r2_dataframe(f"csv/{year}/merged_cgpas2.csv")
    if df is None:
        return False, "merged_cgpas2.csv not found. Run CGPA calculation first."

    if "ID" not in df.columns or "Average CGPA" not in df.columns:
        return False, "merged_cgpas2.csv must contain ID and Average CGPA columns."

    df["Average CGPA"] = pd.to_numeric(df["Average CGPA"], errors="coerce").fillna(0)
    branch_map = {
        "1": "ce",
        "2": "eee",
        "3": "mec",
        "4": "ece",
        "5": "cse"
    }

    results = []
    overall_top = df.sort_values("Average CGPA", ascending=False).head(10)
    for _, row in overall_top.iterrows():
        results.append(["overall", row["ID"], row["Average CGPA"]])

    ids = df["ID"].astype(str)
    for branch_num, branch_name in branch_map.items():
        branch_students = df[ids.str.len().gt(7) & ids.str[7].eq(branch_num)]
        branch_top = branch_students.sort_values("Average CGPA", ascending=False).head(10)
        for _, row in branch_top.iterrows():
            results.append([branch_name, row["ID"], row["Average CGPA"]])

    output_df = pd.DataFrame(results, columns=["category", "roll_number", "cgpa"])
    csv_data = output_df.to_csv(index=False)
    write_text_key(f"csv/{year}/top_10_students.csv", csv_data)
    portal_db.replace_toppers_from_dataframe(year, output_df)
    clear_r2_runtime_cache()
    return True, "Successfully extracted toppers list from R2 merged CGPA data and synchronized it to D1."

def build_student_rag_context(student_id, question):
    """Build a compact roll-specific context packet for AI answers."""
    cgpa_data = get_student_cgpa_data(student_id)
    semester_records = get_student_semester_records(student_id)

    if not cgpa_data and not semester_records:
        return None

    failed_subjects = []
    low_grade_subjects = []
    for semester in semester_records.values():
        for subject in semester['subjects']:
            grade = str(subject.get('grade', '')).upper()
            subject_summary = {
                'semester': semester['label'],
                **subject
            }
            if grade in {'F', 'ABSENT'}:
                failed_subjects.append(subject_summary)
            elif grade in {'D', 'E'}:
                low_grade_subjects.append(subject_summary)

    context = {
        'retrievalBasis': 'Retrieved from Cloudflare D1 by exact roll number match',
        'question': question,
        'portal': {
            'currentNotification': get_latest_notification()
        },
        'student': {
            'rollNumber': student_id,
            'batch': cgpa_data.get('Batch') if cgpa_data else None,
            'regulation': cgpa_data.get('Regulation') if cgpa_data else None,
            'cgpa': cgpa_data.get('CGPA') if cgpa_data else None,
            'totalCredits': cgpa_data.get('Total Credits') if cgpa_data else None,
            'supplementaryAppearances': cgpa_data.get('Supplementary Appearances') if cgpa_data else None,
            'academicSummary': cgpa_data.get('academicSummary') if cgpa_data else None
        },
        'semesterSgpaAndCredits': {
            key: value for key, value in (cgpa_data or {}).items()
            if key not in {'ID', 'Batch', 'Regulation', 'Supplementary Appearances', 'academicSummary'}
        },
        'retrievedSemesters': semester_records,
        'derivedSignals': {
            'failedSubjects': failed_subjects,
            'lowGradeSubjects': low_grade_subjects,
            'failedSubjectCount': len(failed_subjects),
            'lowGradeSubjectCount': len(low_grade_subjects)
        }
    }

    if 'topper' in question.lower() or 'rank' in question.lower() or 'best' in question.lower():
        context['toppersData'] = get_toppers_rag_data()

    return context

def build_multi_student_rag_context(student_ids, question):
    """Build a context packet for comparing multiple students."""
    students_data = []

    for student_id in student_ids:
        cgpa_data = get_student_cgpa_data(student_id)
        semester_records = get_student_semester_records(student_id)

        if not cgpa_data and not semester_records:
            students_data.append({'rollNumber': student_id, 'error': 'No data found'})
            continue

        failed_subjects = []
        low_grade_subjects = []
        for semester in semester_records.values():
            for subject in semester['subjects']:
                grade = str(subject.get('grade', '')).upper()
                subject_summary = {'semester': semester['label'], **subject}
                if grade in {'F', 'ABSENT'}:
                    failed_subjects.append(subject_summary)
                elif grade in {'D', 'E'}:
                    low_grade_subjects.append(subject_summary)

        students_data.append({
            'rollNumber': student_id,
            'batch': cgpa_data.get('Batch') if cgpa_data else None,
            'regulation': cgpa_data.get('Regulation') if cgpa_data else None,
            'cgpa': cgpa_data.get('CGPA') if cgpa_data else None,
            'totalCredits': cgpa_data.get('Total Credits') if cgpa_data else None,
            'supplementaryAppearances': cgpa_data.get('Supplementary Appearances') if cgpa_data else None,
            'academicSummary': cgpa_data.get('academicSummary') if cgpa_data else None,
            'semesterSgpaAndCredits': {
                k: v for k, v in (cgpa_data or {}).items()
                if k not in {'ID', 'Batch', 'Regulation', 'Supplementary Appearances', 'academicSummary'}
            },
            'retrievedSemesters': semester_records,
            'derivedSignals': {
                'failedSubjects': failed_subjects,
                'lowGradeSubjects': low_grade_subjects,
                'failedSubjectCount': len(failed_subjects),
                'lowGradeSubjectCount': len(low_grade_subjects)
            }
        })

    context = {
        'retrievalBasis': f'Comparison context for {len(student_ids)} students retrieved from Cloudflare D1',
        'question': question,
        'portal': {
            'currentNotification': get_latest_notification()
        },
        'students': students_data
    }

    if 'topper' in question.lower() or 'rank' in question.lower() or 'best' in question.lower():
        context['toppersData'] = get_toppers_rag_data()

    return context

def extract_roll_number(text):
    """Extract the first roll number found in text."""
    match = ROLL_NUMBER_PATTERN.search(text or '')
    return match.group(0).upper() if match else None

def extract_all_roll_numbers(text):
    """Extract ALL roll numbers found in text."""
    matches = ROLL_NUMBER_PATTERN.findall(text or '')
    return [m.upper() for m in matches]

def is_relevant_academic_message(message):
    words = set(re.findall(r'[a-zA-Z]+', (message or '').lower()))
    has_roll_number = bool(extract_roll_number(message))
    has_academic_keyword = bool(words & ACADEMIC_CHAT_KEYWORDS)
    is_short_greeting = len(words) <= 3 and bool(words & GREETING_KEYWORDS)
    return has_roll_number or has_academic_keyword or is_short_greeting

def needs_student_result_context(message):
    words = set(re.findall(r'[a-zA-Z]+', (message or '').lower()))
    student_specific_keywords = {
        'cgpa', 'sgpa', 'grade', 'grades', 'credit', 'credits', 'backlog',
        'backlogs', 'fail', 'failed', 'supply', 'performance', 'subject',
        'subjects', 'semester', 'sem', 'best', 'weak', 'attention', 'improve',
        'honors', 'minor', 'compare', 'comparison', 'vs', 'versus'
    }
    general_keywords = {
        'toppers', 'topper', 'download', 'pdf', 'portal', 'help', 'how',
        'where', 'notification', 'notifications', 'released', 'feature',
        'features', 'login', 'admin'
    }

    if words & general_keywords and not words & student_specific_keywords:
        return False
    return bool(words & student_specific_keywords)

def get_latest_notification():
    """Dynamically read the latest notification from D1."""
    try:
        return portal_db.latest_notification_text()
    except Exception as e:
        print(f"Error loading notifications from D1: {e}")
    return None

def build_general_portal_context(question):
    context = {
        'retrievalBasis': 'General portal context; no student roll number was required or supplied',
        'question': question,
        'portal': {
            'name': 'JNTUK UCEN Results Portal',
            'availablePages': [
                {'name': 'CGPA', 'path': '/cgpa', 'purpose': 'Check overall CGPA and credits by roll number'},
                {'name': 'Semester-wise Results', 'path': '/semester_results', 'purpose': 'View semester grades, SGPA, credits, and download PDFs'},
                {'name': 'Toppers', 'path': '/toppers', 'purpose': 'View branch-wise and overall toppers'},
                {'name': 'Admin Login', 'path': '/login', 'purpose': 'Admin-only access'}
            ],
            'chatScope': 'Only answer questions about results, CGPA, SGPA, credits, backlogs, toppers, downloads, and portal navigation.',
            'currentNotification': get_latest_notification()
        }
    }

    if 'topper' in question.lower() or 'rank' in question.lower() or 'best' in question.lower():
        context['toppersData'] = get_toppers_rag_data()

    return context

def call_gemini_with_context(question, student_context, history=None, max_tokens=2000):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key or api_key == 'your_gemini_api_key_here':
        return None, 'GEMINI_API_KEY is not configured'

    model = get_configured_gemini_model()
    api_url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'

    system_instruction_text = f"""
You are "Results AI" for JNTUK UCEN.
Provide clear, detailed, and highly factual academic results analysis based on the retrieved context below.

### STRICT RULES:
1. **Scope Restriction**: ONLY answer questions directly related to academic results, grades, credits, backlogs, toppers, portal features, and academic performance/study improvement strategies.
   - Questions about backlog clearance, how to improve grades, or study advice based on their scores are fully in-scope.
   - If the user asks about completely off-topic subjects (e.g., coding, general history, general knowledge, math equations, or chit-chat), reply exactly: `"I only answer questions regarding academic results, grades, backlogs, and toppers."`
2. **No conversational filler**: Avoid long greetings, introductions, small talk, pleasantries, or generic celebratory/empathetic filler paragraphs. Start the response directly with the factual answer or analysis.
3. **Pristine Table Formatting**:
   - Always use clean Markdown tables with column headers when presenting semester lists, subjects, grades, or rankings.
   - For queries about specific semesters, best/highest performance, lowest/worst performance, or subject lists, you MUST always display the full subject table for that semester (including subject code, name, grade, and credits) in your response.
   - For low performance queries, clearly highlight low grades (e.g., F, D, or C) to show exactly where performance can be improved.
4. **Strict Ground Truth**: Use the retrieved data context as your absolute source of truth. Do not invent any facts, roll numbers, or grades. If data is missing, state it directly in one brief sentence.
5. **No Abrupt Truncation**: Keep your analytical insights and table formats robust, complete, and fully rendered.
6. **Released Results & Notifications**: If the user's question asks about what results were recently released or latest portal notifications, you MUST answer using the exact announcement string found in the "portal.currentNotification" field of the retrieved context below, rather than listing individual student grades or guessing from records.
7. **Conversational Context and Anaphora Resolution**: Pay close attention to pronouns and contextual references in follow-up queries (e.g., "it", "that semester", "its subjects", "in that one").
8. **Semester-Specific Follow-ups**: If the user asks for subjects/grades "in it" or "for that semester" immediately after you have discussed a specific semester (e.g., "semester 4-2" or "best semester"), you MUST resolve "it" to that specific semester and display the subjects for that semester.
9. **Multi-Student Comparison**: When the context contains a "students" array (multiple students), compare them side-by-side. Use comparison tables showing both students' CGPA, semester-wise SGPA, backlogs, credits, and any other relevant metrics. Clearly identify which student performs better in each category. If a student has an "error" field in the array, clearly state their data was not found.
10. **Responsibility**: You explain academic results clearly and responsibly. You never claim official university advice.
11. Consider spelling mistakes in inputs instead of directly saying invalid inputs. But roll numbers should be strictly matched.

---
### RETRIEVED DATA SCHEMA HELP:
**Single student queries:**
- `student`: Dictionary of student details (rollNumber, batch, regulation, cgpa, totalCredits, supplementaryAppearances).
- `semesterSgpaAndCredits`: Dictionary mapping semester names (e.g., "1-1", "1-2") to their SGPA and Credits.
- `retrievedSemesters`: Dictionary of semester records keyed by semester numbers ("1" to "9"). Each semester contains:
  - `label`: Friendly semester name (e.g., "1-1", "4-2", "Honors/Minor").
  - `subjects`: List of subjects, where each subject has `subjectCode`, `subjectName`, `grade`, and `credits`.
- `derivedSignals`: Calculated metrics including `failedSubjects` and `lowGradeSubjects`.

**Multi-student comparison queries:**
- `students`: Array of student objects. Each object has the same fields as above (rollNumber, batch, regulation, cgpa, totalCredits, supplementaryAppearances, semesterSgpaAndCredits, retrievedSemesters, derivedSignals).
- If a student has an `error` field, mention that their data was not found.

- `toppersData`: Official rankings for overall and individual branches.

---
### RETRIEVED DATA CONTEXT (Source of Truth):
{json.dumps(student_context, ensure_ascii=False)}
"""

    contents = []

    if history:
        for turn in history:
            role = turn.get('role', 'user')
            text = turn.get('text', '')
            contents.append({
                'role': role,
                'parts': [{'text': text}]
            })

    contents.append({
        'role': 'user',
        'parts': [{'text': question}]
    })

    gemini_payload = {
        'systemInstruction': {
            'parts': [{'text': system_instruction_text.strip()}]
        },
        'contents': contents,
        'generationConfig': {
            'temperature': 0.1,
            'topP': 0.95,
            'maxOutputTokens': max_tokens
        }
    }

    try:
        response = requests.post(
            api_url,
            headers={
                'Content-Type': 'application/json',
                'x-goog-api-key': api_key
            },
            json=gemini_payload,
            timeout=20
        )
        response.raise_for_status()
        data = response.json()
        parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
        answer = '\n'.join(part.get('text', '') for part in parts).strip()
        if not answer:
            return None, 'Gemini returned an empty response'
        return answer, None
    except requests.HTTPError as error:
        detail = ''
        response = error.response
        if response is not None:
            try:
                detail = response.json().get('error', {}).get('message', '')
            except ValueError:
                detail = response.text[:300]
        suffix = f' - {detail}' if detail else ''
        return None, f'Gemini API request failed: HTTP {response.status_code if response is not None else "unknown"}{suffix}'
    except requests.RequestException as error:
        return None, f'Gemini API request failed: {str(error)}'


def get_configured_gemini_model():
    configured_model = (os.environ.get('GEMINI_MODEL') or '').strip()
    model_aliases = {
        'gemini-3-flash': 'gemini-2.5-flash',
    }
    return model_aliases.get(configured_model, configured_model or 'gemini-2.5-flash')

# --- Page Serving Routes ---

@app.route('/cgpa')
def serve_cgpa():
    return send_from_directory(current_app.static_folder, 'cgpa.html')

@app.route('/toppers')
def serve_toppers():
    return send_from_directory(current_app.static_folder, 'toppers.html')

@app.route('/semester_results')
def serve_semester_results():
    return send_from_directory(current_app.static_folder, 'semester_results.html')

@app.route('/ask-ai')
def serve_ask_ai():
    return send_from_directory(current_app.static_folder, 'ask_ai.html')

# --- Authentication Routes ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        admin_username = ADMIN_USER.get('username')
        admin_password = ADMIN_USER.get('password')
        if admin_username and admin_password and username == admin_username and password == admin_password:
            session['logged_in'] = True
            return redirect(url_for('admin_panel'))
        else:
            error = 'Invalid credentials. Please try again.'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

# --- Secure Admin Route ---

@app.route('/admin')
def admin_panel():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    return render_template('admin.html')

# --- API Endpoints ---

@app.route('/api/notifications')
def serve_notifications():
    """Serve the list of notifications from D1."""
    try:
        return jsonify(portal_db.list_notifications())
    except Exception as e:
        print(f"Error serving notifications API: {e}")
    return jsonify([])

@app.route('/api/cgpa/<student_id>')
def serve_cgpa_data_api(student_id):
    """API endpoint to get a single student's full CGPA record."""
    student_data = get_student_cgpa_data(student_id)
    if student_data:
        return jsonify(student_data)
    return jsonify({'error': 'Student not found'}), 404

@app.route('/api/student-results/<student_id>')
def serve_student_results_api(student_id):
    """Return CGPA and all semester rows in one request."""
    student_id = student_id.strip().upper()
    result = portal_db.get_student_results(student_id)

    if not result.get('cgpaData') and not result.get('semesterData'):
        return jsonify({'error': 'Student not found'}), 404

    return jsonify(result)

@app.route('/api/semester/<int:semester>')
def serve_semester_data(semester):
    student_id = request.args.get('student_id', '')
    batch_folder = get_batch_folder_from_id(student_id)
    if not batch_folder:
        return 'Invalid student ID pattern', 400

    rows = portal_db.get_batch_semester_records(batch_folder, semester)
    content = portal_db.dataframe_to_csv_response(rows)
    if content:
        return current_app.response_class(content, mimetype='text/csv')
    return 'Semester data not found', 404

@app.route('/api/ask-ai', methods=['POST'])
def ask_ai():
    """Gemini-powered academic advisor for loaded student result data."""
    payload = request.get_json(silent=True) or {}
    question = str(payload.get('question', '')).strip()
    student_id = str(payload.get('studentId', '')).strip().upper()

    if not question:
        return jsonify({'error': 'Question is required'}), 400
    if not student_id:
        return jsonify({'error': 'Roll number is required'}), 400

    student_context = build_student_rag_context(student_id, question)
    if not student_context:
        return jsonify({'error': 'No result data found for this roll number'}), 404

    answer, error = call_gemini_with_context(question, student_context, max_tokens=2000)
    if error:
        print(f"Gemini Service Error: {error}")
        return jsonify({'error': 'Results AI is currently offline or undergoing maintenance. Please try again in a few moments.'}), 503

    return jsonify({'answer': answer, 'model': get_configured_gemini_model()})

@app.route('/api/chat-ai', methods=['POST'])
def chat_ai():
    """Home-page chat that retrieves result data based on roll number(s) in the message."""
    payload = request.get_json(silent=True) or {}
    message = str(payload.get('message', '')).strip()
    active_student_id = str(payload.get('activeStudentId', '')).strip().upper()
    history = payload.get('history', [])

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    if not is_relevant_academic_message(message):
        return jsonify({
            'answer': 'I can only help with JNTUK UCEN results, CGPA, SGPA, credits, backlogs, subjects, toppers, downloads, and portal navigation. Please ask a result-related question.'
        }), 200

    # Extract ALL roll numbers from the message
    all_roll_numbers = extract_all_roll_numbers(message)

    # Add active student only for single-student queries, not comparisons
    # If message already has 2+ roll numbers, don't inject activeStudentId
    if len(all_roll_numbers) < 2 and active_student_id and active_student_id not in all_roll_numbers:
        all_roll_numbers.insert(0, active_student_id)


    if len(all_roll_numbers) >= 2:
        # --- Multi-student comparison path ---
        context = build_multi_student_rag_context(all_roll_numbers, message)
        answer, error = call_gemini_with_context(message, context, history=history, max_tokens=2000)
        if error:
            print(f"Gemini Service Error: {error}")
            return jsonify({'error': 'Results AI is currently offline or undergoing maintenance. Please try again in a few moments.'}), 503
        return jsonify({
            'answer': answer,
            'model': get_configured_gemini_model()
        })

    elif len(all_roll_numbers) == 1:
        # --- Single student path ---
        student_id = all_roll_numbers[0]
        student_context = build_student_rag_context(student_id, message)
        if not student_context:
            return jsonify({
                'answer': f'I could not find result data for roll number {student_id}. Please check the roll number and try again.'
            }), 200
        answer, error = call_gemini_with_context(message, student_context, history=history, max_tokens=2000)
        if error:
            print(f"Gemini Service Error: {error}")
            return jsonify({'error': 'Results AI is currently offline or undergoing maintenance. Please try again in a few moments.'}), 503
        return jsonify({
            'answer': answer,
            'studentId': student_id,
            'model': get_configured_gemini_model()
        })

    else:
        # --- No roll number path ---
        if not needs_student_result_context(message):
            general_context = build_general_portal_context(message)
            answer, error = call_gemini_with_context(message, general_context, history=history, max_tokens=2000)
            if error:
                print(f"Gemini Service Error: {error}")
                return jsonify({'error': 'Results AI is currently offline or undergoing maintenance. Please try again in a few moments.'}), 503
            return jsonify({
                'answer': answer,
                'model': get_configured_gemini_model()
            })

        return jsonify({
            'answer': 'I can answer that after I know the student roll number. You can ask naturally, like: "What is the CGPA of 21031A0546?" or "Compare 21031A0546 and 21031A0545"'
        }), 200

@app.route('/api/batch-data/<batch_year>')
def get_batch_data(batch_year):
    """API endpoint that collects and returns all data for a given batch."""
    if not batch_year.isdigit() or len(batch_year) != 4:
        return jsonify({"error": "Invalid batch year format. Please use YYYY."}), 400

    all_batch_data = portal_db.get_batch_data(batch_year)
    if not all_batch_data:
        return jsonify({"error": f"No student data found for the batch year {batch_year}."}), 404

    return jsonify(all_batch_data)

@app.route('/api/toppers')
def get_toppers():
    try:
        year = request.args.get('year', '2021')
        toppers = portal_db.get_toppers_for_year(year)
        if toppers is None:
            return jsonify({
                'error': f'No data available for {year} batch'
            }), 404

        return jsonify(toppers)

    except Exception as e:
        print(f"Error processing toppers data: {str(e)}")
        return jsonify({
            'error': 'Internal server error'
        }), 500

# --- Native Admin API Routes ---

@app.route('/api/admin/ingest', methods=['POST'])
def admin_ingest_results():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    semester = request.form.get('semester')
    result_type = request.form.get('result_type')
    ignore_tags_str = request.form.get('ignore_tags', '')
    
    if not file or not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    if not semester or not result_type:
        return jsonify({'error': 'Semester and Result Type are required'}), 400
        
    ignore_list = [c.strip() for c in ignore_tags_str.split('\n') if c.strip()]
    
    try:
        # Parse CSV file in-memory
        csv_bytes = file.read()
        df = pd.read_csv(io.BytesIO(csv_bytes))
        
        if 'Subject Code' not in df.columns or 'ID' not in df.columns:
            return jsonify({'error': "Data Structure Mismatch: 'ID' and 'Subject Code' columns required."}), 400
            
        df['Batch'] = df['ID'].apply(get_batch)
        unique_batches = [b for b in df['Batch'].unique() if b != "Unknown" and int(b) >= 2021]
        
        if not unique_batches:
            return jsonify({'error': 'No student records from 2021 batch onwards identified in the file.'}), 400
            
        df = df[df['Batch'].isin(unique_batches)]
            
        saved_files = []
        logs = []

        sync_prefixes = csv_workspace_prefixes_for_ingest(unique_batches, semester, result_type)

        with r2_csv_workspace(sync_prefixes) as base_path:
            for batch in unique_batches:
                batch_df = df[df['Batch'] == batch].drop(columns=['Batch'])
                
                if result_type == "Standard Phase (Regular/Supply)":
                    paths = save_processed_csv(batch_df, batch, semester, base_path, ignore_list)
                    if isinstance(paths, list):
                        saved_files.extend(paths)
                        logs.append(f"Batch {batch}: Successfully processed Standard Phase.")
                else:
                    paths, msg = apply_revaluation(batch_df, batch, semester, base_path)
                    if paths is None:
                        logs.append(f"Batch {batch} revaluation failed: {msg}")
                    else:
                        saved_files.extend(paths)
                        logs.append(f"Batch {batch}: Successfully processed Revaluation.")
                    
        return jsonify({
            'success': True,
            'logs': logs,
            'files': [
                f"csv/{os.path.relpath(f, base_path).replace(os.sep, '/')}" if os.path.isabs(str(f)) and str(f).startswith(base_path)
                else f
                for f in saved_files
            ]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/generate-reports', methods=['POST'])
def admin_generate_reports():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    batch_year = request.form.get('batch_year')
    report_type = request.form.get('report_type', 'both')
    
    if not batch_year:
        return jsonify({'error': 'Batch year is required'}), 400

    batches = []
    if batch_year.strip().lower() == 'all':
        csv_files = list_r2_csv_files()
        for item in csv_files:
            parts = item.get('path', '').split('/')
            if len(parts) >= 2 and parts[0] == 'csv' and parts[1].isdigit() and int(parts[1]) >= 2021:
                batches.append(parts[1])
        batches = sorted(list(set(batches)))
    else:
        try:
            if int(batch_year) < 2021:
                return jsonify({'error': 'Report generation is restricted to 2021 batch and onwards.'}), 400
            batches = [batch_year.strip()]
        except ValueError:
            return jsonify({'error': 'Invalid batch year format. Use a 4-digit year or "all".'}), 400
            
    logs = []
    
    try:
        if not batches:
            batches = ['2021', '2022', '2023', '2024', '2025']

        if report_type == 'toppers':
            for b in batches:
                ok, msg = generate_toppers_from_r2_merged(b)
                if ok:
                    logs.append(f"Toppers: Successfully extracted Hall of Fame and branch rankings for batch {b}.")
                else:
                    logs.append(f"Toppers Error (Batch {b}): {msg}")
        else:
            with r2_csv_workspace(batches) as base_path:
                for b in batches:
                    if report_type in ['cgpa', 'both']:
                        cgpa_file, msg1 = merge_all_semesters(b, base_path)
                        if cgpa_file:
                            supple_file, msg2 = calculate_supple_appearances(b, base_path)
                            if supple_file:
                                logs.append(f"CGPA Master: Successfully generated and synchronized graduation report for batch {b}.")
                            else:
                                logs.append(f"CGPA Master: Aggregation succeeded but supplementary calculation failed for batch {b}: {msg2}")
                        else:
                            logs.append(f"CGPA Master Error (Batch {b}): {msg1}")
                            
                    if report_type in ['toppers', 'both']:
                        output_file, toppers_df = get_toppers_list(b, base_path)
                        if output_file:
                            logs.append(f"Toppers: Successfully extracted Hall of Fame and branch rankings for batch {b}.")
                        else:
                            logs.append(f"Toppers Error (Batch {b}): Failed to generate toppers list.")
                
        return jsonify({
            'success': True,
            'logs': logs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/convert-pdf', methods=['POST'])
def admin_convert_pdf():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    pdf_files = request.files.getlist('pdf_files')
    pdf_model = 'new'
    selected_cols_str = request.form.get('selected_cols', '')
    
    if not pdf_files or not pdf_files[0].filename:
        return jsonify({'error': 'No PDF files provided'}), 400
        
    required = [c.strip() for c in selected_cols_str.split(',') if c.strip()]
    if not required:
        required = None
        
    try:
        results = []
        for file in pdf_files:
            file.seek(0)
            df, stats = extract_tables_from_pdf(file, required_columns=required, model=pdf_model)
            
            if not df.empty and 'ID' in df.columns:
                df['Batch'] = df['ID'].apply(get_batch)
                df = df[df['Batch'].apply(lambda b: b != "Unknown" and int(b) >= 2021)]
                df = df.drop(columns=['Batch'])
                
            if df.empty:
                results.append({
                    'filename': file.filename,
                    'error': 'No student records from 2021 batch onwards found in the PDF.'
                })
            else:
                csv_data = df.to_csv(index=False)
                results.append({
                    'filename': file.filename,
                    'success': True,
                    'csv_data': csv_data,
                    'stats': {
                        'total_rows': len(df),
                        'total_pages': stats['total_pages'],
                        'columns_found': stats['columns_found']
                    },
                    'preview': df.to_dict(orient='records')
                })
                
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/csv-files', methods=['GET'])
def admin_list_csv_files():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    if not is_r2_configured():
        return jsonify({'error': 'Cloudflare R2 is not configured'}), 500

    try:
        return jsonify({'success': True, 'source': 'r2', 'files': list_r2_csv_files()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/csv-file', methods=['GET'])
def admin_get_csv_file():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    requested_path = request.args.get('path', '')
    if not is_r2_configured():
        return jsonify({'error': 'Cloudflare R2 is not configured'}), 500

    try:
        key, content = read_r2_csv_text(requested_path)
        rows = content.splitlines()
        return jsonify({
            'success': True,
            'source': 'r2',
            'path': key,
            'content': content,
            'line_count': len(rows),
            'size': len(content.encode('utf-8'))
        })
    except FileNotFoundError:
        return jsonify({'error': 'CSV file not found or not editable'}), 404
    except UnicodeDecodeError:
        return jsonify({'error': 'Unable to read this CSV as UTF-8 text'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/csv-file', methods=['PUT'])
def admin_save_csv_file():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    requested_path = data.get('path', '')
    content = data.get('content')
    if content is None:
        return jsonify({'error': 'CSV content is required'}), 400

    if not is_r2_configured():
        return jsonify({'error': 'Cloudflare R2 is not configured'}), 500

    try:
        key, size = write_r2_csv_text(requested_path, content)
        clear_r2_runtime_cache()
        return jsonify({
            'success': True,
            'source': 'r2',
            'path': key,
            'size': size,
            'message': 'CSV file saved successfully to Cloudflare R2'
        })
    except FileNotFoundError:
        return jsonify({'error': 'CSV file not found or not editable'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Database Browser ---
def _db_list_table_names():
    rows = d1_storage.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
    )
    return [row['name'] for row in rows]

@app.route('/api/admin/db-tables', methods=['GET'])
def admin_db_tables():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        tables = []
        for name in _db_list_table_names():
            count_rows = d1_storage.query(f'SELECT COUNT(*) AS c FROM "{name}"')
            tables.append({'name': name, 'rows': count_rows[0]['c'] if count_rows else 0})
        return jsonify({'success': True, 'tables': tables})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/db-table', methods=['GET'])
def admin_db_table():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    name = request.args.get('name', '')
    try:
        tables = _db_list_table_names()
        if name not in tables:
            return jsonify({'error': 'Unknown table'}), 404

        columns = [row['name'] for row in d1_storage.query(f'PRAGMA table_info("{name}")')]

        page = max(1, int(request.args.get('page', 1) or 1))
        per_page = min(100, max(10, int(request.args.get('per_page', 25) or 25)))
        search = (request.args.get('search') or '').strip()
        filter_col = (request.args.get('filter_col') or '').strip()
        filter_val = (request.args.get('filter_val') or '').strip()
        sort_col = (request.args.get('sort') or '').strip()
        sort_dir = 'DESC' if (request.args.get('dir') or '').lower() == 'desc' else 'ASC'

        where = []
        params = []
        if search:
            like = f'%{search}%'
            clauses = [f'CAST("{col}" AS TEXT) LIKE ?' for col in columns]
            where.append('(' + ' OR '.join(clauses) + ')')
            params.extend([like] * len(columns))
        if filter_col in columns and filter_val:
            where.append(f'CAST("{filter_col}" AS TEXT) LIKE ?')
            params.append(f'%{filter_val}%')

        where_sql = (' WHERE ' + ' AND '.join(where)) if where else ''
        order_sql = f' ORDER BY "{sort_col}" {sort_dir}' if sort_col in columns else ''
        offset = (page - 1) * per_page

        total_rows = d1_storage.query(f'SELECT COUNT(*) AS c FROM "{name}"{where_sql}', params)
        total = total_rows[0]['c'] if total_rows else 0
        rows = d1_storage.query(
            f'SELECT * FROM "{name}"{where_sql}{order_sql} LIMIT ? OFFSET ?',
            params + [per_page, offset]
        )

        return jsonify({
            'success': True,
            'table': name,
            'columns': columns,
            'rows': rows,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': max(1, (total + per_page - 1) // per_page)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Email Change Requests ---
@app.route('/api/admin/email-requests', methods=['GET'])
def admin_email_requests():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        rows = d1_storage.query(
            'SELECT student_id, name, email, pending_email FROM student_cgpa WHERE pending_email IS NOT NULL ORDER BY student_id'
        )
        return jsonify({'success': True, 'requests': rows})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/email-request', methods=['POST'])
def admin_resolve_email_request():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    roll_number = str(data.get('roll_number', '')).strip().upper()
    action = str(data.get('action', '')).strip().lower()
    if not re.fullmatch(r'[0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4}', roll_number):
        return jsonify({'error': 'Invalid roll number'}), 400
    if action not in ('approve', 'reject'):
        return jsonify({'error': 'Action must be approve or reject'}), 400

    try:
        if action == 'approve':
            d1_storage.execute(
                'UPDATE student_cgpa SET email = pending_email, pending_email = NULL WHERE student_id = ? AND pending_email IS NOT NULL',
                [roll_number]
            )
            message = f'Approved email change for {roll_number}.'
        else:
            d1_storage.execute(
                'UPDATE student_cgpa SET pending_email = NULL WHERE student_id = ?',
                [roll_number]
            )
            message = f'Rejected email change for {roll_number}.'
        portal_db.clear_runtime_cache()
        return jsonify({'success': True, 'roll_number': roll_number, 'message': message})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Student ID Image Review ---
ID_IMAGES_PREFIX = 'idsImages'
ID_IMAGE_ROLL_PATTERN = re.compile(r'^([0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4})\.(jpg|jpeg|png|webp)$', re.IGNORECASE)

@app.route('/api/admin/id-images', methods=['GET'])
def admin_list_id_images():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    if not is_r2_configured():
        return jsonify({'error': 'Cloudflare R2 is not configured'}), 500

    try:
        images = []
        for item in list_r2_keys_under(ID_IMAGES_PREFIX):
            if not item['name'].lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                continue
            match = ID_IMAGE_ROLL_PATTERN.match(item['name'])
            images.append({**item, 'roll_number': match.group(1).upper() if match else None})

        rolls = [image['roll_number'] for image in images if image['roll_number']]
        names_by_roll = {}
        if rolls:
            placeholders = ','.join('?' * len(rolls))
            for row in d1_storage.query(
                f'SELECT student_id, name, name_status FROM student_cgpa WHERE student_id IN ({placeholders})', rolls
            ):
                names_by_roll[row['student_id']] = {'name': row.get('name') or '', 'status': row.get('name_status') or 'pending'}

        for image in images:
            record = names_by_roll.get(image['roll_number'], {'name': '', 'status': 'pending'})
            image['db_name'] = record['name']
            image['status'] = record['status']

        pending = [image for image in images if image['status'] != 'approved']
        approved = d1_storage.query(
            "SELECT student_id, name FROM student_cgpa WHERE name_status = 'approved' AND name IS NOT NULL ORDER BY student_id"
        )
        return jsonify({'success': True, 'images': pending, 'approved': approved})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/approve-id-image', methods=['POST'])
def admin_approve_id_image():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    requested_path = data.get('path', '')
    name = ' '.join(str(data.get('name', '')).upper().split())
    if not requested_path.startswith(ID_IMAGES_PREFIX + '/'):
        return jsonify({'error': 'Invalid image path'}), 400
    if not re.fullmatch(r"[A-Z][A-Z .]{1,58}[A-Z.]", name):
        return jsonify({'error': 'Enter a valid name (letters, spaces, and dots only)'}), 400

    filename = requested_path.rsplit('/', 1)[-1]
    match = ID_IMAGE_ROLL_PATTERN.match(filename)
    if not match:
        return jsonify({'error': 'Could not extract a roll number from the image filename'}), 400
    roll_number = match.group(1).upper()

    try:
        d1_storage.execute(
            "UPDATE student_cgpa SET name = ?, name_status = 'approved' WHERE student_id = ?",
            [name, roll_number]
        )
        portal_db.clear_runtime_cache()
        return jsonify({'success': True, 'roll_number': roll_number, 'name': name,
                        'message': f'Approved {roll_number} as "{name}".'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/id-image', methods=['GET'])
def admin_get_id_image():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    requested_path = request.args.get('path', '')
    if not requested_path.startswith(ID_IMAGES_PREFIX + '/'):
        return jsonify({'error': 'Invalid image path'}), 400

    try:
        _, data, content_type = read_r2_bytes_key(requested_path)
        return app.response_class(data, mimetype=content_type)
    except FileNotFoundError:
        return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reject-id-image', methods=['POST'])
def admin_reject_id_image():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    requested_path = data.get('path', '')
    if not requested_path.startswith(ID_IMAGES_PREFIX + '/'):
        return jsonify({'error': 'Invalid image path'}), 400

    filename = requested_path.rsplit('/', 1)[-1]
    match = ID_IMAGE_ROLL_PATTERN.match(filename)
    if not match:
        return jsonify({'error': 'Could not extract a roll number from the image filename'}), 400
    roll_number = match.group(1).upper()

    try:
        d1_storage.execute("UPDATE student_cgpa SET name = NULL, name_status = 'rejected' WHERE student_id = ?", [roll_number])
        portal_db.clear_runtime_cache()
        delete_r2_key(requested_path)
        return jsonify({
            'success': True,
            'roll_number': roll_number,
            'message': f'Rejected ID image and cleared the name for {roll_number}.'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/add-notification', methods=['POST'])
def admin_add_notification():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    if not data or 'text' not in data or not data['text'].strip():
        return jsonify({'error': 'Notification text is required'}), 400
    
    text = data['text'].strip()
    is_new = bool(data.get('is_new', False))
    
    # Default to formatted today's date if not provided
    date_str = data.get('date', '').strip()
    if not date_str:
        import datetime
        now = datetime.datetime.now()
        months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"]
        date_str = f"{months[now.month - 1]} {now.day}, {now.year}"
        
    try:
        notifications = portal_db.add_notification(text, date_str, is_new)
        return jsonify({'success': True, 'notifications': notifications})
    except Exception as e:
        print(f"Error adding notification: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/delete-notification/<int:index>', methods=['DELETE'])
def admin_delete_notification(index):
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        notifications = portal_db.delete_notification(index)
        if notifications is not None:
            return jsonify({'success': True, 'notifications': notifications})
                
        return jsonify({'error': 'Notification not found'}), 404
    except Exception as e:
        print(f"Error deleting notification: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/toggle-blinking/<int:index>', methods=['POST'])
def admin_toggle_blinking(index):
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        notifications = portal_db.toggle_notification(index)
        if notifications is not None:
            return jsonify({'success': True, 'notifications': notifications})
                
        return jsonify({'error': 'Notification not found'}), 404
    except Exception as e:
        print(f"Error toggling blinking: {e}")
        return jsonify({'error': str(e)}), 500

# --- Static File and Main Route (Catch-all) ---
# This must be the last set of routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    static_folder = current_app.static_folder
    if path != "" and static_folder and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)
    else:
        return send_from_directory(static_folder, 'index.html')

# --- Run the App ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
