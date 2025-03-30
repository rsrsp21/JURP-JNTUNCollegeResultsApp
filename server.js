const express = require('express');
const path = require('path');
const fs = require('fs');
const csvParser = require('./utils/csvParser');

const app = express();
const PORT = 8000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Load student data from CSV
let studentData = [];

// Initialize CSV data
const initData = async () => {
  try {
    studentData = await csvParser.parseStudentDataFromCSV('./data/students.csv');
    console.log(`Loaded ${studentData.length} student records from CSV`);
  } catch (error) {
    console.error('Error loading student data:', error);
  }
};

// Initialize data when server starts
initData();

// API endpoint to get student results by roll number
app.get('/api/results/:rollNumber', (req, res) => {
  const { rollNumber } = req.params;
  
  if (!rollNumber) {
    return res.status(400).json({ error: 'Roll number is required' });
  }

  // Find student data based on roll number
  const student = studentData.filter(s => s.rollNumber === rollNumber);
  
  if (student.length === 0) {
    return res.status(404).json({ error: 'Student not found with provided roll number' });
  }

  return res.json(student);
});

// Route to handle the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

// Forward port 8000 to port 5000 for user access
const http = require('http');
http.createServer((req, res) => {
  const options = {
    hostname: '0.0.0.0',
    port: 8000,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });
}).listen(5000, '0.0.0.0', () => {
  console.log('Proxy server running on port 5000');
});
