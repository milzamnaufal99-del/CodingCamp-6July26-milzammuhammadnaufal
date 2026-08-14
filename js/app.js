(() => {

 // =========================================
// CONSTANTS
// =========================================

const STORAGE_KEY = "expense_visualizer_transactions";

const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Education",
  "Health",
  "Salary",
  "Freelance",
  "Investment"
];

const BASE_CURRENCY = "IDR";

const EXCHANGE_RATES = {
  IDR: 1,
  JPY: 110,
  USD: 17000
};

function convertToIDR(amount, currency) {
  const rate = EXCHANGE_RATES[currency] || 1;
  return amount * rate;
}

function parseAmount(value, currency) {

  let amount = String(value).trim();

  // IDR dan JPY:
  // 10.000 -> 10000
  // 226.000 -> 226000
  if (currency === "IDR" || currency === "JPY") {

    amount = amount.replace(/[.,]/g, "");

  }

  // USD:
  // 40,000 -> 40000
  // 40.000 -> 40000
  // 40,000.50 -> 40000.50
  // 40.50 -> 40.50
  else if (currency === "USD") {

    // Both comma and dot exist:
    // Assume the last separator is the decimal separator.
    if (
      amount.includes(",") &&
      amount.includes(".")
    ) {

      const lastComma =
        amount.lastIndexOf(",");

      const lastDot =
        amount.lastIndexOf(".");

      if (lastDot > lastComma) {

        // 40,000.50
        amount =
          amount.replace(/,/g, "");

      } else {

        // 40.000,50
        amount =
          amount
            .replace(/\./g, "")
            .replace(",", ".");
      }

    }

    // Only comma
    else if (amount.includes(",")) {

      const parts =
        amount.split(",");

      // 40,000 -> 40000
      if (
        parts.length === 2 &&
        parts[1].length === 3
      ) {

        amount =
          amount.replace(",", "");

      } else {

        // 40,50 -> 40.50
        amount =
          amount.replace(",", ".");

      }
    }

    // Only dot
    else if (amount.includes(".")) {

      const parts =
        amount.split(".");

      // 40.000 -> 40000
      if (
        parts.length === 2 &&
        parts[1].length === 3
      ) {

        amount =
          amount.replace(".", "");

      }

      // Otherwise keep it as decimal
      // Example: 40.50
    }
  }

  return Number(amount);
}


  // =========================================
  // STATE
  // =========================================

  let transactions = [];
  let chartInstance = null;
  let currentFilter = "all";
  let searchQuery = "";
  let currentSort = "latest";
  let currentEditingId = null;

  // =========================================
  // DOM HELPER
  // =========================================

  const $ = (id) => document.getElementById(id);


  // =========================================
  // CURRENCY FORMAT
  // =========================================

  function formatCurrency(amount, currency = "IDR") {
    const currencyMap ={
      IDR: "id-ID",
      JPY: "ja-JP",
      USD: "en-US"
    };

    return new Intl.NumberFormat(currencyMap[currency] || "id-ID",{
      style: "currency",
      currency,
      minimumFractionDigits:
        currency === "IDR" || currency === "JPY" ? 0 : 2,
      maximumFractionDigits:
        currency === "IDR" || currency === "JPY" ? 0 : 2
  }).format(Number(amount) || 0);
  }

  // =========================================
  // BANNER / ERROR
  // =========================================

  function showBanner(message, type = "warning") {

    const existingBanner = $("app-banner");

    if (existingBanner) {
      existingBanner.remove();
    }

    const banner = document.createElement("div");

    banner.id = "app-banner";
    banner.textContent = message;

    if (type === "error") {
      banner.style.cssText =
        "padding:10px 16px;" +
        "font-size:14px;" +
        "text-align:center;" +
        "background:#fdecea;" +
        "color:#b91c1c;" +
        "border-bottom:1px solid #f87171;";
    } else {
      banner.style.cssText =
        "padding:10px 16px;" +
        "font-size:14px;" +
        "text-align:center;" +
        "background:#fef9c3;" +
        "color:#854d0e;" +
        "border-bottom:1px solid #fde047;";
    }

    document.body.insertBefore(
      banner,
      document.body.firstChild
    );
  }


  function clearErrorMessages() {

    const errors = document.querySelectorAll(".error-msg");

    errors.forEach((error) => {
      error.remove();
    });
  }


  function showFieldError(fieldId, message) {

    const field = $(fieldId);

    if (!field) {
      return;
    }

    const errorMessage = document.createElement("span");

    errorMessage.className = "error-msg";
    errorMessage.textContent = message;

    field.parentNode.insertBefore(
      errorMessage,
      field.nextSibling
    );
  }


  // =========================================
  // LOCAL STORAGE
  // =========================================

  function loadTransactions() {

    try {

      const rawData =
        localStorage.getItem(STORAGE_KEY);

      if (!rawData) {
        return [];
      }

      const parsedData =
        JSON.parse(rawData);

      if (!Array.isArray(parsedData)) {

        showBanner(
          "Could not load saved data. Starting fresh.",
          "warning"
        );

        return [];
      }

      return parsedData;

    } catch (error) {

      showBanner(
        "Could not load saved data. Starting fresh.",
        "warning"
      );

      return [];
    }
  }


  function saveTransactions() {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(transactions)
      );

    } catch (error) {

      showBanner(
        "Unable to save data. Storage may be full.",
        "error"
      );
    }
  }


  // =========================================
  // VALIDATION
  // =========================================

  function validateForm(
    title,
    amount,
    category
  ) {

    const errors = {};

    // Validate title
    if (!title || title.trim() === "") {

      errors.title =
        "Title is required.";
    }


    // Validate amount
    const numericAmount = Number(
  String(amount).replace(/[.,]/g, "")
);

    if (
      amount === "" ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {

      errors.amount =
        "Amount must be greater than 0.";
    }


    // Validate category
    if (!CATEGORIES.includes(category)) {

      errors.category =
        "Please select a valid category.";
    }


    return {
      valid:
        Object.keys(errors).length === 0,

      errors: errors
    };
  }


  // =========================================
  // FORM SUBMIT
  // =========================================

  function handleFormSubmit(event) {

  event.preventDefault();

  clearErrorMessages();


  // =========================================
  // GET FORM ELEMENTS
  // =========================================

  const typeInput =
    $("transactions-type");

  const titleInput =
    $("transaction-title");

  const amountInput =
    $("transaction-amount");

  const currencyInput =
    $("transaction-currency");

  const categoryInput =
    $("transaction-category");

  const dateInput =
    $("transaction-date");

  const noteInput =
    $("transaction-note");


  // =========================================
  // CHECK REQUIRED ELEMENTS
  // =========================================

  if (
    !typeInput ||
    !titleInput ||
    !amountInput ||
    !currencyInput ||
    !categoryInput
  ) {

    showBanner(
      "Some form fields could not be found.",
      "error"
    );

    return;
  }


  // =========================================
  // READ VALUES
  // =========================================

  const title =
    titleInput.value.trim();

  const amount =
    amountInput.value;

  const category =
    categoryInput.value;

  const currency =
    currencyInput.value;


  // =========================================
  // VALIDATE
  // =========================================

  const validation =
    validateForm(
      title,
      amount,
      category
    );


  if (!validation.valid) {

    if (validation.errors.title) {

      showFieldError(
        "transaction-title",
        validation.errors.title
      );

    }

    if (validation.errors.amount) {

      showFieldError(
        "transaction-amount",
        validation.errors.amount
      );

    }

    if (validation.errors.category) {

      showFieldError(
        "transaction-category",
        validation.errors.category
      );

    }

    return;
  }


  // =========================================
  // EDIT EXISTING TRANSACTION
  // =========================================

  if (currentEditingId) {

    const transaction =
      transactions.find(
        (item) =>
          item.id === currentEditingId
      );

    if (transaction) {

      transaction.type =
        typeInput.value === "income"
          ? "income"
          : "expense";

      transaction.title =
        title;

      transaction.amount =
        parseAmount(
          amount,
          currency
        );

      transaction.currency =
        currency;

      transaction.category =
        category;

      transaction.date =
        dateInput
          ? dateInput.value
          : "";

      transaction.note =
        noteInput
          ? noteInput.value.trim()
          : "";

      saveTransactions();

      renderAll();

      currentEditingId = null;

      event.target.reset();

      const submitButton =
        event.target.querySelector(
          'button[type="submit"]'
        );

      if (submitButton) {
        submitButton.textContent =
          "Save Transaction";
      }

      return;
    }

  }


  // =========================================
  // CREATE NEW TRANSACTION
  // =========================================

  let id;

  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {

    id = crypto.randomUUID();

  } else {

    id =
      Date.now().toString() +
      Math.random()
        .toString(36)
        .slice(2);

  }


  const newTransaction = {

    id: id,

    type:
      typeInput.value === "income"
        ? "income"
        : "expense",

    title:
      title,

    amount:
      parseAmount(
        amount,
        currency
      ),

    currency:
      currency,

    category:
      category,

    date:
      dateInput
        ? dateInput.value
        : "",

    note:
      noteInput
        ? noteInput.value.trim()
        : ""

  };


  // =========================================
  // ADD + SAVE
  // =========================================

  transactions.push(
    newTransaction
  );

  saveTransactions();

  renderAll();


  // =========================================
  // RESET FORM
  // =========================================

  event.target.reset();

}

// =========================================
// EDIT TRANSACTION
// =========================================

function handleEditClick(id) {

  const transaction =
    transactions.find(
      (item) =>
        item.id === id
    );

  if (!transaction) {
    return;
  }


  const form =
    $("expense-form");

  const typeInput =
    $("transactions-type");

  const titleInput =
    $("transaction-title");

  const amountInput =
    $("transaction-amount");

  const currencyInput =
    $("transaction-currency");

  const categoryInput =
    $("transaction-category");

  const dateInput =
    $("transaction-date");

  const noteInput =
    $("transaction-note");


  if (
    !form ||
    !typeInput ||
    !titleInput ||
    !amountInput ||
    !currencyInput ||
    !categoryInput
  ) {
    return;
  }


  // =========================================
  // LOAD TRANSACTION INTO FORM
  // =========================================

  currentEditingId =
    transaction.id;


  typeInput.value =
    transaction.type === "income"
      ? "income"
      : "expenses";

  titleInput.value =
    transaction.title || "";

  amountInput.value =
    transaction.amount ?? "";

  currencyInput.value =
    transaction.currency ||
    BASE_CURRENCY;

  categoryInput.value =
    transaction.category ||
    CATEGORIES[0];

  if (dateInput) {
    dateInput.value =
      transaction.date || "";
  }

  if (noteInput) {
    noteInput.value =
      transaction.note || "";
  }


  // =========================================
  // CHANGE BUTTON TEXT
  // =========================================

  const submitButton =
    form.querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {

    submitButton.textContent =
      "Update Transaction";

  }


  // =========================================
  // SCROLL TO FORM
  // =========================================

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}

  // =========================================
  // DELETE TRANSACTION
  // =========================================

  function handleDeleteClick(id) {

    transactions =
      transactions.filter(
        (transaction) =>
          transaction.id !== id
      );


    saveTransactions();

    renderAll();
  }

// =========================================
// EXPORT TRANSACTIONS
// =========================================

function exportTransactionsToCSV() {

  if (transactions.length === 0) {

    showBanner(
      "No transactions available to export.",
      "warning"
    );

    return;
  }


  const headers = [
    "Type",
    "Title",
    "Amount",
    "Currency",
    "Category",
    "Date",
    "Notes"
  ];


  const rows =
    transactions.map(
      (transaction) => [
        transaction.type || "",
        transaction.title || "",
        transaction.amount ?? "",
        transaction.currency || "",
        transaction.category || "",
        transaction.date || "",
        transaction.note || ""
      ]
    );


  const csvContent = [
    headers,
    ...rows
  ]
    .map(
      (row) =>
        row
          .map(
            (value) =>
              `"${String(value)
                .replace(/"/g, '""')}"`
          )
          .join(",")
    )
    .join("\n");


  const blob =
    new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "expense-transactions.csv";

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);

}

  // =========================================
  // RESET ALL DATA
  // =========================================

  function handleResetData() {

    if (transactions.length === 0) {
      return;
    }


    const confirmed =
      window.confirm(
        "Are you sure you want to delete all transactions?"
      );


    if (!confirmed) {
      return;
    }


    transactions = [];

    saveTransactions();

    renderAll();
  }


  // =========================================
  // DASHBOARD
  // =========================================

  function renderBalance() {

  let totalIncome = 0;
  let totalExpense = 0;

  // Calculate income and expense in IDR
  transactions.forEach((transaction) => {

    const amount = Number(transaction.amount) || 0;
    const currency = transaction.currency || BASE_CURRENCY;

    const amountInIDR =
      convertToIDR(amount, currency);

    if (transaction.type === "income") {
      totalIncome += amountInIDR;
    } else {
      totalExpense += amountInIDR;
    }

  });

  // Calculate balance and savings
  const totalBalance =
    totalIncome - totalExpense;

  const totalSavings =
    totalBalance;

  // Calculate expense rate
  const expenseRate =
    totalIncome > 0
      ? (totalExpense / totalIncome) * 100
      : 0;

  // Get dashboard elements
  const incomeElement =
    $("total-income");

  const expenseElement =
    $("total-expense");

  const balanceElement =
    $("total-balance");

  const savingsElement =
    $("total-savings");

  const transactionCountElement =
    $("transaction-count");

  const expenseRateElement =
    $("expense-rate");


  // Update income
  if (incomeElement) {

    incomeElement.textContent =
      formatCurrency(
        totalIncome,
        BASE_CURRENCY
      );

  }


  // Update expense
  if (expenseElement) {

    expenseElement.textContent =
      formatCurrency(
        totalExpense,
        BASE_CURRENCY
      );

  }


  // Update balance
  if (balanceElement) {

    balanceElement.textContent =
      formatCurrency(
        totalBalance,
        BASE_CURRENCY
      );

  }


  // Update savings
  if (savingsElement) {

    savingsElement.textContent =
      formatCurrency(
        totalSavings,
        BASE_CURRENCY
      );

  }


  // Update transaction count
  if (transactionCountElement) {

    transactionCountElement.textContent =
      transactions.length;

  }


  // Update expense rate
  if (expenseRateElement) {

    expenseRateElement.textContent =
      `${expenseRate.toFixed(1)}%`;

  }

}

