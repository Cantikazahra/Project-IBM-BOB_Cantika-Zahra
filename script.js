/**
 * script.js — FlagTracker
 *
 * Architecture:
 *  - State      : `athletes` array is the single source of truth.
 *  - Storage    : Persisted to localStorage; survives page refresh.
 *  - Render     : Full table re-renders on every state change (simple & bug-free).
 *  - Filtering  : Computed on-the-fly from `athletes` using search + position values.
 *
 * Sections:
 *  1.  Type Definition & State
 *  2.  Constants (DOM references)
 *  3.  localStorage helpers
 *  4.  CRUD operations
 *  5.  Filter & search
 *  6.  Render helpers (badges, icons)
 *  7.  Main render function
 *  8.  Header stats updater
 *  9.  Modal helpers (open / close / reset)
 * 10.  Form validation
 * 11.  Toast notification
 * 12.  Event listeners
 * 13.  Seed data & initialization
 */

'use strict';

/* ============================================================
   1. TYPE DEFINITION & STATE
   ============================================================ */

/**
 * @typedef {Object} Athlete
 * @property {string} id       - Unique identifier (UUID or timestamp-based)
 * @property {string} name     - Full name
 * @property {number} number   - Jersey number (1–99)
 * @property {string} position - 'Quarterback' | 'Receiver' | 'Rusher' | 'Defender'
 * @property {number} games    - Total games played
 * @property {number} scores   - Total touchdowns / scores
 * @property {number} tackles  - Total tackles / interceptions
 */

/** @type {Athlete[]} Master list — source of truth */
let athletes = [];

/** Pending delete: ID of the athlete awaiting delete confirmation */
let pendingDeleteId = null;

/* ============================================================
   2. CONSTANTS — DOM element references
   ============================================================ */

// Header stat counters
const domHeaderTotal   = document.getElementById('header-total');
const domHeaderTd      = document.getElementById('header-td');
const domHeaderTackles = document.getElementById('header-tackles');

// Mobile stat counters
const domMobTotal   = document.getElementById('mob-total');
const domMobTd      = document.getElementById('mob-td');
const domMobTackles = document.getElementById('mob-tackles');

// Toolbar
const domSearchInput     = document.getElementById('search-input');
const domPositionFilter  = document.getElementById('position-filter');
const domResultCount     = document.getElementById('result-count');

// Table
const domTableBody  = document.getElementById('athlete-table-body');
const domEmptyState = document.getElementById('empty-state');
const domEmptyTitle = document.getElementById('empty-title');
const domEmptySubtitle = document.getElementById('empty-subtitle');

// Add/Edit Modal
const domAthleteModal  = document.getElementById('athlete-modal');
const domModalTitle    = document.getElementById('modal-title');
const domAthleteForm   = document.getElementById('athlete-form');
const domFormId        = document.getElementById('form-athlete-id');
const domFormName      = document.getElementById('form-name');
const domFormNumber    = document.getElementById('form-number');
const domFormPosition  = document.getElementById('form-position');
const domFormGames     = document.getElementById('form-games');
const domFormScores    = document.getElementById('form-scores');
const domFormTackles   = document.getElementById('form-tackles');
const domOpenAddBtn    = document.getElementById('open-add-modal-btn');
const domCloseModalBtn = document.getElementById('close-modal-btn');
const domCancelModalBtn= document.getElementById('cancel-modal-btn');

// Error elements
const domErrorName     = document.getElementById('error-name');
const domErrorNumber   = document.getElementById('error-number');
const domErrorPosition = document.getElementById('error-position');

// Delete modal
const domDeleteModal      = document.getElementById('delete-modal');
const domDeleteDesc       = document.getElementById('delete-modal-desc');
const domCancelDeleteBtn  = document.getElementById('cancel-delete-btn');
const domConfirmDeleteBtn = document.getElementById('confirm-delete-btn');

// Toast
const domToast = document.getElementById('toast');

/* ============================================================
   3. LOCALSTORAGE HELPERS
   ============================================================ */

const STORAGE_KEY = 'athleteStats_v1';

