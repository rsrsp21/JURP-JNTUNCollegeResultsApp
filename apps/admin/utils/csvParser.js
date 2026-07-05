const fs = require('fs');
const { parse } = require('csv-parse');

/**
 * Parse student data from CSV file
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} - Array of student objects
 */
const parseStudentDataFromCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    // Create a read stream
    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        })
      )
      .on('data', (data) => {
        // Group the data by student
        const existingStudent = results.find(
          student => student.rollNumber === data.rollNumber
        );

        if (existingStudent) {
          // Add subject to existing student
          existingStudent.subjects.push({
            subjectId: data.subjectId,
            subjectName: data.subjectName,
            grade: data.grade,
            credits: parseFloat(data.credits)
          });
        } else {
          // Create a new student record
          results.push({
            rollNumber: data.rollNumber,
            name: data.name,
            cgpa: parseFloat(data.cgpa),
            subjects: [
              {
                subjectId: data.subjectId,
                subjectName: data.subjectName,
                grade: data.grade,
                credits: parseFloat(data.credits)
              }
            ]
          });
        }
      })
      .on('error', (error) => {
        reject(error);
      })
      .on('end', () => {
        resolve(results);
      });
  });
};

module.exports = {
  parseStudentDataFromCSV
};
