from flask import Flask, send_from_directory, jsonify
import os
import csv
import glob

app = Flask(__name__, static_folder='public')

# Parse student data from CSV file
def parse_student_data():
    student_data = {}
    csv_file = './data/students.csv'
    
    with open(csv_file, 'r') as file:
        reader = csv.DictReader(file)
        for row in reader:
            roll_number = row['rollNumber']
            
            if roll_number not in student_data:
                student_data[roll_number] = {
                    'rollNumber': roll_number,
                    'name': row['name'],
                    'cgpa': float(row['cgpa']),
                    'subjects': []
                }
                
            student_data[roll_number]['subjects'].append({
                'subjectId': row['subjectId'],
                'subjectName': row['subjectName'],
                'grade': row['grade'],
                'credits': float(row['credits'])
            })
            
    return student_data

# Parse CGPA data from CSV file
def parse_cgpa_data():
    cgpa_data = {}
    csv_file = './data/cgpa_data.csv'
    
    with open(csv_file, 'r') as file:
        reader = csv.DictReader(file)
        for row in reader:
            student_id = row['ID']
            cgpa_data[student_id] = row
            
    return cgpa_data

# Load student data
STUDENT_DATA = parse_student_data()

# Load CGPA data
CGPA_DATA = parse_cgpa_data()

# Function to get a list of available semesters
def get_available_semesters():
    semester_files = glob.glob('./data/semesters/semester*.csv')
    semesters = []
    
    for file_path in semester_files:
        # Extract semester number from filename
        filename = os.path.basename(file_path)
        semester_number = filename.replace('semester', '').replace('.csv', '')
        
        try:
            semester_number = int(semester_number)
            # Format for display
            if semester_number <= 2:
                year = "First Year"
                sem = "First" if semester_number == 1 else "Second"
            elif semester_number <= 4:
                year = "Second Year"
                sem = "First" if semester_number == 3 else "Second"
            elif semester_number <= 6:
                year = "Third Year"
                sem = "First" if semester_number == 5 else "Second"
            else:
                year = "Fourth Year"
                sem = "First" if semester_number == 7 else "Second"
                
            semesters.append({
                "id": semester_number,
                "name": f"{year} - {sem} Semester",
                "file": filename
            })
        except ValueError:
            continue
    
    # Sort by semester number
    semesters.sort(key=lambda x: x["id"])
    return semesters

# Function to parse semester data from CSV
def parse_semester_data(semester_id):
    semester_data = {}
    file_path = f'./data/semesters/semester{semester_id}.csv'
    
    if not os.path.exists(file_path):
        return {}
        
    with open(file_path, 'r') as file:
        reader = csv.DictReader(file)
        for row in reader:
            student_id = row['ID']
            
            if student_id not in semester_data:
                semester_data[student_id] = []
                
            semester_data[student_id].append(row)
            
    return semester_data

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == "":
        return send_from_directory('public', 'index.html')
    return send_from_directory('public', path)

# API endpoint to get student results
@app.route('/api/results/<roll_number>', methods=['GET'])
def get_results(roll_number):
    if roll_number in STUDENT_DATA:
        return jsonify([STUDENT_DATA[roll_number]])
    else:
        return jsonify({'error': 'Student not found with provided roll number'}), 404

# API endpoint to get CGPA data
@app.route('/api/cgpa/<student_id>', methods=['GET'])
def get_cgpa_data(student_id):
    print(f"Received request for student_id: {student_id}")
    
    # Print all available IDs for debugging
    available_ids = list(CGPA_DATA.keys())
    if len(available_ids) > 10:  # Print first 10 and count
        print(f"Available IDs ({len(available_ids)} total): {available_ids[:10]}...")
    else:
        print(f"Available IDs: {available_ids}")
    
    if student_id in CGPA_DATA:
        print(f"Student found: {student_id}")
        return jsonify(CGPA_DATA[student_id])
    else:
        print(f"Student NOT found: {student_id}")
        return jsonify({'error': 'Student not found with provided ID'}), 404
        
# API endpoint to get all CGPA data
@app.route('/api/cgpa', methods=['GET'])
def get_all_cgpa_data():
    return jsonify(list(CGPA_DATA.values()))

# Function to parse toppers data
def parse_toppers_data():
    toppers_data = {
        'overall': [],
        'ce': [],
        'eee': [],
        'mec': [],
        'ece': [],
        'cse': []
    }
    
    try:
        with open('data/toppers.csv', 'r') as file:
            csv_reader = csv.reader(file)
            next(csv_reader)  # Skip header row
            for row in csv_reader:
                if len(row) >= 3:
                    category, roll_number, cgpa = row
                    toppers_data[category].append({
                        'roll_number': roll_number,
                        'cgpa': cgpa
                    })
        return toppers_data
    except Exception as e:
        print(f"Error parsing toppers data: {e}")
        return toppers_data
        
# API endpoint to get toppers data
@app.route('/api/toppers', methods=['GET'])
def get_toppers():
    toppers_data = parse_toppers_data()
    return jsonify(toppers_data)

# API endpoint to get toppers by category
@app.route('/api/toppers/<category>', methods=['GET'])
def get_toppers_by_category(category):
    toppers_data = parse_toppers_data()
    if category in toppers_data:
        return jsonify(toppers_data[category])
    else:
        return jsonify({'error': f'Category {category} not found'}), 404
        
# API endpoint to get available semesters
@app.route('/api/semesters', methods=['GET'])
def get_semesters():
    semesters = get_available_semesters()
    return jsonify(semesters)
    
# API endpoint to get student semester data
@app.route('/api/semester/<semester_id>/<student_id>', methods=['GET'])
def get_student_semester_data(semester_id, student_id):
    semester_data = parse_semester_data(semester_id)
    
    if student_id in semester_data:
        return jsonify({
            'semester_id': semester_id,
            'student_id': student_id,
            'subjects': semester_data[student_id]
        })
    else:
        return jsonify({'error': 'Student not found for the specified semester'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)