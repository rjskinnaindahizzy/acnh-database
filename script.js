// ACNH Item Database Application - Google Sheets API v4
const SPREADSHEET_ID = '13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DEFAULT_API_KEY = 'AIzaSyAeRzwH9fXnFbFYuvhG_s-6i0Nc1HhcXkk'; // Embedded API key

// State management
let currentData = [];
let allData = [];
let allSheetsData = {}; // Store data from all sheets { 'SheetName': [...rows] }
let availableSheets = []; // List of all sheet names
let headers = [];
let allHeaders = []; // All available headers
let visibleColumns = []; // Currently visible column names
let apiKey = DEFAULT_API_KEY; // Use embedded key by default
let currentPage = 1;
let rowsPerPage = 50;
let sortColumn = null;
let sortDirection = 'asc';
let currentSheet = '';

// Column presets per sheet type
const COLUMN_PRESETS = {
    'Housewares': ['Name', 'Image', 'DIY', 'Buy', 'Sell', 'Color 1', 'Color 2', 'Size', 'Source', 'Catalog', 'Tag'],
    'Villagers': ['Name', 'Image', 'Species', 'Gender', 'Personality', 'Birthday', 'Catchphrase', 'Favorite Song'],
    'default': ['Name', 'Image'] // Fallback for unknown sheets
};

// DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const apiKeySection = document.getElementById('apiKeySection');
const searchInput = document.getElementById('searchInput');
const sheetSelect = document.getElementById('sheetSelect');
const diyFilter = document.getElementById('diyFilter');
const catalogFilter = document.getElementById('catalogFilter');
const columnToggleBtn = document.getElementById('columnToggleBtn');
const columnTogglePanel = document.getElementById('columnTogglePanel');
const closeColumnToggle = document.getElementById('closeColumnToggle');
const columnCheckboxes = document.getElementById('columnCheckboxes');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const emptyStateIcon = document.getElementById('emptyStateIcon');
const emptyStateTitle = document.getElementById('emptyStateTitle');
const emptyStateMessage = document.getElementById('emptyStateMessage');
const resultsSection = document.getElementById('resultsSection');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const recordCount = document.getElementById('recordCount');

// Initialize the application
async function init() {
    loadApiKeyFromStorage();
    setupEventListeners();

    // Hide filters, columns button, and stats initially
    hideFiltersAndControls();

    // Show "no sheet selected" state immediately
    showEmptyState('noSheet');

    // Hide API key section since we have a default key
    if (apiKey) {
        apiKeySection.style.display = 'none';
        apiKeyInput.value = apiKey;
        await loadAvailableSheets();
    }
}

// Hide filters and controls (shown only when sheet is selected)
function hideFiltersAndControls() {
    diyFilter.style.display = 'none';
    catalogFilter.style.display = 'none';
    columnToggleBtn.style.display = 'none';
    recordCount.style.display = 'none';
}

// Show filters and controls
function showFiltersAndControls() {
    columnToggleBtn.style.display = 'block';
    recordCount.style.display = 'block';
    // DIY and Catalog filters shown based on sheet content via updateFilterVisibility()
}

// Setup event listeners
function setupEventListeners() {
    saveApiKeyBtn.addEventListener('click', saveApiKey);

    // Real-time search
    searchInput.addEventListener('input', () => {
        applyFilters();
    });

    // Auto-load on sheet selection
    sheetSelect.addEventListener('change', () => {
        currentSheet = sheetSelect.value;

        if (currentSheet) {
            // Show controls when a sheet is selected
            showFiltersAndControls();
            updateFilterVisibility();
            applyFilters();
        } else {
            // Hide controls when "Select a sheet..." is chosen
            hideFiltersAndControls();
            showEmptyState('noSheet');
        }
    });

    // Filter changes
    diyFilter.addEventListener('change', applyFilters);
    catalogFilter.addEventListener('change', applyFilters);

    // Column toggle
    columnToggleBtn.addEventListener('click', () => {
        columnTogglePanel.style.display = columnTogglePanel.style.display === 'none' ? 'block' : 'none';
    });

    closeColumnToggle.addEventListener('click', () => {
        columnTogglePanel.style.display = 'none';
    });

    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveApiKey();
        }
    });
}

