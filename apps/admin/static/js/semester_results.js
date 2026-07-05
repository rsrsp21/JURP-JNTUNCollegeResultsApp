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

let currentSemester = 1;
let currentStudentData = null;
let allSemesterData = {}; // Store data for all semesters
let semesterSummaries = {};

function getSemesterSummary(semester) {
    const summary = semesterSummaries[String(semester)] || {};
    return {
        sgpa: summary.sgpa || 'N/A',
        credits: summary.credits || 'N/A'
    };
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
    // console.log(`Showing semester ${semester}, data available:`, allSemesterData[semester]);
    
    // Display results for current semester if data exists
    if (allSemesterData[semester]) {
        const sgpaContainer = document.getElementById(`sgpa-container-${semester}`);
        const resultsContainer = document.getElementById(`results-container-${semester}`);
        
        if (!sgpaContainer || !resultsContainer) {
            console.error(`Containers not found for semester ${semester}`);
            return;
        }
        
        const summary = getSemesterSummary(semester);
        updateSGPA(summary.sgpa, summary.credits, document.getElementById('student-id').value, sgpaContainer);
        
        createResultsTable(allSemesterData[semester], resultsContainer);
    } else {
        // console.log(`No data available for semester ${semester}`);
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

async function updateStudentInfo(studentId) {
    document.getElementById('roll-number').textContent = studentId;
    const branchCode = studentId.charAt(7);
    document.getElementById('branch-name').textContent = getEngineeringBranch(branchCode);

    let batch = currentStudentData?.Batch || '';
    let regulation = currentStudentData?.Regulation || '';
    if (batch && /^\d{4}-\d{2}$/.test(batch)) {
        const startYear = batch.slice(0, 4);
        const endYear = `20${batch.slice(-2)}`;
        batch = `${startYear}-${endYear}`;
    }

    document.getElementById('batch').textContent = batch || 'N/A';
    document.getElementById('regulation').textContent = regulation || 'N/A';

    if (currentStudentData) {
        document.getElementById('cgpa').textContent = currentStudentData.CGPA || 'N/A';
        document.getElementById('total-credits').textContent = currentStudentData['Total Credits'] || 'N/A';
    } else {
        document.getElementById('cgpa').textContent = 'N/A';
        document.getElementById('total-credits').textContent = 'N/A';
    }
}

function createResultsTable(studentData, container) {
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'results-table';
    const displayColumns = ['Subject Code', 'Subject Name', 'Grade', 'Credits'];

    const tableHeader = document.createElement('thead');
    const tableBody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    displayColumns.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    tableHeader.appendChild(headerRow);

    studentData.forEach(subject => {
        const row = document.createElement('tr');
        displayColumns.forEach(column => {
            const td = document.createElement('td');
            td.textContent = subject[column] || '';
            row.appendChild(td);
        });
        tableBody.appendChild(row);
    });

    table.appendChild(tableHeader);
    table.appendChild(tableBody);
    container.appendChild(table);
}

function updateSGPA(sgpa, totalCredits, studentId, container) {
    const sgpaText = String(sgpa || 'N/A');
    const creditsText = String(totalCredits || 'N/A');
    // Determine if the SGPA is "FAIL"
    const isFail = isNaN(parseFloat(sgpaText)) || sgpaText.toUpperCase() === "FAIL";
    const sgpaClass = isFail ? "fail" : "pass";

    container.innerHTML = `
        <div class="sgpa-label">SGPA</div>
        <div class="sgpa-value ${sgpaClass}">
            ${sgpaText}
        </div>
        <div class="credits-info">
            <span class="credits-label">Credits Obtained:</span>
            <span class="credits-value">${creditsText}</span>
        </div>
    `;
}


function updateSemesterVisibility(studentId) {
    const semesterItems = document.querySelectorAll('.semester-item');
    // console.log('Updating semester visibility for semesters:', Object.keys(allSemesterData));
    semesterItems.forEach((item, index) => {
        const semester = index + 1;
        if (allSemesterData[semester] && allSemesterData[semester].length > 0) {
            // console.log(`Showing semester ${semester}`);
            item.classList.remove('hidden');
        } else {
            // console.log(`Hiding semester ${semester}`);
            item.classList.add('hidden');
        }
    });
}

async function loadAllSemesterData(studentId) {
    showLoading();
    allSemesterData = {};
    currentStudentData = null;
    semesterSummaries = {};
    
    try {
        const response = await fetch(`/api/student-results/${studentId}`);
        if (!response.ok) {
            if (response.status === 400) {
                alert('Invalid student ID pattern. Please enter a valid roll number.');
            } else {
                alert('No data found for the given Roll Number.');
            }
            hideLoading();
            return false;
        }

        const payload = await response.json();
        currentStudentData = payload.cgpaData || null;
        allSemesterData = payload.semesterData || {};
        semesterSummaries = payload.semesterSummaries || {};

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
        await updateStudentInfo(studentId);
        
        // Display the current semester's data
        if (allSemesterData[currentSemester]) {
            const sgpaContainer = document.getElementById(`sgpa-container-${currentSemester}`);
            const resultsContainer = document.getElementById(`results-container-${currentSemester}`);
            
            const summary = getSemesterSummary(currentSemester);
            updateSGPA(summary.sgpa, summary.credits, studentId, sgpaContainer);
            
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
document.getElementById('download-all').addEventListener('click', downloadAllResults_main);

// Add event listener for the download all button
document.getElementById('download-all-honmin').addEventListener('click', downloadAllResults_honmin);

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
    const tableHeaders = table ? Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim()) : [];
    const columnIndex = {};
    tableHeaders.forEach((header, index) => {
        columnIndex[header.toLowerCase()] = index;
    });

    const getCellValue = (cells, headerName) => {
        const index = columnIndex[headerName.toLowerCase()];
        if (typeof index !== 'number' || !cells[index]) return '';
        return cells[index].textContent.trim();
    };
    
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
    doc.text(sgpa.trim(), 80, 130); 
    doc.text(credits, 80, 140);
    // Results Table
    doc.setFont('helvetica', 'bold');
    doc.text('Subject-wise Results', 20, 160);
    
    // Get table data and remove Points and Total columns
    const tableData = Array.from(table.querySelectorAll('tr')).slice(1).map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        return [
            getCellValue(cells, 'Subject Code'),
            getCellValue(cells, 'Subject Name'),
            getCellValue(cells, 'Grade'),
            getCellValue(cells, 'Credits')
        ];
    });
    
    // Add table using autoTable
    doc.autoTable({
        startY: 170,
        head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
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
            1: { cellWidth: 100 }, // Subject Name
            2: { cellWidth: 20 }, // Grade
            3: { cellWidth: 20 }  // Credits
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


function downloadAllResults_honmin() {
    const studentId = document.getElementById('student-id').value;
    const rollNumber = document.getElementById('roll-number').textContent;
    const branchName = document.getElementById('branch-name').textContent;
    const batch = document.getElementById('batch').textContent;
    const regulation = document.getElementById('regulation').textContent;
    const cgpa = document.getElementById('cgpa').textContent;
    const totalCredits = document.getElementById('total-credits').textContent;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ margin: { top: 20, bottom: 20 } });

    const logo = document.querySelector('link[rel="icon"]')?.href;
    if (logo) {
        doc.addImage(logo, 'PNG', 15, 10, 30, 30);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('JNTUK UCEN', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Complete Academic Record', 105, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Student Information', 20, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Roll Number:', 20, 60);
    doc.text('Branch:', 20, 70);
    doc.text('Batch:', 20, 80);
    doc.text('Regulation:', 20, 90);
    doc.text('CGPA:', 20, 100);
    doc.text('Total Credits Earned*:', 20, 110);

    doc.setFont('helvetica', 'normal');
    doc.text(rollNumber, 80, 60);
    doc.text(branchName, 80, 70);
    doc.text(batch, 80, 80);
    doc.text(regulation, 80, 90);
    doc.text(cgpa, 80, 100);
    doc.text(totalCredits, 80, 110);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('* Honors/Minor credits excluded', 20, 120);

    let currentY = 130;

    for (let year = 1; year <= 4; year++) {
        if (currentY > doc.internal.pageSize.height - 100) {
            doc.addPage();
            currentY = 10;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`Year ${year}`, 10, currentY);
        currentY += 10;

        for (let semesterIndex = 0; semesterIndex < 2; semesterIndex++) {
            let semester = (year - 1) * 2 + semesterIndex + 1;
            if (!allSemesterData[semester] || allSemesterData[semester].length === 0) continue;

            let formattedSemester = `${year}-${semester % 2 === 0 ? 2 : 1}`;
            const labelX = semesterIndex === 0 ? 10 : 110;

            doc.setFontSize(12);
            doc.text(`Semester ${formattedSemester}`, labelX, currentY);

            const summary = getSemesterSummary(semester);

            doc.setFontSize(10);
            doc.text(`SGPA: ${summary.sgpa}    Credits: ${summary.credits}`, labelX, currentY + 10);
        }

        currentY += 20;
        let tableY = currentY;
        let leftTableY = tableY;
        let rightTableY = tableY;

        for (let semesterIndex = 0; semesterIndex < 2; semesterIndex++) {
            let semester = (year - 1) * 2 + semesterIndex + 1;
            if (!allSemesterData[semester] || allSemesterData[semester].length === 0) continue;

            const baseX = semesterIndex === 0 ? 10 : 110;

            const tableData = allSemesterData[semester].map(subject => [
                subject['Subject Code'],
                subject['Subject Name'],
                subject['Grade'],
                subject['Credits']
            ]);

            doc.autoTable({
                startY: tableY,
                margin: { top: tableY, left: baseX },
                head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [0, 102, 204],
                    textColor: [255, 255, 255],
                    halign: 'center',
                    fontSize: 8
                },
                bodyStyles: {
                    fontSize: 8,
                    halign: 'center',
                    cellPadding: 1
                },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 45, halign: 'left', textWrap: 'wrap' },
                    2: { cellWidth: 14 },
                    3: { cellWidth: 15 }
                },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                tableWidth: 'wrap'
            });

            if (semesterIndex === 0) {
                leftTableY = doc.lastAutoTable.finalY;
            } else {
                rightTableY = doc.lastAutoTable.finalY;
            }
        }

        currentY = Math.max(leftTableY, rightTableY) + 10;
    }

    // Handle Honors/Minor semester (semester 9)
    if (allSemesterData[9] && allSemesterData[9].length > 0) {
        const summary = getSemesterSummary(9);

        const tableData = allSemesterData[9].map(subject => [
            subject['Subject Code'],
            subject['Subject Name'],
            subject['Grade'],
            subject['Credits']
        ]);

        const tempDoc = new jsPDF();
        tempDoc.autoTable({
            startY: 0,
            margin: { top: 0 },
            head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
            body: tableData,
            theme: 'grid',
            headStyles: { fontSize: 8 },
            bodyStyles: { fontSize: 8, cellPadding: 1 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 45 },
                2: { cellWidth: 14 },
                3: { cellWidth: 15 }
            }
        });

        const tableHeight = tempDoc.lastAutoTable.finalY;
        const footerBuffer = 30;
        const remainingHeight = doc.internal.pageSize.height - currentY - footerBuffer;

        if (tableHeight + 40 > remainingHeight) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Honors/Minor', 10, currentY);
        currentY += 15;

        doc.setFontSize(10);
        doc.text(`SGPA: ${summary.sgpa}    Credits: ${summary.credits}`, 10, currentY);
        currentY += 10;

        doc.autoTable({
            startY: currentY,
            margin: { left: 10 },
            head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [0, 102, 204],
                textColor: [255, 255, 255],
                halign: 'center',
                fontSize: 8
            },
            bodyStyles: {
                fontSize: 8,
                halign: 'center',
                cellPadding: 1
            },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 45, halign: 'left', textWrap: 'wrap' },
                2: { cellWidth: 14 },
                3: { cellWidth: 15 }
            },
            alternateRowStyles: { fillColor: [240, 240, 240] },
            tableWidth: 'wrap'
        });

        currentY = doc.lastAutoTable.finalY + 10;
    }

    const date = new Date().toLocaleDateString('en-GB');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('This is a computer-generated document.', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    doc.text(`Generated on: ${date}`, 105, doc.internal.pageSize.height - 5, { align: 'center' });

    doc.save(`${studentId}_all_semesters.pdf`);
}

