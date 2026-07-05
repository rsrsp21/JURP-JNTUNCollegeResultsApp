document.addEventListener('DOMContentLoaded', function() {
    // Set up year tabs
    const yearTabs = document.querySelectorAll('.year-tab');
    yearTabs.forEach(tab => {
        tab.addEventListener('click', async function() {
            // Remove active class from all tabs
            yearTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Fetch and display data for selected year
            await fetchToppersData(this.getAttribute('data-year'));
        });
    });
    
    // Set up branch tabs
    const branchTabs = document.querySelectorAll('.branch-tab');
    branchTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            branchTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all content
            document.querySelectorAll('.branch-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show selected content
            const branch = this.getAttribute('data-branch');
            document.getElementById(`${branch}-content`).classList.add('active');
        });
    });
    
    // Show initial message instead of loading data
    document.getElementById('loading-container').innerHTML = `
        <div class="text-center">
            <i class="fas fa-calendar-alt fa-3x mb-3 text-primary"></i>
            <p>Select a year to view toppers list</p>
        </div>
    `;
});

async function fetchToppersData(year) {
    try {
        // Show loading spinner
        document.getElementById('loading-container').classList.remove('hidden');
        document.getElementById('main-content').classList.add('hidden');
        
        // Fetch toppers data from API with year parameter
        const response = await fetch(`/api/toppers?year=${year}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        
        // Hide loading spinner and show content
        document.getElementById('loading-container').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        
        // Populate the top 3 positions
        if (data.overall.length >= 3) {
            document.getElementById('overall-1st-roll').textContent = data.overall[0].roll_number;
            document.getElementById('overall-1st-cgpa').textContent = data.overall[0].cgpa;
            
            document.getElementById('overall-2nd-roll').textContent = data.overall[1].roll_number;
            document.getElementById('overall-2nd-cgpa').textContent = data.overall[1].cgpa;
            
            document.getElementById('overall-3rd-roll').textContent = data.overall[2].roll_number;
            document.getElementById('overall-3rd-cgpa').textContent = data.overall[2].cgpa;
        }
        
        // Populate tables with data
        populateToppersList('overall-toppers-list', data.overall);
        populateToppersList('ce-toppers-list', data.ce);
        populateToppersList('eee-toppers-list', data.eee);
        populateToppersList('mec-toppers-list', data.mec);
        populateToppersList('ece-toppers-list', data.ece);
        populateToppersList('cse-toppers-list', data.cse);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('loading-container').innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error loading toppers data. Please try again later.
            </div>
        `;
    }
}

function populateToppersList(tableId, toppersList) {
    const tableBody = document.getElementById(tableId);
    if (!tableBody) {
        console.error(`Table body with id ${tableId} not found`);
        return;
    }
    
    // Clear existing content
    tableBody.innerHTML = '';
    
    // Add rows for each topper
    toppersList.forEach((topper, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="rank-badge rank-badge-${index < 3 ? index + 1 : ''}">${index + 1}</span>
            </td>
            <td>
                <span class="roll-number">${topper.roll_number}</span>
            </td>
            <td>
                <span class="cgpa-badge">${topper.cgpa}</span>
            </td>
        `;
        tableBody.appendChild(row);
    });
}