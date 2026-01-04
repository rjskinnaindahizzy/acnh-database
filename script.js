// ACNH Item Database Application - Google Sheets API v4
const SPREADSHEET_ID = '13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DEFAULT_API_KEY = (typeof window !== 'undefined' && window.DEFAULT_API_KEY) ? window.DEFAULT_API_KEY : ''; // Load from config if present
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// State management
let currentData = [];
let allData = [];
let allSheetsData = {}; // Store data from all sheets { 'SheetName': [...rows] }
let sheetTimestamps = {}; // Track freshness per sheet
let availableSheets = []; // List of all sheet names
let headers = [];
let allHeaders = []; // All available headers
let visibleColumns = []; // Currently visible column names
let sheetLoadPromises = {}; // Track in-flight sheet fetches to avoid duplicate requests
let apiKey = DEFAULT_API_KEY; // Default from config if available
let currentPage = 1;
let rowsPerPage = 25;
let sortColumn = null;
let sortDirection = 'asc';
let currentSheet = '';
let cacheDisabled = false; // disable caching after quota errors
let prefetchQueue = [];
let prefetchAbortToken = 0;
let prefetchInFlight = 0;
let prefetchRunning = false;
let lastIsSearch = false;
let lastIsMultiSheet = false;
let lastQuery = '';
let recordMeta = { total: 0, showing: 0, start: 0, end: 0 };
let fuseIndexes = {};
let favorites = new Set();
let favoritesOnly = false;
let viewMode = 'table';
let pendingUrlState = null;
let selectedRowKeys = new Set();
let recentSearches = [];
let savedSearches = [];
let recentSaveTimer = null;
let lastSavedSearch = '';
let nameDictionary = new Set();
let initialLoadDone = false;
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
const FAVORITES_STORAGE_KEY = 'acnhFavorites';
const SPOTLIGHT_COLUMNS = [
    'Source',
    'Tag',
    'Color 1',
    'Color 2',
    'Style 1',
    'Style 2',
    'Theme',
    'Set',
    'Series',
    'Personality',
    'Species',
    'Hobby',
    'Type'
];
const PRICE_COLUMNS = ['Buy', 'Sell', 'Sell Price', 'Price', 'Value'];
const NAME_COLUMNS = ['Name', 'Item', 'Item Name', 'Villager', 'Recipe', 'Song', 'Critter'];

// Column presets per sheet type
const COLUMN_PRESETS = {
    'Housewares': ['Name', 'Image', 'DIY', 'Buy', 'Sell', 'Color 1', 'Color 2', 'Size', 'Source', 'Catalog', 'Tag'],
    'Villagers': ['Name', 'Image', 'Species', 'Gender', 'Personality', 'Birthday', 'Catchphrase', 'Favorite Song'],
    'default': ['Name', 'Image'] // Fallback for unknown sheets
};
const MAX_RECENT_SEARCHES = 10;
const MAX_SAVED_SEARCHES = 10;
const SELECT_COLUMN = 'Select';

// DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const apiKeySection = document.getElementById('apiKeySection');
const searchInput = document.getElementById('searchInput');
const searchAssist = document.getElementById('searchAssist');
const sheetSelect = document.getElementById('sheetSelect');
const diyFilter = document.getElementById('diyFilter');
const catalogFilter = document.getElementById('catalogFilter');
const filtersPanel = document.getElementById('filtersPanel');
const mobileFiltersBtn = document.getElementById('mobileFiltersBtn');
const mobileFilterToggle = document.getElementById('mobileFilterToggle');
const mobileFilterSummary = document.getElementById('mobileFilterSummary');
const filterBackdrop = document.getElementById('filterBackdrop');
const closeFiltersBtn = document.getElementById('closeFiltersBtn');
const columnToggleBtn = document.getElementById('columnToggleBtn');
const columnTogglePanel = document.getElementById('columnTogglePanel');
const closeColumnToggle = document.getElementById('closeColumnToggle');
const showAllColumnsBtn = document.getElementById('showAllColumnsBtn');
const compactColumnsBtn = document.getElementById('compactColumnsBtn');
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
const selectionCount = document.getElementById('selectionCount');
const liveRegion = document.getElementById('liveRegion');
const progressBar = document.getElementById('progressBar');
const globalProgress = document.getElementById('globalProgress');
const viewToggleBtn = document.getElementById('viewToggleBtn');
const favoritesToggleBtn = document.getElementById('favoritesToggleBtn');
const cardsContainer = document.getElementById('cardsContainer');
const cardGrid = document.getElementById('cardGrid');
const tableContainer = document.querySelector('.table-container');
const resultsHeader = document.getElementById('resultsHeader');
const resultsTitle = document.getElementById('resultsTitle');
const resultsSubtitle = document.getElementById('resultsSubtitle');
const scrollHint = document.getElementById('scrollHint');
const insightRecords = document.getElementById('insightRecords');
const insightScope = document.getElementById('insightScope');
const insightFavorites = document.getElementById('insightFavorites');
const insightFavoritesSub = document.getElementById('insightFavoritesSub');
const insightSpotlightLabel = document.getElementById('insightSpotlightLabel');
const insightSpotlight = document.getElementById('insightSpotlight');
const insightSpotlightSub = document.getElementById('insightSpotlightSub');
const insightValueLabel = document.getElementById('insightValueLabel');
const insightValue = document.getElementById('insightValue');
const insightValueSub = document.getElementById('insightValueSub');
const activeFilters = document.getElementById('activeFilters');

// IndexedDB for sheet caching
const DB_NAME = 'acnhSheetCache';
const DB_VERSION = 1;
let dbPromise = null;

// Initialize the application
async function init() {
    favorites = loadFavorites();
    loadSearchHistory();
    pendingUrlState = parseStateFromUrl();

    if (pendingUrlState && pendingUrlState.view) {
        viewMode = pendingUrlState.view === 'cards' ? 'cards' : 'table';
    } else if (window.innerWidth < 768) {
        viewMode = 'cards'; // default to cards on small screens
    }
    if (pendingUrlState && pendingUrlState.favorites) {
        favoritesOnly = true;
    }
    setViewMode(viewMode, { silent: true });
    setFavoritesOnly(favoritesOnly, true);

    loadApiKeyFromStorage();
    setupEventListeners();
    handleResponsiveFilters();
    updateInsights([]);

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
    columnToggleBtn.style.display = 'none';
    recordCount.style.display = 'none';
    if (viewToggleBtn) {
        viewToggleBtn.style.display = 'none';
        viewToggleBtn.setAttribute('aria-hidden', 'true');
    }
    updateMobileFilterSummary();
}

// Show filters and controls
function showFiltersAndControls() {
    columnToggleBtn.style.display = 'block';
    recordCount.style.display = 'block';
    if (viewToggleBtn) {
        viewToggleBtn.style.display = '';
        viewToggleBtn.removeAttribute('aria-hidden');
    }
    handleResponsiveFilters();
    // DIY and Catalog filters shown based on sheet content via updateFilterVisibility()
    updateMobileFilterSummary();
}

function isMobileViewport() {
    return window.innerWidth < 768;
}

function isFiltersPanelOpen() {
    return false;
}

function toggleFiltersPanel(forceState, options = {}) {
    // Overlay filters removed; keep stub for compatibility
    return;
}

function handleResponsiveFilters() {
    if (!filtersPanel) return;
    filtersPanel.classList.remove('mobile-open');
    filtersPanel.removeAttribute('aria-hidden');
    updateScrollHint();
}

function updateMobileFilterSummary() {
    if (!mobileFilterSummary) return;
    const sheetLabel = currentSheet || 'All sheets';
    const parts = [];

    if (diyFilter && diyFilter.value) parts.push(`DIY: ${diyFilter.value}`);
    if (catalogFilter && catalogFilter.value) parts.push(`Catalog: ${catalogFilter.value}`);
    if (favoritesOnly) parts.push('Favorites');

    if (parts.length) {
        mobileFilterSummary.textContent = `${sheetLabel} • ${parts.join(' • ')}`;
    } else {
        mobileFilterSummary.textContent = currentSheet ? `${sheetLabel} • No filters` : sheetLabel;
    }
}

