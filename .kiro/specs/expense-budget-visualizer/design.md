# Design Document

## Overview

The Expense Budget Visualizer is a single-page, client-side web application built with vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no backend. Users record personal expense transactions (name, amount, category), and the app immediately reflects those changes in a running balance total, a Category-segmented pie chart (rendered via Chart.js), and a scrollable transaction list. All data is persisted in `localStorage` under the key `expense_visualizer_transactions` as a JSON-serialized array.

The design is intentionally minimal: one HTML file, one CSS file (`css/style.css`), one JS file (`js/app.js`), and a CDN-loaded Chart.js script. This satisfies the hard constraint from Requirement 6.3 and keeps the project approachable for an educational context.

---

## Architecture

The application follows a simple **state-driven render** architecture:

```
localStorage
     │  read on load / write on every mutation
     ▼
  State (in-memory array of Transaction objects)
     │  every mutation calls renderAll()
     ▼
┌──────────────────────────────────────────┐
│                renderAll()               │
│  ┌──────────────┐  ┌───────────────────┐ │
│  │ renderBalance│  │ renderChart()     │ │
│  └──────────────┘  └───────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │          renderList()                │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
     ▲
  User Events
  (form submit, delete button click)
```

**Key design decisions:**

- **Single source of truth**: the in-memory `transactions` array is always in sync with localStorage. There is no separate "chart state" or "balance state" — both are always derived on render.
- **Synchronous localStorage writes**: every mutation (add / delete) calls `saveTransactions()` before `renderAll()`, satisfying Requirement 5.1 and 5.2.
- **No module bundler**: all code lives in one IIFE (Immediately Invoked Function Expression) in `js/app.js` to avoid polluting the global namespace without requiring a build step.
- **Chart.js via CDN**: loaded with a `<script>` tag in `index.html`. The chart instance is stored in a module-level variable and `.destroy()` is called before re-creating it on each render to avoid canvas reuse warnings.

---

## Components and Interfaces

### HTML Structure (`index.html`)

The page is divided into four sections, strictly in this order as required by Requirement 6.1:

```
<body>
  <header>          <!-- Balance_Display -->
  <main>
    <section id="input-section">    <!-- Input_Form -->
    <section id="chart-section">    <!-- Chart -->
    <section id="list-section">     <!-- Transaction_List -->
  </main>
</body>
```

External scripts loaded in `<head>` with `defer`:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
<script src="js/app.js" defer></script>
```

### CSS (`css/style.css`)

Responsibilities:
- **Reset/base**: box-sizing, margin/padding reset, consistent font family and line height.
- **Layout**: flexbox column on `<main>`, sections stack vertically with consistent `gap`.
- **Responsive**: fluid widths using percentages and `max-width`. A single media query at `768px` widens the chart and form for larger screens. No section overflows horizontally between 320px–1440px (Requirement 6.4).
- **Transaction list**: `max-height` + `overflow-y: auto` for scrollability (Requirement 2.2).
- **Empty states**: visually distinct placeholder text for both the list and the chart area.
- **Validation errors**: inline `<span class="error-msg">` styled in red beneath each invalid field.

### JavaScript (`js/app.js`)

All logic wrapped in an IIFE:

```
(function () {
  // --- Constants ---
  const STORAGE_KEY = 'expense_visualizer_transactions';
  const CATEGORIES  = ['Food', 'Transport', 'Fun'];

  // --- State ---
  let transactions = [];   // array of Transaction objects
  let chartInstance = null;

  // --- Persistence ---
  function loadTransactions() { ... }
  function saveTransactions() { ... }

  // --- Validation ---
  function validateForm(name, amount, category) { ... }  // returns { valid, errors }

  // --- Event Handlers ---
  function handleFormSubmit(event) { ... }
  function handleDeleteClick(id) { ... }

  // --- Render ---
  function renderBalance() { ... }
  function renderChart() { ... }
  function renderList() { ... }
  function renderAll() { renderBalance(); renderChart(); renderList(); }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function () {
    transactions = loadTransactions();
    renderAll();
    document.getElementById('expense-form').addEventListener('submit', handleFormSubmit);
  });
})();
```

**Public interface summary (internal to IIFE):**

| Function | Parameters | Returns | Side-effects |
|---|---|---|---|
| `loadTransactions()` | — | `Transaction[]` | reads localStorage |
| `saveTransactions()` | — | `void` | writes localStorage |
| `validateForm(name, amt, cat)` | strings | `{valid: bool, errors: object}` | none (pure) |
| `handleFormSubmit(event)` | Event | `void` | mutates `transactions`, saves, renders |
| `handleDeleteClick(id)` | string | `void` | mutates `transactions`, saves, renders |
| `renderBalance()` | — | `void` | updates DOM |
| `renderChart()` | — | `void` | updates Chart.js canvas |
| `renderList()` | — | `void` | updates DOM |

---

## Data Models

### Transaction Object

```js
{
  id:       string,   // crypto.randomUUID() or Date.now().toString() fallback
  name:     string,   // 1–100 characters, non-empty
  amount:   number,   // 0.01–9,999,999.99, up to 2 decimal places
  category: string    // one of: 'Food' | 'Transport' | 'Fun'
}
```

### localStorage Schema

- **Key**: `expense_visualizer_transactions`
- **Value**: `JSON.stringify(Transaction[])` — a JSON array of Transaction objects.
- **On parse failure or absence**: treated as empty array `[]`.

### Derived State (computed on each render, never stored separately)

```js
// Total balance
const total = transactions.reduce((sum, t) => sum + t.amount, 0);

