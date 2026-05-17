# main.py (Corrected and Consolidated Version)

import os
import csv
import json
import re
import pandas as pd
import requests
from dotenv import load_dotenv
from flask import Flask, send_from_directory, jsonify, request, render_template, session, redirect, url_for, send_file

load_dotenv()

# --- App Initialization ---
app = Flask(__name__, static_folder='public')
app.secret_key = 'jntun_results_secret_key'

ADMIN_USER = {
    "username": "admin",
    "password": "jntun@321"  # Change this in a real application
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

# --- Data Mappings and Configuration ---
id_prefix_mapping = {
    '21031A': ('data/cgpa_data_2021.csv', '2021-25', 'R20'),
    '22035A': ('data/cgpa_data_2021.csv', '2021-25', 'R20'),
    '22031A': ('data/cgpa_data_2022.csv', '2022-26', 'R20'),
    '23035A': ('data/cgpa_data_2022.csv', '2022-26', 'R20'),
    '23031A': ('data/cgpa_data_2023.csv', '2023-27', 'R23'),
    '24035A': ('data/cgpa_data_2023.csv', '2023-27', 'R23'),
    '24031A': ('data/cgpa_data_2024.csv', '2024-28', 'R23'),
    '25035A': ('data/cgpa_data_2024.csv', '2024-28', 'R23'),
}

# --- Helper Functions ---

def get_batch_folder_from_id(student_id):
    if student_id.startswith(('21031A', '22035A')): return '2021'
    if student_id.startswith(('22031A', '23035A')): return '2022'
    if student_id.startswith(('23031A', '24035A')): return '2023'
    if student_id.startswith(('24031A', '25035A')): return '2024'
    return None

def parse_csv_data(csv_string):
    data = []
    lines = csv_string.strip().split('\n')
    if not lines or not lines[0]: return data
    headers = [h.strip() for h in lines[0].split(',')]
    for line in lines[1:]:
        values = [v.strip() for v in line.split(',')]
        if len(values) == len(headers):
            data.append(dict(zip(headers, values)))
    return data

def get_student_cgpa_data(student_id):
    """Helper to get a single student's CGPA record from a CSV."""
    matched = next((data for prefix, data in id_prefix_mapping.items() if student_id.startswith(prefix)), None)
    if not matched:
        return None

    csv_file_path, batch, regulation = matched
    if not os.path.exists(csv_file_path):
        return None

    # utf-8-sig handles BOM (\ufeff) that Excel often adds to CSV files
    with open(csv_file_path, mode='r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        for row in reader:
            row_id = (row.get('ID') or '').strip()
            if row_id == student_id:
                row['ID'] = row_id
                row['Batch'] = batch
                row['Regulation'] = regulation
                return row

    return None

def get_student_ids_by_batch(batch_year):
    """Scans CSV files for a specific batch to collect student IDs."""
    student_ids = []
    csv_files_for_batch = {
        csv_file for _, (csv_file, batch, _) in id_prefix_mapping.items() if batch.startswith(batch_year)
    }

    if not csv_files_for_batch:
        return []

    for csv_file in csv_files_for_batch:
        if os.path.exists(csv_file):
            with open(csv_file, mode='r', encoding='utf-8-sig') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    student_id = (row.get('ID') or '').strip()
                    if student_id and get_batch_folder_from_id(student_id) == batch_year:
                        student_ids.append(student_id)
    return list(set(student_ids))

def get_student_semester_records(student_id):
    """Retrieve semester rows for one roll number from the matching batch folder."""
    batch_folder = get_batch_folder_from_id(student_id)
    if not batch_folder:
        return {}

    semester_records = {}
    for semester in range(1, 10):
        file_path = os.path.join('data', 'semesters', batch_folder, f'semester{semester}.csv')
        if not os.path.exists(file_path):
            continue

        with open(file_path, mode='r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            rows = []
            for row in reader:
                row_id = (row.get('ID') or '').strip()
                if row_id == student_id:
                    rows.append({
                        'subjectCode': row.get('Subject Code', ''),
                        'subjectName': row.get('Subject Name', ''),
                        'grade': row.get('Grade', ''),
                        'credits': row.get('Credits', '')
                    })
            if rows:
                label = 'Honors/Minor' if semester == 9 else f'{(semester + 1) // 2}-{2 if semester % 2 == 0 else 1}'
                semester_records[str(semester)] = {
                    'label': label,
                    'subjects': rows
                }

    return semester_records

def get_toppers_rag_data():
    """Load the top overall and branch toppers for all available batches."""
    toppers_data = {}
    for year in ['2021', '2022', '2023', '2024']:
        csv_path = f'data/toppers_{year}.csv'
        if os.path.exists(csv_path):
            toppers_data[year] = {
                'overall': [],
                'branches': {
                    'cse': [],
                    'ece': [],
                    'eee': [],
                    'mec': [],
                    'ce': []
                }
            }
            try:
                with open(csv_path, mode='r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        category = row.get('category', '').lower().strip()
                        roll_number = row.get('roll_number', '').strip()
                        cgpa = row.get('cgpa', '').strip()
                        record = {'rollNumber': roll_number, 'cgpa': cgpa}

                        if category == 'overall':
                            if len(toppers_data[year]['overall']) < 5:
                                toppers_data[year]['overall'].append(record)
                        elif category in toppers_data[year]['branches']:
                            if len(toppers_data[year]['branches'][category]) < 3:
                                toppers_data[year]['branches'][category].append(record)
            except Exception as e:
                print(f"Error reading toppers CSV for {year}: {e}")
    return toppers_data

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
        'retrievalBasis': 'Retrieved from server CSV files by exact roll number match',
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
            'supplementaryAppearances': cgpa_data.get('Supplementary Appearances') if cgpa_data else None
        },
        'semesterSgpaAndCredits': {
            key: value for key, value in (cgpa_data or {}).items()
            if key not in {'ID', 'Batch', 'Regulation', 'Supplementary Appearances'}
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
            'semesterSgpaAndCredits': {
                k: v for k, v in (cgpa_data or {}).items()
                if k not in {'ID', 'Batch', 'Regulation', 'Supplementary Appearances'}
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
        'retrievalBasis': f'Comparison context for {len(student_ids)} students retrieved from server CSV files',
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
    """Dynamically read the latest notification from public/index.html blinking-note."""
    try:
        html_path = os.path.join('public', 'index.html')
        if os.path.exists(html_path):
            with open(html_path, 'r', encoding='utf-8') as f:
                content = f.read()
            match = re.search(r'class="blinking-note mb-3 text-center"[^>]*>\s*(.*?)\s*</div>', content, re.DOTALL)
            if match:
                return match.group(1).strip()
    except Exception as e:
        print(f"Error parsing index.html for notifications: {e}")
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

    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
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
    except requests.RequestException as error:
        return None, f'Gemini API request failed: {str(error)}'

# --- Page Serving Routes ---

@app.route('/cgpa')
def serve_cgpa():
    return send_from_directory('public', 'cgpa.html')

@app.route('/toppers')
def serve_toppers():
    return send_from_directory('public', 'toppers.html')

@app.route('/semester_results')
def serve_semester_results():
    return send_from_directory('public', 'semester_results.html')

@app.route('/ask-ai')
def serve_ask_ai():
    return send_from_directory('public', 'ask_ai.html')

# --- Authentication Routes ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if username == ADMIN_USER['username'] and password == ADMIN_USER['password']:
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

@app.route('/api/cgpa/<student_id>')
def serve_cgpa_data_api(student_id):
    """API endpoint to get a single student's full CGPA record."""
    student_data = get_student_cgpa_data(student_id)
    if student_data:
        return jsonify(student_data)
    return jsonify({'error': 'Student not found'}), 404

@app.route('/api/semester/<int:semester>')
def serve_semester_data(semester):
    student_id = request.args.get('student_id', '')
    batch_folder = get_batch_folder_from_id(student_id)
    if not batch_folder:
        return 'Invalid student ID pattern', 400

    file_path = os.path.join('data', 'semesters', batch_folder, f'semester{semester}.csv')
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='text/csv')
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

    return jsonify({'answer': answer, 'model': os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')})

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
            'model': os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
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
            'model': os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
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
                'model': os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
            })

        return jsonify({
            'answer': 'I can answer that after I know the student roll number. You can ask naturally, like: "What is the CGPA of 21031A0546?" or "Compare 21031A0546 and 21031A0545"'
        }), 200

@app.route('/api/batch-data/<batch_year>')
def get_batch_data(batch_year):
    """API endpoint that collects and returns all data for a given batch."""
    if not batch_year.isdigit() or len(batch_year) != 4:
        return jsonify({"error": "Invalid batch year format. Please use YYYY."}), 400

    student_ids = get_student_ids_by_batch(batch_year)
    if not student_ids:
        return jsonify({"error": f"No student data found for the batch year {batch_year}."}), 404

    all_batch_data = []
    for student_id in student_ids:
        cgpa_data = get_student_cgpa_data(student_id)
        if not cgpa_data:
            continue

        all_semester_data = {}
        batch_folder = get_batch_folder_from_id(student_id)
        if batch_folder:
            for semester in range(1, 10):
                file_path = os.path.join('data', 'semesters', batch_folder, f'semester{semester}.csv')
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8-sig') as f:
                        parsed_data = parse_csv_data(f.read())
                        student_sem_data = [entry for entry in parsed_data if entry.get('ID') == student_id]
                        if student_sem_data:
                            all_semester_data[str(semester)] = student_sem_data

        student_record = {
            "studentId": student_id,
            "cgpaData": cgpa_data,
            "allSemesterData": all_semester_data
        }
        all_batch_data.append(student_record)

    return jsonify(all_batch_data)

@app.route('/api/toppers')
def get_toppers():
    try:
        year = request.args.get('year', '2021')
        csv_file = f'data/toppers_{year}.csv'

        if not os.path.exists(csv_file):
            return jsonify({
                'error': f'No data available for {year} batch'
            }), 404

        df = pd.read_csv(csv_file, encoding='utf-8-sig')
        df['CGPA'] = pd.to_numeric(df['cgpa'], errors='coerce')
        df = df.sort_values('CGPA', ascending=False)

        overall_toppers = []
        for _, row in df[df['category'] == 'overall'].iterrows():
            overall_toppers.append({
                'roll_number': str(row['roll_number']),
                'cgpa': float(row['CGPA'])
            })

        branch_toppers = {
            'cse': [],
            'ece': [],
            'eee': [],
            'mec': [],
            'ce': []
        }

        for branch in branch_toppers.keys():
            branch_df = df[df['category'] == branch]
            branch_df = branch_df.sort_values('CGPA', ascending=False)

            for _, row in branch_df.iterrows():
                branch_toppers[branch].append({
                    'roll_number': str(row['roll_number']),
                    'cgpa': float(row['CGPA'])
                })

        return jsonify({
            'overall': overall_toppers,
            **branch_toppers
        })

    except Exception as e:
        print(f"Error processing toppers data: {str(e)}")
        return jsonify({
            'error': 'Internal server error'
        }), 500

# --- Static File and Main Route (Catch-all) ---
# This must be the last set of routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):  # type: ignore
        return send_from_directory(app.static_folder, path)  # type: ignore
    else:
        return send_from_directory(app.static_folder, 'index.html')  # type: ignore

# --- Run the App ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)