// Announce updates for screen readers
function announce(message, politeness = 'polite') {
    if (!liveRegion) return;
    liveRegion.setAttribute('aria-live', politeness);
    liveRegion.textContent = '';
    setTimeout(() => {
        liveRegion.textContent = message;
    }, 10);
}

// Favorites helpers
function loadFavorites() {
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return new Set(parsed);
        }
        return new Set();
    } catch (err) {
        console.warn('Could not load favorites', err);
        return new Set();
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    } catch (err) {
        console.warn('Could not save favorites', err);
    }
}

function favoriteKey(row) {
    const name = row['Name'] || row['name'] || row['Item'] || '';
    const id = row['id'] || row['ID'] || name;
    return `${row._sheet || 'sheet'}::${id}`;
}

function rowSelectionKey(row) {
    const id = row['Unique Entry ID'] || row['Internal ID'] || row['Item ID'] || row['id'] || row['ID'] || row['Filename'] || row['Name'] || JSON.stringify(row).slice(0, 24);
    return `${row._sheet || currentSheet || 'sheet'}::${id}`;
}

function isFavorite(row) {
    return favorites.has(favoriteKey(row));
}

function toggleFavorite(row) {
    const key = favoriteKey(row);
    if (favorites.has(key)) {
        favorites.delete(key);
        announce(`${row.Name || 'Item'} removed from favorites.`);
    } else {
        favorites.add(key);
        announce(`${row.Name || 'Item'} added to favorites.`);
    }
    saveFavorites();
    displayData(currentData, lastIsMultiSheet);
    syncUrlState();
}

// Search history helpers
function loadSearchHistory() {
    try {
        const recents = JSON.parse(localStorage.getItem('acnhRecentSearches') || '[]');
        const saved = JSON.parse(localStorage.getItem('acnhSavedSearches') || '[]');
        if (Array.isArray(recents)) recentSearches = recents.slice(0, MAX_RECENT_SEARCHES);
        if (Array.isArray(saved)) savedSearches = saved.slice(0, MAX_SAVED_SEARCHES);
    } catch (err) {
        recentSearches = [];
        savedSearches = [];
    }
}

function persistSearchHistory() {
    localStorage.setItem('acnhRecentSearches', JSON.stringify(recentSearches.slice(0, MAX_RECENT_SEARCHES)));
    localStorage.setItem('acnhSavedSearches', JSON.stringify(savedSearches.slice(0, MAX_SAVED_SEARCHES)));
}

function addRecentSearch(query) {
    if (!query) return;
    recentSearches = recentSearches.filter(q => q.toLowerCase() !== query.toLowerCase());
    recentSearches.unshift(query);
    if (recentSearches.length > MAX_RECENT_SEARCHES) {
        recentSearches.length = MAX_RECENT_SEARCHES;
    }
    persistSearchHistory();
    renderSearchAssist(query);
}

function removeRecentSearch(query) {
    if (!query) return;
    recentSearches = recentSearches.filter(q => q.toLowerCase() !== query.toLowerCase());
    persistSearchHistory();
}

function queueRecentSearchSave(query, immediate = false) {
    const normalized = (query || '').trim();
    if (!normalized || normalized.length < 2) {
        clearTimeout(recentSaveTimer);
        return;
    }

    const save = () => {
        if (normalized.toLowerCase() === lastSavedSearch.toLowerCase()) return;
        addRecentSearch(normalized);
        lastSavedSearch = normalized;
    };

    clearTimeout(recentSaveTimer);
    if (immediate) {
        save();
    } else {
        recentSaveTimer = setTimeout(save, 600);
    }
}

function saveCurrentSearch(query) {
    if (!query) return;
    savedSearches = savedSearches.filter(q => q.toLowerCase() !== query.toLowerCase());
    savedSearches.unshift(query);
    if (savedSearches.length > MAX_SAVED_SEARCHES) {
        savedSearches.length = MAX_SAVED_SEARCHES;
    }
    persistSearchHistory();
    renderSearchAssist(query);
    announce('Search saved.');
}

function setFavoritesOnly(enabled, silent = false) {
    favoritesOnly = enabled;
    if (favoritesToggleBtn) {
        favoritesToggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        favoritesToggleBtn.textContent = enabled ? 'Favorites only' : 'Favorites';
    }
    if (!silent) {
        applyFilters();
    }
    updateMobileFilterSummary();
}

// View mode helpers
function setViewMode(mode, options = {}) {
    const { silent = false } = options;
    viewMode = mode === 'cards' ? 'cards' : 'table';
    const isCards = viewMode === 'cards';

    if (viewToggleBtn) {
        viewToggleBtn.textContent = isCards ? 'Table view' : 'Card view';
        viewToggleBtn.setAttribute('aria-pressed', isCards ? 'true' : 'false');
        viewToggleBtn.title = isCards ? 'Switch back to table view' : 'Switch to card view';
    }

    if (tableContainer) tableContainer.style.display = isCards ? 'none' : 'block';
    if (cardsContainer) cardsContainer.style.display = isCards ? 'block' : 'none';

    if (!silent) {
        displayData(currentData, lastIsMultiSheet);
        syncUrlState();
    }
}

function toggleViewMode() {
    setViewMode(viewMode === 'table' ? 'cards' : 'table');
}

// URL state helpers for deep linking
function parseStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
        sheet: params.get('sheet') || '',
        search: params.get('search') || '',
        diy: params.get('diy') || '',
        catalog: params.get('catalog') || '',
        view: params.get('view') || '',
        favorites: params.get('favorites') === '1' || params.get('favorites') === 'true'
    };
}

function syncUrlState() {
    const params = new URLSearchParams();
    if (currentSheet) params.set('sheet', currentSheet);
    const searchVal = searchInput.value.trim();
    if (searchVal) params.set('search', searchVal);
    if (diyFilter.value) params.set('diy', diyFilter.value);
    if (catalogFilter.value) params.set('catalog', catalogFilter.value);
    if (viewMode === 'cards') params.set('view', 'cards');
    if (favoritesOnly) params.set('favorites', '1');

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    if (history.replaceState) {
        history.replaceState({}, '', newUrl);
    }
}

// Progress indicator for batch/global loading
function setGlobalProgress(completed, total) {
    if (!progressBar || !globalProgress) return;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    globalProgress.style.display = 'block';
    globalProgress.setAttribute('aria-hidden', 'false');
    globalProgress.setAttribute('aria-valuenow', String(percent));
    progressBar.style.width = `${percent}%`;
}

function clearGlobalProgress() {
    if (!progressBar || !globalProgress) return;
    globalProgress.style.display = 'none';
    globalProgress.setAttribute('aria-hidden', 'true');
    globalProgress.setAttribute('aria-valuenow', '0');
    progressBar.style.width = '0%';
}

async function applyInitialUrlState() {
    if (!pendingUrlState) return { applied: false };
    const state = pendingUrlState;
    pendingUrlState = null;

    // Apply view-only state up front
    if (state.view) {
        setViewMode(state.view, { silent: true });
    }
    setFavoritesOnly(state.favorites, true);

    let needsApply = false;

    if (state.sheet && availableSheets.includes(state.sheet)) {
        sheetSelect.value = state.sheet;
        currentSheet = state.sheet;
        showFiltersAndControls();
        await loadSheetData(currentSheet);
        updateFilterVisibility();
        needsApply = true;
    }

    if (state.search) {
        searchInput.value = state.search;
        needsApply = true;
    }
    if (state.diy) {
        diyFilter.value = state.diy;
        needsApply = true;
    }
    if (state.catalog) {
        catalogFilter.value = state.catalog;
        needsApply = true;
    }
    if (state.favorites) {
        needsApply = true;
    }

    if (needsApply) {
        await applyFilters();
        return { applied: true };
    }

    return { applied: false };
}