/** Load athletes array from localStorage. Returns [] if empty or corrupted. */
function loadAthletesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist the current athletes array to localStorage. */
function saveAthletesToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(athletes));
}

/* ============================================================
   4. CRUD OPERATIONS
   ============================================================ */

/**
 * CREATE — Add a new athlete to the beginning of the list.
 * @param {Omit<Athlete, 'id'>} athleteData
 */
function createAthlete(athleteData) {
  const newAthlete = {
    id: generateId(),
    ...athleteData,
  };
  athletes.unshift(newAthlete);
  saveAthletesToStorage();
  renderTable();
  updateHeaderStats();
  showToast(`✓ ${newAthlete.name} added successfully.`);
}

/**
 * UPDATE — Replace an existing athlete's data by ID.
 * @param {string}              id
 * @param {Omit<Athlete, 'id'>} updatedData
 */
function updateAthlete(id, updatedData) {
  const index = athletes.findIndex(a => a.id === id);
  if (index === -1) return;

  athletes[index] = { id, ...updatedData };
  saveAthletesToStorage();
  renderTable();
  updateHeaderStats();
  showToast(`✓ ${athletes[index].name} updated successfully.`);
}

/**
 * DELETE — Remove an athlete by ID.
 * @param {string} id
 */
function deleteAthlete(id) {
  const athlete = athletes.find(a => a.id === id);
  const name = athlete ? athlete.name : 'Athlete';

  athletes = athletes.filter(a => a.id !== id);
  saveAthletesToStorage();
  renderTable();
  updateHeaderStats();
  showToast(`✓ ${name} removed.`);
}

/* ============================================================
   5. FILTER & SEARCH
   ============================================================ */

/**
 * Return athletes matching the current search query and position filter.
 * Filtering is case-insensitive and trims whitespace.
 * @returns {Athlete[]}
 */
function getFilteredAthletes() {
  const query    = domSearchInput.value.trim().toLowerCase();
  const position = domPositionFilter.value;

  return athletes.filter(athlete => {
    const matchesName     = athlete.name.toLowerCase().includes(query);
    const matchesPosition = position === '' || athlete.position === position;
    return matchesName && matchesPosition;
  });
}

/* ============================================================
   6. RENDER HELPERS
   ============================================================ */

/**
 * Generate a unique ID string.
 * Uses crypto.randomUUID() when available (modern browsers).
 * @returns {string}
 */
function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Map a position string to a CSS badge class.
 * @param {string} position
 * @returns {string} CSS class name
 */
function getPositionBadgeClass(position) {
  const map = {
    Quarterback: 'badge-qb',
    Receiver:    'badge-wr',
    Rusher:      'badge-rb',
    Defender:    'badge-def',
  };
  return map[position] || 'badge-qb';
}

/**
 * Build the SVG markup for edit and delete icon buttons.
 * @param {'edit'|'delete'} type
 * @returns {string}
 */
