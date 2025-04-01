// Mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navToggle.contains(event.target) && !navMenu.contains(event.target)) {
                navMenu.classList.remove('active');
            }
        });

        // Close menu when clicking a link
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
            });
        });
    }
});

function toggleSemesterList() {
    const semesterList = document.querySelector('.semester-list');
    semesterList.classList.toggle('hidden');
}

function selectSemester(semester) {
    const currentSemesterElement = document.getElementById('current-semester');
    currentSemesterElement.textContent = `Semester ${semester}`;
    showSemester(semester);
    document.querySelector('.semester-list').classList.add('hidden');
}
var grades = {
    // R20 Grading System
    'A+': 10,
    'A': 9,
    'B': 8,
    'C': 7,
    'D': 6,
    'E': 5,
    'F': 'Fail',
    'COMPLE': 0,
    'ABSENT': 'Fail',
    'NOT CO': 0
};

var gradesR23 = {
    // R23 Grading System
    'S': 10,
    'A': 9,
    'B': 8,
    'C': 7,
    'D': 6,
    'E': 5,
    'F': 'Fail',
    'COMPLE': 0,
    'ABSENT': 'Fail',
    'NOT CO': 0
};

let currentSemester = 1;
let currentStudentData = null;
let allSemesterData = {}; // Store data for all semesters
let currentRegulation = 'R20'; // Default regulation

function parseCSV(csv) {
    var lines = csv.split('\n');
    var headers = lines[0].split(',');

    var data = [];
    for (var i = 1; i < lines.length; i++) {
        var values = lines[i].split(',');
        if (values.length === headers.length) {
            var entry = {};
            for (var j = 0; j < headers.length; j++) {
                entry[headers[j].trim()] = values[j].trim();
            }
            data.push(entry);
        }
    }

    return data;
}

function getStudentData(id, data) {
    var studentData = data.filter(function(entry) {
        return entry.ID === id;
    });

    return studentData;
}

function getRegulationFromId(studentId) {
    if (studentId.startsWith('21031A') || studentId.startsWith('22035A') || 
        studentId.startsWith('22031A') || studentId.startsWith('23035A')) {
        return 'R20';
    } else if (studentId.startsWith('23031A') || studentId.startsWith('24035A') || 
               studentId.startsWith('24031A') || studentId.startsWith('25035A')) {
        return 'R23';
    }
    return 'R20'; // Default to R20 if pattern not recognized
}

function calculateSGPA(studentData) {
    var totalCredits = 0;
    var totalGradePoints = 0;

    // Get the appropriate grading system based on regulation
    const gradingSystem = currentRegulation === 'R23' ? gradesR23 : grades;

    for (var i = 0; i < studentData.length; i++) {
        var subject = studentData[i];
        var grade = gradingSystem[subject.Grade];
        var credits = parseFloat(subject.Credits);

        if (grade === 'Fail') {
            return 'Fail';
        }

        totalCredits += credits;
        totalGradePoints += grade * credits;
    }

    var sgpa = (totalGradePoints / totalCredits).toFixed(2);

    return sgpa;
}

function calculateTotalCredits(studentData) {
    var totalCredits = 0;

    for (var i = 0; i < studentData.length; i++) {
        var credits = parseFloat(studentData[i].Credits);
        totalCredits += credits;
    }

    return totalCredits.toFixed(1);
}

function toggleSemester(semester) {
    // Prevent default button behavior
    event.preventDefault();
    
    const semesterItem = document.querySelector(`.semester-item:nth-child(${semester})`);
    const content = semesterItem.querySelector('.semester-content');
    const arrow = semesterItem.querySelector('.semester-arrow');
    
    // Toggle the active class
    semesterItem.classList.toggle('active');
    
    // Toggle the content visibility
    content.classList.toggle('hidden');
    
    // If content is visible, load the results
    if (!content.classList.contains('hidden')) {
        showSemester(semester);
    }
}

function showSemester(semester) {
    currentSemester = semester;
    console.log(`Showing semester ${semester}, data available:`, allSemesterData[semester]);
    
    // Display results for current semester if data exists
    if (allSemesterData[semester]) {
        const sgpaContainer = document.getElementById(`sgpa-container-${semester}`);
        const resultsContainer = document.getElementById(`results-container-${semester}`);
        
        if (!sgpaContainer || !resultsContainer) {
            console.error(`Containers not found for semester ${semester}`);
            return;
        }
        
        const sgpa = calculateSGPA(allSemesterData[semester]);
        const totalCredits = calculateTotalCredits(allSemesterData[semester]);
        updateSGPA(sgpa, totalCredits, document.getElementById('student-id').value, sgpaContainer);
        
        createResultsTable(allSemesterData[semester], resultsContainer);
    } else {
        console.log(`No data available for semester ${semester}`);
    }
}

