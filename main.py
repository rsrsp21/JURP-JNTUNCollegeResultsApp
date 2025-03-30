from flask import Flask, send_from_directory, jsonify
import os
import csv
import glob

app = Flask(__name__, static_folder='public')

# Function to get student info from semester data
def get_student_info_from_semester(student_id):
    # Try to find student in any semester
    for semester_id in range(1, 5):  # Assuming max 4 semesters
        semester_data = parse_semester_data(semester_id)
        if student_id in semester_data:
            # Get the first subject entry to extract student info
            subject = semester_data[student_id][0]
            return {
                'rollNumber': student_id,
                'name': student_id,  # Using ID as name since it's not in the CSV
                'cgpa': 0.0,  # We'll calculate this later if needed
                'subjects': []
            }
    return None

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
    
    print(f"Attempting to parse semester data from: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"Error: Semester file not found: {file_path}")
        return {}
        
    try:
        with open(file_path, 'r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                student_id = row['ID']
                
                if not student_id:
                    print(f"Warning: Row missing student ID: {row}")
                    continue
                
                if student_id not in semester_data:
                    semester_data[student_id] = []
                    
                # Store the subject data
                semester_data[student_id].append({
                    'Subject Code': row['Subject Code'],
                    'Subject Name': row['Subject Name'],
                    'Grade': row['Grade'],
                    'Credits': row['Credits']
                })
                
        print(f"Successfully parsed semester {semester_id} data")
        print(f"Found {len(semester_data)} students")
        print(f"Student IDs: {list(semester_data.keys())}")
        return semester_data
    except Exception as e:
        print(f"Error parsing semester data from {file_path}: {str(e)}")
        return {}

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
    # Get student info from semester data
    student_info = get_student_info_from_semester(roll_number)
    if student_info:
        return jsonify([student_info])
    else:
        return jsonify({'error': 'Student not found with provided roll number'}), 404

# API endpoint to get available semesters
@app.route('/api/semesters', methods=['GET'])
def get_semesters():
    semesters = get_available_semesters()
    return jsonify(semesters)
    
# API endpoint to get student semester data
@app.route('/api/semester/<semester_id>/<student_id>', methods=['GET'])
def get_student_semester_data(semester_id, student_id):
    print(f"Fetching semester {semester_id} data for student {student_id}")
    semester_data = parse_semester_data(semester_id)
    
    if not semester_data:
        print(f"No data found for semester {semester_id}")
        return jsonify({'error': 'Semester data not found'}), 404
        
    if student_id in semester_data:
        print(f"Found {len(semester_data[student_id])} subjects for student {student_id}")
        print(f"Subjects: {semester_data[student_id]}")
        return jsonify({
            'semester_id': semester_id,
            'student_id': student_id,
            'subjects': semester_data[student_id]
        })
    else:
        print(f"Student {student_id} not found in semester {semester_id}")
        print(f"Available student IDs in semester: {list(semester_data.keys())}")
        return jsonify({'error': 'Student not found for the specified semester'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)