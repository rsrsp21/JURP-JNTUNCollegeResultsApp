// CSV data for student results
var csvData = `ID,1-1,Credits_1-1,1-2,Credits_1-2,2-1,Credits_2-1,2-2,Credits_2-2,3-1,Credits_3-1,3-2,Credits_3-2,4-1,Credits_4-1,Total Credits,CGPA,Supplementary Appearances
21031A0101,0.0,13.5,0.0,13.5,0.0,22.5,0.0,12.5,0.0,15.5,0.0,12.5,0.0,20.0,110.0,0.0,*********************
21031A0102,7.13,19.5,5.77,19.5,6.94,25.5,6.47,21.5,7.26,21.5,6.98,21.5,7.78,23.0,152.0,6.93,*******
21031A0103,7.13,19.5,6.69,19.5,8.24,25.5,7.14,21.5,7.33,21.5,7.28,21.5,7.13,23.0,152.0,7.31,
21031A0104,8.23,19.5,7.77,19.5,8.0,25.5,8.67,21.5,9.16,21.5,8.95,21.5,8.67,24.0,153.0,8.5,
21031A0105,0.0,16.5,0.0,16.5,0.0,19.5,0.0,18.5,0.0,18.5,0.0,18.5,0.0,17.0,125.0,0.0,*********************
21031A0106,7.41,19.5,6.29,21.0,7.76,25.5,7.37,21.5,7.47,21.5,7.74,21.5,7.13,23.0,153.5,7.32,**
21031A0107,5.82,19.5,0.0,16.5,6.82,25.5,5.81,21.5,7.16,21.5,6.84,21.5,7.26,23.0,149.0,0.0,************
21031A0108,0.0,13.5,0.0,16.5,0.0,22.5,0.0,18.5,6.37,21.5,6.63,21.5,6.48,23.0,137.0,0.0,*******************
21031A0109,6.44,19.5,6.46,19.5,6.92,25.5,7.0,21.5,6.86,21.5,6.56,21.5,6.61,23.0,152.0,6.7,**
21031A0110,6.51,19.5,5.71,21.0,6.67,25.5,5.95,21.5,6.51,21.5,6.93,21.5,0.0,20.0,150.5,0.0,*********`;

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
});

// Parse CSV data
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

