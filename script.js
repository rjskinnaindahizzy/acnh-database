// ACNH Item Database Application - Google Sheets API v4
const SPREADSHEET_ID = '13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DEFAULT_API_KEY = (typeof window !== 'undefined' && window.DEFAULT_API_KEY) ? window.DEFAULT_API_KEY : ''; // Load from config if present
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// State management
let currentData = [];
let allData = [];
let allSheetsData = {}; // Store data from all sheets { 'SheetName': [...rows] }
let availableSheets = []; // List of all sheet names
let headers = [];
let allHeaders = []; // All available headers
let visibleColumns = []; // Currently visible column names
let sheetLoadPromises = {}; // Track in-flight sheet fetches to avoid duplicate requests
let apiKey = DEFAULT_API_KEY; // Default from config if available
let currentPage = 1;
let rowsPerPage = 50;
let sortColumn = null;
let sortDirection = 'asc';
let currentSheet = '';
let cacheDisabled = false; // disable caching after quota errors
let prefetchQueue = [];
let prefetchAbortToken = 0;
let prefetchInFlight = 0;
let prefetchRunning = false;
let shouldFocusSort = false; // Flag to restore focus to sort header
let shouldFocusPagination = null; // Flag to restore focus to pagination buttons
let isCurrentMultiSheet = false; // Track whether current display is multi-sheet
const PREFETCH_CONCURRENCY = 2;
const MOST_USED_SHEETS = [
    'Housewares',
    'Villagers',
    'Recipes',
    'Tools/Goods',
    'Miscellaneous',
    'Interior Structures',
    'Wallpaper',
    'Floors',
    'Rugs',
    'Music'
];

// Column presets per sheet type
const COLUMN_PRESETS = {
    'Housewares': ['Name', 'Image', 'DIY', 'Buy', 'Sell', 'Color 1', 'Color 2', 'Size', 'Source', 'Catalog', 'Tag'],
    'Villagers': ['Name', 'Image', 'Species', 'Gender', 'Personality', 'Birthday', 'Catchphrase', 'Favorite Song'],
    'default': ['Name', 'Image'] // Fallback for unknown sheets
};

// DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const apiKeySection = document.getElementById('apiKeySection');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const sheetSelect = document.getElementById('sheetSelect');
const diyFilter = document.getElementById('diyFilter');
const catalogFilter = document.getElementById('catalogFilter');
const wrapTextBtn = document.getElementById('wrapTextBtn');
const columnToggleBtn = document.getElementById('columnToggleBtn');
const columnTogglePanel = document.getElementById('columnTogglePanel');
const closeColumnToggle = document.getElementById('closeColumnToggle');
const refreshBtn = document.getElementById('refreshBtn');
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
const toastContainer = document.getElementById('toast-container');

// IndexedDB for sheet caching
const DB_NAME = 'acnhSheetCache';
const DB_VERSION = 1;
let dbPromise = null;

// Initialize the application
async function init() {
    loadApiKeyFromStorage();
    setupEventListeners();

    // Restore wrap text preference
    const wrapText = localStorage.getItem('acnh_wrap_text');
    if (wrapText === 'true') {
        const table = document.getElementById('dataTable');
        if (table) table.classList.add('wrap-text');
        if (wrapTextBtn) wrapTextBtn.setAttribute('aria-pressed', 'true');
    }

    // Hide filters, columns button, and stats initially
    hideFiltersAndControls();

    // Show loading state while we fetch sheets
    showEmptyState('loading');
    sheetSelect.disabled = true;
    sheetSelect.innerHTML = '<option value="">Loading sheets...</option>';

    // Hide API key section since we have a default key
    if (apiKey) {
        apiKeySection.style.display = 'none';
        apiKeyInput.value = apiKey;
        await loadAvailableSheets();
    } else {
        // No API key - show the API key section
        showEmptyState('noApiKey');
        sheetSelect.innerHTML = '<option value="">Please enter API key first</option>';
    }
}

// Hide filters and controls (shown only when sheet is selected)
function hideFiltersAndControls() {
    diyFilter.style.display = 'none';
    catalogFilter.style.display = 'none';
    if (wrapTextBtn) wrapTextBtn.style.display = 'none';
    columnToggleBtn.style.display = 'none';
    refreshBtn.style.display = 'none';
    recordCount.style.display = 'none';
}

// Show filters and controls
function showFiltersAndControls() {
    if (wrapTextBtn) wrapTextBtn.style.display = 'inline-flex';
    columnToggleBtn.style.display = 'block';
    refreshBtn.style.display = 'block';
    recordCount.style.display = 'block';
    // DIY and Catalog filters shown based on sheet content via updateFilterVisibility()
}