// Load API key from localStorage
function loadApiKeyFromStorage() {
    const savedKey = localStorage.getItem('googleSheetsApiKey');
    if (savedKey) {
        apiKey = savedKey;
        apiKeyInput.value = savedKey;
    } else {
        // Use default embedded key
        apiKey = DEFAULT_API_KEY;
        apiKeyInput.value = DEFAULT_API_KEY;
    }
}

// Save API key
async function saveApiKey() {
    const key = apiKeyInput.value.trim();

    if (!key) {
        apiKeyStatus.textContent = '✗ Please enter an API key';
        apiKeyStatus.className = 'error';
        return;
    }

    // Test the API key by trying to fetch spreadsheet metadata
    apiKeyStatus.textContent = 'Testing API key...';
    apiKeyStatus.className = '';

    try {
        const testUrl = `${API_BASE_URL}/${SPREADSHEET_ID}?key=${key}`;
        const response = await fetch(testUrl);

        if (!response.ok) {
            throw new Error('Invalid API key or spreadsheet not accessible');
        }

        // API key works!
        apiKey = key;
        localStorage.setItem('googleSheetsApiKey', key);
        apiKeyStatus.textContent = '✓ API Key Saved Successfully!';
        apiKeyStatus.className = 'success';

        // Hide API key section
        setTimeout(() => {
            apiKeySection.style.display = 'none';
        }, 1500);

        // Load available sheets
        await loadAvailableSheets();

    } catch (error) {
        console.error('API key validation error:', error);
        apiKeyStatus.textContent = '✗ Invalid API key. Please check and try again.';
        apiKeyStatus.className = 'error';
    }
}