// Get student data by ID
function getStudentData(id, data) {
    var studentData = data.filter(function(entry) {
        return entry.ID === id;
    });

    return studentData;
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
function displayResults() {
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

    var studentData = getStudentData(studentId, parseCSV(csvData));
    if (studentData.length === 0) {
        alert('No data found for the given Roll Number.');
        return;
    }

    // Show results section
    const resultsSection = document.getElementById('results-section');
    resultsSection.classList.remove('hidden');
    setTimeout(() => {
        resultsSection.classList.add('shown');
    }, 10);

    // Display Roll Number and Branch
    var idContainer = document.getElementById('id-container');
    idContainer.innerHTML = '';

    var idHeading = document.createElement('h3');
    idHeading.className = 'text-xl mb-2';
    idHeading.innerHTML = '<span class="text-gray-300 font-semibold">Roll Number: </span><span class="text-blue-400 font-bold">' + studentId + '</span>';
    idContainer.appendChild(idHeading);

    var branchHeading = document.createElement('h3');
    branchHeading.className = 'text-xl';
    branchHeading.innerHTML = '<span class="text-gray-300 font-semibold">Branch: </span><span class="text-green-400 font-bold">' + branch + '</span>';
    idContainer.appendChild(branchHeading);

    // Display CGPA
    var cgpaContainer = document.getElementById('cgpa-container');
    cgpaContainer.innerHTML = '';

    var cgpaHeading = document.createElement('h2');
    cgpaHeading.className = 'text-3xl font-bold flex items-center justify-center gap-3';
    cgpaHeading.innerHTML = '<span class="text-white">CGPA:</span><span class="text-4xl text-white">' + studentData[0]['CGPA'] + '</span>';
    cgpaContainer.appendChild(cgpaHeading);

    // Set up progress bar for CGPA
    var cgpa = parseFloat(studentData[0]['CGPA']);
    var progressBar = document.createElement('div');
    progressBar.className = 'mt-4 h-3 bg-gray-200 rounded-full overflow-hidden';
    
    var progressFill = document.createElement('div');
    var progressPercentage = (cgpa / 10) * 100; // Assuming max CGPA is 10
    progressFill.className = 'h-full rounded-full';
    progressFill.style.width = `${progressPercentage}%`;
    
    // Set color based on CGPA
    if (cgpa >= 7.75) {
        progressFill.className += ' bg-gradient-to-r from-green-400 to-blue-500';
    } else if (cgpa >= 6.75) {
        progressFill.className += ' bg-gradient-to-r from-green-400 to-cyan-500';
    } else if (cgpa >= 5.75) {
        progressFill.className += ' bg-gradient-to-r from-yellow-400 to-orange-500';
    } else {
        progressFill.className += ' bg-gradient-to-r from-orange-400 to-red-500';
    }
    
    progressBar.appendChild(progressFill);
    cgpaContainer.appendChild(progressBar);

    // Display division message
    var message = '';
    var supplementaryAppearances = studentData[0]['Supplementary Appearances'];

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

    var messageContainer = document.getElementById('message-container');
    messageContainer.innerHTML = '';

    if (message !== '') {
        var messageElement = document.createElement('h3');
        messageElement.textContent = message;
        messageElement.className = 'text-center text-green-400 font-bold';
        messageContainer.appendChild(messageElement);
    }

    // Display Percentage and Total Credits
    var percentageTotalContainer = document.getElementById('percentage-total-container');
    percentageTotalContainer.innerHTML = '';

    var percentageDiv = document.createElement('div');
    percentageDiv.className = 'rounded-lg bg-gray-800 p-4 shadow-inner';
    
    var percentageHeading = document.createElement('h3');
    percentageHeading.className = 'flex items-center justify-between';
    
    var percentageLabel = document.createElement('span');
    percentageLabel.className = 'text-gray-300 font-semibold';
    percentageLabel.textContent = 'Percentage:';
    
    var percentageValue = document.createElement('span');
    percentageValue.className = 'text-yellow-400 font-bold text-xl';
    var percentage = ((cgpa - 0.75) * 10).toFixed(2);
    percentageValue.textContent = (percentage <= 0) ? '0' : percentage + '%';
    
    percentageHeading.appendChild(percentageLabel);
    percentageHeading.appendChild(percentageValue);
    percentageDiv.appendChild(percentageHeading);
    percentageTotalContainer.appendChild(percentageDiv);

    var creditsDiv = document.createElement('div');
    creditsDiv.className = 'rounded-lg bg-gray-800 p-4 shadow-inner';
    
    var creditsHeading = document.createElement('h3');
    creditsHeading.className = 'flex items-center justify-between';
    
    var creditsLabel = document.createElement('span');
    creditsLabel.className = 'text-gray-300 font-semibold';
    creditsLabel.textContent = 'Total Credits:';
    
    var creditsValue = document.createElement('span');
    creditsValue.className = 'text-blue-400 font-bold text-xl';
    creditsValue.textContent = studentData[0]['Total Credits'];
    
    creditsHeading.appendChild(creditsLabel);
    creditsHeading.appendChild(creditsValue);
    creditsDiv.appendChild(creditsHeading);
    percentageTotalContainer.appendChild(creditsDiv);

    // Display Supplementary Appearances
    var supplementaryAppearances = studentData[0]['Supplementary Appearances'];
    var supplementaryContainer = document.getElementById('supplementary-container');
    supplementaryContainer.innerHTML = '';

    var supplementaryHeading = document.createElement('h3');
    supplementaryHeading.className = 'flex items-center justify-between';
    
    var supplementaryLabel = document.createElement('span');
    supplementaryLabel.className = 'text-gray-300 font-semibold';
    supplementaryLabel.textContent = 'Supplementary Appearances:';
    
    var supplementaryValue = document.createElement('span');
    var suppCount = (supplementaryAppearances && supplementaryAppearances.includes('*')) 
        ? supplementaryAppearances.split('*').length - 1 
        : 0;
    
    if (suppCount > 0) {
        supplementaryValue.className = 'text-red-400 font-bold';
        supplementaryValue.textContent = suppCount;
    } else {
        supplementaryValue.className = 'text-green-400 font-bold';
        supplementaryValue.textContent = 'None';
    }
    
    supplementaryHeading.appendChild(supplementaryLabel);
    supplementaryHeading.appendChild(supplementaryValue);
    supplementaryContainer.appendChild(supplementaryHeading);

    // Create and populate semester table
    var tableContainer = document.getElementById('table-container');
    tableContainer.innerHTML = '';

    var table = document.createElement('table');
    table.className = 'min-w-full';
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
        { key: '4-1', label: 'Fourth Year - First Semester' }
    ];

    // Loop through the semesters
    semesterData.forEach(semester => {
        const sgpa = studentData[0][semester.key];
        const credits = studentData[0][`Credits_${semester.key}`];
        
        // Skip empty semesters
        if (sgpa === '' && credits === '') return;
        
        var row = document.createElement('tr');
        
        // Semester label
        var labelCell = document.createElement('td');
        labelCell.textContent = semester.label;
        labelCell.className = 'font-medium text-gray-200';
        row.appendChild(labelCell);

        // SGPA with appropriate styling
        var sgpaCell = document.createElement('td');
        if (sgpa && sgpa !== '0.0') {
            const sgpaValue = parseFloat(sgpa);
            let sgpaClass = 'font-semibold ';
            
            if (sgpaValue >= 7.75) sgpaClass += 'text-green-400';
            else if (sgpaValue >= 6.75) sgpaClass += 'text-blue-400';
            else if (sgpaValue >= 5.75) sgpaClass += 'text-yellow-400';
            else sgpaClass += 'text-red-400';
            
            sgpaCell.innerHTML = `<span class="${sgpaClass}">${sgpa}</span>`;
        } else {
            sgpaCell.innerHTML = '<span class="text-red-500">NA</span>';
        }
        row.appendChild(sgpaCell);

        // Credits
        var creditsCell = document.createElement('td');
        creditsCell.innerHTML = `<span class="bg-gray-700 px-2 py-1 rounded text-white">${credits}</span>`;
        row.appendChild(creditsCell);

        tableBody.appendChild(row);
    });
}

// Function to download results as PDF (can be implemented with jsPDF)
function downloadPDF() {
    alert('PDF download functionality will be implemented soon.');
}