// Setup event listeners
function setupEventListeners() {
    saveApiKeyBtn.addEventListener('click', saveApiKey);

    // Search box interactions (do not auto-run search on every keystroke)
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        renderSearchAssist(q);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            runSearch();
        }
    });
    searchInput.addEventListener('focus', () => renderSearchAssist(searchInput.value.trim()));
    searchInput.addEventListener('blur', () => {
        setTimeout(() => searchAssist && searchAssist.classList.remove('visible'), 120);
    });

    // Auto-load on sheet selection
    sheetSelect.addEventListener('change', async () => {
        currentSheet = sheetSelect.value;
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
                syncUrlState();
            } catch (error) {
                console.error(`Error loading sheet ${currentSheet}:`, error);
                showEmptyState('error', {
                    title: `Failed to load ${currentSheet}`,
                    message: error.message || 'Failed to load sheet data. Please try again.'
                });
            }
        } else {
            // All sheets view - keep controls visible and load global data
            showFiltersAndControls();
            await applyFilters();
        }
    });

    // Filter changes
    diyFilter.addEventListener('change', () => {
        applyFilters();
        syncUrlState();
    });
    catalogFilter.addEventListener('change', () => {
        applyFilters();
        syncUrlState();
    });

    // Column toggle
    columnToggleBtn.addEventListener('click', () => toggleColumnPanel());
    closeColumnToggle.addEventListener('click', () => toggleColumnPanel(false));
    if (showAllColumnsBtn) {
        showAllColumnsBtn.addEventListener('click', showAllColumns);
    }
    if (compactColumnsBtn) {
        compactColumnsBtn.addEventListener('click', applyCompactPreset);
    }
    // Ensure ARIA state is in sync on load
    toggleColumnPanel(false, true);

    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveApiKey();
        }
    });

    if (viewToggleBtn) {
        viewToggleBtn.addEventListener('click', toggleViewMode);
    }
    if (favoritesToggleBtn) {
        favoritesToggleBtn.addEventListener('click', () => setFavoritesOnly(!favoritesOnly));
    }

    if (window.innerWidth < 768) {
        initPullToRefresh();
    }

    window.addEventListener('resize', handleResponsiveFilters);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (columnTogglePanel && columnTogglePanel.style.display === 'block') {
                toggleColumnPanel(false);
            }
        }
    });

    if (tableContainer) {
        tableContainer.addEventListener('scroll', () => {
            if (scrollHint) {
                scrollHint.classList.remove('visible');
            }
        });
    }
}

function runSearch(queryOverride) {
    const q = (typeof queryOverride === 'string' ? queryOverride : searchInput.value).trim();
    if (typeof queryOverride === 'string') {
        searchInput.value = queryOverride;
    }
    cancelPrefetch('search submit');
    queueRecentSearchSave(q, true);
    applyFilters();
}

function triggerRefresh() {
    if (currentSheet) {
        clearSheetCache(currentSheet)
            .then(() => loadSheetData(currentSheet, { forceRefresh: true }))
            .then(() => {
                updateFilterVisibility();
                return applyFilters();
            })
            .catch(err => console.error('Auto refresh failed', err));
    } else {
        applyFilters();
    }
}

function initPullToRefresh() {
    let startY = 0;
    let pulling = false;

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const delta = e.touches[0].clientY - startY;
        if (delta > 80) {
            pulling = false;
            triggerRefresh();
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        pulling = false;
    });
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
                resolve({ headers, data, timestamp });
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
                timestamp: sheetData.timestamp || Date.now(),
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
        delete fuseIndexes[sheetName];
        delete sheetTimestamps[sheetName];
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
        apiKeyStatus.textContent = 'Please enter an API key';
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
        apiKeyStatus.textContent = 'API Key Saved Successfully!';
        apiKeyStatus.className = 'success';

        // Hide API key section
        setTimeout(() => {
            apiKeySection.style.display = 'none';
        }, 1500);

        // Load available sheets
        await loadAvailableSheets();

    } catch (error) {
        console.error('API key validation error:', error);
        apiKeyStatus.textContent = 'Invalid API key. Please check and try again.';
        apiKeyStatus.className = 'error';
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

        const url = `${API_BASE_URL}/${SPREADSHEET_ID}?key=${apiKey}`;
        let response;
        try {
            response = await fetch(url);
        } catch (err) {
            throw new Error('Network error while loading sheet list. Please check your connection and try again.');
        }

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

        // Exclude README/Read Me helper tab from selection
        const visibleSheets = sheets.filter(sheet => {
            const title = (sheet.properties.title || '').replace(/\s+/g, '').toLowerCase();
            return !title.startsWith('readme');
        });

        if (visibleSheets.length === 0) {
            throw new Error('No selectable sheets found after excluding the README tab.');
        }

        availableSheets = visibleSheets.map(s => s.properties.title);

        // Populate sheet selector
        sheetSelect.innerHTML = '<option value="">All sheets</option>';

        visibleSheets.forEach(sheet => {
            const sheetTitle = sheet.properties.title;
            const option = document.createElement('option');
            option.value = sheetTitle;
            option.textContent = sheetTitle;
            sheetSelect.appendChild(option);
        });

        // Enable the selector and prompt user to choose a sheet
        sheetSelect.disabled = false;
        showFiltersAndControls();

        // If there is a deep-link state, honor it; otherwise load all sheets immediately
        const hasDeepLinkState = Boolean(
            pendingUrlState && (
                pendingUrlState.sheet ||
                pendingUrlState.search ||
                pendingUrlState.diy ||
                pendingUrlState.catalog ||
                pendingUrlState.favorites
            )
        );

        const urlStateResult = await applyInitialUrlState();

        if (!hasDeepLinkState || !urlStateResult.applied) {
            await applyFilters({ suppressLoadingState: true });
        }

        // Warm up frequently used sheets so the first selection is instant
        startPrefetchQueue();

        initialLoadDone = true;

    } catch (error) {
        console.error('Error loading sheets:', error);
        sheetSelect.innerHTML = '<option value="">Error loading sheets</option>';
        sheetSelect.disabled = true;
        showEmptyState('error', {
            title: 'Error loading sheets',
            message: error.message || 'Failed to load sheets. Please check your connection and try again.'
        });
    }
}

// Load data for a single sheet (lazy-loaded)
async function loadSheetData(sheetName, { forceRefresh = false, showLoading = true } = {}) {
    if (!sheetName) return null;

    const existing = allSheetsData[sheetName];
    if (!forceRefresh && existing) {
        const age = sheetTimestamps[sheetName] ? Date.now() - sheetTimestamps[sheetName] : 0;
        if (age > 0 && age < CACHE_TTL_MS) {
            return existing;
        }
        // Data is stale; refresh from network
    }

    if (!forceRefresh) {
        const cached = await getCachedSheet(sheetName);
        if (cached) {
            allSheetsData[sheetName] = cached;
            sheetTimestamps[sheetName] = cached.timestamp || Date.now();
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
        const url = `${API_BASE_URL}/${SPREADSHEET_ID}/values/${range}?key=${apiKey}`;
        let response;
        try {
            response = await fetch(url);
        } catch (err) {
            throw new Error(`Network error while loading ${sheetName}. Please check your connection.`);
        }

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

        if (!rows.length || !headers.length) {
            throw new Error(`Invalid data received for ${sheetName}.`);
        }
        const dataRows = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowData = { _sheet: sheetName }; // Add sheet name to each row

            headers.forEach((header, index) => {
                rowData[header] = row[index] || '';
            });

            dataRows.push(rowData);
        }

        dataRows.forEach(row => {
            if (row.Name) {
                nameDictionary.add(row.Name);
            }
        });

        const fetchedAt = Date.now();
        const sheetData = { headers, data: dataRows, timestamp: fetchedAt };
        allSheetsData[sheetName] = sheetData;
        sheetTimestamps[sheetName] = fetchedAt;
        await saveSheetToCache(sheetName, sheetData);
        ensureFuseIndex(sheetName);
        return sheetData;
    })().finally(() => {
        delete sheetLoadPromises[sheetName];
    });

    return sheetLoadPromises[sheetName];
}