// Load available sheets from the spreadsheet and fetch all data
async function loadAvailableSheets() {
    if (!apiKey) {
        sheetSelect.innerHTML = '<option value="">Please enter API key first</option>';
        return;
    }

    try {
        // Keep empty state visible while loading in background
        const url = `${API_BASE_URL}/${SPREADSHEET_ID}?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch spreadsheet metadata');
        }

        const data = await response.json();
        const sheets = data.sheets || [];

        // Store all sheet names (including Read Me)
        availableSheets = sheets.map(s => s.properties.title);

        // Populate sheet selector
        sheetSelect.innerHTML = '<option value="">Select a sheet...</option>';

        sheets.forEach(sheet => {
            const sheetTitle = sheet.properties.title;
            const option = document.createElement('option');
            option.value = sheetTitle;
            option.textContent = sheetTitle;
            sheetSelect.appendChild(option);
        });

        // Fetch data from all sheets in background
        await loadAllSheetsData();

        // Don't auto-select a sheet - keep the empty state visible

    } catch (error) {
        console.error('Error loading sheets:', error);
        sheetSelect.innerHTML = '<option value="">Error loading sheets</option>';
        alert('Error loading sheets. Please check your API key and try again.');
    }
}

// Load data from all sheets
async function loadAllSheetsData() {
    allSheetsData = {};

    for (let i = 0; i < availableSheets.length; i++) {
        const sheetName = availableSheets[i];

        try {
            const range = encodeURIComponent(`${sheetName}!A:ZZ`);
            const url = `${API_BASE_URL}/${SPREADSHEET_ID}/values/${range}?key=${apiKey}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Failed to fetch data for sheet: ${sheetName}`);
                continue;
            }

            const data = await response.json();
            const rows = data.values || [];

            if (rows.length > 0) {
                const headers = rows[0];
                const dataRows = [];

                for (let j = 1; j < rows.length; j++) {
                    const row = rows[j];
                    const rowData = { _sheet: sheetName }; // Add sheet name to each row

                    headers.forEach((header, index) => {
                        rowData[header] = row[index] || '';
                    });

                    dataRows.push(rowData);
                }

                allSheetsData[sheetName] = {
                    headers: headers,
                    data: dataRows
                };
            }

            // Add delay between requests to avoid rate limiting
            // Wait 200ms between each sheet (40 sheets = ~8 seconds total)
            if (i < availableSheets.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.error(`Error loading sheet ${sheetName}:`, error);
        }
    }
}

// Populate column toggle checkboxes
function populateColumnToggles() {
    columnCheckboxes.innerHTML = '';

    allHeaders.forEach(header => {
        const label = document.createElement('label');
        label.className = 'column-checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = visibleColumns.includes(header);
        checkbox.addEventListener('change', () => toggleColumn(header, checkbox.checked));

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + header));
        columnCheckboxes.appendChild(label);
    });
}

// Toggle column visibility
function toggleColumn(columnName, isVisible) {
    if (isVisible && !visibleColumns.includes(columnName)) {
        visibleColumns.push(columnName);
    } else if (!isVisible) {
        visibleColumns = visibleColumns.filter(col => col !== columnName);
    }

    headers = visibleColumns;
    displayData(currentData);
}

// Update filter visibility based on selected sheet
function updateFilterVisibility() {
    // Show DIY and Catalog filters only for sheets that have these columns
    const sheetData = allSheetsData[currentSheet];

    if (sheetData && sheetData.headers) {
        const hasDIY = sheetData.headers.includes('DIY');
        const hasCatalog = sheetData.headers.includes('Catalog');

        diyFilter.style.display = hasDIY ? 'block' : 'none';
        catalogFilter.style.display = hasCatalog ? 'block' : 'none';

        // Reset filter values when switching sheets
        diyFilter.value = '';
        catalogFilter.value = '';
    }
}

// Display data in table with pagination
function displayData(data, isMultiSheet = false) {
    if (data.length === 0 || headers.length === 0) {
        resultsSection.style.display = 'none';

        // Determine which empty state to show
        if (!currentSheet) {
            showEmptyState('noSheet');
        } else if (searchInput.value.trim().length > 0 || diyFilter.value || catalogFilter.value) {
            showEmptyState('noResults');
        } else {
            showEmptyState('welcome');
        }
        return;
    }

    // Hide empty state when we have data
    hideEmptyState();

    // Create table headers with sorting
    tableHead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.title = `Click to sort by ${header}`;
        th.className = 'sortable';

        // Add sort indicators
        if (sortColumn === header) {
            th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }

        // Add click handler for sorting
        th.addEventListener('click', () => sortBy(header, isMultiSheet));

        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Calculate pagination
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    // Create table rows with optional grouping by sheet
    tableBody.innerHTML = '';

    if (isMultiSheet) {
        // Group by sheet for visual separation
        let currentSheetName = null;

        paginatedData.forEach(row => {
            // Add sheet separator row if sheet changed
            if (row._sheet !== currentSheetName) {
                currentSheetName = row._sheet;
                const separatorRow = document.createElement('tr');
                separatorRow.className = 'sheet-separator';
                const separatorCell = document.createElement('td');
                separatorCell.colSpan = headers.length;
                separatorCell.textContent = `── ${currentSheetName} ──`;
                separatorRow.appendChild(separatorCell);
                tableBody.appendChild(separatorRow);
            }

            const tr = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                let value;

                // Handle special "Sheet" column
                if (header === 'Sheet') {
                    value = row._sheet || '';
                } else {
                    value = row[header] || '';
                }

                // Special handling for Image column
                if (header === 'Image' && value && value.startsWith('http')) {
                    const img = document.createElement('img');
                    img.src = value;
                    img.alt = row['Name'] || 'Image';
                    img.className = 'item-image';
                    img.loading = 'lazy';
                    td.appendChild(img);
                    td.className = 'image-cell';
                } else {
                    td.textContent = value;
                    td.title = 'Click to expand';

                    // Click to expand/collapse
                    td.addEventListener('click', function() {
                        this.classList.toggle('expanded');
                    });
                }

                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    } else {
        // Normal single-sheet display
        paginatedData.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                const value = row[header] || '';

                // Special handling for Image column
                if (header === 'Image' && value && value.startsWith('http')) {
                    const img = document.createElement('img');
                    img.src = value;
                    img.alt = row['Name'] || 'Image';
                    img.className = 'item-image';
                    img.loading = 'lazy';
                    td.appendChild(img);
                    td.className = 'image-cell';
                } else {
                    td.textContent = value;
                    td.title = 'Click to expand';

                    // Click to expand/collapse
                    td.addEventListener('click', function() {
                        this.classList.toggle('expanded');
                    });
                }

                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    }

    // Add pagination controls
    renderPagination(data.length);

    resultsSection.style.display = 'block';
}

// Sort data by column
function sortBy(column, isMultiSheet = false) {
    if (sortColumn === column) {
        // Toggle direction
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    currentData.sort((a, b) => {
        let aVal, bVal;

        // Handle Sheet column specially
        if (column === 'Sheet') {
            aVal = String(a._sheet || '').toLowerCase();
            bVal = String(b._sheet || '').toLowerCase();
        } else {
            aVal = String(a[column] || '').toLowerCase();
            bVal = String(b[column] || '').toLowerCase();
        }

        // Try to parse as numbers
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        if (sortDirection === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });

    currentPage = 1; // Reset to first page
    displayData(currentData, isMultiSheet);
    updateRecordCount();
}

// Render pagination controls
function renderPagination(totalRecords) {
    const totalPages = Math.ceil(totalRecords / rowsPerPage);

    // Remove existing pagination if present
    let paginationDiv = document.querySelector('.pagination');
    if (paginationDiv) {
        paginationDiv.remove();
    }

    if (totalPages <= 1) return; // No pagination needed

    paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayData(currentData);
            updateRecordCount();
        }
    });
    paginationDiv.appendChild(prevBtn);

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    paginationDiv.appendChild(pageInfo);

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayData(currentData);
            updateRecordCount();
        }
    });
    paginationDiv.appendChild(nextBtn);

    // Add export button
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📥 Export CSV';
    exportBtn.className = 'export-btn';
    exportBtn.title = 'Export current data to CSV';
    exportBtn.addEventListener('click', exportToCSV);
    paginationDiv.appendChild(exportBtn);

    resultsSection.appendChild(paginationDiv);
}

// Apply all filters (search + DIY + Catalog)
function applyFilters() {
    if (Object.keys(allSheetsData).length === 0) {
        showEmptyState('welcome');
        return; // No data loaded
    }

    const query = searchInput.value.toLowerCase().trim();
    const diyValue = diyFilter.value;
    const catalogValue = catalogFilter.value;
    const hasSearch = query.length > 0;

    let combinedData = [];
    let isMultiSheet = false;

    // If searching, search across ALL sheets
    if (hasSearch) {
        for (const sheetName of availableSheets) {
            const sheetData = allSheetsData[sheetName];
            if (!sheetData || !sheetData.data) continue;

            const filteredRows = sheetData.data.filter(row => {
                // Search filter
                const matchesSearch = Object.values(row).some(value => {
                    return String(value).toLowerCase().includes(query);
                });
                if (!matchesSearch) return false;

                // DIY filter (only if this sheet has DIY column)
                if (diyValue && sheetData.headers.includes('DIY') && row['DIY'] !== diyValue) {
                    return false;
                }

                // Catalog filter (only if this sheet has Catalog column)
                if (catalogValue && sheetData.headers.includes('Catalog') && row['Catalog'] !== catalogValue) {
                    return false;
                }

                return true;
            });

            combinedData = combinedData.concat(filteredRows);
        }

        // If a specific sheet is selected, filter results to only that sheet
        if (currentSheet) {
            combinedData = combinedData.filter(row => row._sheet === currentSheet);
        }

        // Check if results come from multiple sheets
        const uniqueSheets = new Set(combinedData.map(row => row._sheet));
        isMultiSheet = uniqueSheets.size > 1;

        // Sort by sheet name to group results together
        if (isMultiSheet) {
            combinedData.sort((a, b) => {
                return a._sheet.localeCompare(b._sheet);
            });
        }

    } else {
        // No search - show data from currently selected sheet only
        if (!currentSheet || !allSheetsData[currentSheet]) {
            currentData = [];
            allData = [];
            updateRecordCount();
            showEmptyState('noSheet');
            return;
        }

        const sheetData = allSheetsData[currentSheet];
        let filteredRows = sheetData.data.filter(row => {
            // DIY filter
            if (diyValue && row['DIY'] !== diyValue) {
                return false;
            }

            // Catalog filter
            if (catalogValue && row['Catalog'] !== catalogValue) {
                return false;
            }

            return true;
        });

        combinedData = filteredRows;
        isMultiSheet = false;
    }

    // Set up headers and visible columns
    setupHeadersForDisplay(isMultiSheet, combinedData);

    currentData = combinedData;
    allData = combinedData;
    currentPage = 1; // Reset to first page

    displayData(currentData, isMultiSheet);
    updateRecordCount();
}

// Setup headers based on display mode
function setupHeadersForDisplay(isMultiSheet, data) {
    if (isMultiSheet) {
        // Multi-sheet results - show common columns plus Sheet column
        const allHeaders = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key !== '_sheet') {
                    allHeaders.add(key);
                }
            });
        });

        // Prioritize Name and Image, then add Sheet
        visibleColumns = ['Sheet'];
        if (allHeaders.has('Name')) visibleColumns.push('Name');
        if (allHeaders.has('Image')) visibleColumns.push('Image');

        // Add other common columns
        const commonCols = Array.from(allHeaders).filter(h => h !== 'Name' && h !== 'Image');
        visibleColumns = visibleColumns.concat(commonCols.slice(0, 8)); // Limit to reasonable number

        headers = visibleColumns;
        allHeaders.clear();

    } else if (currentSheet && allSheetsData[currentSheet]) {
        // Single sheet - use preset columns
        const sheetData = allSheetsData[currentSheet];
        allHeaders = sheetData.headers;

        const preset = COLUMN_PRESETS[currentSheet] || COLUMN_PRESETS['default'];
        visibleColumns = allHeaders.filter(h => preset.includes(h));

        if (visibleColumns.length === 0) {
            visibleColumns = allHeaders.slice(0, Math.min(10, allHeaders.length));
        }

        headers = visibleColumns;

        // Populate column toggle UI
        populateColumnToggles();
    }
}

// Update record count
function updateRecordCount() {
    if (allData.length === 0) {
        recordCount.textContent = 'No data loaded';
    } else if (currentData.length === allData.length) {
        recordCount.textContent = `Showing all ${allData.length} records`;
    } else {
        recordCount.textContent = `Showing ${currentData.length} of ${allData.length} records`;
    }
}

// Show/hide loading indicator
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    if (!show) {
        resultsSection.style.display = allData.length > 0 ? 'block' : 'none';
    } else {
        resultsSection.style.display = 'none';
        emptyState.style.display = 'none';
    }
}

// Update empty state display
function updateEmptyState(type = 'welcome') {
    const states = {
        welcome: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>`,
            title: 'Welcome to ACNH Database!',
            message: 'Select a sheet from the dropdown above to explore items, villagers, and more.'
        },
        noResults: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>`,
            title: 'No Items Found',
            message: 'Try adjusting your search terms or filters to find what you\'re looking for.'
        },
        noSheet: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>`,
            title: 'No Sheet Selected',
            message: 'Please select a sheet from the dropdown to view data.'
        }
    };

    const state = states[type] || states.welcome;
    emptyStateIcon.innerHTML = state.icon;
    emptyStateTitle.textContent = state.title;
    emptyStateMessage.textContent = state.message;
}