function getActionIconSvg(type) {
  if (type === 'edit') {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`;
  }
  // delete
  return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>`;
}

/**
 * Build a <tr> element for one athlete row.
 * Uses data-id for event delegation.
 * @param {Athlete} athlete
 * @param {number}  rowIndex - 1-based display index
 * @returns {HTMLTableRowElement}
 */
function createAthleteRow(athlete, rowIndex) {
  const tr = document.createElement('tr');
  tr.dataset.id = athlete.id;

  const badgeClass = getPositionBadgeClass(athlete.position);

  tr.innerHTML = `
    <td class="px-5 py-3.5 text-cool-400 text-xs font-semibold">${rowIndex}</td>
    <td class="px-5 py-3.5">
      <div class="flex items-center gap-3">
        <span class="jersey-badge">${athlete.number}</span>
        <span class="font-semibold text-cool-800 text-sm leading-tight">${escapeHtml(athlete.name)}</span>
      </div>
    </td>
    <td class="px-5 py-3.5 hidden sm:table-cell">
      <span class="position-badge ${badgeClass}">${escapeHtml(athlete.position)}</span>
    </td>
    <td class="px-5 py-3.5 hidden md:table-cell text-center text-cool-600 font-medium">${athlete.games}</td>
    <td class="px-5 py-3.5 hidden md:table-cell text-center">
      <span class="font-bold text-navy-700">${athlete.scores}</span>
    </td>
    <td class="px-5 py-3.5 hidden lg:table-cell text-center text-cool-600 font-medium">${athlete.tackles}</td>
    <td class="px-5 py-3.5 text-right">
      <div class="flex items-center justify-end gap-1">
        <button
          class="btn-action btn-edit-row"
          data-action="edit"
          aria-label="Edit ${escapeHtml(athlete.name)}"
          title="Edit"
        >${getActionIconSvg('edit')}</button>
        <button
          class="btn-action btn-delete-row"
          data-action="delete"
          aria-label="Delete ${escapeHtml(athlete.name)}"
          title="Delete"
        >${getActionIconSvg('delete')}</button>
      </div>
    </td>
  `;

  return tr;
}

/* ============================================================
   7. MAIN RENDER FUNCTION
   ============================================================ */

/**
 * Re-render the entire athlete table based on current state + active filters.
 * Called after every state mutation and after any filter/search change.
 */
function renderTable() {
  const filtered = getFilteredAthletes();

  // Clear existing rows
  domTableBody.innerHTML = '';

  if (filtered.length === 0) {
    // Show contextual empty state
    domEmptyState.classList.remove('hidden');
    domEmptyState.classList.add('flex');

    const hasFilters = domSearchInput.value.trim() !== '' || domPositionFilter.value !== '';
    domEmptyTitle.textContent    = hasFilters ? 'No athletes match your filters' : 'No athletes yet';
    domEmptySubtitle.textContent = hasFilters
      ? 'Try a different name or position.'
      : 'Click "Add Athlete" to get started.';
  } else {
    domEmptyState.classList.add('hidden');
    domEmptyState.classList.remove('flex');
    filtered.forEach((athlete, index) => {
      domTableBody.appendChild(createAthleteRow(athlete, index + 1));
    });
  }

  // Update result count badge
  const count = filtered.length;
  domResultCount.textContent = `${count} athlete${count !== 1 ? 's' : ''}`;
}

/* ============================================================
   8. HEADER STATS UPDATER
   ============================================================ */

/**
 * Recalculate aggregate stats from the full (unfiltered) athletes array
 * and update both desktop header and mobile stat cards.
 */
function updateHeaderStats() {
  const totalAthletes = athletes.length;
  const totalTd       = athletes.reduce((sum, a) => sum + a.scores,  0);
  const totalTackles  = athletes.reduce((sum, a) => sum + a.tackles, 0);

  // Desktop header
  domHeaderTotal.textContent   = totalAthletes;
  domHeaderTd.textContent      = totalTd;
  domHeaderTackles.textContent = totalTackles;

  // Mobile cards
  domMobTotal.textContent   = totalAthletes;
  domMobTd.textContent      = totalTd;
  domMobTackles.textContent = totalTackles;
}

/* ============================================================
   9. MODAL HELPERS
   ============================================================ */

/** Open the Add Athlete modal (blank form). */
function openAddModal() {
  resetFormFields();
  clearFormValidationErrors();
  domFormId.value      = '';  // No ID means Create mode
  domModalTitle.textContent = 'Add Athlete';
  domAthleteModal.classList.remove('hidden');
  domFormName.focus();
}

/**
 * Open the Edit Athlete modal pre-filled with existing data.
 * @param {string} id - Athlete ID to edit
 */
function openEditModal(id) {
  const athlete = athletes.find(a => a.id === id);
  if (!athlete) return;

  clearFormValidationErrors();
  domFormId.value       = athlete.id;
  domFormName.value     = athlete.name;
  domFormNumber.value   = athlete.number;
  domFormPosition.value = athlete.position;
  domFormGames.value    = athlete.games;
  domFormScores.value   = athlete.scores;
  domFormTackles.value  = athlete.tackles;

  domModalTitle.textContent = 'Edit Athlete';
  domAthleteModal.classList.remove('hidden');
  domFormName.focus();
  domFormName.select();
}

/** Close the Add/Edit modal. */
function closeAthleteModal() {
  domAthleteModal.classList.add('hidden');
  resetFormFields();
  clearFormValidationErrors();
}

/**
 * Open the delete confirmation modal.
 * @param {string} id - Athlete ID to delete
 */
function openDeleteModal(id) {
  const athlete = athletes.find(a => a.id === id);
  if (!athlete) return;

  pendingDeleteId = id;
  domDeleteDesc.textContent = `You are about to delete "${athlete.name}" (#${athlete.number}). This action cannot be undone.`;
  domDeleteModal.classList.remove('hidden');
}

/** Close the delete confirmation modal. */
function closeDeleteModal() {
  domDeleteModal.classList.add('hidden');
  pendingDeleteId = null;
}

/** Reset all form inputs to their default empty state. */
function resetFormFields() {
  domAthleteForm.reset();
  domFormId.value = '';
}

/* ============================================================
   10. FORM VALIDATION
   ============================================================ */

/**
 * Validate the athlete form and show inline errors.
 * @returns {boolean} true if all required fields are valid
 */
function validateAthleteForm() {
  let isValid = true;
  clearFormValidationErrors();

  // Name: required, non-empty
  if (!domFormName.value.trim()) {
    showFieldError(domFormName, domErrorName);
    isValid = false;
  }

  // Jersey number: required, integer between 1–99
  const num = parseInt(domFormNumber.value, 10);
  if (!domFormNumber.value || isNaN(num) || num < 1 || num > 99) {
    showFieldError(domFormNumber, domErrorNumber);
    isValid = false;
  }

  // Position: required, must select a value
  if (!domFormPosition.value) {
    showFieldError(domFormPosition, domErrorPosition);
    isValid = false;
  }

  return isValid;
}

/**
 * Mark a form field as invalid and show its associated error message.
 * @param {HTMLElement} inputEl  - The input/select element
 * @param {HTMLElement} errorEl  - The <p> error message element
 */
function showFieldError(inputEl, errorEl) {
  inputEl.classList.add('is-invalid');
  errorEl.classList.remove('hidden');
}

/** Remove all validation error indicators from the form. */
function clearFormValidationErrors() {
  [domFormName, domFormNumber, domFormPosition].forEach(el => {
    el.classList.remove('is-invalid');
  });
  [domErrorName, domErrorNumber, domErrorPosition].forEach(el => {
    el.classList.add('hidden');
  });
}

/** Clear invalid style from a field as soon as the user starts typing. */
function clearFieldErrorOnInput(inputEl, errorEl) {
  inputEl.addEventListener('input', () => {
    inputEl.classList.remove('is-invalid');
    errorEl.classList.add('hidden');
  });
}

/* ============================================================
   11. TOAST NOTIFICATION
   ============================================================ */

/** Timer handle for auto-hiding the toast */
let toastTimer = null;

/**
 * Display a brief toast message at the bottom of the viewport.
 * @param {string}  message    - The message to display
 * @param {boolean} [isError]  - true = red error toast
 */
function showToast(message, isError = false) {
  if (toastTimer) clearTimeout(toastTimer);

  domToast.textContent = message;
  domToast.classList.toggle('toast-error', isError);
  domToast.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    domToast.classList.add('hidden');
  }, 2800);
}

