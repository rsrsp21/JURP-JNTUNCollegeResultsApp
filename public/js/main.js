// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const rollNumberInput = document.getElementById('rollNumberInput');
  const searchButton = document.getElementById('searchButton');
  const errorMessage = document.getElementById('errorMessage');
  const errorMessageText = document.getElementById('errorMessageText');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const resultsSection = document.getElementById('resultsSection');
  const noResultsSection = document.getElementById('noResultsSection');
  const searchAgainBtn = document.getElementById('searchAgainBtn');
  const studentNameElement = document.getElementById('studentName');
  const studentRollElement = document.getElementById('studentRoll');
  const studentCGPAElement = document.getElementById('studentCGPA');
  const subjectsTableBody = document.getElementById('subjectsTableBody');
  const downloadPDFBtn = document.getElementById('downloadPDFBtn');
  const downloadCSVBtn = document.getElementById('downloadCSVBtn');

  // Store current student data
  let currentStudentData = null;

  // Initialize jsPDF
  const { jsPDF } = window.jspdf;

  // Add event listeners
  searchButton.addEventListener('click', searchResults);
  rollNumberInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchResults();
    }
  });
  searchAgainBtn.addEventListener('click', resetSearch);
  downloadPDFBtn.addEventListener('click', downloadPDF);
  downloadCSVBtn.addEventListener('click', downloadCSV);

  // Function to search student results
  async function searchResults() {
    const rollNumber = rollNumberInput.value.trim();
    
    // Validate roll number
    if (!rollNumber) {
      showError('Please enter a roll number');
      return;
    }

    // Reset UI
    hideError();
    hideResults();
    showLoading();

    try {
      // Fetch student data from API
      const response = await fetch(`/api/results/${rollNumber}`);
      const data = await response.json();

      // Hide loading indicator
      hideLoading();

      if (response.ok && data.length > 0) {
        // Store student data
        currentStudentData = data[0];
        
        // Display the student information
        displayStudentInfo(currentStudentData);
        
        // Show results section
        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('animate-fadeIn');
      } else {
        // Show no results section
        noResultsSection.classList.remove('hidden');
        noResultsSection.classList.add('animate-fadeIn');
      }
    } catch (error) {
      console.error('Error fetching student results:', error);
      hideLoading();
      showError('Error connecting to server. Please try again later.');
    }
  }

  // Function to display student information
  function displayStudentInfo(studentData) {
    // Display student details
    studentNameElement.textContent = studentData.name;
    studentRollElement.textContent = `Roll Number: ${studentData.rollNumber}`;
    studentCGPAElement.textContent = studentData.cgpa.toFixed(1);

    // Clear existing table rows
    subjectsTableBody.innerHTML = '';

    // Add subject rows to the table
    studentData.subjects.forEach(subject => {
      const row = document.createElement('tr');
      
      // Create grade class based on grade value
      let gradeClass = 'grade-';
      const grade = subject.grade.toLowerCase();
      
      if (grade === 'a+') gradeClass += 'a-plus';
      else if (grade === 'a') gradeClass += 'a';
      else if (grade === 'a-') gradeClass += 'a-minus';
      else if (grade === 'b+') gradeClass += 'b-plus';
      else if (grade === 'b') gradeClass += 'b';
      else if (grade === 'b-') gradeClass += 'b-minus';
      else if (grade === 'c+') gradeClass += 'c-plus';
      else if (grade === 'c') gradeClass += 'c';
      else if (grade === 'c-') gradeClass += 'c-minus';
      else if (grade === 'd') gradeClass += 'd';
      else if (grade === 'f') gradeClass += 'f';
      
      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">${subject.subjectId}</td>
        <td class="px-6 py-4 whitespace-nowrap">${subject.subjectName}</td>
        <td class="px-6 py-4 whitespace-nowrap"><span class="${gradeClass}">${subject.grade}</span></td>
        <td class="px-6 py-4 whitespace-nowrap">${subject.credits}</td>
      `;
      
      subjectsTableBody.appendChild(row);
    });
  }

  // Function to download results as PDF
  function downloadPDF() {
    if (!currentStudentData) return;

    // Create PDF document
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(22);
    doc.text('Student Result Card', 105, 20, { align: 'center' });
    
    // Add student info
    doc.setFontSize(14);
    doc.text(`Name: ${currentStudentData.name}`, 20, 40);
    doc.text(`Roll Number: ${currentStudentData.rollNumber}`, 20, 50);
    doc.text(`CGPA: ${currentStudentData.cgpa.toFixed(2)}`, 20, 60);
    
    // Create subject table data
    const tableColumn = ["Subject ID", "Subject Name", "Grade", "Credits"];
    const tableRows = [];
    
    currentStudentData.subjects.forEach(subject => {
      const subjectData = [
        subject.subjectId,
        subject.subjectName,
        subject.grade,
        subject.credits
      ];
      tableRows.push(subjectData);
    });
    
    // Generate the PDF table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 70,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
        lineColor: [100, 100, 100]
      },
      headerStyles: {
        fillColor: [50, 50, 50],
        textColor: 240
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240]
      }
    });
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()}`,
        105, 
        doc.internal.pageSize.height - 10, 
        { align: 'center' }
      );
    }
    
    // Save the PDF
    doc.save(`${currentStudentData.rollNumber}_results.pdf`);
  }

  // Function to download results as CSV
  function downloadCSV() {
    if (!currentStudentData) return;
    
    // CSV Header
    let csvContent = "Roll Number,Name,Subject ID,Subject Name,Grade,Credits,CGPA\n";
    
    // Add data rows
    currentStudentData.subjects.forEach(subject => {
      csvContent += `${currentStudentData.rollNumber},${currentStudentData.name},${subject.subjectId},"${subject.subjectName}",${subject.grade},${subject.credits},${currentStudentData.cgpa}\n`;
    });
    
    // Create download link
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${currentStudentData.rollNumber}_results.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
  }

  // Helper functions for UI manipulation
  function showError(message) {
    errorMessageText.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }

  function showLoading() {
    loadingIndicator.classList.remove('hidden');
  }

  function hideLoading() {
    loadingIndicator.classList.add('hidden');
  }

  function hideResults() {
    resultsSection.classList.add('hidden');
    noResultsSection.classList.add('hidden');
  }

  function resetSearch() {
    rollNumberInput.value = '';
    hideResults();
    rollNumberInput.focus();
  }

  // Set focus on roll number input when the page loads
  rollNumberInput.focus();
});
