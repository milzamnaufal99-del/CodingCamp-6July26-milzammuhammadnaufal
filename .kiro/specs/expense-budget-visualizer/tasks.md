# Implementation Plan: Expense Budget Visualizer

## Overview

Build a single-page, client-side expense tracker using vanilla HTML, CSS, and JavaScript. The implementation follows a state-driven render architecture: one in-memory `transactions` array is the single source of truth, every mutation persists to `localStorage`, and `renderAll()` keeps every UI section (Balance_Display, Input_Form, Chart, Transaction_List) in sync. Chart.js is loaded from CDN. All JS lives in one IIFE inside `js/app.js`.

---

## Tasks

- [x] 1. Scaffold project files and base HTML structure
  - Create `index.html` at the project root with `<!DOCTYPE html>`, `<meta charset>`, `<meta name="viewport">`, and a descriptive `<title>`
  - Add Chart.js CDN `<script>` tag and `<script src="js/app.js" defer>` in `<head>`
  - Add `<link rel="stylesheet" href="css/style.css">` in `<head>`
  - Create the four section skeleton in `<body>` in the required order: `<header>` (Balance_Display), `<section id="input-section">` (Input_Form), `<section id="chart-section">` (Chart), `<section id="list-section">` (Transaction_List)
  - Create empty placeholder files `css/style.css` and `js/app.js`
  - _Requirements: 6.1, 6.3_

- [ ] 2. Implement core JavaScript skeleton and persistence layer
  - [x] 2.1 Set up IIFE, constants, and state variables in `js/app.js`
    - Open the IIFE: `(function () { ... })();`
    - Declare `const STORAGE_KEY = 'expense_visualizer_transactions'` and `const CATEGORIES = ['Food', 'Transport', 'Fun']`
    - Declare `let transactions = []` and `let chartInstance = null`
    - _Requirements: 5.5, 6.3_

  - [x] 2.2 Implement `loadTransactions()` and `saveTransactions()`
    - `loadTransactions()`: wraps `localStorage.getItem` + `JSON.parse` in try/catch; returns parsed array if valid, otherwise returns `[]` and shows a "Could not load saved data. Starting fresh." warning banner
    - `saveTransactions()`: wraps `localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))` in try/catch; on error shows a persistent "Unable to save data. Storage may be full." banner
    - Both functions MUST use only the key `expense_visualizer_transactions`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 2.7_

- [x] 3. Implement form validation logic
  - [x] 3.1 Implement `validateForm(name, amount, category)`
    - Returns `{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }`
    - Invalid when: `name` is empty or whitespace-only; `amount` ≤ 0 or > 9,999,999.99 or not a number; `category` is not one of `CATEGORIES`
    - Pure function — no side effects, no DOM access
    - _Requirements: 1.4_

- [x] 4. Implement Balance_Display render and currency formatting
  - [x] 4.1 Implement currency formatter and `renderBalance()`
    - Create an `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })` instance
    - `renderBalance()` computes `transactions.reduce((sum, t) => sum + t.amount, 0)` and writes the formatted string into the `<header>` balance element
    - When `transactions` is empty, display `$0.00`
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 5. Implement add-transaction and delete-transaction handlers
  - [x] 5.1 Implement `handleFormSubmit(event)` and id generation
    - Call `event.preventDefault()`; read form field values; call `validateForm`
    - On invalid: inject inline `<span class="error-msg">` under each invalid field; do not mutate `transactions`
    - On valid: generate id via `crypto.randomUUID()` with fallback to `Date.now().toString() + Math.random().toString(36).slice(2)`; push new Transaction object to `transactions`; call `saveTransactions()`; call `renderAll()`; reset form fields (name and amount to empty, category to default placeholder)
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.1_

  - [x] 5.3 Implement `handleDeleteClick(id)`
    - Filter `transactions` to remove the entry with matching `id`; call `saveTransactions()`; call `renderAll()`
    - DOM update MUST complete within 100ms (synchronous render satisfies this)
    - _Requirements: 2.5, 2.6, 3.3, 5.2_

- [x] 6. Checkpoint — core logic verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Transaction_List render
  - [x] 7.1 Implement `renderList()`
    - When `transactions` is empty: render a single empty-state `<p>` message (e.g. "No transactions recorded yet.")
    - When non-empty: for each Transaction render a row containing: item name, amount formatted with the currency formatter, category, and a delete `<button>` with the transaction `id` bound to `handleDeleteClick`
    - Replace the entire inner HTML of `#list-section` on each call — do not diff
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8. Implement Chart render
  - [x] 8.1 Implement `renderChart()`
    - Compute `categoryTotals` by summing amounts per category from `transactions`
    - Filter to only categories with total > 0 for data labels and values
    - When no categories have total > 0: hide the `<canvas>` and show a "No spending data available." message in `#chart-section`; return early
    - When data exists: show the `<canvas>`; call `chartInstance.destroy()` if `chartInstance` is not null; create a new `Chart` instance of type `'pie'` with label and percentage options (percentages rounded to 1 decimal place)
    - Wrap Chart construction in a try/catch; if `Chart` is undefined (CDN failure), display an error message instead
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9. Wire up `renderAll()` and DOMContentLoaded initializer
  - [x] 9.1 Implement `renderAll()` and the `DOMContentLoaded` init block
    - `renderAll()` calls `renderBalance()`, `renderChart()`, `renderList()` in sequence
    - In the `DOMContentLoaded` listener: call `loadTransactions()` to populate `transactions`; call `renderAll()`; attach `handleFormSubmit` to `#expense-form`'s `submit` event
    - _Requirements: 2.3, 3.2, 4.3, 5.3_

- [x] 10. Write CSS for layout, responsiveness, and component styling
  - [x] 10.1 Implement base reset, typography, and vertical layout in `css/style.css`
    - Apply `box-sizing: border-box`, margin/padding reset, consistent `font-family` and `line-height` globally
    - Use flexbox column on `<main>` with consistent `gap` so sections stack in the order: Balance_Display → Input_Form → Chart → Transaction_List
    - _Requirements: 6.1, 6.2_

  - [x] 10.2 Implement responsive sizing, Transaction_List scroll, and empty/error states
    - Fluid widths with `max-width`; single breakpoint at `768px` for wider chart/form layout
    - Transaction_List: `max-height` + `overflow-y: auto` for scrollability
    - Empty state text: visually distinct (muted color, center alignment)
    - Validation `.error-msg`: `color: red`, displayed beneath each invalid field
    - Error/warning banners: visible, persistent styling
    - No horizontal overflow at any viewport width between 320px–1440px
    - _Requirements: 2.2, 6.2, 6.4_

- [x] 11. Final checkpoint — full integration verified
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The IIFE pattern in `js/app.js` means the property tests will need to extract pure functions (e.g. `validateForm`, the currency formatter, the category-total computation) into a separately importable module or test via a thin wrapper — plan accordingly when writing tests
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations each
- All 7 correctness properties from the design document are covered by PBT sub-tasks (2.3, 2.4, 3.2, 4.2, 5.2, 5.4, 8.2)
- Checkpoints ensure the core logic is verified before tackling the UI and styling layers

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "7.1"] },
    { "id": 6, "tasks": ["8.1", "9.1"] },
    { "id": 7, "tasks": ["8.2", "10.1"] },
    { "id": 8, "tasks": ["10.2"] }
  ]
}
```
