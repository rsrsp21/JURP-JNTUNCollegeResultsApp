# main.py (Corrected and Consolidated Version)

import os
import csv
import pandas as pd
from flask import Flask, send_from_directory, jsonify, request, render_template, session, redirect, url_for, send_file

# --- App Initialization ---
app = Flask(__name__, static_folder='public')
app.secret_key = 'jntun_results_secret_key'

ADMIN_USER = {
    "username": "admin",
    "password": "jntun@321" # Change this in a real application
}

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