// Setup event listeners
function setupEventListeners() {
    saveApiKeyBtn.addEventListener('click', saveApiKey);

    // Toggle API Key visibility
    if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener('click', () => {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';

            // Update icon and aria-label
            if (isPassword) {
                // Switch to "Hide" icon (Eye Off)
                toggleApiKeyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
                toggleApiKeyBtn.setAttribute('aria-label', 'Hide API key');
                toggleApiKeyBtn.setAttribute('title', 'Hide API key');
            } else {
                // Switch to "Show" icon (Eye)
                toggleApiKeyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                toggleApiKeyBtn.setAttribute('aria-label', 'Show API key');
                toggleApiKeyBtn.setAttribute('title', 'Show API key');
            }
        });
    }

    // Real-time search
    searchInput.addEventListener('input', () => {
        cancelPrefetch('search change');
        updateClearButton();
        applyFilters();
    });

    // Clear button functionality
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            updateClearButton();
            applyFilters();
        });
    }

    // Keyboard shortcut '/' to focus search
    document.addEventListener('keydown', (e) => {
        // Check if user pressed '/' and isn't currently in an input/textarea
        if (e.key === '/' &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'TEXTAREA') {

            e.preventDefault(); // Prevent '/' from being typed if focusing
            searchInput.focus();
        }

        // Escape to clear search
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            if (searchInput.value) {
                searchInput.value = '';
                updateClearButton();
                applyFilters();
            } else {
                searchInput.blur();
            }
        }
    });

    // Auto-load on sheet selection
    sheetSelect.addEventListener('change', async () => {
        currentSheet = sheetSelect.value;
        // UX: Save selection to restore on reload
        if (currentSheet) {
            localStorage.setItem('acnh_last_sheet', currentSheet);
        } else {
            localStorage.removeItem('acnh_last_sheet');
        }

        const hasSearch = searchInput.value.trim().length > 0;

        cancelPrefetch('sheet change');

        if (currentSheet) {
            // Show controls when a sheet is selected
            showFiltersAndControls();
            try {
                await loadSheetData(currentSheet);
                updateFilterVisibility();
                await applyFilters();
                startPrefetchQueue();
            } catch (error) {
                console.error(`Error loading sheet ${currentSheet}:`, error);
                showEmptyState('error');
                updateEmptyStateMessage(error.message || 'Failed to load sheet data. Please try again.');
            }
        } else {
            // Hide controls when "Select a sheet..." is chosen
            hideFiltersAndControls();
            // If there's a search term, run a global search; otherwise show no-sheet state
            if (hasSearch) {
                await applyFilters();
            } else {
                showEmptyState('noSheet');
            }
        }
    });

    // Filter changes
    diyFilter.addEventListener('change', applyFilters);
    catalogFilter.addEventListener('change', applyFilters);

    // Wrap Text toggle
    if (wrapTextBtn) {
        wrapTextBtn.addEventListener('click', () => {
            const table = document.getElementById('dataTable');
            const isWrapped = table.classList.toggle('wrap-text');
            wrapTextBtn.setAttribute('aria-pressed', String(isWrapped));
            localStorage.setItem('acnh_wrap_text', String(isWrapped));
        });
    }

    // Column toggle
    columnToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent closing immediately
        const isHidden = columnTogglePanel.style.display === 'none';
        columnTogglePanel.style.display = isHidden ? 'block' : 'none';

        // Update aria-expanded
        columnToggleBtn.setAttribute('aria-expanded', isHidden);

        if (isHidden) {
            // Panel is opening, move focus to close button for accessibility
            closeColumnToggle.focus();
        }
    });

    closeColumnToggle.addEventListener('click', () => {
        columnTogglePanel.style.display = 'none';
        columnToggleBtn.setAttribute('aria-expanded', 'false');
        // Return focus to the button that opened it
        columnToggleBtn.focus();
    });

    // Close column toggle on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && columnTogglePanel.style.display !== 'none') {
            columnTogglePanel.style.display = 'none';
            columnToggleBtn.setAttribute('aria-expanded', 'false');
            columnToggleBtn.focus();
        }
    });

    // Close column toggle when clicking outside
    document.addEventListener('click', (e) => {
        if (columnTogglePanel.style.display !== 'none' &&
            !columnTogglePanel.contains(e.target) &&
            e.target !== columnToggleBtn) {
            columnTogglePanel.style.display = 'none';
            columnToggleBtn.setAttribute('aria-expanded', 'false');
        }
    });

    // Prevent clicks inside panel from closing it
    columnTogglePanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    refreshBtn.addEventListener('click', async () => {
        if (!currentSheet) {
            showEmptyState('noSheet');
            return;
        }

        // UX: Loading state
        const originalBtnContent = refreshBtn.innerHTML;
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span class="btn-spinner"></span> Refreshing...';

        await clearSheetCache(currentSheet);
        cancelPrefetch('manual refresh');

        let success = false;
        try {
            await loadSheetData(currentSheet, { forceRefresh: true });
            updateFilterVisibility();
            await applyFilters();
            success = true;
        } catch (error) {
            console.error(`Error refreshing sheet ${currentSheet}:`, error);
            showEmptyState('error', {
                title: `Failed to refresh ${currentSheet}`,
                message: error.message || 'Please try again.'
            });
        } finally {
            if (success) {
                // Show success state briefly
                refreshBtn.innerHTML = '<span role="img" aria-label="Success">✓</span> Refreshed!';
                refreshBtn.style.background = 'var(--success)';
                refreshBtn.style.color = 'white';
                refreshBtn.style.borderColor = 'var(--success)';

                // Revert to original state after delay
                setTimeout(() => {
                    refreshBtn.innerHTML = originalBtnContent;
                    refreshBtn.style.background = '';
                    refreshBtn.style.color = '';
                    refreshBtn.style.borderColor = '';
                    refreshBtn.disabled = false;
                }, 2000);
            } else {
                // Error case: revert immediately
                refreshBtn.innerHTML = originalBtnContent;
                refreshBtn.disabled = false;
            }
        }
    });

    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveApiKey();
        }
    });

    // Back to Top functionality
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            // For keyboard accessibility, move focus to the top of the container
            // We focus the header or a top element to ensure tab order restarts from top
            const h1 = document.querySelector('header h1');
            if (h1) h1.focus();
        });
    }
}

