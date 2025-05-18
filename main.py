from flask import Flask, send_from_directory, jsonify, request, send_file
import os
import csv
import glob
import pandas as pd

app = Flask(__name__, static_folder='public')

# Clean URL routes (must come before catch-all route)
@app.route('/cgpa')
def serve_cgpa():
    return send_from_directory('public', 'cgpa.html')

@app.route('/toppers')
def serve_toppers():
    return send_from_directory('public', 'toppers.html')

@app.route('/semester_results')
def serve_semester_results():
    return send_from_directory('public', 'semester_results.html')

# Serve static files (catch-all route should be last)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == "":
        return send_from_directory('public', 'index.html')
    return send_from_directory('public', path)

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

@app.route('/api/cgpa/<student_id>')
def get_cgpa_data(student_id):
    # Identify the prefix mapping
    matched = next(
        ((csv_file, batch, reg) for prefix, (csv_file, batch, reg) in id_prefix_mapping.items() if student_id.startswith(prefix)),
        None
    )

    if not matched:
        return jsonify({'error': 'Invalid student ID or no data available'}), 404

    csv_file_path, batch, regulation = matched
    student_data = None

    # Read data from the matched file
    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row['ID'] == student_id:
                student_data = row
                break

    if not student_data:
        return jsonify({'error': 'Student not found'}), 404

    # Build response
    formatted_data = {
        'ID': student_data['ID'],
        'Total Credits': student_data.get('Total Credits', 'N/A'),
        'CGPA': student_data.get('CGPA', 'N/A'),
        'Supplementary Appearances': student_data.get('Supplementary Appearances', 'N/A'),
        'Batch': batch,
        'Regulation': regulation
    }

    # Optional: Add semester-wise data
    semesters = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2']
    for sem in semesters:
        if sem in student_data and student_data[sem].strip():
            formatted_data[sem] = student_data[sem]
            formatted_data[f'Credits_{sem}'] = student_data.get(f'Credits_{sem}', 'N/A')

    return jsonify(formatted_data)
    
# Endpoint to get toppers data
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

# Endpoint to reset chart data
@app.route('/api/reset_chart', methods=['POST'])
def reset_chart_data():
    # Logic to reset chart data or state if needed
    # Currently, just returns a success message
    return jsonify({'status': 'success', 'message': 'Chart data reset successfully.'})

# Serve static files from the public directory
@app.route('/')
def serve_index():
    return send_from_directory('public', 'semester_results.html')

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('public/css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('public/js', filename)

@app.route('/api/semester/<int:semester>')
def serve_semester_data(semester):
    # Get student ID from query parameters
    student_id = request.args.get('student_id', '')
    
    # Determine which batch folder to use based on student ID pattern
    if student_id.startswith(('21031A', '22035A')):
        batch_folder = '2021'
    elif student_id.startswith(('22031A', '23035A')):
        batch_folder = '2022'
    elif student_id.startswith(('23031A', '24035A')):
        batch_folder = '2023'
    elif student_id.startswith(('24031A', '25035A')):
        batch_folder = '2024'
    else:
        return 'Invalid student ID pattern', 400
        
    file_path = os.path.join('data', 'semesters', batch_folder, f'semester{semester}.csv')
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='text/csv')
    return 'Semester data not found', 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)