// Ensure all sheets are loaded when performing a cross-sheet search
async function ensureSheetsLoadedForSearch(suppressLoadingState = false) {
    const missingSheets = [];

    // Try to hydrate from cache first
    for (const name of availableSheets) {
        const ts = sheetTimestamps[name];
        if (allSheetsData[name] && ts && Date.now() - ts >= CACHE_TTL_MS) {
            delete allSheetsData[name];
            delete fuseIndexes[name];
        }
        if (allSheetsData[name]) continue;
        const cached = await getCachedSheet(name);
        if (cached) {
            allSheetsData[name] = cached;
            sheetTimestamps[name] = cached.timestamp || Date.now();
        } else {
            missingSheets.push(name);
        }
    }

    if (missingSheets.length === 0) return;

    if (!suppressLoadingState) {
        showEmptyState('loading', {
            title: 'Loading...',
            message: 'Fetching spreadsheet data. Please wait.'
        });
        setGlobalProgress(0, missingSheets.length);
    }

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
        if (!suppressLoadingState) {
            setGlobalProgress(loadedCount, missingSheets.length);
        }
    }

    if (!suppressLoadingState) {
        clearGlobalProgress();
    }
}

// Batch-fetch multiple sheets to reduce latency
async function fetchSheetsBatch(sheetNames) {
    if (!sheetNames || sheetNames.length === 0) return;

    // Respect Google Sheets API query limits; keep query reasonable
    const rangesQuery = sheetNames.map(name => `ranges=${encodeURIComponent(`${name}!A:ZZ`)}`).join('&');
    const url = `${API_BASE_URL}/${SPREADSHEET_ID}/values:batchGet?${rangesQuery}&key=${apiKey}`;

    let response;
    try {
        response = await fetch(url);
    } catch (err) {
        throw new Error('Network error while batch loading sheets. Please check your connection.');
    }

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

        if (!rows.length || !headers.length) {
            throw new Error(`Invalid data received for sheet ${sheetName}.`);
        }
        const dataRows = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowData = { _sheet: sheetName };
            headers.forEach((header, index) => {
                rowData[header] = row[index] || '';
            });
            dataRows.push(rowData);
        }

        const fetchedAt = Date.now();
        const sheetData = { headers, data: dataRows, timestamp: fetchedAt };
        allSheetsData[sheetName] = sheetData;
        sheetTimestamps[sheetName] = fetchedAt;
        await saveSheetToCache(sheetName, sheetData);
    }
}

function ensureFuseIndex(sheetName) {
    if (fuseIndexes[sheetName] || !window.Fuse) return;
    const sheetData = allSheetsData[sheetName];
    if (!sheetData || !sheetData.data) return;

    const indexedRows = sheetData.data.map(row => ({
        __ref: row,
        __haystack: Object.values(row).join(' ').toLowerCase()
    }));

    fuseIndexes[sheetName] = new Fuse(indexedRows, {
        keys: ['__haystack'],
        threshold: 0.34,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 2
    });
}

function runSearchOnSheet(sheetName, query) {
    const sheetData = allSheetsData[sheetName];
    if (!sheetData || !sheetData.data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return sheetData.data;

    ensureFuseIndex(sheetName);
    const fuse = fuseIndexes[sheetName];
    if (fuse) {
        return fuse.search(q).map(res => res.item.__ref);
    }

    // Fallback to basic substring search if Fuse isn't available
    return sheetData.data.filter(row => {
        return Object.values(row).some(value => String(value).toLowerCase().includes(q));
    });
}

function buildNameSuggestions(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const matches = [];
    for (const name of nameDictionary) {
        if (name.toLowerCase().includes(q)) {
            matches.push(name);
        }
        if (matches.length >= 8) break;
    }
    return matches;
}

function renderSearchAssist(query = '') {
    if (!searchAssist) return;
    searchAssist.innerHTML = '';

    const sections = [];
    const hasQuery = query && query.length > 0;
    const suggestionItems = hasQuery ? buildNameSuggestions(query) : [];

    if (hasQuery && suggestionItems.length) {
        sections.push({ title: 'Suggestions', items: suggestionItems });
    }
    if (recentSearches.length) {
        sections.push({ title: 'Recent', items: recentSearches });
    }

    if (!sections.length) {
        searchAssist.classList.remove('visible');
        return;
    }

    sections.forEach(section => {
        const header = document.createElement('div');
        header.className = 'assist-section-header';
        header.textContent = section.title;
        searchAssist.appendChild(header);

        section.items.slice(0, 8).forEach(item => {
            const row = document.createElement('div');
            row.className = 'assist-row';

            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'assist-item';
            option.setAttribute('role', 'option');
            option.textContent = item;
            option.addEventListener('mousedown', (e) => {
                // Prevent blur before we handle click
                e.preventDefault();
            });
            option.addEventListener('click', () => {
                searchInput.value = item;
                renderSearchAssist(item);
                runSearch(item);
            });
            row.appendChild(option);

            if (section.title === 'Recent') {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'assist-remove';
                removeBtn.setAttribute('aria-label', `Remove "${item}" from recent searches`);
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeRecentSearch(item);
                    renderSearchAssist(query);
                });
                row.appendChild(removeBtn);
            }

            searchAssist.appendChild(row);
        });
    });

    searchAssist.classList.add('visible');
}

// Populate column toggle checkboxes
function populateColumnToggles() {
    columnCheckboxes.innerHTML = '';

    allHeaders.forEach(header => {
        if (header === SELECT_COLUMN) return;
        const label = document.createElement('label');
        label.className = 'column-checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = visibleColumns.includes(header);
        checkbox.dataset.column = header;
        checkbox.addEventListener('change', () => toggleColumn(header, checkbox.checked));

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + header));
        columnCheckboxes.appendChild(label);
    });
}

// Toggle column visibility
function toggleColumn(columnName, isVisible) {
    let next = [...visibleColumns];
    if (isVisible && !next.includes(columnName)) {
        next.push(columnName);
    } else if (!isVisible) {
        next = next.filter(col => col !== columnName);
    }

    setVisibleColumns(next);
    announce(`${columnName} column ${isVisible ? 'shown' : 'hidden'}.`);
}

function setVisibleColumns(columns) {
    visibleColumns = columns.filter(Boolean);
    headers = visibleColumns;
    displayData(currentData);
    syncColumnCheckboxes();
}

function toggleColumnPanel(forceState, skipFocus = false) {
    const isCurrentlyVisible = columnTogglePanel.style.display === 'block';
    const shouldShow = typeof forceState === 'boolean' ? forceState : !isCurrentlyVisible;

    columnTogglePanel.style.display = shouldShow ? 'block' : 'none';
    columnTogglePanel.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    columnToggleBtn.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');

    if (!skipFocus) {
        if (shouldShow) {
            const firstCheckbox = columnCheckboxes.querySelector('input[type=\"checkbox\"]');
            if (firstCheckbox) firstCheckbox.focus();
        } else {
            columnToggleBtn.focus();
        }
    }
}

function syncColumnCheckboxes() {
    if (!columnCheckboxes) return;
    columnCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(input => {
        const name = input.dataset.column;
        if (!name) return;
        input.checked = visibleColumns.includes(name);
    });
}

function applyCompactPreset() {
    if (!currentSheet || !allSheetsData[currentSheet]) return;
    const preset = COLUMN_PRESETS[currentSheet] || COLUMN_PRESETS['default'];
    const presetSet = new Set([SELECT_COLUMN, 'Favorite', ...preset]);
    const next = allHeaders.filter(col => presetSet.has(col));
    if (next.length) {
        setVisibleColumns(next);
        announce(`Applied compact columns for ${currentSheet}.`);
    }
}

function showAllColumns() {
    if (!allHeaders || !allHeaders.length) return;
    setVisibleColumns([...allHeaders]);
    announce('Showing all columns.');
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
    updateMobileFilterSummary();
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlightText(text, query) {
    if (!query) return escapeHTML(text || '');
    const words = query.split(/\s+/).filter(Boolean);
    if (!words.length) return escapeHTML(text || '');
    let result = escapeHTML(text || '');
    words.forEach(word => {
        const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'ig');
        result = result.replace(regex, '<mark>$1</mark>');
    });
    return result;
}