// Show empty state
function showEmptyState(type = 'welcome') {
    updateEmptyState(type);
    emptyState.style.display = 'block';
    resultsSection.style.display = 'none';
    loading.style.display = 'none';
}

// Hide empty state
function hideEmptyState() {
    emptyState.style.display = 'none';
}

// Add button to show API key section again if needed
function showApiKeySection() {
    apiKeySection.style.display = 'flex';
}

// Export data to CSV
function exportToCSV() {
    if (currentData.length === 0) {
        alert('No data to export');
        return;
    }

    // Create CSV content
    let csv = '';

    // Add headers
    csv += headers.map(h => `"${h}"`).join(',') + '\n';

    // Add data rows
    currentData.forEach(row => {
        const values = headers.map(header => {
            const value = String(row[header] || '').replace(/"/g, '""');
            return `"${value}"`;
        });
        csv += values.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const sheetName = sheetSelect.value || 'data';
    link.setAttribute('href', url);
    link.setAttribute('download', `acnh_${sheetName.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Optional: Add a settings button to manage API key (if needed)
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Add API settings link to footer
    const footer = document.querySelector('footer');
    const settingsPara = document.createElement('p');
    settingsPara.style.marginTop = '10px';

    const settingsLink = document.createElement('a');
    settingsLink.textContent = 'API Settings';
    settingsLink.href = '#';
    settingsLink.className = 'settings-link';
    settingsLink.onclick = (e) => {
        e.preventDefault();
        if (apiKeySection.style.display === 'none') {
            apiKeySection.style.display = 'flex';
            settingsLink.textContent = 'Close API Settings';
        } else {
            apiKeySection.style.display = 'none';
            settingsLink.textContent = 'API Settings';
        }
    };

    settingsPara.appendChild(settingsLink);
    footer.appendChild(settingsPara);
});