function showLoading() {
    document.getElementById('loading-indicator').classList.remove('hidden');
    document.getElementById('results-section').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading-indicator').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');
}

function getEngineeringBranch(branchCode) {
    switch (branchCode) {
        case '1':
            return 'Civil Engineering';
        case '2':
            return 'Electrical and Electronics Engineering';
        case '3':
            return 'Mechanical Engineering';
        case '4':
            return 'Electronics and Communication Engineering';
        case '5':
            return 'Computer Science and Engineering';
        default:
            return 'Unknown Branch';
    }
}

function updateStudentInfo(studentId) {
    document.getElementById('roll-number').textContent = studentId;
    // Extract branch code from student ID (assuming it's the 5th character)
    const branchCode = studentId.charAt(7);
    document.getElementById('branch-name').textContent = getEngineeringBranch(branchCode);
    
    // Determine batch and regulation based on student ID pattern
    let batch, regulation;
    if (studentId.startsWith('21031A') || studentId.startsWith('22035A')) {
        batch = '2021-2025';
        regulation = 'R20';
    } else if (studentId.startsWith('22031A') || studentId.startsWith('23035A')) {
        batch = '2022-2026';
        regulation = 'R20';
    } else if (studentId.startsWith('23031A') || studentId.startsWith('24035A')) {
        batch = '2023-2027';
        regulation = 'R23';
    } else if (studentId.startsWith('24031A') || studentId.startsWith('25035A')) {
        batch = '2024-2028';
        regulation = 'R23';
    } else {
        batch = 'N/A';
        regulation = 'N/A';
    }
    
    document.getElementById('batch').textContent = batch;
    document.getElementById('regulation').textContent = regulation;
}


function createResultsTable(studentData, container) {
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'results-table';

    const tableHeader = document.createElement('thead');
    const tableBody = document.createElement('tbody');

    const headers = Object.keys(studentData[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        if (header !== 'ID') {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        }
    });
    tableHeader.appendChild(headerRow);

    studentData.forEach(subject => {
        const row = document.createElement('tr');
        Object.entries(subject).forEach(([key, value]) => {
            if (key !== 'ID') {
                const td = document.createElement('td');
                td.textContent = value;
                // if (key === 'Grade') {
                //     let gradeClass = value.toLowerCase().replace('+', '-plus');
                //     console.log(`Setting class name to: grade-${gradeClass}`);
                //     td.className = `grade-${gradeClass}`;
                // }
                row.appendChild(td);
            }
        });
        tableBody.appendChild(row);
    });

    table.appendChild(tableHeader);
    table.appendChild(tableBody);
    container.appendChild(table);
}

function updateSGPA(sgpa, totalCredits, studentId, container) {
    // Determine if the SGPA is "FAIL"
    const isFail = isNaN(parseFloat(sgpa)) || sgpa.toUpperCase() === "FAIL";
    const sgpaClass = isFail ? "fail" : "pass";

    container.innerHTML = `
        <div class="sgpa-label">SGPA</div>
        <div class="sgpa-value ${sgpaClass}">
            ${sgpa}
        </div>
        <div class="credits-info">
            <span class="credits-label">Credits Obtained:</span>
            <span class="credits-value">${totalCredits}</span>
        </div>
    `;
}


function updateSemesterVisibility(studentId) {
    const semesterItems = document.querySelectorAll('.semester-item');
    console.log('Updating semester visibility for semesters:', Object.keys(allSemesterData));
    semesterItems.forEach((item, index) => {
        const semester = index + 1;
        if (allSemesterData[semester] && allSemesterData[semester].length > 0) {
            console.log(`Showing semester ${semester}`);
            item.classList.remove('hidden');
        } else {
            console.log(`Hiding semester ${semester}`);
            item.classList.add('hidden');
        }
    });
}

async function loadAllSemesterData(studentId) {
    showLoading();
    allSemesterData = {};
    
    try {
        // Load data for all semesters (assuming 8 semesters)
        for (let semester = 1; semester <= 9; semester++) {
            console.log(`Loading data for semester ${semester}...`);
            const response = await fetch(`/api/semester/${semester}?student_id=${studentId}`);
            if (!response.ok) {
                if (response.status === 400) {
                    alert('Invalid student ID pattern. Please enter a valid roll number.');
                    hideLoading();
                    return false;
                }
                // If we get a 404 for the first semester, stop loading further
                if (semester === 1 && response.status === 404) {
                    alert('No data found for the given Roll Number.');
                    hideLoading();
                    return false;
                }
                continue; // Skip if semester data not found
            }
            const csvData = await response.text();
            const studentData = getStudentData(studentId, parseCSV(csvData));
            console.log(`Semester ${semester} data:`, studentData);
            if (studentData.length > 0) {
                allSemesterData[semester] = studentData;
            }
        }

        console.log('All semester data loaded:', allSemesterData);

        if (Object.keys(allSemesterData).length === 0) {
            alert('No data found for the given Roll Number in any semester.');
            hideLoading();
            return false;
        }

        updateSemesterVisibility(studentId);
        return true;
    } catch (error) {
        console.error('Error fetching semester data:', error);
        alert('Error loading semester data. Please try again.');
        hideLoading();
        return false;
    }
}

