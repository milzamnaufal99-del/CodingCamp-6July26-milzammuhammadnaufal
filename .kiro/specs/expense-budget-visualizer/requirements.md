# Requirements Document

## Introduction

The Expense Budget Visualizer is a client-side web application that allows users to track personal expenses by entering transactions with a name, amount, and category. It displays a running total balance, a scrollable list of all transactions, and a pie chart that breaks down spending by category. All data is persisted in the browser's localStorage. The application is built using only HTML, CSS, and vanilla JavaScript — no frameworks, no backend.

## Glossary

- **App**: The Expense Budget Visualizer web application
- **Transaction**: A single expense record consisting of a name, amount, and category
- **Transaction_List**: The scrollable UI component that displays all recorded transactions
- **Input_Form**: The HTML form used to enter a new transaction
- **Balance_Display**: The UI element at the top of the page that shows the total amount spent
- **Chart**: The pie chart rendered by Chart.js that visualizes spending by category
- **Category**: One of three fixed labels — Food, Transport, or Fun — used to classify a transaction
- **LocalStorage**: The browser's built-in key-value storage used to persist transaction data between sessions

---

## Requirements

### Requirement 1: Input Form

**User Story:** As a user, I want to enter a transaction using a form, so that I can record my expenses quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL display three fields: Item Name (text, max 100 characters), Amount (number, range 0.01–9,999,999.99 with up to 2 decimal places), and Category (select with options: Food, Transport, Fun).
2. THE Input_Form SHALL display a submit button labeled "Add Expense".
3. WHEN a user submits the Input_Form with Item Name non-empty, Amount in the range 0.01–9,999,999.99, and a Category selected, THE App SHALL create a new Transaction and add it to the Transaction_List.
4. IF a user submits the Input_Form with Item Name empty, Amount equal to zero, Amount negative, Amount out of range, or no Category selected, THEN THE Input_Form SHALL prevent submission and display an inline validation message identifying each invalid field.
5. WHEN a Transaction is successfully added, THE Input_Form SHALL reset Item Name and Amount to empty and Category to its default unselected placeholder state.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each Transaction with its Item Name, Amount formatted as a currency symbol followed by a value with exactly 2 decimal places, and Category.
2. IF the number of Transaction entries exceeds the visible height of the Transaction_List container, THEN THE Transaction_List SHALL be scrollable to reveal all entries.
3. WHEN the App loads and LocalStorage contains one or more Transactions, THE Transaction_List SHALL render all stored Transactions.
4. WHEN the App loads and LocalStorage contains no Transactions, THE Transaction_List SHALL display an empty state message indicating no transactions have been recorded.
5. WHEN a user clicks the delete button on a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from LocalStorage.
6. WHEN a Transaction is deleted, THE Transaction_List SHALL update within 100 milliseconds without requiring a page reload.
7. IF LocalStorage is unavailable or a read/write operation fails, THEN THE App SHALL display an error message informing the user that data cannot be saved or loaded.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending at a glance, so that I know how much I have spent overall.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts formatted as a currency symbol, thousands separator, and exactly 2 decimal places, at the top of the page.
2. WHEN a new Transaction is added, THE Balance_Display SHALL update its displayed value within 300 milliseconds to reflect the new total.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update its displayed value within 300 milliseconds to reflect the reduced total.
4. WHEN a Transaction's amount is edited, THE Balance_Display SHALL update its displayed value within 300 milliseconds to reflect the corrected total.
5. WHEN no Transactions exist, THE Balance_Display SHALL display a value of zero formatted as a currency symbol, thousands separator, and exactly 2 decimal places.

---

### Requirement 4: Visual Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart using Chart.js, displaying one segment per Category that has at least one Transaction.
2. THE Chart SHALL label each segment with its Category name and display the percentage of total spending it represents, rounded to one decimal place.
3. WHEN a new Transaction is added, THE Chart SHALL update within 1 second to reflect the new category totals.
4. WHEN a Transaction is deleted, THE Chart SHALL update within 1 second to reflect the revised category totals, and any Category with no remaining Transactions SHALL have its segment removed from the Chart.
5. WHEN no Transactions exist, THE Chart SHALL display a message containing text indicating no spending data is available, in place of the chart canvas.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my data when I close and reopen the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL synchronously write the updated Transaction list to LocalStorage under the key `expense_visualizer_transactions` as a JSON-serialized array, such that the value is readable before any subsequent user action.
2. WHEN a Transaction is deleted, THE App SHALL synchronously write the updated Transaction list to LocalStorage under the key `expense_visualizer_transactions` as a JSON-serialized array, such that the value is readable before any subsequent user action.
3. WHEN the App loads, THE App SHALL read the Transaction list from LocalStorage under the key `expense_visualizer_transactions` and use it to initialize the Transaction_List; the Balance_Display and Chart SHALL be derived from that loaded list rather than independently stored values.
4. IF LocalStorage contains no value at `expense_visualizer_transactions` or contains a value that cannot be parsed as a valid JSON array, THEN THE App SHALL initialize with an empty Transaction list and render the UI in its empty state without throwing an error.
5. THE App SHALL use the fixed key `expense_visualizer_transactions` for all LocalStorage reads and writes, with no other key used to store Transaction data.

---

### Requirement 6: Layout and Responsiveness

**User Story:** As a user, I want a clean and readable interface that works on different screen sizes, so that I can use the app comfortably on desktop and mobile.

#### Acceptance Criteria

1. THE App SHALL stack its sections vertically in the following order on all viewport widths: Balance_Display, Input_Form, Chart, Transaction_List, with no section rendered out of this order.
2. THE App SHALL apply a consistent base font size, line height, and spacing scale such that no two adjacent sections have inconsistent visual weight or overlap.
3. THE App SHALL use exactly one CSS file and exactly one JavaScript file; adding a second CSS or JavaScript file SHALL be considered a constraint violation.
4. THE App SHALL be responsive such that at no viewport width between 320px and 1440px does any section overflow its container horizontally, text become unreadable due to clipping or overlap, or interactive controls become inaccessible.
