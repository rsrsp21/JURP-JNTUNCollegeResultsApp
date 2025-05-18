// Wait for the DOM to be loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event listener for the print button
    const printButton = document.getElementById('printResultsBtn');
    if (printButton) {
        printButton.addEventListener('click', function() {
            downloadPDF();
        });
    }
    
    // Check if student ID was provided in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    
    if (studentId) {
        document.getElementById('student-id').value = studentId;
        displayResults();
    }
    
    // Add event listener for the search button
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            displayResults();
        });
    }
    
    // Add event listener for Enter key in the input field
    const studentIdInput = document.getElementById('student-id');
    if (studentIdInput) {
        studentIdInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                displayResults();
            }
        });
    }
});

// Get student data from API
async function fetchStudentData(id) {
    try {
        // console.log('Fetching data for:', id);
        const response = await fetch(`/api/cgpa/${id}`);
        
        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            throw new Error(`Student not found (Status: ${response.status})`);
        }
        
        const data = await response.json();
        // console.log('Data received:', data);
        return data;
    } catch (error) {
        console.error('Error fetching student data:', error);
        return null;
    }
}

// Get engineering branch based on the roll number
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

// Function to reset chart data
async function resetChartData() {
    try {
        const response = await fetch('/api/reset_chart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();
        // console.log('Reset Chart Response:', result);
    } catch (error) {
        console.error('Error resetting chart data:', error);
    }
}

// Display student results
async function displayResults() {
    // Reset chart data before fetching new results
    await resetChartData();

    var studentId = document.getElementById('student-id').value.trim();
    if (!studentId) {
        alert('Please enter a valid Roll Number.');
        return;
    }

    // Get branch if the roll number format is valid
    var branch = 'Unknown Branch';
    if (studentId.length >= 8) {
        branch = getEngineeringBranch(studentId.charAt(7));
    }
    
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
    }
    
    // Hide results section while loading
    const resultsSection = document.getElementById('results-section');
    resultsSection.classList.add('hidden');
    resultsSection.classList.remove('shown');

    try {
        // --- Clear previous results first ---
        const idContainer = document.getElementById('id-container');
        const cgpaContainer = document.getElementById('cgpa-container');
        const percentageContainer = document.getElementById('percentage-container');
        const creditsContainer = document.getElementById('credits-container');
        const supplementaryContainer = document.getElementById('supplementary-container');
        const tableContainer = document.getElementById('table-container');
        const chartContainer = document.getElementById('sgpaChart')?.parentNode;
        const messageContainer = document.getElementById('message-container');
        const progressFill = document.getElementById('progress-fill');

        if(idContainer) idContainer.innerHTML = '';
        if(cgpaContainer) cgpaContainer.innerHTML = '';
        if(percentageContainer) percentageContainer.innerHTML = '';
        if(creditsContainer) creditsContainer.innerHTML = '';
        if(supplementaryContainer) supplementaryContainer.innerHTML = '';
        if(tableContainer) tableContainer.innerHTML = '';
        if(messageContainer) messageContainer.innerHTML = '';
        progressFill.style.width = '0%'; // Reset progress bar
        
        // Ensure chart canvas exists before proceeding
        if(chartContainer && !chartContainer.querySelector('canvas#sgpaChart')) {
            chartContainer.innerHTML = '<canvas id="sgpaChart"></canvas>';
        } else if (chartContainer) {
             // If canvas exists, clear potential old message sibling (less likely needed now, but safe)
             const oldMsg = chartContainer.querySelector('p.no-chart-data');
             if(oldMsg) oldMsg.remove();
        }

        const studentData = await fetchStudentData(studentId);
        if (!studentData) {
            alert('No data found for the given Roll Number.');
            if (loadingIndicator) {
                loadingIndicator.classList.add('hidden');
            }
            return;
        }
        
        // Hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }

        // Show results section
        resultsSection.classList.remove('hidden');
        setTimeout(() => {
            resultsSection.classList.add('shown');
        }, 10);

    // Display Roll Number and Branch
    idContainer.innerHTML = '';

    var idHeading = document.createElement('div');
    idHeading.className = 'd-flex align-items-center';
    idHeading.innerHTML = '<span class="roll-number">' + studentId + '</span><span class="mx-2 text-muted"></span><span class="branch-name">' + branch + '</span>';
    idContainer.appendChild(idHeading);

    // Display CGPA
    cgpaContainer.innerHTML = '';

    var cgpaValue = document.createElement('div');
    cgpaValue.className = 'cgpa-value';
    cgpaValue.textContent = studentData['CGPA'];
    cgpaContainer.appendChild(cgpaValue);

    // Set up progress bar for CGPA
    var cgpa = parseFloat(studentData['CGPA']);
    var progressPercentage = (cgpa / 10) * 100; // Assuming max CGPA is 10
    
    // Set progress bar width and color
    progressFill.style.width = `${progressPercentage}%`;
    
    // Set color based on CGPA and regulation
    var regulation = studentData['Regulation'];
    if (regulation === 'R23') {
        if (cgpa >= 7.5) {
            progressFill.className = 'progress-bar-fill excellence';
        } else if (cgpa >= 6.5) {
            progressFill.className = 'progress-bar-fill first-class';
        } else if (cgpa >= 5.5) {
            progressFill.className = 'progress-bar-fill second-class';
        } else {
            progressFill.className = 'progress-bar-fill pass-class';
        }
    } else {
        if (cgpa >= 7.75) {
            progressFill.className = 'progress-bar-fill excellence';
        } else if (cgpa >= 6.75) {
            progressFill.className = 'progress-bar-fill first-class';
        } else if (cgpa >= 5.75) {
            progressFill.className = 'progress-bar-fill second-class';
        } else {
            progressFill.className = 'progress-bar-fill pass-class';
        }
    }

    // Display division message
    var message = '';
    var supplementaryAppearances = studentData['Supplementary Appearances'];

    // Different conditions based on regulation
    if (regulation === 'R23') {
        if (cgpa >= 7.5) {
            message = 'First Class with Distinction';
        } else if (cgpa >= 6.5) {
            message = 'First Class';
        } else if (cgpa >= 5.5) {
            message = 'Second Class';
        } else if (cgpa >= 5) {
            message = 'Pass Class';
        } else {
            message = 'Not Applicable';
        }
    } else {
        if (cgpa >= 7.75 && (supplementaryAppearances === '' || !supplementaryAppearances.includes('*'))) {
            message = 'First Class with Distinction';
        } else if (cgpa >= 6.75) {
            message = 'First Class';
        } else if (cgpa >= 5.75) {
            message = 'Second Class';
        } else if (cgpa >= 5) {
            message = 'Pass Class';
        } else {
            message = 'Not Applicable';
        }
    }

    messageContainer.innerHTML = '';
    if (message !== '') {
        var messageElement = document.createElement('div');
        messageElement.textContent = message;
        
        // Add appropriate class based on division
        if (message.includes('Distinction')) {
            messageElement.className = 'division-badge distinction';
        } else if (message.includes('First Class')) {
            messageElement.className = 'division-badge first';
        } else if (message.includes('Second Class')) {
            messageElement.className = 'division-badge second';
        } else if (message.includes('Pass Class')) {
            messageElement.className = 'division-badge pass';
        }
        
        messageContainer.appendChild(messageElement);

        // Add batch and regulation info below message
        var infoContainer = document.createElement('div');
        infoContainer.className = 'student-info-badges';
        
        var batchBadge = document.createElement('div');
        batchBadge.className = 'info-badge batch-badge';
        batchBadge.innerHTML = '<span class="info-label">Batch:</span><span class="info-value">' + studentData['Batch'] + '</span>';
        
        var regulationBadge = document.createElement('div');
        regulationBadge.className = 'info-badge regulation-badge';
        regulationBadge.innerHTML = '<span class="info-label">Regulation:</span><span class="info-value">' + studentData['Regulation'] + '</span>';
        
        infoContainer.appendChild(batchBadge);
        infoContainer.appendChild(regulationBadge);
        messageContainer.appendChild(infoContainer);
    }

    // Display Percentage
    percentageContainer.innerHTML = '';
    
    var percentageLabel = document.createElement('div');
    percentageLabel.className = 'data-label';
    percentageLabel.textContent = 'Percentage';
    percentageContainer.appendChild(percentageLabel);
    
    var percentageValue = document.createElement('div');
    percentageValue.className = 'percentage-value';
    var percentage;
    if (regulation === 'R23') {
        percentage = ((cgpa - 0.5) * 10).toFixed(2);
    } else {
        percentage = ((cgpa - 0.75) * 10).toFixed(2);
    }
    percentageValue.textContent = (percentage <= 0) ? '0%' : percentage + '%';
    percentageContainer.appendChild(percentageValue);

    // Display Total Credits
    creditsContainer.innerHTML = '';
    
    var creditsLabel = document.createElement('div');
    creditsLabel.className = 'data-label';
    creditsLabel.textContent = 'Total Credits';
    creditsContainer.appendChild(creditsLabel);
    
    var creditsValue = document.createElement('div');
    creditsValue.className = 'credits-value';
    creditsValue.textContent = studentData['Total Credits'];
    creditsContainer.appendChild(creditsValue);

    // Display Supplementary Appearances
    var supplementaryAppearances = studentData['Supplementary Appearances'];
    supplementaryContainer.innerHTML = '';
    
    var supplementaryLabel = document.createElement('div');
    supplementaryLabel.className = 'data-label';
    supplementaryLabel.textContent = 'Supplementary Appearances';
    supplementaryContainer.appendChild(supplementaryLabel);
    
    var suppCount = (supplementaryAppearances && supplementaryAppearances.includes('*')) 
        ? supplementaryAppearances.split('*').length - 1 
        : 0;
    
    var supplementaryValue = document.createElement('div');
    if (suppCount > 0) {
        supplementaryValue.className = 'supplementary-value supplementary-count';
        supplementaryValue.textContent = suppCount;
    } else {
        supplementaryValue.className = 'supplementary-value supplementary-none';
        supplementaryValue.textContent = 'None';
    }
    supplementaryContainer.appendChild(supplementaryValue);

    // Create and populate semester table
    tableContainer.innerHTML = '';

    var table = document.createElement('table');
    table.className = 'table semester-table';
    tableContainer.appendChild(table);

    var tableHeader = document.createElement('thead');
    table.appendChild(tableHeader);

    var headerRow = document.createElement('tr');
    tableHeader.appendChild(headerRow);

    var semestersHeader = document.createElement('th');
    semestersHeader.textContent = "Semester";
    headerRow.appendChild(semestersHeader);

    var sgpaHeader = document.createElement('th');
    sgpaHeader.textContent = "SGPA";
    headerRow.appendChild(sgpaHeader);

    var creditsHeader = document.createElement('th');
    creditsHeader.textContent = "Credits";
    headerRow.appendChild(creditsHeader);

    var tableBody = document.createElement('tbody');
    table.appendChild(tableBody);

    // Define the semester keys and labels
    const semesterData = [
        { key: '1-1', label: 'First Year - First Semester' },
        { key: '1-2', label: 'First Year - Second Semester' },
        { key: '2-1', label: 'Second Year - First Semester' },
        { key: '2-2', label: 'Second Year - Second Semester' },
        { key: '3-1', label: 'Third Year - First Semester' },
        { key: '3-2', label: 'Third Year - Second Semester' },
        { key: '4-1', label: 'Fourth Year - First Semester' },
        { key: '4-1', label: 'Fourth Year - Second Semester' }
    ];

    // Loop through the semesters and display only available ones
    semesterData.forEach(semester => {
        const sgpa = studentData[semester.key];
        const credits = studentData[`Credits_${semester.key}`];

        // Skip missing semesters
        if (!sgpa || sgpa === 'N/A') return;

        var row = document.createElement('tr');

        // Semester label
        var labelCell = document.createElement('td');
        labelCell.textContent = semester.label;
        labelCell.className = 'semester-name';
        row.appendChild(labelCell);

        // SGPA with appropriate styling
        var sgpaCell = document.createElement('td');
        if (sgpa && sgpa !== '0.0') {
            const sgpaValue = parseFloat(sgpa);
            let sgpaClass = 'sgpa-value ';
            
            if (regulation === 'R23') {
                if (sgpaValue >= 7.5) sgpaClass += 'excellent-sgpa';
                else if (sgpaValue >= 6.5) sgpaClass += 'good-sgpa';
                else if (sgpaValue >= 5.5) sgpaClass += 'average-sgpa';
                else sgpaClass += 'poor-sgpa';
            } else {
                if (sgpaValue >= 7.75) sgpaClass += 'excellent-sgpa';
                else if (sgpaValue >= 6.75) sgpaClass += 'good-sgpa';
                else if (sgpaValue >= 5.75) sgpaClass += 'average-sgpa';
                else sgpaClass += 'poor-sgpa';
            }
            
            sgpaCell.innerHTML = `<span class="${sgpaClass}">${sgpa}</span>`;
        } else {
            sgpaCell.innerHTML = '<span class="poor-sgpa">NA</span>';
        }
        row.appendChild(sgpaCell);

        // Credits
        var creditsCell = document.createElement('td');
        creditsCell.innerHTML = `<span class="credits-badge">${credits || 'N/A'}</span>`;
        row.appendChild(creditsCell);

        tableBody.appendChild(row);
    });

    // Global variable to hold the chart instance
    let sgpaChartInstance = null;

    // Enhanced function to create SGPA Chart with explicit canvas reset
    function createSGPAChart(semesters, sgpaValues) {
        // Ensure the existing chart is destroyed
        if (sgpaChartInstance) {
            // console.log('Destroying existing chart instance...');
            sgpaChartInstance.destroy();
            sgpaChartInstance = null; // Explicitly nullify
            // console.log('Chart destroyed.');
        }

        // Ensure canvas exists and is ready
        const chartContainer = document.getElementById('sgpaChart')?.parentNode;
        if (!chartContainer) {
            console.error('Chart container not found.');
            return; // Exit if container is not ready
        }

        // Clear and recreate the canvas
        chartContainer.innerHTML = '<canvas id="sgpaChart"></canvas>';
        const ctx = document.getElementById('sgpaChart')?.getContext('2d');
        
        // Check if context was successfully obtained (canvas exists)
        if (!ctx) {
            console.error('Failed to get canvas context for sgpaChart');
            return; // Exit if canvas is not ready
        }

        // console.log('Creating new chart instance...');
        sgpaChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: semesters,
                datasets: [{
                    label: 'SGPA',
                    data: sgpaValues,
                    borderColor: '#00bcd4', // Cyan border color
                    backgroundColor: 'rgba(0, 188, 212, 0.1)', // Light cyan fill
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4, // Smooth curves
                    pointBackgroundColor: '#ffffff', // White points
                    pointBorderColor: '#00bcd4', // Cyan border for points
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#00bcd4',
                    pointHoverBorderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false, // Don't force start at 0
                        min: Math.max(0, Math.min(...sgpaValues) - 1), // Dynamic min based on data, but not below 0
                        max: Math.min(10, Math.max(...sgpaValues) + 1), // Dynamic max based on data, but not above 10
                        grid: {
                            color: 'rgba(255, 255, 255, 0.15)', // Lighter grid lines
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#adb5bd', // Light gray tick labels
                            stepSize: 1
                        }
                    },
                    x: {
                        grid: {
                            display: false, // Hide vertical grid lines
                        },
                        ticks: {
                            color: '#adb5bd' // Light gray tick labels
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hide legend as there's only one dataset
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        padding: 12,
                        cornerRadius: 4,
                        displayColors: false,
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return ` Semester ${context.label}: ${context.parsed.y.toFixed(2)}`;
                            },
                            title: function() {
                                return ''; // Hide default title
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                }
            }
        });
        // console.log('New chart instance created.');
    }

    // --- Add Chart Creation Logic Here ---
    const semestersForChart = [];
    const sgpaValuesForChart = [];
    
    // Use the same semesterData array used for the table
    semesterData.forEach(semester => {
        const sgpa = studentData[semester.key]; // Access SGPA directly
        
        // Check if data exists for this semester key
        if (typeof sgpa !== 'undefined' && sgpa !== null) {
            semestersForChart.push(semester.key); // Include semester even if SGPA is N/A
            
            // Use 0 if SGPA is 'N/A' or '0.0', otherwise parse the float
            if (sgpa === 'N/A' || sgpa === '0.0') {
                sgpaValuesForChart.push(0);
            } else {
                sgpaValuesForChart.push(parseFloat(sgpa));
            }
        } 
        // If sgpa is undefined or null, we simply skip this semester for the chart
    });

    // Create/Update SGPA Chart only if *any* data was processed
    if (semestersForChart.length > 0) {
         // Call create chart function (it will handle canvas ensure/destroy)
         createSGPAChart(semestersForChart, sgpaValuesForChart);
    } else {
        // If no data, destroy chart, hide canvas, show message
        if (sgpaChartInstance) {
            sgpaChartInstance.destroy();
            sgpaChartInstance = null;
        }
         
         const chartContainer = document.getElementById('sgpaChart')?.parentNode;
         const canvas = document.getElementById('sgpaChart');
         const noDataMessage = document.getElementById('no-chart-data-message');

         if(canvas) canvas.style.display = 'none'; // Hide canvas
         if(chartContainer) chartContainer.style.display = 'none'; // Hide container
         if(noDataMessage) noDataMessage.classList.remove('d-none'); // Show message
    }
    // --- End Chart Creation Logic ---

    } catch (error) {
        console.error('Error displaying results:', error);
        alert('An error occurred while fetching data. Please try again.');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }
}

