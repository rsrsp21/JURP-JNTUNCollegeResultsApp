from flask import Flask, send_from_directory, jsonify, request
import os
import csv
import glob

app = Flask(__name__, static_folder='public')

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == "":
        return send_from_directory('public', 'index.html')
    return send_from_directory('public', path)

# Endpoint to get CGPA data for a given student ID
@app.route('/api/cgpa/<student_id>')
def get_cgpa_data(student_id):
    # Define the path to the CSV file
    csv_file_path = 'data/cgpa_data.csv'  # Update this path to your CSV file

    # Initialize a variable to store the student data
    student_data = None

    # Open the CSV file and read the data
    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row['ID'] == student_id:
                student_data = row
                break

    # If student data is found, return it as JSON
    if student_data:
        # Convert the data to the expected format
        formatted_data = {
            'ID': student_data['ID'],
            '1-1': student_data['1-1'],
            'Credits_1-1': student_data['Credits_1-1'],
            '1-2': student_data['1-2'],
            'Credits_1-2': student_data['Credits_1-2'],
            '2-1': student_data['2-1'],
            'Credits_2-1': student_data['Credits_2-1'],
            '2-2': student_data['2-2'],
            'Credits_2-2': student_data['Credits_2-2'],
            '3-1': student_data['3-1'],
            'Credits_3-1': student_data['Credits_3-1'],
            '3-2': student_data['3-2'],
            'Credits_3-2': student_data['Credits_3-2'],
            '4-1': student_data['4-1'],
            'Credits_4-1': student_data['Credits_4-1'],
            'Total Credits': student_data['Total Credits'],
            'CGPA': student_data['CGPA'],
            'Supplementary Appearances': student_data['Supplementary Appearances']
        }
        return jsonify(formatted_data)
    else:
        # If student data is not found, return an error message
        return jsonify({'error': 'Student not found'}), 404
    
# Endpoint to get toppers data
@app.route('/api/toppers')
def get_toppers_data():
    # Define the path to the CSV file
    csv_file_path = 'data/toppers.csv'  # Update this path to your toppers CSV file

    # Initialize a dictionary to store the toppers data
    toppers_data = {
        'overall': [],
        'ce': [],
        'eee': [],
        'mec': [],
        'ece': [],
        'cse': []
    }

    # Open the CSV file and read the data
    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            category = row['category']
            roll_number = row['roll_number']
            cgpa = float(row['cgpa'])

            # Append the data to the corresponding category
            if category in toppers_data:
                toppers_data[category].append({
                    'roll_number': roll_number,
                    'cgpa': cgpa
                })

    # Return the toppers data as JSON
    return jsonify(toppers_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)