async function displayResults() {
    const studentId = document.getElementById('student-id').value.trim();
    if (!studentId) {
        alert('Please enter a valid Roll Number');
        return;
    }

    // Set the current regulation based on student ID
    currentRegulation = getRegulationFromId(studentId);

    // Load all semester data first
    const dataLoaded = await loadAllSemesterData(studentId);
    if (!dataLoaded) {
        // Hide results section if no data is loaded
        document.getElementById('results-section').classList.add('hidden');
        return;
    }

    // Only proceed if we have valid data
    if (Object.keys(allSemesterData).length > 0) {
        // Update UI with animations
        updateStudentInfo(studentId);
        
        // Display the current semester's data
        if (allSemesterData[currentSemester]) {
            const sgpaContainer = document.getElementById(`sgpa-container-${currentSemester}`);
            const resultsContainer = document.getElementById(`results-container-${currentSemester}`);
            
            const sgpa = calculateSGPA(allSemesterData[currentSemester]);
            const totalCredits = calculateTotalCredits(allSemesterData[currentSemester]);
            updateSGPA(sgpa, totalCredits, studentId, sgpaContainer);
            
            createResultsTable(allSemesterData[currentSemester], resultsContainer);
        }

        // Show results section only if we have valid data
        document.getElementById('results-section').classList.remove('hidden');
    } else {
        // Hide results section if no valid data
        document.getElementById('results-section').classList.add('hidden');
    }

    hideLoading();
}

// Add event listener for Enter key
document.getElementById('student-id').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
        displayResults();
    }
});

// Add event listener for the download all button
document.getElementById('download-all').addEventListener('click', downloadAllResults);

function downloadSemester(semester) {
    const studentId = document.getElementById('student-id').value;
    const rollNumber = document.getElementById('roll-number').textContent;
    const branchName = document.getElementById('branch-name').textContent;
    const batch = document.getElementById('batch').textContent;
    const regulation = document.getElementById('regulation').textContent;
    
    // Get SGPA and credits for the semester
    const sgpaContainer = document.getElementById(`sgpa-container-${semester}`);
    const sgpa = sgpaContainer.querySelector('.sgpa-value').textContent;
    const credits = sgpaContainer.querySelector('.credits-value').textContent;
    
    // Get the results table
    const resultsContainer = document.getElementById(`results-container-${semester}`);
    const table = resultsContainer.querySelector('table');
    
    // Create new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add university logo if available
    const logo = document.querySelector('link[rel="icon"]')?.href;
    if (logo) {
        doc.addImage(logo, 'PNG', 15, 10, 30, 30);
    }
    
    // Title and Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('JNTUK UCEN', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Semester Results', 105, 30, { align: 'center' });
    
    // Student Information
    doc.setFontSize(12);
    doc.text('Student Information', 20, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Roll Number:', 20, 60);
    doc.text('Branch:', 20, 70);
    doc.text('Batch:', 20, 80);
    doc.text('Regulation:', 20, 90);
    doc.text('Year & Semester:', 20, 100);
    
    // Format semester text
    let formattedSemester =
        semester === 9 ? "Honors/Minor" : `${Math.ceil(semester / 2)}-${(semester % 2 === 0) ? 2 : 1}`;
    
    doc.setFont('helvetica', 'normal');
    doc.text(rollNumber, 80, 60);
    doc.text(branchName, 80, 70);
    doc.text(batch, 80, 80);
    doc.text(regulation, 80, 90);
    doc.text(formattedSemester, 80, 100);
    
    // Academic Performance
    doc.setFont('helvetica', 'bold');
    doc.text('Academic Performance', 20, 120);
    doc.text('SGPA:', 20, 130);
    doc.text('Credits:', 20, 140);
    
    doc.setFont('helvetica', 'normal');
    doc.text(sgpa, 80, 130);
    doc.text(credits, 80, 140);
    
    // Results Table
    doc.setFont('helvetica', 'bold');
    doc.text('Subject-wise Results', 20, 160);
    
    // Get table data and remove Points and Total columns
    const tableData = Array.from(table.querySelectorAll('tr')).slice(1).map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        return [
            cells[0].textContent.trim(), // Subject Code
            cells[1].textContent.trim(), // Subject Name
            cells[2].textContent.trim(), // Credits
            cells[3].textContent.trim()  // Grade
        ];
    });
    
    // Add table using autoTable
    doc.autoTable({
        startY: 170,
        head: [['Subject Code', 'Subject Name', 'Credits', 'Grade']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [0, 102, 204],
            textColor: [255, 255, 255],
            halign: 'center',
            fontSize: 10
        },
        bodyStyles: {
            fontSize: 9,
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 30 }, // Subject Code
            1: { cellWidth: 100 }, // Subject Name
            2: { cellWidth: 30 }, // Credits
            3: { cellWidth: 30 }  // Grade
        },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { top: 10 }
    });
    
    // Footer
    const date = new Date().toLocaleDateString('en-GB');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('This is a computer-generated document.', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    doc.text(`Generated on: ${date}`, 105, doc.internal.pageSize.height - 5, { align: 'center' });
    
    // Save the PDF
    doc.save(`${studentId}_semester_${formattedSemester}.pdf`);
}


