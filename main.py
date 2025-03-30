from flask import Flask, render_template, redirect, request, send_from_directory
import os
import json
import subprocess

app = Flask(__name__, static_folder='public')

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == "":
        return send_from_directory('public', 'index.html')
    return send_from_directory('public', path)

# Proxy API requests to the Node.js server
@app.route('/api/results/<roll_number>', methods=['GET'])
def get_results(roll_number):
    # Start the Node.js server if not already running
    try:
        # Execute the node server in the background
        node_server = subprocess.Popen(["node", "server.js"], 
                                     stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE)
        
        # Wait a bit for the server to start
        import time
        time.sleep(1)
        
        # Forward the request to the Node.js API
        import requests
        response = requests.get(f"http://localhost:8000/api/results/{roll_number}")
        
        # Return the response from the Node.js server
        return json.loads(response.text), response.status_code
    except Exception as e:
        return {"error": str(e)}, 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)