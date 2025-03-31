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

# Endpoint to get CGPA data
@app.route('/api/cgpa/<student_id>')
def get_cgpa_data(student_id):
    csv_files = ['data/cgpa_data_2021.csv', 'data/cgpa_data_2022.csv', 'data/cgpa_data_2023.csv', 'data/cgpa_data_2024.csv']
    student_data = None
    batch = None
    regulation = None

    for csv_file_path in csv_files:
        with open(csv_file_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                if row['ID'] == student_id:
                    student_data = row
                    # Extract batch and regulation from filename
                    if '2021' in csv_file_path:
                        batch = '2021-25'
                        regulation = 'R20'
                    elif '2022' in csv_file_path:
                        batch = '2022-26'
                        regulation = 'R20'
                    elif '2023' in csv_file_path:
                        batch = '2023-27'
                        regulation = 'R23'
                    elif '2024' in csv_file_path:
                        batch = '2024-28'
                        regulation = 'R23'
                    break
        if student_data:
            break  # Stop searching once found

    if student_data:
        # Dynamically build the response by excluding missing semester data
        formatted_data = {
            'ID': student_data['ID'],
            'Total Credits': student_data.get('Total Credits', 'N/A'),
            'CGPA': student_data.get('CGPA', 'N/A'),
            'Supplementary Appearances': student_data.get('Supplementary Appearances', 'N/A'),
            'Batch': batch,
            'Regulation': regulation
        }

        # Dynamically add semester data if available
        semesters = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1']
        for sem in semesters:
            if sem in student_data and student_data[sem].strip():  # Only add non-empty data
                formatted_data[sem] = student_data[sem]
                formatted_data[f'Credits_{sem}'] = student_data.get(f'Credits_{sem}', 'N/A')

        return jsonify(formatted_data)
    
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