/* ============================================================
   12. UTILITY
   ============================================================ */

/**
 * Escape special HTML characters to prevent XSS when setting innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, ch => map[ch]);
}

/**
 * Parse a numeric form field value, defaulting to 0 if empty or NaN.
 * @param {HTMLInputElement} inputEl
 * @returns {number}
 */
function parseStatField(inputEl) {
  const val = parseInt(inputEl.value, 10);
  return isNaN(val) || val < 0 ? 0 : val;
}

/* ============================================================
   13. EVENT LISTENERS
   ============================================================ */

// --- Open "Add Athlete" modal ---
domOpenAddBtn.addEventListener('click', openAddModal);

// --- Close modal buttons ---
domCloseModalBtn.addEventListener('click', closeAthleteModal);
domCancelModalBtn.addEventListener('click', closeAthleteModal);

// --- Close modal by clicking outside the modal box ---
domAthleteModal.addEventListener('click', (e) => {
  if (e.target === domAthleteModal) closeAthleteModal();
});

// --- Escape key closes either open modal ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!domAthleteModal.classList.contains('hidden')) closeAthleteModal();
    if (!domDeleteModal.classList.contains('hidden'))  closeDeleteModal();
  }
});

// --- Form submission: Create or Update ---
domAthleteForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateAthleteForm()) return;

  // Build the athlete data object from form values
  /** @type {Omit<Athlete, 'id'>} */
  const athleteData = {
    name:     domFormName.value.trim(),
    number:   parseInt(domFormNumber.value, 10),
    position: domFormPosition.value,
    games:    parseStatField(domFormGames),
    scores:   parseStatField(domFormScores),
    tackles:  parseStatField(domFormTackles),
  };

  const editingId = domFormId.value;

  if (editingId) {
    // UPDATE existing athlete
    updateAthlete(editingId, athleteData);
  } else {
    // CREATE new athlete
    createAthlete(athleteData);
  }

  closeAthleteModal();
});

