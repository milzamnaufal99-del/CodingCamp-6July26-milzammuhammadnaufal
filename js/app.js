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

  if (currency === "IDR" || currency === "JPY") {
    amount = amount.replace(/[.,]/g, "");
  } else if (currency === "USD") {
    amount = amount.replace(/,/g, "");
  }

  return Number(amount);
}


  // =========================================
  // STATE
  // =========================================

  let transactions = [];
  let chartInstance = null;


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


    // Get form elements
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


    // Make sure required fields exist
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


    // Read values
    const title =
      titleInput.value.trim();

    const amount =
      amountInput.value;

    const category =
      categoryInput.value;


    // Validate
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


    // Generate ID
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


    // Create transaction
    const newTransaction = {

      id: id,

      type:
        typeInput.value === "income"
          ? "income"
          : "expense",

      title: title,

      amount:
        parseAmount(
          amount,
          currencyInput.value
  ),

      currency:
          currencyInput.value,

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


    // Add transaction
    transactions.push(
      newTransaction
    );


    // Save + render
    saveTransactions();

    renderAll();


    // Reset form
    event.target.reset();
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

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0;
    const currency = transaction.currency || BASE_CURRENCY;

    const amountInIDR = convertToIDR(amount, currency);

    if (transaction.type === "income") {
      totalIncome += amountInIDR;
    } else {
      totalExpense += amountInIDR;
    }
  });

  const totalBalance = totalIncome - totalExpense;
  const totalSavings = totalBalance;

  const incomeElement = $ ("total-income");
  const expenseElement = $ ("total-expense");
  const balanceElement = $ ("total-balance");
  const savingsElement = $ ("total-savings");

  if (incomeElement) {
    incomeElement.textContent = formatCurrency(totalIncome, BASE_CURRENCY);
  }

  if (expenseElement) {
    expenseElement.textContent = formatCurrency(totalExpense, BASE_CURRENCY);
  }

  if (balanceElement) {
    balanceElement.textContent = formatCurrency(totalBalance, BASE_CURRENCY);
  }

  if (savingsElement) {
    savingsElement.textContent = formatCurrency(totalSavings, BASE_CURRENCY);
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


    // Empty state
    if (transactions.length === 0) {

      const emptyMessage =
        document.createElement("p");

      emptyMessage.id =
        "list-empty-msg";

      emptyMessage.textContent =
        "No transactions recorded yet.";

      listContainer.appendChild(
        emptyMessage
      );

      return;
    }


    // Render transactions
    transactions.forEach(
      (transaction) => {

        const row =
          document.createElement("div");

        row.className =
          "transaction-row";


        const name =
          document.createElement("span");

        name.className =
          "transaction-name";

        name.textContent =
          transaction.title ||
          "Untitled";


        const amount =
          document.createElement("span");

        amount.className =
          "transaction-amount";

        amount.textContent =
          formatCurrency(
            transaction.amount,
            transaction.currency || "IDR"
          );


        const category =
          document.createElement("span");

        category.className =
          "transaction-category";

        category.textContent =
          transaction.category;


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


        row.appendChild(name);

        row.appendChild(amount);

        row.appendChild(category);

        row.appendChild(deleteButton);


        listContainer.appendChild(row);
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

          categoryTotals[
            transaction.category
          ] +=
            Number(transaction.amount) || 0;
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
    }
  );

})();