// Cache helpers (IndexedDB)
function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('sheets')) {
                db.createObjectStore('sheets', { keyPath: 'name' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}

async function getCachedSheet(sheetName) {
    if (cacheDisabled) return null;
    try {
        const db = await getDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('sheets', 'readonly');
            const store = tx.objectStore('sheets');
            const req = store.get(sheetName);
            req.onsuccess = () => {
                const row = req.result;
                if (!row) return resolve(null);
                const { timestamp, headers, data } = row;
                if (!timestamp || !headers || !data) return resolve(null);
                const isFresh = Date.now() - timestamp < CACHE_TTL_MS;
                if (!isFresh) {
                    clearSheetCache(sheetName).then(() => resolve(null)).catch(() => resolve(null));
                    return;
                }
                resolve({ headers, data });
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('Error reading cache for', sheetName, err);
        cacheDisabled = true;
        return null;
    }
}

async function saveSheetToCache(sheetName, sheetData) {
    if (cacheDisabled) return;
    try {
        const db = await getDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('sheets', 'readwrite');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.objectStore('sheets').put({
                name: sheetName,
                timestamp: Date.now(),
                headers: sheetData.headers,
                data: sheetData.data
            });
        });
    } catch (err) {
        console.warn('Unable to cache sheet', sheetName, err);
        cacheDisabled = true; // stop further cache attempts after quota errors
        cancelPrefetch('cache quota exceeded');
    }
}

async function clearSheetCache(sheetName) {
    try {
        const db = await getDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('sheets', 'readwrite');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.objectStore('sheets').delete(sheetName);
        });
        delete allSheetsData[sheetName];
    } catch (err) {
        console.warn('Unable to clear cache for', sheetName, err);
    }
}