// Make table cells keyboard and screen-reader friendly for expand/collapse
function makeCellExpandable(td, headerLabel) {
    const label = headerLabel || 'Cell';
    td.classList.add('expandable-cell');
    td.setAttribute('role', 'button');
    td.setAttribute('tabindex', '0');
    td.setAttribute('aria-expanded', 'false');
    td.setAttribute('aria-describedby', 'cellExpandHelp');
    td.title = 'Press Enter or Space to expand';

    const toggleExpand = () => {
        const isExpanded = td.classList.toggle('expanded');
        td.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        announce(`${label} ${isExpanded ? 'expanded' : 'collapsed'}.`);
    };

    const autoExpand = () => td.classList.add('expanded-auto');
    const collapse = () => td.classList.remove('expanded-auto');

    td.addEventListener('focus', autoExpand);
    td.addEventListener('blur', collapse);
    td.addEventListener('mouseenter', autoExpand);
    td.addEventListener('mouseleave', collapse);

    td.addEventListener('click', toggleExpand);
    td.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand();
        }
    });
}

function buildFavoriteButton(row) {
    const isFav = isFavorite(row);
    const btn = document.createElement('button');
    btn.className = `favorite-btn${isFav ? ' active' : ''}`;
    btn.textContent = isFav ? '\u2605' : '\u2606';
    btn.setAttribute('aria-label', `${isFav ? 'Remove' : 'Add'} ${row.Name || 'item'} ${isFav ? 'from' : 'to'} favorites`);
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(row);
    });
    return btn;
}

// Display data in table with pagination
function displayData(data, isMultiSheet = false) {
    if (data.length === 0 || headers.length === 0) {
        selectedRowKeys = new Set();
        updateSelectionSummary();
        if (resultsHeader) {
            resultsHeader.classList.remove('show');
            resultsHeader.setAttribute('aria-hidden', 'true');
        }
        if (scrollHint) scrollHint.classList.remove('visible');
        if (resultsSection) {
            resultsSection.classList.add('results-hidden');
        }
        if (cardsContainer) cardsContainer.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'none';
        recordMeta = { total: data.length, showing: 0, start: 0, end: 0 };
        updateRecordCount();
        updateInsights([]);

        // Determine which empty state to show
        if (favoritesOnly) {
            showEmptyState('noFavorites');
        } else if (!currentSheet) {
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

    let selectAllCheckbox = null;

    // Create table headers with sorting
    tableHead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');

        if (header === SELECT_COLUMN) {
            selectAllCheckbox = document.createElement('input');
            selectAllCheckbox.type = 'checkbox';
            selectAllCheckbox.title = 'Select all rows on this page';
            selectAllCheckbox.className = 'select-all-checkbox';
            th.appendChild(selectAllCheckbox);
            th.classList.add('select-header');
            th.setAttribute('role', 'columnheader');
            th.setAttribute('aria-label', 'Select all rows on this page');
        } else {
            th.textContent = header === 'Favorite' ? '\u2605' : header;
            th.title = header === 'Favorite' ? 'Sort by favorites' : `Click to sort by ${header}`;
            th.className = 'sortable';
            th.tabIndex = 0;
            th.setAttribute('role', 'columnheader');
            th.setAttribute('aria-label', `${header} column, sortable`);

            // Add sort indicators
            if (sortColumn === header) {
                th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
                th.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
            } else {
                th.setAttribute('aria-sort', 'none');
            }

            // Add click handler for sorting
            th.addEventListener('click', () => sortBy(header, isMultiSheet));
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sortBy(header, isMultiSheet);
                }
            });
        }

        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Calculate pagination
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    // Create table rows with optional grouping by sheet
    tableBody.innerHTML = '';
    if (cardGrid) cardGrid.innerHTML = '';

    const pageRowKeys = [];

    const renderTableRow = (row) => {
        const tr = document.createElement('tr');
        const rowKey = rowSelectionKey(row);
        pageRowKeys.push(rowKey);
        headers.forEach(header => {
            const td = document.createElement('td');
            let value = row[header] || '';

            if (header === SELECT_COLUMN) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'row-select';
                checkbox.checked = selectedRowKeys.has(rowKey);
                checkbox.addEventListener('click', (e) => e.stopPropagation());
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        selectedRowKeys.add(rowKey);
                    } else {
                        selectedRowKeys.delete(rowKey);
                    }
                    updateSelectionSummary();
                });
                td.appendChild(checkbox);
            } else if (header === 'Favorite') {
                td.appendChild(buildFavoriteButton(row));
                td.className = 'favorite-cell';
            } else if (header === 'Sheet') {
                value = row._sheet || '';
                td.textContent = value;
                makeCellExpandable(td, header);
            } else if (header === 'Image' && value && value.startsWith('http')) {
                const img = document.createElement('img');
                img.src = value;
                img.alt = row['Name'] || 'Image';
                img.className = 'item-image';
                img.loading = 'lazy';
                td.appendChild(img);
                td.className = 'image-cell';
            } else {
                const wrapper = document.createElement('div');
                wrapper.className = 'cell-inner';
                const textSpan = document.createElement('span');
                textSpan.className = 'cell-text';
                if (header === 'Name') {
                    textSpan.classList.add('name-cell');
                }
                textSpan.innerHTML = highlightText(value, lastQuery);
                wrapper.appendChild(textSpan);

                if (value !== undefined && value !== null && value !== '') {
                    const copyBtn = document.createElement('button');
                    copyBtn.type = 'button';
                    copyBtn.className = 'copy-cell-btn';
                    copyBtn.title = 'Copy cell';
                    copyBtn.setAttribute('aria-label', `Copy ${header} value`);
                    copyBtn.textContent = '\u2398'; // copy icon
                    copyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(String(value)).then(() => announce(`${header} copied`)).catch(() => {});
                    });
                    wrapper.appendChild(copyBtn);
                }

                td.appendChild(wrapper);
                makeCellExpandable(td, header);
            }

            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    };

    if (viewMode === 'cards' && cardGrid) {
        renderCards(paginatedData, isMultiSheet);
    } else if (isMultiSheet) {
        let currentSheetName = null;
        paginatedData.forEach(row => {
            if (row._sheet !== currentSheetName) {
                currentSheetName = row._sheet;
                const separatorRow = document.createElement('tr');
                separatorRow.className = 'sheet-separator';
                const separatorCell = document.createElement('td');
                separatorCell.colSpan = headers.length;
                separatorCell.textContent = `-- ${currentSheetName} --`;
                separatorRow.appendChild(separatorCell);
                tableBody.appendChild(separatorRow);
            }
            renderTableRow(row);
        });
    } else {
        paginatedData.forEach(renderTableRow);
    }

    // Hook up select-all for current page
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = pageRowKeys.length > 0 && pageRowKeys.every(key => selectedRowKeys.has(key));
        selectAllCheckbox.addEventListener('change', () => {
            if (selectAllCheckbox.checked) {
                pageRowKeys.forEach(key => selectedRowKeys.add(key));
            } else {
                pageRowKeys.forEach(key => selectedRowKeys.delete(key));
            }
            displayData(currentData, lastIsMultiSheet);
            updateSelectionSummary();
        });
    }

    // Add pagination controls
    renderPagination(data.length);

    recordMeta = {
        total: data.length,
        showing: paginatedData.length,
        start: data.length ? startIndex + 1 : 0,
        end: data.length ? Math.min(endIndex, data.length) : 0
    };
    updateRecordCount();
    updateResultsHeading(isMultiSheet);
    updateInsights(data);

    if (resultsSection) {
        resultsSection.classList.remove('results-hidden');
    }
    if (viewMode === 'cards') {
        if (cardsContainer) cardsContainer.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
    } else {
        if (tableContainer) tableContainer.style.display = 'block';
        if (cardsContainer) cardsContainer.style.display = 'none';
    }

    if (tableContainer) {
        tableContainer.scrollTop = 0;
        tableContainer.scrollLeft = 0;
    }
    requestAnimationFrame(updateScrollHint);
}