// --- Table body: delegated click for Edit / Delete buttons ---
domTableBody.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;

  // Find the parent <tr> which holds the athlete's data-id
  const row = e.target.closest('tr[data-id]');
  if (!row) return;

  const athleteId = row.dataset.id;

  if (actionBtn.dataset.action === 'edit') {
    openEditModal(athleteId);
  }

  if (actionBtn.dataset.action === 'delete') {
    openDeleteModal(athleteId);
  }
});

// --- Delete modal: confirm delete ---
domConfirmDeleteBtn.addEventListener('click', () => {
  if (!pendingDeleteId) return;
  deleteAthlete(pendingDeleteId);
  closeDeleteModal();
});

// --- Delete modal: cancel ---
domCancelDeleteBtn.addEventListener('click', closeDeleteModal);

// --- Delete modal: click outside to close ---
domDeleteModal.addEventListener('click', (e) => {
  if (e.target === domDeleteModal) closeDeleteModal();
});

// --- Real-time search (fires on every keystroke) ---
domSearchInput.addEventListener('input', renderTable);

// --- Real-time position filter (fires on dropdown change) ---
domPositionFilter.addEventListener('change', renderTable);

// --- Clear validation errors as user corrects fields ---
clearFieldErrorOnInput(domFormName,     domErrorName);
clearFieldErrorOnInput(domFormNumber,   domErrorNumber);
clearFieldErrorOnInput(domFormPosition, domErrorPosition);

/* ============================================================
   14. SEED DATA & INITIALIZATION
   ============================================================ */

/**
 * Default athletes to pre-populate on first load (no localStorage data).
 * Gives users an instant preview of the dashboard's capabilities.
 * @returns {Athlete[]}
 */
function getSeedAthletes() {
  return [
    { id: generateId(), name: 'Patrick Mahomes',  number: 15, position: 'Quarterback', games: 102, scores: 284, tackles: 0   },
    { id: generateId(), name: 'Tyreek Hill',       number: 10, position: 'Receiver',    games: 124, scores: 91,  tackles: 0   },
    { id: generateId(), name: 'Derrick Henry',     number: 22, position: 'Rusher',      games: 110, scores: 107, tackles: 0   },
    { id: generateId(), name: 'Micah Parsons',     number: 11, position: 'Defender',    games: 52,  scores: 7,   tackles: 312 },
    { id: generateId(), name: 'Justin Jefferson',  number: 18, position: 'Receiver',    games: 68,  scores: 44,  tackles: 0   },
    { id: generateId(), name: 'Sauce Gardner',     number: 1,  position: 'Defender',    games: 48,  scores: 2,   tackles: 278 },
  ];
}

/**
 * Bootstrap the application:
 * 1. Load persisted athletes from localStorage (or use seed data on first run).
 * 2. Perform initial render.
 * 3. Sync header stats.
 */
function initApp() {
  const stored = loadAthletesFromStorage();

  if (stored.length > 0) {
    // Restore previously saved data
    athletes = stored;
  } else {
    // First-time load: populate with seed athletes for immediate preview
    athletes = getSeedAthletes();
    saveAthletesToStorage();
  }

  renderTable();
  updateHeaderStats();
}

// Run on page load
initApp();