// =========================================
// MONTHLY SUMMARY
// =========================================

function renderMonthlySummary() {

  const monthlyIncomeElement =
    $("monthly-income");

  const monthlyExpenseElement =
    $("monthly-expense");

  const monthlySavingsElement =
    $("monthly-savings");

  const monthlyExpenseRateElement =
    $("monthly-expense-rate");

  const monthlySummaryMonthElement =
    $("monthly-summary-month");


  // =========================================
  // CURRENT MONTH
  // =========================================

  const now =
    new Date();

  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth();


  const monthLabel =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    ).format(now);


  if (monthlySummaryMonthElement) {

    monthlySummaryMonthElement.textContent =
      monthLabel;

  }


  // =========================================
  // CALCULATE MONTHLY TOTALS
  // =========================================

  let monthlyIncome = 0;
  let monthlyExpense = 0;


  transactions.forEach(
    (transaction) => {

      if (!transaction.date) {
        return;
      }


      const transactionDate =
        new Date(
          `${transaction.date}T00:00:00`
        );


      if (
        transactionDate.getFullYear() !==
          currentYear ||
        transactionDate.getMonth() !==
          currentMonth
      ) {
        return;
      }


      const amount =
        Number(transaction.amount) || 0;

      const currency =
        transaction.currency ||
        BASE_CURRENCY;


      const amountInIDR =
        convertToIDR(
          amount,
          currency
        );


      if (
        transaction.type === "income"
      ) {

        monthlyIncome +=
          amountInIDR;

      } else {

        monthlyExpense +=
          amountInIDR;

      }

    }
  );


  // =========================================
  // CALCULATE SAVINGS
  // =========================================

  const monthlySavings =
    monthlyIncome -
    monthlyExpense;


  // =========================================
  // CALCULATE EXPENSE RATE
  // =========================================

  const monthlyExpenseRate =
    monthlyIncome > 0
      ? (
          monthlyExpense /
          monthlyIncome
        ) * 100
      : 0;


  // =========================================
  // UPDATE UI
  // =========================================

  if (monthlyIncomeElement) {

    monthlyIncomeElement.textContent =
      formatCurrency(
        monthlyIncome,
        BASE_CURRENCY
      );

  }


  if (monthlyExpenseElement) {

    monthlyExpenseElement.textContent =
      formatCurrency(
        monthlyExpense,
        BASE_CURRENCY
      );

  }


  if (monthlySavingsElement) {

    monthlySavingsElement.textContent =
      formatCurrency(
        monthlySavings,
        BASE_CURRENCY
      );

  }


  if (monthlyExpenseRateElement) {

    monthlyExpenseRateElement.textContent =
      `${monthlyExpenseRate.toFixed(1)}%`;

  }

}

  // =========================================
  // TRANSACTION LIST
  // =========================================

  function renderList() {

  const listContainer =
    $("transaction-list");

  if (!listContainer) {
    return;
  }

  listContainer.innerHTML = "";


  // =========================================
// FILTER TRANSACTIONS
// =========================================

const filteredTransactions =
  transactions.filter((transaction) => {

    // Filter berdasarkan type
    const matchesFilter =
      currentFilter === "all" ||
      transaction.type === currentFilter;

    // Filter berdasarkan search
    const query =
      searchQuery.toLowerCase();

    const matchesSearch =
      query === "" ||
      (transaction.title || "")
        .toLowerCase()
        .includes(query) ||
      (transaction.category || "")
        .toLowerCase()
        .includes(query) ||
      (transaction.note || "")
        .toLowerCase()
        .includes(query) ||
      (transaction.currency || "")
        .toLowerCase()
        .includes(query);

    return matchesFilter && matchesSearch;
  });

  // =========================================
// SORT TRANSACTIONS
// =========================================

filteredTransactions.sort((a, b) => {

  // Sort by amount
  if (
    currentSort === "highest" ||
    currentSort === "lowest"
  ) {

    const amountA =
      convertToIDR(
        Number(a.amount) || 0,
        a.currency || BASE_CURRENCY
      );

    const amountB =
      convertToIDR(
        Number(b.amount) || 0,
        b.currency || BASE_CURRENCY
      );

    return currentSort === "highest"
      ? amountB - amountA
      : amountA - amountB;
  }


  // Sort by date
  const dateA =
    a.date
      ? new Date(a.date).getTime()
      : 0;

  const dateB =
    b.date
      ? new Date(b.date).getTime()
      : 0;

  return currentSort === "latest"
    ? dateB - dateA
    : dateA - dateB;
});


// =========================================
// EMPTY STATE
// =========================================

if (filteredTransactions.length === 0) {

  const emptyMessage =
    document.createElement("p");

  emptyMessage.id =
    "list-empty-msg";

  emptyMessage.textContent =
    transactions.length === 0
      ? "No transactions recorded yet."
      : `No ${currentFilter} transactions found.`;

  listContainer.appendChild(
    emptyMessage
  );

  return;
}


  // =========================================
  // RENDER TRANSACTIONS
  // =========================================

  filteredTransactions.forEach(
  (transaction) => {

      const row =
        document.createElement("div");

      row.className =
        "transaction-row";


      // -----------------------------------------
      // Transaction title
      // -----------------------------------------

      const name =
        document.createElement("span");

      name.className =
        "transaction-name";

      name.textContent =
        transaction.title ||
        "Untitled";


      // -----------------------------------------
      // Transaction amount
      // -----------------------------------------

      const amount =
        document.createElement("span");

      amount.className =
        "transaction-amount";

      amount.textContent =
        formatCurrency(
          transaction.amount,
          transaction.currency ||
          BASE_CURRENCY
        );


      // -----------------------------------------
      // Transaction category
      // -----------------------------------------

      const category =
        document.createElement("span");

      category.className =
        "transaction-category";

      category.textContent =
        transaction.category ||
        "Uncategorized";


      // -----------------------------------------
      // Transaction type
      // -----------------------------------------

      const type =
        document.createElement("span");

      type.className =
        "transaction-type";

      type.textContent =
        transaction.type === "income"
          ? "Income"
          : "Expense";


      // -----------------------------------------
      // Transaction date
      // -----------------------------------------

      const date =
        document.createElement("span");

      date.className =
        "transaction-date";

      if (transaction.date) {

        date.textContent =
          transaction.date;

      } else {

        date.textContent =
          "No date";

      }


      // -----------------------------------------
      // Transaction note
      // -----------------------------------------

      const note =
        document.createElement("span");

      note.className =
        "transaction-note";

      note.textContent =
        transaction.note ||
        "";


      // -----------------------------------------
      // Delete button & Edit button
      // -----------------------------------------

      const editButton =
  document.createElement("button");

editButton.className =
  "edit-btn";

editButton.type =
  "button";

editButton.textContent =
  "Edit";

editButton.addEventListener(
  "click",
  () => {

    handleEditClick(
      transaction.id
    );

  }
);

      const deleteButton =
        document.createElement("button");

      deleteButton.className =
        "delete-btn";

      deleteButton.type =
        "button";

      deleteButton.textContent =
        "Delete";


      deleteButton.addEventListener(
        "click",
        () => {

          handleDeleteClick(
            transaction.id
          );

        }
      );


      // =========================================
      // ADD ELEMENTS TO ROW
      // =========================================

      row.appendChild(name);

      row.appendChild(amount);

      row.appendChild(category);

      row.appendChild(type);

      row.appendChild(date);

      if (transaction.note) {

        row.appendChild(note);

      }

     row.appendChild(
      editButton
      );

     row.appendChild(
      deleteButton
      );


      listContainer.appendChild(
        row
      );

    }
  );

}

  // =========================================
  // CHART
  // =========================================

  function renderChart() {

    const canvas =
      $("expense-chart");

    const emptyMessage =
      $("chart-empty-msg");


    if (!canvas || !emptyMessage) {
      return;
    }


    // Only expenses
    const expenseTransactions =
      transactions.filter(
        (transaction) =>
          transaction.type !== "income"
      );


    // Prepare category totals
    const categoryTotals = {};


    CATEGORIES.forEach(
      (category) => {

        categoryTotals[category] = 0;
      }
    );


    expenseTransactions.forEach(
  (transaction) => {

    if (
      categoryTotals[
        transaction.category
      ] !== undefined
    ) {

      const amount =
        Number(transaction.amount) || 0;

      const currency =
        transaction.currency || BASE_CURRENCY;

      const amountInIDR =
        convertToIDR(
          amount,
          currency
        );

      categoryTotals[
        transaction.category
      ] += amountInIDR;
    }
  }
);

    const categoriesWithData =
      CATEGORIES.filter(
        (category) =>
          categoryTotals[category] > 0
      );


    const dataValues =
      categoriesWithData.map(
        (category) =>
          categoryTotals[category]
      );


    // Destroy old chart
    if (chartInstance) {

      chartInstance.destroy();

      chartInstance = null;
    }


    // No data
    if (
      categoriesWithData.length === 0
    ) {

      canvas.style.display =
        "none";

      emptyMessage.style.display =
        "block";

      emptyMessage.textContent =
        "No spending data available.";

      return;
    }


    // Chart.js unavailable
    if (
      typeof Chart === "undefined"
    ) {

      canvas.style.display =
        "none";

      emptyMessage.style.display =
        "block";

      emptyMessage.textContent =
        "Unable to load chart. Please check your internet connection.";

      return;
    }


    canvas.style.display =
      "block";

    emptyMessage.style.display =
      "none";


    const total =
      dataValues.reduce(
        (sum, value) =>
          sum + value,
        0
      );


    // Create chart
    try {

      chartInstance =
        new Chart(
          canvas,
          {

            type: "pie",

            data: {

              labels:
                categoriesWithData,

              datasets: [
                {

                  data:
                    dataValues,

                  backgroundColor: [
                    "#ff6384",
                    "#36a2eb",
                    "#ffce56",
                    "#4bc0c0",
                    "#9966ff",
                    "#ff9f40",
                    "#8bc34a",
                    "#e91e63",
                    "#795548",
                    "#607d8b"
                  ],

                  borderWidth: 2,

                  borderColor:
                    "#ffffff"
                }
              ]
            },


            options: {

              responsive: true,

              plugins: {

                legend: {
                  position: "bottom"
                },


                tooltip: {

                  callbacks: {

                    label(context) {

                      const label =
                        context.label || "";

                      const value =
                        Number(
                          context.parsed
                        ) || 0;


                      const percentage =
                        total > 0
                          ? (
                              (value / total) *
                              100
                            ).toFixed(1)
                          : "0.0";


                      return (
                        `${label}: ` +
                        `${formatCurrency(
                          value,
                          "IDR"
                        )} ` +
                        `(${percentage}%)`
                      );
                    }
                  }
                }
              }
            }
          }
        );

    } catch (error) {

      canvas.style.display =
        "none";

      emptyMessage.style.display =
        "block";

      emptyMessage.textContent =
        "Unable to render chart.";
    }
  }


  // =========================================
  // RENDER ALL
  // =========================================

  function renderAll() {

    renderBalance();

    renderMonthlySummary();

    renderChart();

    renderList();
  }


  // =========================================
  // INITIALIZE APP
  // =========================================

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      // Load saved data
      transactions =
        loadTransactions();


      // Initial render
      renderAll();


      // Form submit
      const form =
        $("expense-form");


      if (form) {

        form.addEventListener(
          "submit",
          handleFormSubmit
        );
      }


      // Reset button
      const resetButton =
        $("reset-data");


      if (resetButton) {

        resetButton.addEventListener(
          "click",
          handleResetData
        );
      }

      // =========================================
// EXPORT BUTTON
// =========================================

const exportButton =
  $("export-data");

if (exportButton) {

  exportButton.addEventListener(
    "click",
    exportTransactionsToCSV
  );

}
      // =========================================
// TRANSACTION FILTER
// =========================================

const filterButtons =
  document.querySelectorAll(".filter-btn");

filterButtons.forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        currentFilter =
          button.dataset.filter;

        filterButtons.forEach(
          (btn) => {
            btn.classList.remove("active");
          }
        );

        button.classList.add("active");

        renderList();
      }
    );
  }
);

// =========================================
// TRANSACTION SEARCH
// =========================================

const searchInput =
  $("transaction-search");

if (searchInput) {

  searchInput.addEventListener(
    "input",
    () => {

      searchQuery =
        searchInput.value.trim();

      renderList();
    }
  );

}

// =========================================
// TRANSACTION SORT
// =========================================

const sortSelect =
  $("transaction-sort");

if (sortSelect) {

  sortSelect.addEventListener(
    "change",
    () => {

      currentSort =
        sortSelect.value;

      renderList();
    }
  );

}

    }
  );

})();