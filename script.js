// ACNH Item Database Application - Google Sheets API v4
const SPREADSHEET_ID = '13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DEFAULT_API_KEY = 'AIzaSyAeRzwH9fXnFbFYuvhG_s-6i0Nc1HhcXkk'; // Embedded API key

// State management
let currentData = [];
let allData = [];
let headers = [];
let apiKey = DEFAULT_API_KEY; // Use embedded key by default

// DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const apiKeySection = document.getElementById('apiKeySection');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');
const sheetSelect = document.getElementById('sheetSelect');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const recordCount = document.getElementById('recordCount');

// Initialize the application
async function init() {
    loadApiKeyFromStorage();
    setupEventListeners();

    // Hide API key section since we have a default key
    if (apiKey) {
        apiKeySection.style.display = 'none';
        apiKeyInput.value = apiKey;
        await loadAvailableSheets();
    }
}

// Setup event listeners
function setupEventListeners() {
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    searchBtn.addEventListener('click', performSearch);
    loadBtn.addEventListener('click', loadSheetData);
    clearBtn.addEventListener('click', clearResults);

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
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

// Load available sheets from the spreadsheet
async function loadAvailableSheets() {
    if (!apiKey) {
        sheetSelect.innerHTML = '<option value="">Please enter API key first</option>';
        return;
    }

    try {
        showLoading(true);
        const url = `${API_BASE_URL}/${SPREADSHEET_ID}?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch spreadsheet metadata');
        }

        const data = await response.json();
        const sheets = data.sheets || [];

        // Populate sheet selector
        sheetSelect.innerHTML = '<option value="">Select a sheet...</option>';

        sheets.forEach(sheet => {
            const sheetTitle = sheet.properties.title;
            const option = document.createElement('option');
            option.value = sheetTitle;
            option.textContent = sheetTitle;
            sheetSelect.appendChild(option);
        });

        showLoading(false);

    } catch (error) {
        console.error('Error loading sheets:', error);
        sheetSelect.innerHTML = '<option value="">Error loading sheets</option>';
        alert('Error loading sheets. Please check your API key and try again.');
        showLoading(false);
    }
}

// Load data from selected sheet
async function loadSheetData() {
    const sheetName = sheetSelect.value;

    if (!sheetName) {
        alert('Please select a sheet first');
        return;
    }

    if (!apiKey) {
        alert('Please enter your API key first');
        return;
    }

    await fetchSheetData(sheetName);
}

// Fetch data from Google Sheets using API v4
async function fetchSheetData(sheetName) {
    showLoading(true);

    try {
        // Fetch all data from the sheet
        const range = encodeURIComponent(`${sheetName}!A:ZZ`); // Get columns A through ZZ
        const url = `${API_BASE_URL}/${SPREADSHEET_ID}/values/${range}?key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch sheet data');
        }

        const data = await response.json();
        const rows = data.values || [];

        if (rows.length === 0) {
            throw new Error('No data found in the sheet');
        }

        // Parse the data
        parseSheetData(rows);
        displayData(allData);
        updateRecordCount();

    } catch (error) {
        console.error('Error fetching data:', error);
        alert(`Error loading data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Parse sheet data from Google Sheets API response
function parseSheetData(rows) {
    if (rows.length === 0) {
        allData = [];
        headers = [];
        return;
    }

    // First row is headers
    headers = rows[0];

    // Convert remaining rows to objects
    allData = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowData = {};

        headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
        });

        allData.push(rowData);
    }

    currentData = [...allData];
}

// Display data in table
function displayData(data) {
    if (data.length === 0 || headers.length === 0) {
        resultsSection.style.display = 'none';
        return;
    }

    // Create table headers
    tableHead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.title = header; // Tooltip for long headers
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Create table rows
    tableBody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            const value = row[header] || '';
            td.textContent = value;
            td.title = value; // Tooltip for long values
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });

    resultsSection.style.display = 'block';
}

// Perform search
function performSearch() {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
        currentData = [...allData];
        displayData(currentData);
        updateRecordCount();
        return;
    }

    if (allData.length === 0) {
        alert('Please load data first by selecting a sheet and clicking "Load Data"');
        return;
    }

    // Search across all fields
    currentData = allData.filter(row => {
        return Object.values(row).some(value => {
            return String(value).toLowerCase().includes(query);
        });
    });

    displayData(currentData);
    updateRecordCount();
}

// Clear results
function clearResults() {
    searchInput.value = '';
    currentData = [...allData];
    displayData(currentData);
    updateRecordCount();
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
    }
}

// Add button to show API key section again if needed
function showApiKeySection() {
    apiKeySection.style.display = 'flex';
}

// Optional: Add a settings button to manage API key (if needed)
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Add a small settings icon to change API key if needed
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️ API Settings';
    settingsBtn.title = 'Change API Key (optional)';
    settingsBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 10px 15px; border-radius: 50px; background: #667eea; color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); z-index: 1000; font-size: 14px;';
    settingsBtn.onclick = () => {
        if (apiKeySection.style.display === 'none') {
            apiKeySection.style.display = 'flex';
            settingsBtn.textContent = '✕ Close Settings';
        } else {
            apiKeySection.style.display = 'none';
            settingsBtn.textContent = '⚙️ API Settings';
        }
    };
    document.body.appendChild(settingsBtn);
});
