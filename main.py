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

# Load student data
STUDENT_DATA = parse_student_data()

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)