// Load API key from localStorage
function loadApiKeyFromStorage() {
    const savedKey = localStorage.getItem('googleSheetsApiKey');
    if (savedKey) {
        apiKey = savedKey;
        apiKeyInput.value = savedKey;
    } else {
        // Use default key from optional config file, otherwise stay empty and prompt user
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

    // UX: Loading state
    const originalBtnContent = saveApiKeyBtn.innerHTML;
    saveApiKeyBtn.disabled = true;
    saveApiKeyBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';

    try {
        const testUrl = `${API_BASE_URL}/${SPREADSHEET_ID}?key=${key}`;
        const response = await fetch(testUrl);

        if (!response.ok) {
            throw new Error('Invalid API key or spreadsheet not accessible');
        }

        // API key works!
        apiKey = key;
        localStorage.setItem('googleSheetsApiKey', key);
        showToast('API Key Saved Successfully!', 'success');
        apiKeyStatus.textContent = '✓ Saved';
        apiKeyStatus.className = 'success';

        // Hide API key section
        setTimeout(() => {
            apiKeySection.style.display = 'none';
        }, 1000);

        // Load available sheets
        await loadAvailableSheets();

    } catch (error) {
        console.error('API key validation error:', error);
        showToast('Invalid API key. Please check and try again.', 'error');
        apiKeyStatus.textContent = '✗ Invalid API key. Please check and try again.';
        apiKeyStatus.className = 'error';
    } finally {
        saveApiKeyBtn.disabled = false;
        saveApiKeyBtn.innerHTML = originalBtnContent;
    }
}

// Load available sheets from the spreadsheet and fetch all data
async function loadAvailableSheets() {
    if (!apiKey) {
        sheetSelect.innerHTML = '<option value="">Please enter API key first</option>';
        sheetSelect.disabled = true;
        return;
    }

    try {
        // Reset loaded data for fresh session
        allSheetsData = {};
        sheetLoadPromises = {};

        // Show loading state
        showEmptyState('loading');
        updateEmptyStateMessage('Fetching spreadsheet information...');

        const url = `${API_BASE_URL}/${SPREADSHEET_ID}?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('API key is invalid or does not have permission to access this spreadsheet.');
            } else if (response.status === 429) {
                throw new Error('Too many requests. Please try again in a moment.');
            } else {
                throw new Error(`Failed to fetch spreadsheet (Error ${response.status})`);
            }
        }

        const data = await response.json();
        const sheets = data.sheets || [];

        if (sheets.length === 0) {
            throw new Error('No sheets found in the spreadsheet.');
        }

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

        // Enable the selector and prompt user to choose a sheet
        sheetSelect.disabled = false;

        // UX: Restore last used sheet if available
        const lastSheet = localStorage.getItem('acnh_last_sheet');
        if (lastSheet && availableSheets.includes(lastSheet)) {
            sheetSelect.value = lastSheet;
            // Manually trigger change event to load data
            sheetSelect.dispatchEvent(new Event('change'));
        } else {
            updateEmptyStateMessage(`Found ${availableSheets.length} sheets. Select one to load.`);
            showEmptyState('noSheet');
        }

    } catch (error) {
        console.error('Error loading sheets:', error);
        sheetSelect.innerHTML = '<option value="">Error loading sheets</option>';
        sheetSelect.disabled = true;
        showEmptyState('error');
        updateEmptyStateMessage(error.message || 'Failed to load sheets. Please check your connection and try again.');
    }
}

function resolveImageUrl(value) {
    if (typeof value !== 'string') return '';

    const trimmed = value.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('http')) {
        return trimmed;
    }

    const quotedFormulaMatch = trimmed.match(/IMAGE\(\s*(['"])(.*?)\1/i);
    if (quotedFormulaMatch && quotedFormulaMatch[2]) {
        return quotedFormulaMatch[2].trim();
    }

    const formulaMatch = trimmed.match(/IMAGE\(\s*([^"')\s]+)\s*\)/i);
    if (formulaMatch && formulaMatch[1]) {
        return formulaMatch[1].trim();
    }

    const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch && urlMatch[0]) {
        return urlMatch[0].trim();
    }

    return '';
}

function isImageHeader(header) {
    return String(header || '').trim().toLowerCase().startsWith('image');
}

function isImageFormulaValue(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim().toUpperCase();
    return trimmed.startsWith('=IMAGE(') || trimmed.startsWith('IMAGE(');
}

function isLikelyImageUrl(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(trimmed);
}

// Helper to escape HTML characters
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight search terms in text
function highlightText(text, query) {
    if (!query) return escapeHtml(text);

    // Split by the query (case-insensitive) to preserve original casing
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const parts = String(text).split(regex);

    return parts.map(part => {
        if (part.toLowerCase() === query.toLowerCase()) {
            return `<mark>${escapeHtml(part)}</mark>`;
        }
        return escapeHtml(part);
    }).join('');
}

// Group rows by Name for collapsible variant display.
// Returns an array of { name, rows } objects preserving original order.
function groupRowsByName(rows) {
    const groups = new Map();
    const order = [];
    let blankId = 0;

    for (const row of rows) {
        const name = row['Name'] || '';
        // Treat each blank-name row as its own group to avoid
        // collapsing unrelated rows that happen to lack a Name.
        const key = name === '' ? `\x00blank_${blankId++}` : name;
        if (!groups.has(key)) {
            groups.set(key, []);
            order.push(key);
        }
        groups.get(key).push(row);
    }

    return order.map(key => ({ name: groups.get(key)[0]['Name'] || '', rows: groups.get(key) }));
}

// Check if a column holds image data (by header name or by its values).
function isImageColumn(col, rows) {
    if (isImageHeader(col)) return true;
    // Sample first row's value to detect image URLs / formulas
    const sample = String((rows[0] && rows[0][col]) ?? '');
    return isImageFormulaValue(sample) || isLikelyImageUrl(sample);
}

// Build a variant label for each row in a group by finding which columns
// actually differ between variants (e.g. "Yellow", "Green" for Color 1).
function getVariantLabels(groupRows, hdrs) {
    // Columns that commonly distinguish variants, checked in priority order
    const candidateCols = [
        'Variation', 'Variant', 'Color 1', 'Color 2',
        'Pattern', 'Body Color', 'Filename'
    ];

    // Find which candidate columns actually vary across these rows
    const differingCols = [];
    for (const col of candidateCols) {
        if (!hdrs.includes(col)) continue;
        if (isImageColumn(col, groupRows)) continue;
        const values = new Set(groupRows.map(r => String(r[col] ?? '').trim()));
        if (values.size > 1) differingCols.push(col);
    }

    // Fallback: if no known variant columns differ, scan all visible columns
    if (differingCols.length === 0) {
        for (const col of hdrs) {
            if (col === 'Name') continue;
            if (isImageColumn(col, groupRows)) continue;
            const values = new Set(groupRows.map(r => String(r[col] ?? '').trim()));
            if (values.size > 1) {
                differingCols.push(col);
                break;
            }
        }
    }

    return groupRows.map((row, i) => {
        if (differingCols.length === 0) return `Variant ${i + 1}`;
        const parts = differingCols
            .map(col => String(row[col] ?? '').trim())
            .filter(Boolean);
        // Remove duplicate values (e.g. Variation="Yellow" and Color 1="Yellow")
        const unique = [...new Set(parts)];
        return unique.length > 0 ? unique.join(' / ') : `Variant ${i + 1}`;
    });
}

// Create a single table row element from row data.
function createDataRow(row, hdrs, searchQuery) {
    const tr = document.createElement('tr');

    hdrs.forEach(header => {
        const td = document.createElement('td');
        const value = (header === 'Sheet') ? (row._sheet || '') : (row[header] || '');

        const shouldRenderImage = isImageHeader(header) || isImageFormulaValue(value) || isLikelyImageUrl(value);
        const resolvedUrl = shouldRenderImage ? resolveImageUrl(value) : '';

        if (shouldRenderImage && resolvedUrl) {
            const img = document.createElement('img');
            img.src = resolvedUrl;
            img.alt = row['Name'] || 'Image';
            img.className = 'item-image';
            img.loading = 'lazy';
            td.appendChild(img);
            td.className = 'image-cell';
        } else {
            if (searchQuery) {
                td.innerHTML = highlightText(value, searchQuery);
            } else {
                td.textContent = value;
            }
            td.title = 'Click to expand';
            td.addEventListener('click', function() {
                this.classList.toggle('expanded');
            });
        }

        tr.appendChild(td);
    });

    return tr;
}

// Load data for a single sheet (lazy-loaded)
async function loadSheetData(sheetName, { forceRefresh = false, showLoading = true } = {}) {
    if (!sheetName) return null;

    if (!forceRefresh && allSheetsData[sheetName]) {
        return allSheetsData[sheetName];
    }

    if (!forceRefresh) {
        const cached = await getCachedSheet(sheetName);
        if (cached) {
            allSheetsData[sheetName] = cached;
            return cached;
        }
    }

    if (sheetLoadPromises[sheetName]) {
        return sheetLoadPromises[sheetName];
    }

    sheetLoadPromises[sheetName] = (async () => {
        if (showLoading) {
            showEmptyState('loading', {
                title: `Loading ${sheetName}...`,
                message: 'Fetching latest data from Google Sheets.'
            });
        }

        const range = encodeURIComponent(`${sheetName}!A:ZZ`);
        const url = `${API_BASE_URL}/${SPREADSHEET_ID}/values/${range}?key=${apiKey}&valueRenderOption=FORMULA`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('API key is invalid or does not have permission to access this spreadsheet.');
            } else if (response.status === 429) {
                throw new Error('Rate limit reached while loading data. Please try again shortly.');
            } else {
                throw new Error(`Failed to load ${sheetName} (Error ${response.status})`);
            }
        }

        const data = await response.json();
        const rows = data.values || [];
        const headers = rows[0] || [];
        const dataRows = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowData = { _sheet: sheetName }; // Add sheet name to each row

            headers.forEach((header, index) => {
                const value = row[index] || '';
                const shouldResolveImage = isImageHeader(header) || isImageFormulaValue(value);
                rowData[header] = shouldResolveImage ? resolveImageUrl(value) : value;
            });

            dataRows.push(rowData);
        }

        const sheetData = { headers, data: dataRows };
        allSheetsData[sheetName] = sheetData;
        await saveSheetToCache(sheetName, sheetData);
        return sheetData;
    })().finally(() => {
        delete sheetLoadPromises[sheetName];
    });

    return sheetLoadPromises[sheetName];
}

// Ensure all sheets are loaded when performing a cross-sheet search
async function ensureSheetsLoadedForSearch() {
    const missingSheets = [];

    // Try to hydrate from cache first
    for (const name of availableSheets) {
        if (allSheetsData[name]) continue;
        const cached = await getCachedSheet(name);
        if (cached) {
            allSheetsData[name] = cached;
        } else {
            missingSheets.push(name);
        }
    }

    if (missingSheets.length === 0) return;

    showEmptyState('loading', {
        title: 'Loading sheets...',
        message: `Batch loading ${missingSheets.length} sheet(s)...`
    });

    const chunkSize = 10;
    let loadedCount = 0;
    for (let i = 0; i < missingSheets.length; i += chunkSize) {
        const chunk = missingSheets.slice(i, i + chunkSize).filter(name => !sheetLoadPromises[name]);
        if (chunk.length === 0) continue;

        const chunkPromise = fetchSheetsBatch(chunk).finally(() => {
            chunk.forEach(name => delete sheetLoadPromises[name]);
        });
        chunk.forEach(name => {
            sheetLoadPromises[name] = chunkPromise;
        });

        await chunkPromise;

        loadedCount += chunk.length;
        const percentage = Math.round((loadedCount / missingSheets.length) * 100);
        showEmptyState('loading', {
            title: `Loading sheets (${loadedCount}/${missingSheets.length})...`,
            message: `${percentage}% complete`
        });
    }
}

// Batch-fetch multiple sheets to reduce latency
async function fetchSheetsBatch(sheetNames) {
    if (!sheetNames || sheetNames.length === 0) return;

    // Respect Google Sheets API query limits; keep query reasonable
    const rangesQuery = sheetNames.map(name => `ranges=${encodeURIComponent(`${name}!A:ZZ`)}`).join('&');
    const url = `${API_BASE_URL}/${SPREADSHEET_ID}/values:batchGet?${rangesQuery}&key=${apiKey}&valueRenderOption=FORMULA`;

    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 403) {
            throw new Error('API key is invalid or does not have permission to access this spreadsheet.');
        } else if (response.status === 429) {
            throw new Error('Rate limit reached while loading data. Please try again shortly.');
        } else {
            throw new Error(`Failed to load sheets (Error ${response.status})`);
        }
    }

    const data = await response.json();
    const ranges = data.valueRanges || [];

    for (const range of ranges) {
        const sheetName = range.range.split('!')[0];
        const rows = range.values || [];
        const headers = rows[0] || [];
        const dataRows = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowData = { _sheet: sheetName };
            headers.forEach((header, index) => {
                const value = row[index] || '';
                const shouldResolveImage = isImageHeader(header) || isImageFormulaValue(value);
                rowData[header] = shouldResolveImage ? resolveImageUrl(value) : value;
            });
            dataRows.push(rowData);
        }

        const sheetData = { headers, data: dataRows };
        allSheetsData[sheetName] = sheetData;
        await saveSheetToCache(sheetName, sheetData);
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
    displayData(currentData, isCurrentMultiSheet);
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
function displayData(data, isMultiSheet) {
    if (isMultiSheet !== undefined) {
        isCurrentMultiSheet = isMultiSheet;
    }
    isMultiSheet = isCurrentMultiSheet;

    if (data.length === 0 || headers.length === 0) {
        resultsSection.style.display = 'none';

        const query = searchInput.value.trim();
        const diy = diyFilter.value;
        const catalog = catalogFilter.value;
        const hasActiveFilters = query.length > 0 || diy || catalog;

        // Determine which empty state to show
        if (hasActiveFilters) {
            // Construct helpful message
            let message = 'We couldn\'t find any matches';
            if (query) message += ` for "${query}"`;
            if (diy) message += ` with DIY: ${diy}`;
            if (catalog) message += ` in Catalog: ${catalog}`;
            message += '.';

            showEmptyState('noResults', {
                message: message
            });
            addClearSearchButton();
        } else if (!currentSheet) {
            showEmptyState('noSheet');
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

    // Track element to focus after render
    let elementToFocus = null;

    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.title = `Click to sort by ${header}`;
        th.className = 'sortable';
        th.tabIndex = 0;
        th.setAttribute('role', 'button');

        // Add sort indicators
        if (sortColumn === header) {
            th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            th.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');

            // If this is the sorted column, we should focus it if it was the interaction target
            // But we don't know if it was the target.
            // Better strategy: If document.activeElement was a TH, we try to maintain focus on the same column.
            elementToFocus = th;
        } else {
            th.setAttribute('aria-sort', 'none');
        }

        // Add click handler for sorting
        th.addEventListener('click', () => sortBy(header, isMultiSheet));

        // Add keyboard handler
        th.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sortBy(header, isMultiSheet);
            }
        });

        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Restore focus to the sorted column if requested
    if (shouldFocusSort && elementToFocus) {
        elementToFocus.focus();
        shouldFocusSort = false;
    }

    // Create table rows
    tableBody.innerHTML = '';

    // Get current search query for highlighting
    const searchQuery = searchInput.value.trim();

    // Determine whether to use grouped display (collapse same-Name variants)
    const hasNameColumn = headers.includes('Name');
    const useGrouping = !isMultiSheet && hasNameColumn;

    if (useGrouping) {
        // Group rows by Name, paginate by group, and render with expand/collapse
        const groups = groupRowsByName(data);
        const totalGroups = groups.length;
        const startGroup = (currentPage - 1) * rowsPerPage;
        const endGroup = startGroup + rowsPerPage;
        const paginatedGroups = groups.slice(startGroup, endGroup);

        paginatedGroups.forEach((group, idx) => {
            const primaryRow = group.rows[0];
            const tr = createDataRow(primaryRow, headers, searchQuery);

            if (group.rows.length > 1) {
                const groupId = `grp-${currentPage}-${idx}`;
                tr.classList.add('group-row');

                // Add clickable variant count badge to the Name cell
                const nameIdx = headers.indexOf('Name');
                if (nameIdx >= 0 && tr.children[nameIdx]) {
                    const nameCell = tr.children[nameIdx];
                    const count = group.rows.length - 1;

                    const badge = document.createElement('span');
                    badge.className = 'variant-badge';
                    badge.textContent = `${count} variant${count > 1 ? 's' : ''}`;
                    badge.setAttribute('role', 'button');
                    badge.setAttribute('tabindex', '0');
                    badge.setAttribute('aria-expanded', 'false');
                    badge.setAttribute('aria-label', `Show ${count} variant${count > 1 ? 's' : ''} of ${group.name}`);

                    const toggleVariants = (e) => {
                        e.stopPropagation();
                        const expanded = badge.getAttribute('aria-expanded') === 'true';
                        badge.setAttribute('aria-expanded', String(!expanded));
                        tr.classList.toggle('group-expanded', !expanded);
                        const variantRows = tableBody.querySelectorAll(`.variant-row[data-group-id="${groupId}"]`);
                        variantRows.forEach(vr => { vr.style.display = expanded ? 'none' : ''; });
                    };

                    badge.addEventListener('click', toggleVariants);
                    badge.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleVariants(e); }
                    });

                    nameCell.appendChild(badge);
                }

                tableBody.appendChild(tr);

                // Create hidden variant rows with distinguishing labels
                const labels = getVariantLabels(group.rows, headers);
                for (let i = 1; i < group.rows.length; i++) {
                    const variantTr = createDataRow(group.rows[i], headers, searchQuery);
                    variantTr.classList.add('variant-row');
                    variantTr.dataset.groupId = groupId;
                    variantTr.style.display = 'none';

                    // Replace Name cell with variant-specific label
                    if (nameIdx >= 0 && variantTr.children[nameIdx] && labels[i]) {
                        const varNameCell = variantTr.children[nameIdx];
                        varNameCell.textContent = '';
                        const labelSpan = document.createElement('span');
                        labelSpan.className = 'variant-label';
                        labelSpan.textContent = labels[i];
                        varNameCell.appendChild(labelSpan);
                    }

                    tableBody.appendChild(variantTr);
                }
            } else {
                tableBody.appendChild(tr);
            }
        });

        renderPagination(totalGroups);

    } else if (isMultiSheet) {
        // Multi-sheet: flat rows with sheet separators
        const startIndex = (currentPage - 1) * rowsPerPage;
        const paginatedData = data.slice(startIndex, startIndex + rowsPerPage);
        let currentSheetName = null;

        paginatedData.forEach(row => {
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

            tableBody.appendChild(createDataRow(row, headers, searchQuery));
        });

        renderPagination(data.length);

    } else {
        // Flat single-sheet display (no Name column)
        const startIndex = (currentPage - 1) * rowsPerPage;
        const paginatedData = data.slice(startIndex, startIndex + rowsPerPage);

        paginatedData.forEach(row => {
            tableBody.appendChild(createDataRow(row, headers, searchQuery));
        });

        renderPagination(data.length);
    }

    resultsSection.style.display = 'block';
}

// Sort data by column
function sortBy(column, isMultiSheet = false) {
    // Set flag to restore focus after re-render
    shouldFocusSort = true;

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

    // Always show container if we have data, so export button is available
    if (totalRecords === 0) return;

    paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';

    // Only show pagination controls if we have multiple pages
    if (totalPages > 1) {
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<span aria-hidden="true">←</span> Previous';
        prevBtn.setAttribute('aria-label', 'Go to previous page');
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                shouldFocusPagination = 'prev';
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
        nextBtn.innerHTML = 'Next <span aria-hidden="true">→</span>';
        nextBtn.setAttribute('aria-label', 'Go to next page');
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                shouldFocusPagination = 'next';
                currentPage++;
                displayData(currentData);
                updateRecordCount();
            }
        });
        paginationDiv.appendChild(nextBtn);

    }

    // Add export button (always visible when data exists)
    const exportBtn = document.createElement('button');
    exportBtn.innerHTML = '<span role="img" aria-hidden="true">📥</span> Export CSV';
    exportBtn.className = 'export-btn';
    exportBtn.title = 'Export current data to CSV';
    exportBtn.setAttribute('aria-label', `Export ${totalRecords} records to CSV`);
    exportBtn.addEventListener('click', exportToCSV);
    paginationDiv.appendChild(exportBtn);

    resultsSection.appendChild(paginationDiv);

    // Restore focus if needed (must be done after appending to DOM)
    if (shouldFocusPagination && totalPages > 1) {
        // Find buttons in the new pagination div
        // We know the structure: Prev is first child, Next is third (Prev, Span, Next, Export)
        // Safer to find by text content or keeping references
        const buttons = paginationDiv.querySelectorAll('button');
        const prevBtn = Array.from(buttons).find(b => b.textContent.includes('Previous'));
        const nextBtn = Array.from(buttons).find(b => b.textContent.includes('Next'));

        if (shouldFocusPagination === 'next') {
            if (nextBtn && !nextBtn.disabled) {
                nextBtn.focus();
            } else if (prevBtn && !prevBtn.disabled) {
                prevBtn.focus();
            }
        } else if (shouldFocusPagination === 'prev') {
            if (prevBtn && !prevBtn.disabled) {
                prevBtn.focus();
            } else if (nextBtn && !nextBtn.disabled) {
                nextBtn.focus();
            }
        }
        shouldFocusPagination = null;
    }
}

// Apply all filters (search + DIY + Catalog)
async function applyFilters() {
    try {
        const query = searchInput.value.toLowerCase().trim();
        const diyValue = diyFilter.value;
        const catalogValue = catalogFilter.value;
        const hasSearch = query.length > 0;
        const isGlobalSearch = hasSearch && !currentSheet;

        if (isGlobalSearch) {
            await ensureSheetsLoadedForSearch();
        } else if (currentSheet && !allSheetsData[currentSheet]) {
            await loadSheetData(currentSheet);
        }

        if (!hasSearch && (!currentSheet || !allSheetsData[currentSheet])) {
            currentData = [];
            allData = [];
            showEmptyState('noSheet');
            return;
        }

        if (Object.keys(allSheetsData).length === 0) {
            showEmptyState('welcome');
            return; // No data loaded
        }

        let combinedData = [];
        let isMultiSheet = false;

        // If searching, scope to selected sheet or all sheets if none selected
        if (hasSearch) {
            const targetSheets = isGlobalSearch ? availableSheets : [currentSheet];

            for (const sheetName of targetSheets) {
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

            // Deduplicate results within the same sheet. Include _sheet in the
            // key so distinct items from different categories that happen to
            // share the same name/variant metadata are preserved.
            if (isGlobalSearch) {
                const seen = new Set();
                combinedData = combinedData.filter(row => {
                    const key = [
                        row['_sheet'] || '',
                        row['Name'] || '',
                        row['Variant'] || '',
                        row['Variation'] || '',
                        row['Color 1'] || '',
                        row['Color 2'] || '',
                        row['Pattern'] || ''
                    ].join('\x00');
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
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

        // If this was a global search, stop prefetch to avoid background noise
        if (!currentSheet && hasSearch) {
            cancelPrefetch('global search');
        }
    } catch (error) {
        console.error('Error applying filters:', error);
        showEmptyState('error');
        updateEmptyStateMessage(error.message || 'Failed to load data. Please try again.');
    }
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
    // Don't show record count if no sheet is selected
    if (!currentSheet) {
        recordCount.style.display = 'none';
        return;
    }

    // Show record count when sheet is selected
    recordCount.style.display = 'block';

    if (allData.length === 0) {
        recordCount.textContent = 'No results found';
    } else {
        // Show unique item count when grouping is active
        const hasNameColumn = headers.includes('Name');
        const total = currentData.length;

        if (hasNameColumn && currentSheet) {
            const uniqueNames = new Set(currentData.map(r => r['Name'])).size;
            if (uniqueNames < total) {
                recordCount.textContent = currentData.length === allData.length
                    ? `Showing ${uniqueNames} items (${total} total with variants)`
                    : `Showing ${uniqueNames} items (${total} total) of ${allData.length} records`;
            } else {
                recordCount.textContent = currentData.length === allData.length
                    ? `Showing all ${total} records`
                    : `Showing ${total} of ${allData.length} records`;
            }
        } else if (currentData.length === allData.length) {
            recordCount.textContent = `Showing all ${total} records`;
        } else {
            recordCount.textContent = `Showing ${total} of ${allData.length} records`;
        }
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
function updateEmptyState(type = 'welcome', overrides = {}) {
    const states = {
        welcome: {
            icon: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>`,
            title: 'Welcome to ACNH Database!',
            message: 'Select a sheet from the dropdown above to explore items, villagers, and more.'
        },
        noResults: {
            icon: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>`,
            title: 'No Items Found',
            message: 'Try adjusting your search terms or filters to find what you\'re looking for.'
        },
        noSheet: {
            icon: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>`,
            title: 'No Sheet Selected',
            message: 'Please select a sheet from the dropdown to view data.'
        },
        loading: {
            icon: `<div class="spinner"></div>`,
            title: 'Loading...',
            message: 'Please wait while we fetch your data.'
        },
        error: {
            icon: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>`,
            title: 'Error Loading Data',
            message: 'Something went wrong. Please try again.'
        },
        noApiKey: {
            icon: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>`,
            title: 'API Key Required',
            message: 'Please enter your Google Sheets API key above to continue.'
        }
    };

    const baseState = states[type] || states.welcome;
    const state = { ...baseState, ...overrides };
    emptyStateIcon.innerHTML = state.icon;
    emptyStateTitle.textContent = state.title;
    emptyStateMessage.textContent = state.message;

    // Manage hints visibility - only show for welcome/initial states
    const hints = document.querySelector('.empty-state-hints');
    if (hints) {
        if (type === 'welcome' || type === 'noSheet') {
            hints.style.display = 'flex';
        } else {
            hints.style.display = 'none';
        }
    }
}