// Function to download results as PDF
function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Get student data
    const studentId = document.getElementById('student-id')?.value.trim() || 'Unknown';
    const branch = document.querySelector('.branch-name')?.textContent?.trim() || 'Unknown Branch';
    const cgpa = document.querySelector('.cgpa-value')?.textContent?.trim() || 'N/A';
    const division = document.querySelector('.division-badge')?.textContent?.trim() || 'N/A';
    const percentage = document.querySelector('.percentage-value')?.textContent?.trim() || 'N/A';
    const totalCredits = document.querySelector('.credits-value')?.textContent?.trim() || 'N/A';
    const supplementaryCount = document.querySelector('.supplementary-value')?.textContent?.trim() || 'None';
    const batch = document.querySelector('.batch-badge .info-value')?.textContent?.trim() || 'N/A';
    const regulation = document.querySelector('.regulation-badge .info-value')?.textContent?.trim() || 'N/A';
    
    // Title and Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('JNTUK UCEN', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Student Academic Record', 105, 30, { align: 'center' });
    
    // Add university logo if available
    const logo = document.querySelector('link[rel="icon"]')?.href;
    if (logo) {
        doc.addImage(logo, 'PNG', 15, 10, 30, 30);
    }
    
    // Student Information
    doc.setFontSize(12);
    doc.text('Student Information', 20, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Roll Number:', 20, 60);
    doc.text('Branch:', 20, 70);
    doc.text('Batch:', 20, 80);
    doc.text('Regulation:', 20, 90);
    
    doc.setFont('helvetica', 'normal');
    doc.text(studentId, 60, 60);
    doc.text(branch, 60, 70);
    doc.text(batch, 60, 80);
    doc.text(regulation, 60, 90);
    
    // Academic Performance
    doc.setFont('helvetica', 'bold');
    doc.text('Academic Performance', 20, 110);
    doc.setFont('helvetica', 'bold');
    doc.text('CGPA:', 20, 120);
    doc.text('Percentage:', 20, 130);
    doc.text('Division:', 20, 140);
    doc.text('Total Credits:', 20, 150);
    
    doc.setFont('helvetica', 'normal');
    doc.text(cgpa, 60, 120);
    doc.text(percentage, 60, 130);
    doc.text(division, 60, 140);
    doc.text(totalCredits, 60, 150);
    
    // Semester-wise Performance Table
    doc.setFont('helvetica', 'bold');
    doc.text('Semester-wise Performance', 20, 170);
    
    const tableData = [];
    document.querySelectorAll('.semester-table tbody tr').forEach(row => {
        tableData.push([
            row.querySelector('.semester-name')?.textContent.trim() || '',
            row.querySelector('.sgpa-value')?.textContent.trim() || '',
            row.querySelector('.credits-badge')?.textContent.trim() || ''
        ]);
    });
    
    doc.autoTable({
        startY: 180,
        head: [['Semester', 'SGPA', 'Credits']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], halign: 'center' },
        bodyStyles: { fontSize: 11, halign: 'center' },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { top: 20 }
    });
    
    // Footer with Date
    const pageCount = doc.internal.getNumberOfPages();
    const date = new Date().toLocaleDateString('en-GB'); // Format as dd/mm/yyyy
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('This is a computer-generated document.', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    doc.text(`Generated on: ${date}`, 105, doc.internal.pageSize.height - 5, { align: 'center' });  // | Page ${pageCount}`
    
    // Save PDF
    doc.save(`Student_Result_${studentId}.pdf`);
}