function renderCards(data, isMultiSheet = false) {
    if (!cardGrid) return;
    cardGrid.innerHTML = '';

    const infoColumns = headers.filter(h => h !== 'Favorite' && h !== 'Image' && h !== SELECT_COLUMN);
    data.forEach(row => {
        const card = document.createElement('article');
        card.className = 'item-card';
        if (isFavorite(row)) card.classList.add('favorite');

        // Sheet badge
        if (isMultiSheet) {
            const badge = document.createElement('div');
            badge.className = 'sheet-badge';
            badge.textContent = row._sheet || '';
            card.appendChild(badge);
        }

        // Favorite toggle
        const favBtn = buildFavoriteButton(row);
        favBtn.classList.add('card-fav-btn');
        card.appendChild(favBtn);

        // Image
        const imgUrl = row['Image'];
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
            const imgWrap = document.createElement('div');
            imgWrap.className = 'card-image';
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = row['Name'] || 'Image';
            img.loading = 'lazy';
            imgWrap.appendChild(img);
            card.appendChild(imgWrap);
        }

        // Title
        const title = document.createElement('h3');
        title.className = 'card-title';
        title.innerHTML = highlightText(row['Name'] || row['Item'] || 'Untitled', lastQuery);
        card.appendChild(title);

        // Details
        const meta = document.createElement('dl');
        meta.className = 'card-meta';

        infoColumns.slice(0, 6).forEach(col => {
            const value = row[col];
            if (!value || col === 'Name' || col === 'Sheet') return;
            const dt = document.createElement('dt');
            dt.textContent = col;
            const dd = document.createElement('dd');
            dd.innerHTML = highlightText(value, lastQuery);
            meta.appendChild(dt);
            meta.appendChild(dd);
        });

        card.appendChild(meta);
        cardGrid.appendChild(card);
    });
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

        if (column === 'Favorite') {
            const aFav = isFavorite(a) ? 1 : 0;
            const bFav = isFavorite(b) ? 1 : 0;
            return sortDirection === 'asc' ? aFav - bFav : bFav - aFav;
        }

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
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayData(currentData, lastIsMultiSheet);
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
    nextBtn.textContent = 'Next';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayData(currentData, lastIsMultiSheet);
        }
    });
    paginationDiv.appendChild(nextBtn);

    // Add export buttons
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export CSV';
    exportBtn.className = 'export-btn';
    exportBtn.title = 'Export current data to CSV';
    exportBtn.addEventListener('click', exportToCSV);
    paginationDiv.appendChild(exportBtn);

    const exportSelectedBtn = document.createElement('button');
    exportSelectedBtn.textContent = 'Export Selected';
    exportSelectedBtn.className = 'export-btn secondary';
    exportSelectedBtn.title = 'Export only selected rows to CSV';
    exportSelectedBtn.addEventListener('click', exportSelectedToCSV);
    paginationDiv.appendChild(exportSelectedBtn);

    resultsSection.appendChild(paginationDiv);
}

// Apply all filters (search + DIY + Catalog)
async function applyFilters(options = {}) {
    const { suppressLoadingState = false } = options;
    try {
        const query = searchInput.value.trim();
        const diyValue = diyFilter.value;
        const catalogValue = catalogFilter.value;
        const hasSearch = query.length > 0;
        const isGlobalSearch = hasSearch && !currentSheet;
        const wantsGlobalFavorites = favoritesOnly && !currentSheet && !hasSearch;
        const wantsGlobalAll = !hasSearch && !currentSheet && !favoritesOnly;
        const needGlobalData = (!currentSheet && (isGlobalSearch || wantsGlobalFavorites || wantsGlobalAll));
        lastIsSearch = hasSearch;
        lastQuery = query;

        if (needGlobalData) {
            await ensureSheetsLoadedForSearch(suppressLoadingState);
        } else if (currentSheet && !allSheetsData[currentSheet]) {
            await loadSheetData(currentSheet);
        }

        if (!hasSearch && !favoritesOnly && !currentSheet && Object.keys(allSheetsData).length === 0) {
            showEmptyState('welcome');
            recordMeta = { total: 0, showing: 0, start: 0, end: 0 };
            updateRecordCount();
            updateInsights([]);
            return; // No data loaded yet
        }

        let combinedData = [];
        let isMultiSheet = false;

        // If searching, scope to selected sheet or all sheets if none selected
        if (hasSearch) {
            const targetSheets = isGlobalSearch ? availableSheets : [currentSheet];

            for (const sheetName of targetSheets) {
                const sheetData = allSheetsData[sheetName];
                if (!sheetData || !sheetData.data) continue;

                const searchResults = runSearchOnSheet(sheetName, query);
                const filteredRows = searchResults.filter(row => {
                    if (diyValue && sheetData.headers.includes('DIY') && row['DIY'] !== diyValue) return false;
                    if (catalogValue && sheetData.headers.includes('Catalog') && row['Catalog'] !== catalogValue) return false;
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

        } else if (wantsGlobalFavorites || wantsGlobalAll) {
            const targetSheets = availableSheets;
            for (const sheetName of targetSheets) {
                const sheetData = allSheetsData[sheetName];
                if (!sheetData || !sheetData.data) continue;
                const filtered = sheetData.data.filter(row => {
                    if (diyValue && sheetData.headers.includes('DIY') && row['DIY'] !== diyValue) return false;
                    if (catalogValue && sheetData.headers.includes('Catalog') && row['Catalog'] !== catalogValue) return false;
                    return true;
                });
                combinedData = combinedData.concat(filtered);
            }
            isMultiSheet = true;
        } else {
            // No search - show data from currently selected sheet only
            const sheetData = allSheetsData[currentSheet];
            if (sheetData && sheetData.data) {
                combinedData = sheetData.data.filter(row => {
                    if (diyValue && sheetData.headers.includes('DIY') && row['DIY'] !== diyValue) return false;
                    if (catalogValue && sheetData.headers.includes('Catalog') && row['Catalog'] !== catalogValue) return false;
                    return true;
                });
            }
            isMultiSheet = false;
        }

        if (favoritesOnly) {
            combinedData = combinedData.filter(row => isFavorite(row));
        }

        if (!currentSheet) {
            const uniqueSheets = new Set(combinedData.map(row => row._sheet));
            isMultiSheet = uniqueSheets.size > 1;
        }

        // Set up headers and visible columns
        setupHeadersForDisplay(isMultiSheet, combinedData);

        currentData = combinedData;
        allData = combinedData;
        pruneSelection();
        currentPage = 1; // Reset to first page
        lastIsMultiSheet = isMultiSheet;

        displayData(currentData, isMultiSheet);

        // If this was a global search, stop prefetch to avoid background noise
        if (!currentSheet && hasSearch) {
            cancelPrefetch('global search');
        }

        syncUrlState();
        updateMobileFilterSummary();
    } catch (error) {
        console.error('Error applying filters:', error);
        clearGlobalProgress();
        showEmptyState('error', {
            title: 'Unable to load data',
            message: error.message || 'Failed to load data. Please try again.'
        });
    }
}

// Setup headers based on display mode
function setupHeadersForDisplay(isMultiSheet, data) {
    if (isMultiSheet) {
        // Multi-sheet results - show common columns plus Sheet column
        const headerSet = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key !== '_sheet') {
                    headerSet.add(key);
                }
            });
        });

        // Prioritize Name and Image, then add Sheet
        visibleColumns = [SELECT_COLUMN, 'Favorite', 'Sheet'];
        if (headerSet.has('Name')) visibleColumns.push('Name');
        if (headerSet.has('Image')) visibleColumns.push('Image');

        // Add other common columns
        const commonCols = Array.from(headerSet).filter(h => h !== 'Name' && h !== 'Image');
        visibleColumns = visibleColumns.concat(commonCols.slice(0, 8)); // Limit to reasonable number

        headers = visibleColumns;
        allHeaders = [...headers];
        populateColumnToggles();

    } else if (currentSheet && allSheetsData[currentSheet]) {
        // Single sheet - use preset columns
        const sheetData = allSheetsData[currentSheet];
        allHeaders = [SELECT_COLUMN, 'Favorite', ...sheetData.headers];

        const preset = COLUMN_PRESETS[currentSheet] || COLUMN_PRESETS['default'];
        const presetWithFav = [SELECT_COLUMN, 'Favorite', ...preset];
        visibleColumns = allHeaders.filter(h => presetWithFav.includes(h));

        if (visibleColumns.length === 0) {
            visibleColumns = allHeaders.slice(0, Math.min(10, allHeaders.length));
        }

        headers = visibleColumns;

        // Populate column toggle UI
        populateColumnToggles();
    } else if (data && data.length) {
        // Fallback for global results that only include one sheet
        const derivedHeaders = Object.keys(data[0]).filter(h => h !== '_sheet');
        headers = [SELECT_COLUMN, 'Favorite', ...derivedHeaders];
        visibleColumns = headers;
        allHeaders = [...headers];
        populateColumnToggles();
    }
}