// Helper function to update just the message without changing the entire state
function updateEmptyStateMessage(message) {
    if (emptyStateMessage) {
        emptyStateMessage.textContent = message;
    }
}

// Show empty state
function showEmptyState(type = 'welcome', overrides = {}) {
    updateEmptyState(type, overrides);
    emptyState.style.display = 'block';
    resultsSection.style.display = 'none';
    loading.style.display = 'none';

    // Apply appropriate CSS class for styling
    emptyState.className = 'empty-state';
    if (type === 'error') {
        emptyState.classList.add('error');
        addRetryButton();
    } else if (type === 'loading') {
        emptyState.classList.add('loading');
    }
}

// Add retry button for error states
function addRetryButton() {
    removeActionButtons();

    // Create retry button
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retryButton';
    retryBtn.textContent = '🔄 Retry';
    retryBtn.className = 'action-btn retry-btn';
    styleActionButton(retryBtn, '#667eea');

    retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Retrying...';
        await loadAvailableSheets();
        retryBtn.disabled = false;
        retryBtn.textContent = '🔄 Retry';
    });

    // Append to empty state content
    const emptyStateContent = document.querySelector('.empty-state-content');
    if (emptyStateContent) {
        emptyStateContent.appendChild(retryBtn);
    }
}

// Add clear search button for no results state
function addClearSearchButton() {
    removeActionButtons();

    // Create clear button
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearSearchActionBtn';
    clearBtn.textContent = '✕ Clear Search & Filters';
    clearBtn.className = 'action-btn clear-btn';
    clearBtn.setAttribute('aria-label', 'Clear all search terms and filters');
    styleActionButton(clearBtn, 'var(--primary)');

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        diyFilter.value = '';
        catalogFilter.value = '';
        updateClearButton();
        applyFilters();
    });

    // Append to empty state content
    const emptyStateContent = document.querySelector('.empty-state-content');
    if (emptyStateContent) {
        emptyStateContent.appendChild(clearBtn);
    }
}

