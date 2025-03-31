// Wait for the DOM to be loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event listener for the print button
    const printButton = document.getElementById('printResultsBtn');
    if (printButton) {
        printButton.addEventListener('click', function() {
            window.print();
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
        console.log('Fetching data for:', id);
        const response = await fetch(`/api/cgpa/${id}`);
        
        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            throw new Error(`Student not found (Status: ${response.status})`);
        }
        
        const data = await response.json();
        console.log('Data received:', data);
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

// Display student results
async function displayResults() {
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
    var idContainer = document.getElementById('id-container');
    idContainer.innerHTML = '';

    var idHeading = document.createElement('div');
    idHeading.className = 'd-flex align-items-center';
    idHeading.innerHTML = '<span class="roll-number">' + studentId + '</span><span class="mx-2 text-muted"></span><span class="branch-name">' + branch + '</span>';
    idContainer.appendChild(idHeading);

    // Display CGPA
    var cgpaContainer = document.getElementById('cgpa-container');
    cgpaContainer.innerHTML = '';

    var cgpaValue = document.createElement('div');
    cgpaValue.className = 'cgpa-value';
    cgpaValue.textContent = studentData['CGPA'];
    cgpaContainer.appendChild(cgpaValue);

    // Set up progress bar for CGPA
    var cgpa = parseFloat(studentData['CGPA']);
    var progressPercentage = (cgpa / 10) * 100; // Assuming max CGPA is 10
    
    // Set progress bar width and color
    var progressFill = document.getElementById('progress-fill');
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

    var messageContainer = document.getElementById('message-container');
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
    var percentageContainer = document.getElementById('percentage-container');
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
    var creditsContainer = document.getElementById('credits-container');
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
    var supplementaryContainer = document.getElementById('supplementary-container');
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
    var tableContainer = document.getElementById('table-container');
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
    // Define the semester keys and labels
const semesterData = [
    { key: '1-1', label: 'First Year - First Semester' },
    { key: '1-2', label: 'First Year - Second Semester' },
    { key: '2-1', label: 'Second Year - First Semester' },
    { key: '2-2', label: 'Second Year - Second Semester' },
    { key: '3-1', label: 'Third Year - First Semester' },
    { key: '3-2', label: 'Third Year - Second Semester' },
    { key: '4-1', label: 'Fourth Year - First Semester' }
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
    } catch (error) {
        console.error('Error displaying results:', error);
        alert('An error occurred while fetching data. Please try again.');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }
}

// Function to download results as PDF (can be implemented with jsPDF)
function downloadPDF() {
    alert('PDF download functionality will be implemented soon.');
}