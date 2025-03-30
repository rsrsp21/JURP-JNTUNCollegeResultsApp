from flask import Flask, send_from_directory, jsonify
import os
import csv

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)