// Update record count
function updateRecordCount() {
    if (!recordCount) return;

    const hasResults = recordMeta.total > 0;
    const shouldShow = hasResults || lastIsSearch || !!currentSheet;
    recordCount.style.display = shouldShow ? 'block' : 'none';

    if (!hasResults) {
        recordCount.textContent = lastIsSearch ? 'No matches found' : 'No results found';
        return;
    }

    const context = lastIsSearch ? 'matches' : 'records';

    if (recordMeta.showing >= recordMeta.total) {
        recordCount.textContent = `Showing all ${recordMeta.total} ${context}`;
    } else {
        recordCount.textContent = `Showing ${recordMeta.start}-${recordMeta.end} of ${recordMeta.total} ${context}`;
    }

    updateSelectionSummary();
}

function updateSelectionSummary() {
    if (!selectionCount) return;
    const count = selectedRowKeys.size;
    if (count === 0) {
        selectionCount.textContent = '';
        selectionCount.style.display = 'none';
    } else {
        selectionCount.textContent = `${count} selected`;
        selectionCount.style.display = 'inline-block';
    }
}

function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return Number(value).toLocaleString();
}

function parseNumeric(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

function getColumnValues(data, column) {
    if (!data || !column) return [];
    const values = [];
    data.forEach(row => {
        const value = row[column];
        if (value === undefined || value === null) return;
        const normalized = String(value).trim();
        if (normalized) values.push(normalized);
    });
    return values;
}

function getMostCommon(values) {
    const counts = new Map();
    values.forEach(value => {
        const key = String(value).trim();
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    let best = null;
    counts.forEach((count, value) => {
        if (!best || count > best.count) {
            best = { value, count };
        }
    });
    return best;
}

function pickNameColumn(data) {
    if (!data || !data.length) return null;
    const row = data[0] || {};
    for (const col of NAME_COLUMNS) {
        if (col in row) return col;
    }
    const fallback = Object.keys(row).filter(key => key !== '_sheet' && key !== 'Image');
    return fallback.length ? fallback[0] : null;
}

function getSpotlight(data) {
    for (const column of SPOTLIGHT_COLUMNS) {
        const values = getColumnValues(data, column);
        if (values.length < 4) continue;
        const top = getMostCommon(values);
        if (top && top.count >= 3) {
            return { column, value: top.value, count: top.count, total: values.length };
        }
    }
    return null;
}

function getPriceRange(data) {
    for (const column of PRICE_COLUMNS) {
        const values = getColumnValues(data, column)
            .map(parseNumeric)
            .filter(value => value !== null);
        if (values.length < 3) continue;
        const min = Math.min(...values);
        const max = Math.max(...values);
        return { column, min, max, count: values.length };
    }
    return null;
}

function createFilterChip(label, onClick, options = {}) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `filter-chip${options.variant ? ` ${options.variant}` : ''}`;
    chip.setAttribute('aria-label', options.ariaLabel || `Clear ${label}`);
    const text = document.createElement('span');
    text.textContent = label;
    chip.appendChild(text);

    if (onClick) {
        const close = document.createElement('span');
        close.className = 'chip-close';
        close.textContent = 'x';
        chip.appendChild(close);
        chip.addEventListener('click', onClick);
    } else {
        chip.classList.add('empty');
        chip.setAttribute('aria-label', label);
    }

    return chip;
}

function clearAllFilters() {
    searchInput.value = '';
    if (diyFilter) diyFilter.value = '';
    if (catalogFilter) catalogFilter.value = '';
    if (currentSheet) {
        currentSheet = '';
        sheetSelect.value = '';
    }
    if (favoritesOnly) {
        setFavoritesOnly(false, true);
    }
    applyFilters();
    syncUrlState();
}

function updateActiveFilterChips() {
    if (!activeFilters) return;
    activeFilters.innerHTML = '';

    const chips = [];
    const query = searchInput.value.trim();

    if (currentSheet) {
        chips.push(createFilterChip(`Sheet: ${currentSheet}`, () => {
            currentSheet = '';
            sheetSelect.value = '';
            applyFilters();
            syncUrlState();
        }));
    }

    if (query) {
        chips.push(createFilterChip(`Search: ${query}`, () => {
            runSearch('');
            syncUrlState();
        }));
    }

    if (diyFilter && diyFilter.value) {
        chips.push(createFilterChip(`DIY: ${diyFilter.value}`, () => {
            diyFilter.value = '';
            applyFilters();
            syncUrlState();
        }));
    }

    if (catalogFilter && catalogFilter.value) {
        chips.push(createFilterChip(`Catalog: ${catalogFilter.value}`, () => {
            catalogFilter.value = '';
            applyFilters();
            syncUrlState();
        }));
    }

    if (favoritesOnly) {
        chips.push(createFilterChip('Favorites only', () => {
            setFavoritesOnly(false);
            syncUrlState();
        }));
    }

    if (!chips.length) {
        activeFilters.appendChild(createFilterChip('No filters applied'));
        return;
    }

    chips.forEach(chip => activeFilters.appendChild(chip));
    activeFilters.appendChild(createFilterChip('Reset all', clearAllFilters, {
        variant: 'reset',
        ariaLabel: 'Reset all filters'
    }));
}

function updateInsights(data = currentData) {
    if (!insightRecords || !insightFavorites || !insightSpotlight || !insightValue) {
        updateActiveFilterChips();
        return;
    }

    const total = Array.isArray(data) ? data.length : 0;
    insightRecords.textContent = total ? formatNumber(total) : '--';
    if (insightScope) {
        insightScope.textContent = total
            ? (currentSheet ? `in ${currentSheet}` : 'across all sheets')
            : 'Select a sheet to begin';
    }

    const totalFavorites = favorites.size;
    insightFavorites.textContent = formatNumber(totalFavorites || 0);
    if (insightFavoritesSub) {
        if (!total) {
            insightFavoritesSub.textContent = totalFavorites ? `${formatNumber(totalFavorites)} saved` : 'Stars you save live here';
        } else {
            const favoritesInView = data.filter(row => isFavorite(row)).length;
            insightFavoritesSub.textContent = `${formatNumber(favoritesInView)} in view`;
        }
    }

    if (!total) {
        if (insightSpotlightLabel) insightSpotlightLabel.textContent = 'Spotlight';
        if (insightSpotlightSub) insightSpotlightSub.textContent = 'Load data to see trends';
        insightSpotlight.textContent = '--';
        if (insightValueLabel) insightValueLabel.textContent = 'Value range';
        if (insightValueSub) insightValueSub.textContent = 'Waiting for price data';
        insightValue.textContent = '--';
        updateActiveFilterChips();
        return;
    }

    const spotlight = getSpotlight(data);
    if (spotlight) {
        if (insightSpotlightLabel) insightSpotlightLabel.textContent = `Top ${spotlight.column}`;
        insightSpotlight.textContent = spotlight.value;
        const pct = Math.round((spotlight.count / total) * 100);
        if (insightSpotlightSub) insightSpotlightSub.textContent = `${pct}% of visible records`;
    } else {
        const nameColumn = pickNameColumn(data);
        if (nameColumn) {
            const unique = new Set(getColumnValues(data, nameColumn).map(value => value.toLowerCase())).size;
            if (insightSpotlightLabel) insightSpotlightLabel.textContent = 'Unique entries';
            insightSpotlight.textContent = formatNumber(unique);
            if (insightSpotlightSub) insightSpotlightSub.textContent = nameColumn;
        } else {
            if (insightSpotlightLabel) insightSpotlightLabel.textContent = 'Spotlight';
            insightSpotlight.textContent = '--';
            if (insightSpotlightSub) insightSpotlightSub.textContent = 'No highlight available';
        }
    }

    const priceRange = getPriceRange(data);
    if (priceRange) {
        if (insightValueLabel) insightValueLabel.textContent = `${priceRange.column} range`;
        insightValue.textContent = `${formatNumber(priceRange.min)} - ${formatNumber(priceRange.max)}`;
        if (insightValueSub) insightValueSub.textContent = `${formatNumber(priceRange.count)} prices found`;
    } else {
        const diyValues = getColumnValues(data, 'DIY');
        if (diyValues.length) {
            const yesCount = diyValues.filter(value => value.toLowerCase() === 'yes').length;
            const pct = Math.round((yesCount / diyValues.length) * 100);
            if (insightValueLabel) insightValueLabel.textContent = 'DIY share';
            insightValue.textContent = `${pct}%`;
            if (insightValueSub) insightValueSub.textContent = `${yesCount} of ${diyValues.length} items`;
        } else {
            const imageValues = getColumnValues(data, 'Image');
            if (imageValues.length) {
                const withImages = imageValues.filter(value => value.startsWith('http')).length;
                const pct = Math.round((withImages / imageValues.length) * 100);
                if (insightValueLabel) insightValueLabel.textContent = 'Image coverage';
                insightValue.textContent = `${pct}%`;
                if (insightValueSub) insightValueSub.textContent = `${withImages} of ${imageValues.length} have images`;
            } else {
                if (insightValueLabel) insightValueLabel.textContent = 'Columns detected';
                const columnCount = Object.keys(data[0] || {}).filter(key => key !== '_sheet').length;
                insightValue.textContent = formatNumber(columnCount || 0);
                if (insightValueSub) insightValueSub.textContent = 'Fields in the current view';
            }
        }
    }

    updateActiveFilterChips();
}

function updateResultsHeading(isMultiSheet) {
    if (!resultsHeader || !resultsTitle || !resultsSubtitle) return;

    const titleText = currentSheet || 'All Sheets';
    resultsTitle.textContent = titleText;

    const badges = [];
    if (favoritesOnly) badges.push('Favorites only');
    if (lastIsSearch && lastQuery) badges.push(`Search: "${lastQuery}"`);
    if (diyFilter && diyFilter.value) badges.push(`DIY: ${diyFilter.value}`);
    if (catalogFilter && catalogFilter.value) badges.push(`Catalog: ${catalogFilter.value}`);

    resultsSubtitle.textContent = badges.join(' • ');
    resultsSubtitle.style.display = badges.length ? 'inline' : 'none';
    resultsHeader.classList.add('show');
    resultsHeader.setAttribute('aria-hidden', 'false');
}

function updateScrollHint() {
    if (!scrollHint || !tableContainer) return;
    const hasOverflow = (tableContainer.scrollWidth - tableContainer.clientWidth) > 12;
    scrollHint.classList.toggle('visible', hasOverflow);
}

function pruneSelection() {
    if (!selectedRowKeys.size || !currentData.length) {
        selectedRowKeys = new Set();
        updateSelectionSummary();
        return;
    }
    const next = new Set();
    currentData.forEach(row => {
        const key = rowSelectionKey(row);
        if (selectedRowKeys.has(key)) next.add(key);
    });
    selectedRowKeys = next;
    updateSelectionSummary();
}

// Show/hide loading indicator
function showLoading(show) {
    loading.style.display = show ? 'flex' : 'none';
    if (show) {
        if (resultsSection) {
            resultsSection.classList.add('results-hidden');
        }
        if (emptyState) emptyState.style.display = 'none';
    } else {
        if (resultsSection) {
            const hasData = allData.length > 0;
            if (hasData) {
                resultsSection.classList.remove('results-hidden');
            }
        }
    }
}

// Update empty state display
function updateEmptyState(type = 'welcome', overrides = {}) {
    const states = {
        welcome: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>`,
            title: 'Welcome to ACNH Database!',
            message: 'Search across all sheets or choose a sheet to focus your results.'
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
        noFavorites: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 21s-6.5-4.35-9-9.5A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9 6.5C18.5 16.65 12 21 12 21z"></path>
            </svg>`,
            title: 'No favorites found',
            message: 'Tap the ☆ on any item to save it—or clear filters if they are hiding your favorites.'
        },
        noSheet: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>`,
            title: 'All Sheets',
            message: 'You are browsing all sheets. Pick one to focus if you need sheet-only filters.'
        },
        loading: {
            icon: `<div class="spinner"></div>`,
            title: 'Loading...',
            message: 'Please wait while we fetch your data.'
        },
        error: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>`,
            title: 'Error Loading Data',
            message: 'Something went wrong. Please try again.'
        },
        noApiKey: {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
    if (resultsSection) {
        resultsSection.classList.add('results-hidden');
    }
    loading.style.display = 'none';

    // Apply appropriate CSS class for styling
    emptyState.className = 'empty-state';
    if (type === 'error') {
        emptyState.classList.add('error');
        addRetryButton();
    } else if (type === 'loading') {
        emptyState.classList.add('loading');
    }

    const liveMessage = `${emptyStateTitle.textContent || ''} ${emptyStateMessage.textContent || ''}`.trim();
    announce(liveMessage, type === 'error' ? 'assertive' : 'polite');
}

// Add retry button for error states
function addRetryButton() {
    // Remove existing retry button if present
    const existingBtn = document.getElementById('retryButton');
    if (existingBtn) {
        existingBtn.remove();
    }

    // Create retry button
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retryButton';
    retryBtn.textContent = 'Retry';
    retryBtn.className = 'retry-btn';

    retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Retrying...';
        await loadAvailableSheets();
        retryBtn.disabled = false;
        retryBtn.textContent = 'Retry';
    });

    const emptyStateContent = document.querySelector('.empty-state-content');
    if (emptyStateContent) {
        emptyStateContent.appendChild(retryBtn);
    }
}