function removeActionButtons() {
    const buttons = document.querySelectorAll('.empty-state-content button.action-btn, #retryButton, #clearSearchActionBtn');
    buttons.forEach(btn => btn.remove());
}

function styleActionButton(btn, bgColor) {
    btn.style.marginTop = '20px';
    btn.style.padding = '12px 30px';
    btn.style.fontSize = '16px';
    btn.style.fontWeight = '600';
    btn.style.border = 'none';
    btn.style.borderRadius = '10px';
    btn.style.cursor = 'pointer';
    btn.style.background = bgColor;
    btn.style.color = 'white';
    btn.style.transition = 'all 0.3s';

    btn.addEventListener('mouseenter', () => {
        btn.style.filter = 'brightness(1.1)';
        btn.style.transform = 'translateY(-2px)';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.filter = 'none';
        btn.style.transform = 'translateY(0)';
    });
}

// Hide empty state
function hideEmptyState() {
    emptyState.style.display = 'none';
    emptyState.className = 'empty-state';
}

// Prefetch queue to load additional sheets in the background
function startPrefetchQueue() {
    // Build queue of sheets excluding current and already loaded
    const remaining = availableSheets.filter(name => name && name !== currentSheet && !allSheetsData[name]);
    if (remaining.length === 0) return;

    // Sort by most-used priority first, then original order
    const priorityIndex = sheet => {
        const idx = MOST_USED_SHEETS.indexOf(sheet);
        return idx === -1 ? MOST_USED_SHEETS.length + 1 : idx;
    };

    remaining.sort((a, b) => {
        const pa = priorityIndex(a);
        const pb = priorityIndex(b);
        if (pa === pb) return availableSheets.indexOf(a) - availableSheets.indexOf(b);
        return pa - pb;
    });

    prefetchQueue = remaining;
    prefetchAbortToken++;
    prefetchInFlight = 0;
    prefetchRunning = true;

    scheduleNextPrefetch(prefetchAbortToken);
}

