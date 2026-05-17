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
    "password": "jntun@321" # Change this in a real application
}

ROLL_NUMBER_PATTERN = re.compile(r'\b\d{5}A[A-Z0-9]{4}\b', re.IGNORECASE)

ACADEMIC_CHAT_KEYWORDS = {
    'result', 'results', 'semester', 'sem', 'sgpa', 'cgpa', 'grade', 'grades',
    'credit', 'credits', 'backlog', 'backlogs', 'fail', 'failed', 'supply',
    'supplementary', 'performance', 'subject', 'subjects', 'download', 'pdf',
    'toppers', 'topper', 'rank', 'branch', 'batch', 'regulation', 'improve',
    'best', 'weak', 'attention', 'honors', 'minor', 'roll', 'number', 'marks',
    'academic', 'history', 'portal'
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
    if not matched: return None
    
    csv_file_path, batch, regulation = matched
    if not os.path.exists(csv_file_path): return None

    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row.get('ID') == student_id:
                # Add Batch and Regulation info to the record before returning
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
            with open(csv_file, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    student_id = row.get('ID')
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

        with open(file_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            rows = []
            for row in reader:
                if row.get('ID') == student_id:
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
                with open(csv_path, mode='r', encoding='utf-8') as f:
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

def extract_roll_number(text):
    match = ROLL_NUMBER_PATTERN.search(text or '')
    return match.group(0).upper() if match else None

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
        'honors', 'minor'
    }
    general_keywords = {
        'toppers', 'topper', 'download', 'pdf', 'portal', 'help', 'how',
        'where', 'notification', 'notifications', 'released', 'feature',
        'features', 'login', 'admin'
    }

    if words & general_keywords and not words & student_specific_keywords:
        return False
    return bool(words & student_specific_keywords)

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
            'currentNotification': '4-1 Supply, 2-2 RC/RV R20/R23, 4-2 Reg/Supp R20 May-2026 Results Released!'
        }
    }

    if 'topper' in question.lower() or 'rank' in question.lower() or 'best' in question.lower():
        context['toppersData'] = get_toppers_rag_data()

    return context