// Hide empty state
function hideEmptyState() {
    emptyState.style.display = 'none';
    emptyState.className = 'empty-state';
    if (resultsSection) {
        resultsSection.classList.remove('results-hidden');
    }
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
function exportToCSV() {
    if (currentData.length === 0) {
        alert('No data to export');
        return;
    }

    // Create CSV content
    let csv = '';

    // Add headers
    const exportHeaders = headers.filter(h => h !== SELECT_COLUMN);
    csv += exportHeaders.map(h => `"${h}"`).join(',') + '\n';

    // Add data rows
    currentData.forEach(row => {
        const values = exportHeaders.map(header => {
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

function exportSelectedToCSV() {
    const exportHeaders = headers.filter(h => h !== SELECT_COLUMN);
    const selectedRows = currentData.filter(row => selectedRowKeys.has(rowSelectionKey(row)));
    if (!selectedRows.length) {
        alert('No selected rows to export.');
        return;
    }

    let csv = '';
    csv += exportHeaders.map(h => `"${h}"`).join(',') + '\n';
    selectedRows.forEach(row => {
        const values = exportHeaders.map(header => {
            const value = String(row[header] || '').replace(/"/g, '""');
            return `"${value}"`;
        });
        csv += values.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const sheetName = sheetSelect.value || 'data';
    link.setAttribute('href', url);
    link.setAttribute('download', `acnh_selected_${sheetName.replace(/\s+/g, '_')}_${Date.now()}.csv`);
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