// Category totals for chart
const categoryTotals = CATEGORIES.reduce((acc, cat) => {
  acc[cat] = transactions
    .filter(t => t.category === cat)
    .reduce((s, t) => s + t.amount, 0);
  return acc;
}, {});
```

### Currency Formatting

```js
// Using Intl.NumberFormat for consistency
const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
fmt.format(total); // e.g. "$1,234.56"
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction always appears in the list

*For any* non-empty item name, amount in [0.01, 9,999,999.99], and valid category, after calling the add-transaction logic, the resulting `transactions` array SHALL contain exactly one more entry, and that entry SHALL have the supplied name, amount, and category.

**Validates: Requirements 1.3, 2.1**

### Property 2: Whitespace-only names and zero/negative/out-of-range amounts are rejected

*For any* item name composed entirely of whitespace characters, or any amount ≤ 0 or > 9,999,999.99, `validateForm` SHALL return `valid: false` and the `transactions` array SHALL remain unchanged.

**Validates: Requirements 1.4**

### Property 3: Balance equals sum of all transaction amounts

*For any* array of transactions, `renderBalance` SHALL display a value equal to the arithmetic sum of every transaction's `amount`, formatted with a currency symbol, thousands separator, and exactly 2 decimal places.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

### Property 4: localStorage round-trip preserves transaction data

*For any* array of Transaction objects written via `saveTransactions()`, calling `loadTransactions()` subsequently SHALL return an array that is deeply equal to the written array (same length, same ids, names, amounts, categories).

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: Corrupt or absent localStorage initializes to empty state

*For any* localStorage value at `expense_visualizer_transactions` that is absent or not parseable as a valid JSON array, `loadTransactions()` SHALL return an empty array `[]` without throwing an error.

**Validates: Requirements 5.4**

### Property 6: Deleting a transaction removes it from the array and localStorage

*For any* transaction that exists in `transactions`, after calling `handleDeleteClick(id)`, the resulting array SHALL not contain any entry with that id, and `loadTransactions()` SHALL likewise not return any entry with that id.

**Validates: Requirements 2.5, 2.6, 3.3**

### Property 7: Chart segments correspond exactly to categories with nonzero totals

*For any* array of transactions, `renderChart` SHALL produce a chart whose data labels are exactly the subset of categories whose total amount is > 0, and each segment percentage SHALL equal that category's total divided by the grand total, rounded to one decimal place.

**Validates: Requirements 4.1, 4.2, 4.4**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `localStorage.setItem` throws (e.g., storage quota exceeded) | Catch the error; display a persistent banner: "Unable to save data. Storage may be full." |
| `localStorage.getItem` / `JSON.parse` throws | Catch and return `[]`; display a warning banner: "Could not load saved data. Starting fresh." |
| Chart.js not loaded (CDN failure) | The `chart-section` displays the "no spending data" message by default; `renderChart` wraps Chart construction in a try/catch and shows an error message if `Chart` is undefined. |
| Form submission with invalid fields | `validateForm` returns error map; inline `<span class="error-msg">` is injected under each invalid field. Submission is prevented via `event.preventDefault()`. |
| `crypto.randomUUID` unavailable (very old browsers) | Falls back to `Date.now().toString() + Math.random().toString(36).slice(2)` for id generation. |

---

## Testing Strategy

This feature is a vanilla JS single-page app with clear pure-function boundaries in validation, formatting, and data transformation. Property-based testing applies to those pure layers.

### Unit Tests

Use a lightweight test runner (e.g., [uvu](https://github.com/lukeed/uvu) or plain Node.js `assert`) to cover:

- `validateForm`: specific valid and invalid examples (empty name, boundary amounts `0.00`, `0.01`, `9999999.99`, `10000000.00`, whitespace-only names, missing category).
- `loadTransactions`: specific localStorage states (missing key, malformed JSON, valid JSON).
- Currency formatting: spot-checks for `$0.00`, `$1,234.56`, `$9,999,999.99`.
- `renderList` DOM output: verify each transaction row contains name, formatted amount, and category.

### Property-Based Tests

Use [fast-check](https://github.com/dubzzz/fast-check) (JavaScript PBT library). Each test runs a **minimum of 100 iterations**.

Tag format: `// Feature: expense-budget-visualizer, Property N: <property text>`

| Property | Test description |
|---|---|
| **Property 1** | Generate random valid transactions; after adding, array length increases by 1 and last entry matches input. |
| **Property 2** | Generate whitespace-only names and out-of-range amounts; `validateForm` always returns `valid: false` and array is unchanged. |
| **Property 3** | Generate random transaction arrays; computed balance always equals `transactions.reduce((s,t) => s+t.amount, 0)` formatted correctly. |
| **Property 4** | Generate random Transaction arrays; `JSON.parse(JSON.stringify(arr))` deep-equals original (round-trip). |
| **Property 5** | Generate random non-array JSON strings and `null`; `loadTransactions()` always returns `[]`. |
| **Property 6** | Generate a non-empty transaction array and a random index; after delete, array length decreases by 1 and deleted id absent. |
| **Property 7** | Generate random transaction arrays; chart labels equal categories with sum > 0; each percentage rounds correctly. |

### Integration / Smoke Tests

- Load `index.html` in a browser (or via Playwright) and verify: page renders without JS errors, form submission adds a row, delete removes it, balance updates, chart renders.
- Verify localStorage key `expense_visualizer_transactions` is written after form submit.
- Verify responsive layout at 320px, 768px, and 1440px viewport widths (no horizontal overflow).

### What is NOT tested with PBT

- CSS layout and visual appearance → manual review + browser DevTools responsive mode.
- Chart.js rendering fidelity → smoke test in browser.
- `setTimeout`/animation timing (300ms / 1s update windows) → DOM mutation is synchronous; timing requirements are satisfied by the synchronous render pipeline.
