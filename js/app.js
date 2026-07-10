(function () {
  // --- Constants ---
  const STORAGE_KEY = 'expense_visualizer_transactions';
  const CATEGORIES  = ['Food', 'Transport', 'Fun'];

  // --- State ---
  let transactions  = [];   // array of Transaction objects
  let chartInstance = null;

  // --- Persistence ---

  /**
   * Shows a banner message at the top of <body>.
   * Repeated calls replace the existing banner.
   * @param {string} message - The text to display.
   * @param {'warning'|'error'} type - Controls the visual style.
   */
  function showBanner(message, type) {
    var existing = document.getElementById('app-banner');
    if (existing) {
      existing.remove();
    }

    var banner = document.createElement('div');
    banner.id = 'app-banner';
    banner.textContent = message;
    banner.style.cssText = [
      'padding: 10px 16px',
      'font-size: 14px',
      'text-align: center',
      type === 'error'
        ? 'background: #fdecea; color: #b91c1c; border-bottom: 1px solid #f87171'
        : 'background: #fef9c3; color: #854d0e; border-bottom: 1px solid #fde047'
    ].join(';');

    document.body.insertBefore(banner, document.body.firstChild);
  }

  /**
   * Reads the transaction list from localStorage.
   * Returns the parsed array if valid, otherwise [] and shows a warning banner.
   * Satisfies Requirements 5.3, 5.4, 5.5, 2.7.
   * @returns {Array} Array of Transaction objects (may be empty).
   */
  function loadTransactions() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        // Key is absent — treat as fresh start (no banner needed)
        return [];
      }
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // Parsed successfully but not an array
      showBanner('Could not load saved data. Starting fresh.', 'warning');
      return [];
    } catch (e) {
      showBanner('Could not load saved data. Starting fresh.', 'warning');
      return [];
    }
  }

  /**
   * Writes the current transaction list to localStorage.
   * Shows a persistent error banner if the write fails (e.g. storage full).
   * Satisfies Requirements 5.1, 5.2, 5.5, 2.7.
   */
  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      showBanner('Unable to save data. Storage may be full.', 'error');
    }
  }

  // --- Validation ---

  /**
   * Validates form input for creating a transaction.
   * Pure function — no side effects, no DOM access.
   * Satisfies Requirement 1.4.
   * @param {string} name - The transaction name/description.
   * @param {string|number} amount - The transaction amount (may be string from form input).
   * @param {string} category - The selected category.
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  function validateForm(name, amount, category) {
    var errors = {};
    var valid = true;

    // Validate name: must not be empty or whitespace-only
    if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.name = 'Item name is required and cannot be empty.';
      valid = false;
    }

    // Validate amount: must be a number in range 0.01 to 9,999,999.99
    var numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 9999999.99) {
      errors.amount = 'Amount must be between $0.01 and $9,999,999.99.';
      valid = false;
    }

    // Validate category: must be one of the allowed categories
    if (!category || !CATEGORIES.includes(category)) {
      errors.category = 'Please select a valid category.';
      valid = false;
    }

    return { valid: valid, errors: errors };
  }

  // --- Event Handlers ---

  /**
   * Handles form submission for adding a new transaction.
   * Validates input, shows errors inline, or adds transaction and renders.
   * Satisfies Requirements 1.2, 1.3, 1.4, 1.5, 5.1.
   * @param {Event} event - The form submit event.
   */
  function handleFormSubmit(event) {
    event.preventDefault();

    // Clear any existing error messages
    clearErrorMessages();

    // Read form field values
    const nameInput = document.getElementById('item-name');
    const amountInput = document.getElementById('amount');
    const categorySelect = document.getElementById('category');

    const name = nameInput.value.trim();
    const amount = amountInput.value;
    const category = categorySelect.value;

    // Validate the form
    const validation = validateForm(name, amount, category);

    if (!validation.valid) {
      // Show inline error messages for each invalid field
      if (validation.errors.name) {
        showFieldError('item-name', validation.errors.name);
      }
      if (validation.errors.amount) {
        showFieldError('amount', validation.errors.amount);
      }
      if (validation.errors.category) {
        showFieldError('category', validation.errors.category);
      }
      return; // Do not mutate transactions
    }

    // Generate unique ID for the transaction
    let id;
    try {
      id = crypto.randomUUID();
    } catch (e) {
      // Fallback for browsers that don't support crypto.randomUUID()
      id = Date.now().toString() + Math.random().toString(36).slice(2);
    }

    // Create new transaction object and add to transactions array
    const newTransaction = {
      id: id,
      name: name,
      amount: parseFloat(amount),
      category: category
    };

    transactions.push(newTransaction);

    // Save to localStorage and render all sections
    saveTransactions();
    renderAll();

    // Reset form fields
    nameInput.value = '';
    amountInput.value = '';
    categorySelect.selectedIndex = 0; // Reset to placeholder option
  }

  /**
   * Clears all existing error messages from the form.
   */
  function clearErrorMessages() {
    const errorMessages = document.querySelectorAll('.error-msg');
    errorMessages.forEach(msg => msg.remove());
  }

  /**
   * Shows an inline error message under a specific form field.
   * @param {string} fieldId - The ID of the form field.
   * @param {string} message - The error message to display.
   */
  function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const errorSpan = document.createElement('span');
    errorSpan.className = 'error-msg';
    errorSpan.textContent = message;
    // Styling is handled by the .error-msg CSS rule in style.css

    // Insert error message after the field
    field.parentNode.insertBefore(errorSpan, field.nextSibling);
  }

  /**
   * Handles deletion of a transaction by ID.
   * Filters transactions array to remove the matching entry, saves to localStorage,
   * and renders all UI components synchronously (satisfies 100ms requirement).
   * Satisfies Requirements 2.5, 2.6, 3.3, 5.2.
   * @param {string} id - The unique ID of the transaction to delete.
   */
  function handleDeleteClick(id) {
    // Filter out the transaction with the matching ID
    transactions = transactions.filter(transaction => transaction.id !== id);
    
    // Save the updated transactions to localStorage
    saveTransactions();
    
    // Update all UI components synchronously
    renderAll();
  }

  // --- Currency Formatting ---
  
  /**
   * Currency formatter instance for consistent formatting throughout the app.
   * Satisfies Requirements 3.1, 3.5 for currency symbol, thousands separator, and exactly 2 decimal places.
   */
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // --- Render ---
  
  /**
   * Updates the balance display in the header with the sum of all transaction amounts.
   * When transactions is empty, displays $0.00.
   * Satisfies Requirements 3.1, 3.2, 3.3, 3.5.
   */
  function renderBalance() {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const balanceElement = document.getElementById('balance-display');
    if (balanceElement) {
      balanceElement.textContent = currencyFormatter.format(total);
    }
  }

  /**
   * Renders the transaction list in the #list-section.
   * When transactions is empty: shows a single empty-state message.
   * When non-empty: renders each transaction as a row with name, formatted amount, category, and delete button.
   * Replaces entire innerHTML of #list-section on each call (no diffing).
   * Satisfies Requirements 2.1, 2.2, 2.3, 2.4, 2.5.
   */
  function renderList() {
    const listContainer = document.getElementById('transaction-list');
    if (!listContainer) return;

    // Clear existing content
    listContainer.innerHTML = '';

    // Empty state: show message when no transactions exist
    if (transactions.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.id = 'list-empty-msg';
      emptyMessage.textContent = 'No transactions recorded yet.';
      listContainer.appendChild(emptyMessage);
      return;
    }

    // Non-empty state: render each transaction as a row
    transactions.forEach(function(transaction) {
      const row = document.createElement('div');
      row.className = 'transaction-row';
      
      // Create transaction content elements
      const nameSpan = document.createElement('span');
      nameSpan.className = 'transaction-name';
      nameSpan.textContent = transaction.name;
      
      const amountSpan = document.createElement('span');
      amountSpan.className = 'transaction-amount';
      amountSpan.textContent = currencyFormatter.format(transaction.amount);
      
      const categorySpan = document.createElement('span');
      categorySpan.className = 'transaction-category';
      categorySpan.textContent = transaction.category;
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-btn';
      deleteButton.textContent = 'Delete';
      deleteButton.type = 'button';
      
      // Bind delete handler to the transaction ID
      deleteButton.addEventListener('click', function() {
        handleDeleteClick(transaction.id);
      });
      
      // Append all elements to the row
      row.appendChild(nameSpan);
      row.appendChild(amountSpan);
      row.appendChild(categorySpan);
      row.appendChild(deleteButton);
      
      // Append row to the container
      listContainer.appendChild(row);
    });
  }

  /**
   * Renders the spending chart in the #chart-section.
   * Computes categoryTotals, filters to categories with total > 0,
   * and creates a Chart.js pie chart with percentages rounded to 1 decimal place.
   * When no data exists, shows "No spending data available." message.
   * Handles Chart.js CDN failure with try/catch error handling.
   * Satisfies Requirements 4.1, 4.2, 4.3, 4.4, 4.5.
   */
  function renderChart() {
    const chartCanvas = document.getElementById('expense-chart');
    const emptyMessage = document.getElementById('chart-empty-msg');
    
    if (!chartCanvas || !emptyMessage) return;

    // Compute categoryTotals by summing amounts per category from transactions
    const categoryTotals = CATEGORIES.reduce((acc, category) => {
      acc[category] = transactions
        .filter(t => t.category === category)
        .reduce((sum, t) => sum + t.amount, 0);
      return acc;
    }, {});

    // Filter to only categories with total > 0 for data labels and values
    const categoriesWithData = CATEGORIES.filter(category => categoryTotals[category] > 0);
    const dataValues = categoriesWithData.map(category => categoryTotals[category]);
    
    // When no categories have total > 0: hide canvas and show message
    if (categoriesWithData.length === 0) {
      chartCanvas.style.display = 'none';
      emptyMessage.style.display = 'block';
      return;
    }

    // When data exists: show canvas and hide message
    chartCanvas.style.display = 'block';
    emptyMessage.style.display = 'none';

    // Destroy existing chart instance if it exists
    if (chartInstance !== null) {
      chartInstance.destroy();
      chartInstance = null;
    }

    try {
      // Check if Chart.js is available (CDN loaded successfully)
      if (typeof Chart === 'undefined') {
        throw new Error('Chart.js not loaded');
      }

      // Calculate total for percentage computation
      const total = dataValues.reduce((sum, value) => sum + value, 0);

      // Create new Chart instance of type 'pie' with label and percentage options
      chartInstance = new Chart(chartCanvas, {
        type: 'pie',
        data: {
          labels: categoriesWithData,
          datasets: [{
            data: dataValues,
            backgroundColor: [
              '#ff6384', // Red/Pink for Food
              '#36a2eb', // Blue for Transport  
              '#ffce56'  // Yellow for Fun
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: ${currencyFormatter.format(value)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      // If Chart is undefined (CDN failure), display error message instead
      chartCanvas.style.display = 'none';
      emptyMessage.style.display = 'block';
      emptyMessage.textContent = 'Unable to load chart. Please check your internet connection.';
    }
  }

  /**
   * Renders all UI sections (balance, chart, list) in sequence.
   * Called after every transaction mutation to keep UI in sync.
   * Satisfies Requirements 2.3, 3.2, 4.3, 5.3.
   */
  function renderAll() {
    renderBalance();
    renderChart();
    renderList();
  }

  // --- Init ---

  /**
   * Initialize the application when DOM is ready.
   * Loads transactions from localStorage and renders the UI.
   */
  document.addEventListener('DOMContentLoaded', function () {
    transactions = loadTransactions();
    renderAll();
    
    // Attach form submit handler
    const form = document.getElementById('expense-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
  });
})();