function downloadAllResults_main() {
    const studentId = document.getElementById('student-id').value;
    const rollNumber = document.getElementById('roll-number').textContent;
    const branchName = document.getElementById('branch-name').textContent;
    const batch = document.getElementById('batch').textContent;
    const regulation = document.getElementById('regulation').textContent;
    const cgpa = document.getElementById('cgpa').textContent;
    const totalCredits = document.getElementById('total-credits').textContent;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ margin: { top: 20, bottom: 20 } });

    const logo = document.querySelector('link[rel="icon"]')?.href;
    if (logo) {
        doc.addImage(logo, 'PNG', 15, 10, 30, 30);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('JNTUK UCEN', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Complete Academic Record', 105, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Student Information', 20, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Roll Number:', 20, 60);
    doc.text('Branch:', 20, 70);
    doc.text('Batch:', 20, 80);
    doc.text('Regulation:', 20, 90);
    doc.text('CGPA:', 20, 100);
    doc.text('Total Credits Earned*:', 20, 110);

    doc.setFont('helvetica', 'normal');
    doc.text(rollNumber, 80, 60);
    doc.text(branchName, 80, 70);
    doc.text(batch, 80, 80);
    doc.text(regulation, 80, 90);
    doc.text(cgpa, 80, 100);
    doc.text(totalCredits, 80, 110);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('* Honors/Minor credits excluded', 20, 120);

    let currentY = 130;

    for (let year = 1; year <= 4; year++) {
        if (currentY > doc.internal.pageSize.height - 100) {
            doc.addPage();
            currentY = 10;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`Year ${year}`, 10, currentY);
        currentY += 10;

        for (let semesterIndex = 0; semesterIndex < 2; semesterIndex++) {
            let semester = (year - 1) * 2 + semesterIndex + 1;
            if (!allSemesterData[semester] || allSemesterData[semester].length === 0) continue;

            let formattedSemester = `${year}-${semester % 2 === 0 ? 2 : 1}`;
            const labelX = semesterIndex === 0 ? 10 : 110;

            doc.setFontSize(12);
            doc.text(`Semester ${formattedSemester}`, labelX, currentY);

            const summary = getSemesterSummary(semester);

            doc.setFontSize(10);
            doc.text(`SGPA: ${summary.sgpa}    Credits: ${summary.credits}`, labelX, currentY + 10);
        }

        currentY += 20;
        let tableY = currentY;
        let leftTableY = tableY;
        let rightTableY = tableY;

        for (let semesterIndex = 0; semesterIndex < 2; semesterIndex++) {
            let semester = (year - 1) * 2 + semesterIndex + 1;
            if (!allSemesterData[semester] || allSemesterData[semester].length === 0) continue;

            const baseX = semesterIndex === 0 ? 10 : 110;

            const tableData = allSemesterData[semester].map(subject => [
                subject['Subject Code'],
                subject['Subject Name'],
                subject['Grade'],
                subject['Credits']
            ]);

            doc.autoTable({
                startY: tableY,
                margin: { top: tableY, left: baseX },
                head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [0, 102, 204],
                    textColor: [255, 255, 255],
                    halign: 'center',
                    fontSize: 8
                },
                bodyStyles: {
                    fontSize: 8,
                    halign: 'center',
                    cellPadding: 1
                },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 45, halign: 'left', textWrap: 'wrap' },
                    2: { cellWidth: 14 },
                    3: { cellWidth: 15 }
                },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                tableWidth: 'wrap'
            });

            if (semesterIndex === 0) {
                leftTableY = doc.lastAutoTable.finalY;
            } else {
                rightTableY = doc.lastAutoTable.finalY;
            }
        }

        currentY = Math.max(leftTableY, rightTableY) + 10;
    }

    const date = new Date().toLocaleDateString('en-GB');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('This is a computer-generated document.', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    doc.text(`Generated on: ${date}`, 105, doc.internal.pageSize.height - 5, { align: 'center' });

    doc.save(`${studentId}_all_semesters.pdf`);
}