def call_gemini_with_context(question, student_context, max_tokens=600):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key or api_key == 'your_gemini_api_key_here':
        return None, 'GEMINI_API_KEY is not configured'

    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    api_url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'

    prompt = f"""
You are "Results AI", a premium, highly-intelligent, and extremely supportive Academic Results Advisor for JNTUK UCEN students. 
Your goal is to explain academic results, credits, CGPA/SGPA, backlogs, toppers, and portal features clearly, responsibly, and in a highly polished tone.

---
### 🛠️ STRATEGIC INSTRUCTIONS & PERSONALITY:
1. **Dynamic Tone**: 
   - Be supportive, highly professional, and encouraging. 
   - If a student has an outstanding CGPA (e.g., >= 8.5) or strong improvements, congratulate them warmly!
   - If a student has backlogs or grades needing attention, be encouraging, empathetic, and focus on practical steps to clear them.
2. **Zero Hallucination / Strict Ground Truth**: 
   - Use the retrieved context below as your absolute source of truth. 
   - Do NOT invent or assume any missing student details, grades, roll numbers, cutoffs, regulations, or official JNTU policies.
   - If the data is insufficient to answer the question, state exactly what is missing and direct them to the appropriate portal page.
3. **Premium Markdown Formatting**:
   - **Bolding**: Highlight key metrics like CGPA, SGPA, roll numbers, or specific grades using `**` (e.g., **9.07 CGPA**).
   - **Tables**: When presenting list of subjects, semester-wise grades, or rankings, ALWAYS use highly clean Markdown tables with headers (e.g., Columns: `Semester`, `Subject Code`, `Subject Name`, `Grade`, `Credits`).
   - **Visual Structure**: Use clean lists, short paragraphs, and emoji bullet points to make the advice incredibly easy to scan.
4. **Actionable RAG Guidance**:
   - **Roll Numbers**: When answering roll-specific queries, start by acknowledging the student ID (e.g., "### 📊 Analysis for Roll Number: **[Roll Number]**").
   - **Toppers Analysis**: When toppers are requested, look under `toppersData`. Render a beautifully structured table showcasing overall/branch toppers with rank, roll number, and CGPA. Include an inspiring commendation.
   - **Backlog & SGPA Analysis**: If the user is asking about backlogs or improvement, parse their `derivedSignals` (`failedSubjects`, `lowGradeSubjects`) and offer a clear summary and motivational academic tips.
   - **PDF Downloads**: If asked about downloads, explain that they can navigate to the **Semester-wise Results** page, enter their roll number, load their records, and click **"Download PDF"** to get their official gradesheet.

---
### 📊 RETRIEVED DATA CONTEXT (Source of Truth):
{json.dumps(student_context, ensure_ascii=False)}

---
### 💬 STUDENT QUESTION:
"{question}"

Please provide your highly structured, helpful, and premium Results AI response below:
"""

    gemini_payload = {
        'systemInstruction': {
            'parts': [{
                'text': 'You explain academic results clearly and responsibly. You never claim official university advice.'
            }]
        },
        'contents': [{
            'role': 'user',
            'parts': [{'text': prompt}]
        }],
        'generationConfig': {
            'temperature': 0.3,
            'topP': 0.9,
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

# --- NEW: Authentication Routes ---

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

# --- NEW: Secure Admin Route ---

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

    answer, error = call_gemini_with_context(question, student_context, max_tokens=500)
    if error:
        status_code = 503 if 'GEMINI_API_KEY' in error else 502
        return jsonify({'error': error}), status_code

    return jsonify({'answer': answer, 'model': os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')})

@app.route('/api/chat-ai', methods=['POST'])
def chat_ai():
    """Home-page chat that retrieves result data based on roll number in the message."""
    payload = request.get_json(silent=True) or {}
    message = str(payload.get('message', '')).strip()
    active_student_id = str(payload.get('activeStudentId', '')).strip().upper()

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    if not is_relevant_academic_message(message):
        return jsonify({
            'answer': 'I can only help with JNTUK UCEN results, CGPA, SGPA, credits, backlogs, subjects, toppers, downloads, and portal navigation. Please ask a result-related question.'
        }), 200

    student_id = extract_roll_number(message) or active_student_id
    if not student_id:
        if not needs_student_result_context(message):
            general_context = build_general_portal_context(message)
            answer, error = call_gemini_with_context(message, general_context, max_tokens=500)
            if error:
                status_code = 503 if 'GEMINI_API_KEY' in error else 502
                return jsonify({'error': error}), status_code

            return jsonify({
                'answer': answer,
                'model': os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
            })

        return jsonify({
            'answer': 'I can answer that after I know the student roll number. You can ask naturally, like: "What is the CGPA of 21031A0546?"'
        }), 200

    student_context = build_student_rag_context(student_id, message)
    if not student_context:
        return jsonify({
            'answer': f'I could not find result data for roll number {student_id}. Please check the roll number and try again.'
        }), 200

    answer, error = call_gemini_with_context(message, student_context, max_tokens=650)
    if error:
        status_code = 503 if 'GEMINI_API_KEY' in error else 502
        return jsonify({'error': error}), status_code

    return jsonify({
        'answer': answer,
        'studentId': student_id,
        'model': os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    })

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
                    with open(file_path, 'r', encoding='utf-8') as f:
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
        # Get year parameter from query string, default to 2021
        year = request.args.get('year', '2021')
        csv_file = f'data/toppers_{year}.csv'
        
        # Check if file exists
        if not os.path.exists(csv_file):
            return jsonify({
                'error': f'No data available for {year} batch'
            }), 404
            
        # Read the CSV file
        df = pd.read_csv(csv_file)
        
        # Convert CGPA to numeric, handling any non-numeric values
        df['CGPA'] = pd.to_numeric(df['cgpa'], errors='coerce')
        
        # Sort by CGPA in descending order
        df = df.sort_values('CGPA', ascending=False)
        
        # Create overall toppers list
        overall_toppers = []
        for _, row in df[df['category'] == 'overall'].iterrows():
            overall_toppers.append({
                'roll_number': str(row['roll_number']),
                'cgpa': float(row['CGPA'])
            })
        
        # Create branch-wise toppers lists
        branch_toppers = {
            'cse': [],
            'ece': [],
            'eee': [],
            'mec': [],
            'ce': []
        }
        
        # Process each branch
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
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)): # type: ignore
        return send_from_directory(app.static_folder, path) # type: ignore
    else:
        return send_from_directory(app.static_folder, 'index.html') # type: ignore

# --- Run the App ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
