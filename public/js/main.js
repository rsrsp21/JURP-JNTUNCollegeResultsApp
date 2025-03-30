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
  const semesterSelector = document.getElementById('semesterSelector');
  const semesterLoadingIndicator = document.getElementById('semesterLoadingIndicator');
  const currentSemesterName = document.getElementById('currentSemesterName');
  const sgpaValue = document.getElementById('sgpaValue');
  const subjectCount = document.getElementById('subjectCount');

  // Store current data
  let currentStudentData = null;
  let currentStudentId = null;
  let availableSemesters = [];

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
  if (semesterSelector) {
    semesterSelector.addEventListener('change', handleSemesterSelection);
  }
  
  // Add print functionality if the button exists
  const printResultsBtn = document.getElementById('printResultsBtn');
  if (printResultsBtn) {
    printResultsBtn.addEventListener('click', () => {
      window.print();
    });
  }

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
        currentStudentId = currentStudentData.rollNumber;
        
        // Display the student information
        displayStudentInfo(currentStudentData);
        
        // Fetch available semesters
        await fetchSemesters();
        
        // Show results section
        resultsSection.style.display = 'block';
        resultsSection.classList.remove('hidden');
      } else {
        // Show no results section
        noResultsSection.style.display = 'block';
        noResultsSection.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error fetching student results:', error);
      hideLoading();
      showError('Error connecting to server. Please try again later.');
    }
  }
  
  // Function to fetch available semesters
  async function fetchSemesters() {
    try {
      // Clear semester selector
      semesterSelector.innerHTML = '<option value="" disabled selected>Select Semester</option>';
      
      // Show loading indicator
      semesterLoadingIndicator.style.display = 'flex';
      
      // Fetch semesters from API
      const response = await fetch('/api/semesters');
      const data = await response.json();
      
      if (response.ok && data.length > 0) {
        // Store available semesters
        availableSemesters = data;
        
        // Add options to semester selector
        availableSemesters.forEach(semester => {
          const option = document.createElement('option');
          option.value = semester.id;
          option.textContent = semester.name;
          semesterSelector.appendChild(option);
        });
        
        // Select first semester by default if available
        if (availableSemesters.length > 0) {
          semesterSelector.value = availableSemesters[0].id;
          handleSemesterSelection();
        }
      } else {
        // No semesters available
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No semesters available";
        option.disabled = true;
        semesterSelector.appendChild(option);
      }
    } catch (error) {
      console.error('Error fetching semesters:', error);
      
      // Add fallback option
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "Error loading semesters";
      option.disabled = true;
      semesterSelector.appendChild(option);
    } finally {
      // Hide loading indicator
      semesterLoadingIndicator.style.display = 'none';
    }
  }
  
  // Function to handle semester selection
  async function handleSemesterSelection() {
    const semesterId = semesterSelector.value;
    
    if (!semesterId || !currentStudentId) return;
    
    try {
      // Show loading indicator
      semesterLoadingIndicator.style.display = 'flex';
      
      // Fetch semester data from API
      const response = await fetch(`/api/semester/${semesterId}/${currentStudentId}`);
      const data = await response.json();
      
      if (response.ok && data.subjects) {
        // Display semester data
        displaySemesterData(data, semesterId);
      } else {
        showError('No data found for the selected semester.');
        clearSemesterData();
      }
    } catch (error) {
      console.error('Error fetching semester data:', error);
      showError('Error loading semester data. Please try again.');
      clearSemesterData();
    } finally {
      // Hide loading indicator
      semesterLoadingIndicator.style.display = 'none';
    }
  }
  
  // Function to display semester data
  function displaySemesterData(data, semesterId) {
    // Set current semester name
    const semesterOption = semesterSelector.options[semesterSelector.selectedIndex];
    currentSemesterName.textContent = semesterOption.textContent;
    
    // Clear existing table rows
    subjectsTableBody.innerHTML = '';
    
    // Update subject count
    if (subjectCount) {
      subjectCount.textContent = data.subjects.length;
    }
    
    // Calculate SGPA
    const sgpa = calculateSGPA(data.subjects);
    sgpaValue.textContent = sgpa;
    
    // Add subject rows to the table
    data.subjects.forEach((subject, index) => {
      const row = document.createElement('tr');
      
      // Create grade class based on grade value
      let gradeClass = 'grade-';
      const grade = subject.Grade.toLowerCase();
      
      if (grade === 'a+') gradeClass += 'a';
      else if (grade === 'a') gradeClass += 'a';
      else if (grade === 'b') gradeClass += 'b';
      else if (grade === 'c') gradeClass += 'c';
      else if (grade === 'd') gradeClass += 'd';
      else if (grade === 'e') gradeClass += 'd';
      else if (grade === 'f') gradeClass += 'f';
      
      row.innerHTML = `
        <td class="subject-id">${subject['Subject Code']}</td>
        <td class="subject-name">${subject['Subject Name']}</td>
        <td class="grade-cell"><span class="grade-badge ${gradeClass}">${subject.Grade}</span></td>
        <td class="credits-cell">${subject.Credits}</td>
      `;
      
      subjectsTableBody.appendChild(row);
    });
  }
  
  // Function to calculate SGPA from semester data
  function calculateSGPA(subjects) {
    const grades = {
      'A+': 10,
      'A': 9,
      'B': 8,
      'C': 7,
      'D': 6,
      'E': 5,
      'F': 0
    };
    
    let totalCredits = 0;
    let totalGradePoints = 0;
    let hasFailed = false;
    
    subjects.forEach(subject => {
      const grade = subject.Grade;
      const credits = parseFloat(subject.Credits);
      
      if (grade === 'F') {
        hasFailed = true;
      }
      
      if (grades[grade] !== undefined) {
        totalCredits += credits;
        totalGradePoints += grades[grade] * credits;
      }
    });
    
    if (hasFailed) {
      return 'Failed';
    }
    
    if (totalCredits === 0) {
      return 'N/A';
    }
    
    return (totalGradePoints / totalCredits).toFixed(2);
  }
  
  // Function to clear semester data
  function clearSemesterData() {
    currentSemesterName.textContent = 'Subject Details';
    sgpaValue.textContent = '-';
    subjectsTableBody.innerHTML = '';
    if (subjectCount) {
      subjectCount.textContent = '0';
    }
  }

  // Function to display student information
  function displayStudentInfo(studentData) {
    // Display student details
    studentNameElement.textContent = studentData.name;
    studentRollElement.textContent = `Roll Number: ${studentData.rollNumber}`;
    studentCGPAElement.textContent = studentData.cgpa.toFixed(1);
    
    // Set CGPA progress bar width (assuming max CGPA is 4.0)
    const progressPercentage = (studentData.cgpa / 4.0) * 100;
    const cgpaProgress = document.getElementById('cgpaProgress');
    if (cgpaProgress) {
      cgpaProgress.style.setProperty('--progress-width', `${progressPercentage}%`);
      cgpaProgress.style.width = `${progressPercentage}%`;
      
      // Set gradient color based on CGPA value
      if (studentData.cgpa >= 3.7) {
        cgpaProgress.className = 'h-full bg-gradient-to-r from-green-400 to-blue-500';
      } else if (studentData.cgpa >= 3.0) {
        cgpaProgress.className = 'h-full bg-gradient-to-r from-green-400 to-cyan-500';
      } else if (studentData.cgpa >= 2.0) {
        cgpaProgress.className = 'h-full bg-gradient-to-r from-yellow-400 to-orange-500';
      } else {
        cgpaProgress.className = 'h-full bg-gradient-to-r from-orange-400 to-red-500';
      }
    }

    // Clear existing table rows
    subjectsTableBody.innerHTML = '';
    
    // Update subject count
    const subjectCount = document.getElementById('subjectCount');
    if (subjectCount) {
      subjectCount.textContent = studentData.subjects.length;
    }

    // Add subject rows to the table with animation delay
    studentData.subjects.forEach((subject, index) => {
      const row = document.createElement('tr');
      row.classList.add('animate-fadeIn');
      row.style.animationDelay = `${index * 0.1}s`;
      
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
        <td class="px-6 py-4 whitespace-nowrap text-blue-300">${subject.subjectId}</td>
        <td class="px-6 py-4">${subject.subjectName}</td>
        <td class="px-6 py-4 text-center"><span class="${gradeClass}">${subject.grade}</span></td>
        <td class="px-6 py-4 text-center"><span class="credit-badge">${subject.credits}</span></td>
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