function downloadAllResults() {
    const studentId = document.getElementById('student-id').value;
    const rollNumber = document.getElementById('roll-number').textContent;
    const branchName = document.getElementById('branch-name').textContent;
    const batch = document.getElementById('batch').textContent;
    const regulation = document.getElementById('regulation').textContent;
    
    // Create new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add university logo if available
    const logo = document.querySelector('link[rel="icon"]')?.href;
    if (logo) {
        doc.addImage(logo, 'PNG', 15, 10, 30, 30);
    }
    
    // Title and Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('JNTUK UCEN', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Complete Academic Record', 105, 30, { align: 'center' });
    
    // Student Information
    doc.setFontSize(12);
    doc.text('Student Information', 20, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Roll Number:', 20, 60);
    doc.text('Branch:', 20, 70);
    doc.text('Batch:', 20, 80);
    doc.text('Regulation:', 20, 90);
    
    doc.setFont('helvetica', 'normal');
    doc.text(rollNumber, 80, 60);
    doc.text(branchName, 80, 70);
    doc.text(batch, 80, 80);
    doc.text(regulation, 80, 90);
    
    let currentY = 110;
    
    // Add each semester's results
    for (let semester = 1; semester <= 9; semester++) { // Loop through all 9 semesters
        if (!allSemesterData[semester] || allSemesterData[semester].length === 0) {
            console.log(`No data for semester ${semester}`);
            continue; // Skip if no data for this semester
        }
        
        // Add new page if not enough space
        if (currentY > doc.internal.pageSize.height - 100) {
            doc.addPage();
            currentY = 20;
        }
        
        // Semester header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        let formattedSemester =
            semester === 9 ? "Honors/Minor" : `${Math.ceil(semester / 2)}-${(semester % 2 === 0) ? 2 : 1}`;
        doc.text(`Year & Semester ${formattedSemester}`, 20, currentY);
        currentY += 10;
        
        // SGPA and credits
        const sgpa = calculateSGPA(allSemesterData[semester]);
        const credits = calculateTotalCredits(allSemesterData[semester]);
        
        doc.setFontSize(11);
        doc.text(`SGPA: ${sgpa}    Credits: ${credits}`, 20, currentY);
        currentY += 15;
        
        // Create table data
        const tableData = allSemesterData[semester].map(subject => [
            subject['Subject Code'],
            subject['Subject Name'],
            subject['Credits'],
            subject['Grade']
        ]);
        
        // Add table using autoTable
        doc.autoTable({
            startY: currentY,
            head: [['Subject Code', 'Subject Name', 'Credits', 'Grade']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [0, 102, 204],
                textColor: [255, 255, 255],
                halign: 'center',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 20 }, // Subject Code
                1: { cellWidth: 80 }, // Subject Name
                2: { cellWidth: 20 }, // Credits
                3: { cellWidth: 20 }  // Grade
            },
            alternateRowStyles: { fillColor: [240, 240, 240] },
            margin: { top: 10 },
            tableWidth: 'auto' // Adjust table width to fit page
        });
        
        // Update Y position after table
        currentY = doc.lastAutoTable.finalY + 20;
    }
    
    // Footer
    const date = new Date().toLocaleDateString('en-GB');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('This is a computer-generated document.', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    doc.text(`Generated on: ${date}`, 105, doc.internal.pageSize.height - 5, { align: 'center' });
    
    // Save the PDF
    doc.save(`${studentId}_all_semesters.pdf`);
}