function cancelPrefetch(reason = '') {
    if (prefetchRunning || prefetchInFlight > 0) {
        console.debug('Prefetch cancelled', reason);
    }
    prefetchAbortToken++;
    prefetchQueue = [];
    prefetchInFlight = 0;
    prefetchRunning = false;
}

function scheduleNextPrefetch(token) {
    if (token !== prefetchAbortToken) return;
    if (!prefetchQueue.length && prefetchInFlight === 0) {
        prefetchRunning = false;
        return;
    }

    // Start up to PREFETCH_CONCURRENCY
    while (prefetchInFlight < PREFETCH_CONCURRENCY && prefetchQueue.length) {
        const sheetName = prefetchQueue.shift();
        prefetchInFlight++;

        loadSheetData(sheetName, { showLoading: false })
            .catch(err => console.warn('Prefetch error', sheetName, err))
            .finally(() => {
                prefetchInFlight--;
                const cb = window.requestIdleCallback || function(fn) { return setTimeout(fn, 150); };
                cb(() => scheduleNextPrefetch(token), { timeout: 1000 });
            });
    }
}

// Add button to show API key section again if needed
function showApiKeySection() {
    apiKeySection.style.display = 'flex';
}

// Export data to CSV
function exportToCSV(e) {
    if (currentData.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    // UX: Success feedback on button
    const btn = e ? e.target.closest('button') : null;
    let originalContent = '';
    let originalStyle = '';

    if (btn) {
        originalContent = btn.innerHTML;
        originalStyle = btn.getAttribute('style') || '';

        btn.innerHTML = '<span role="img" aria-hidden="true">✓</span> Exported!';
        btn.style.background = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        btn.disabled = true; // Prevent double clicks
    }

    try {
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

        showToast(`Exported ${currentData.length} items successfully`, 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showToast('Failed to export data', 'error');

        // Reset button immediately on error
        if (btn) {
            btn.innerHTML = originalContent;
            btn.setAttribute('style', originalStyle);
            btn.disabled = false;
        }
        return;
    }

    // Reset button after delay
    if (btn) {
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.setAttribute('style', originalStyle);
            btn.disabled = false;
        }, 2000);
    }
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
// Show/hide clear button based on search input
function updateClearButton() {
    if (!searchClearBtn) return;

    if (searchInput.value.trim().length > 0) {
        searchClearBtn.style.display = 'flex';
    } else {
        searchClearBtn.style.display = 'none';
    }
}

// Show toast notification
function showToast(message, type = 'default') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if (type === 'success') icon = '✓';
    else if (type === 'error') icon = '✕';
    else icon = 'ℹ';

    // Accessibility: Add roles for screen readers
    if (type === 'error') {
        toast.setAttribute('role', 'alert');
    } else {
        toast.setAttribute('role', 'status');
    }

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;

    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove toast after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}
