(() => {

 // =========================================
// CONSTANTS
// =========================================

const STORAGE_KEY = 
  "expense_visualizer_transactions";

const BUDGET_STORAGE_KEY =
  "expense_visualizer_budgets";

const RATES_STORAGE_KEY =
  "expense_visualizer_exchange_rates";

const THEME_STORAGE_KEY =
  "expense_visualizer_theme";

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

let EXCHANGE_RATES = {
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
  let budgets = {};

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
// BUDGET STORAGE
// =========================================

function loadBudgets() {

  try {

    const correctKey =
      localStorage.getItem(
        BUDGET_STORAGE_KEY
      );

    // -----------------------------------------
    // NORMAL BUDGET STORAGE
    // -----------------------------------------

    if (correctKey) {

      const parsedData =
        JSON.parse(correctKey);

      if (
        parsedData &&
        typeof parsedData === "object" &&
        !Array.isArray(parsedData)
      ) {

        return parsedData;

      }

    }


    // -----------------------------------------
    // MIGRATE OLD BUGGED STORAGE
    // -----------------------------------------

    const oldKey =
      localStorage.getItem(
        "expense_visualizer_exchange_rates"
      );


    if (oldKey) {

      const parsedOldData =
        JSON.parse(oldKey);


      const looksLikeBudgetData =
        parsedOldData &&
        typeof parsedOldData === "object" &&
        !Array.isArray(parsedOldData) &&
        Object.keys(parsedOldData).some(
          (key) =>
            CATEGORIES.includes(key)
        );


      if (looksLikeBudgetData) {

        localStorage.setItem(
          BUDGET_STORAGE_KEY,
          JSON.stringify(
            parsedOldData
          )
        );

        return parsedOldData;

      }

    }


    return {};

  } catch (error) {

    showBanner(
      "Could not load budget settings.",
      "warning"
    );

    return {};

  }

}

// =========================================
// EXCHANGE RATE STORAGE
// =========================================

function loadExchangeRates() {

  try {

    const rawData =
      localStorage.getItem(
        RATES_STORAGE_KEY
      );


    if (!rawData) {

      return {
        IDR: 1,
        JPY: 110,
        USD: 17000
      };

    }


    const parsedData =
      JSON.parse(rawData);


    return {
      IDR: 1,

      JPY:
        Number(parsedData.JPY) > 0
          ? Number(parsedData.JPY)
          : 110,

      USD:
        Number(parsedData.USD) > 0
          ? Number(parsedData.USD)
          : 17000
    };


  } catch (error) {

    showBanner(
      "Could not load exchange rates.",
      "warning"
    );


    return {
      IDR: 1,
      JPY: 110,
      USD: 17000
    };

  }

}

function saveExchangeRates() {

  try {

    localStorage.setItem(
      RATES_STORAGE_KEY,
      JSON.stringify(
        EXCHANGE_RATES
      )
    );

  } catch (error) {

    showBanner(
      "Unable to save exchange rates.",
      "error"
    );

  }

}

// =========================================
// RENDER EXCHANGE RATES
// =========================================

function renderExchangeRates() {

  const jpyInput =
    $("rate-jpy");

  const usdInput =
    $("rate-usd");


  if (!jpyInput || !usdInput) {
    return;
  }


  jpyInput.value =
    EXCHANGE_RATES.JPY;


  usdInput.value =
    EXCHANGE_RATES.USD;

}

// =========================================
// SAVE EXCHANGE RATES
// =========================================

function handleSaveExchangeRates() {

  const jpyInput =
    $("rate-jpy");

  const usdInput =
    $("rate-usd");


  if (!jpyInput || !usdInput) {
    return;
  }


  const jpyRate =
    Number(
      String(
        jpyInput.value
      ).replace(/[.,]/g, "")
    );


  const usdRate =
    Number(
      String(
        usdInput.value
      ).replace(/[.,]/g, "")
    );


  if (
    !Number.isFinite(jpyRate) ||
    jpyRate <= 0
  ) {

    showBanner(
      "JPY exchange rate must be greater than 0.",
      "warning"
    );

    return;
  }


  if (
    !Number.isFinite(usdRate) ||
    usdRate <= 0
  ) {

    showBanner(
      "USD exchange rate must be greater than 0.",
      "warning"
    );

    return;
  }


  EXCHANGE_RATES =
    {
      IDR: 1,
      JPY: jpyRate,
      USD: usdRate
    };


  saveExchangeRates();


  // Refresh every currency-based calculation
  renderAll();


  showBanner(
    "Exchange rates updated successfully.",
    "warning"
  );

}

// =========================================
// RENDER BUDGET + MONTHLY USAGE
// =========================================

function renderBudgets() {

  const budgetList =
    $("budget-list");

  if (!budgetList) {
    return;
  }

  budgetList.innerHTML = "";


  const budgetEntries =
    Object.entries(budgets);


  // =========================================
  // EMPTY STATE
  // =========================================

  if (budgetEntries.length === 0) {

    const emptyMessage =
      document.createElement("p");

    emptyMessage.id =
      "budget-empty";

    emptyMessage.textContent =
      "No budgets set yet.";

    budgetList.appendChild(
      emptyMessage
    );

    return;
  }


  // =========================================
  // CURRENT MONTH
  // =========================================

  const now =
    new Date();

  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth();


  // =========================================
  // CALCULATE EXPENSE BY CATEGORY
  // =========================================

  const monthlyExpenses = {};


  transactions.forEach(
    (transaction) => {

      if (
        transaction.type === "income"
      ) {
        return;
      }


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


      const category =
        transaction.category;

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
        monthlyExpenses[category] ===
        undefined
      ) {

        monthlyExpenses[category] =
          0;

      }


      monthlyExpenses[category] +=
        amountInIDR;

    }
  );


  // =========================================
  // RENDER EACH BUDGET
  // =========================================

  budgetEntries.forEach(
    ([category, budgetAmount]) => {

      const used =
        monthlyExpenses[category] || 0;


      const remaining =
        budgetAmount - used;


      const percentage =
        budgetAmount > 0
          ? (used / budgetAmount) * 100
          : 0;


      const isOverBudget =
        used > budgetAmount;


      // ---------------------------------------
      // ROW
      // ---------------------------------------

      const row =
        document.createElement("div");

      row.className =
        "budget-row";


      // ---------------------------------------
      // CATEGORY
      // ---------------------------------------

      const name =
        document.createElement("div");

      name.className =
        "budget-category";

      name.textContent =
        category;


      // ---------------------------------------
      // BUDGET INFO
      // ---------------------------------------

      const info =
        document.createElement("div");

      info.className =
        "budget-info";


      const budgetText =
        document.createElement("span");

      budgetText.className =
        "budget-limit";

      budgetText.textContent =
        `Budget: ${
          formatCurrency(
            budgetAmount,
            BASE_CURRENCY
          )
        }`;


      const usedText =
        document.createElement("span");

      usedText.className =
        "budget-used";

      usedText.textContent =
        `Used: ${
          formatCurrency(
            used,
            BASE_CURRENCY
          )
        }`;


      const remainingText =
        document.createElement("span");

      remainingText.className =
        isOverBudget
          ? "budget-remaining over"
          : "budget-remaining";

      remainingText.textContent =
        isOverBudget
          ? `Over: ${formatCurrency(
              Math.abs(remaining),
              BASE_CURRENCY
            )}`
          : `Remaining: ${formatCurrency(
              remaining,
              BASE_CURRENCY
            )}`;


      const percentageText =
        document.createElement("span");

      percentageText.className =
        isOverBudget
          ? "budget-percentage over"
          : "budget-percentage";

      percentageText.textContent =
        `${percentage.toFixed(1)}% used`;


      info.appendChild(
        budgetText
      );

      info.appendChild(
        usedText
      );

      info.appendChild(
        remainingText
      );

      info.appendChild(
        percentageText
      );


      // ---------------------------------------
      // PROGRESS BAR
      // ---------------------------------------

      const progressContainer =
        document.createElement("div");

      progressContainer.className =
        "budget-progress";


      const progressBar =
        document.createElement("div");

      progressBar.className =
        isOverBudget
          ? "budget-progress-bar over"
          : "budget-progress-bar";


      const progressWidth =
        Math.min(
          percentage,
          100
        );


      progressBar.style.width =
        `${progressWidth}%`;


      progressContainer.appendChild(
        progressBar
      );


      // ---------------------------------------
      // STATUS
      // ---------------------------------------

      const status =
        document.createElement("span");

      status.className =
        isOverBudget
          ? "budget-status over"
          : percentage >= 80
            ? "budget-status warning"
            : "budget-status safe";


      if (isOverBudget) {

        status.textContent =
          "Over Budget";

      } else if (percentage >= 80) {

        status.textContent =
          "Almost Limit";

      } else {

        status.textContent =
          "On Track";

      }


      // ---------------------------------------
      // REMOVE & EDIT BUTTON
      // ---------------------------------------

      const editButton =
  document.createElement("button");

editButton.type =
  "button";

editButton.className =
  "budget-edit";

editButton.textContent =
  "Edit";


editButton.addEventListener(
  "click",
  () => {

    const categoryInput =
      $("budget-category");

    const amountInput =
      $("budget-amount");


    if (
      !categoryInput ||
      !amountInput
    ) {
      return;
    }


    categoryInput.value =
      category;

    amountInput.value =
      budgetAmount
        .toLocaleString(
          "id-ID"
        );


    amountInput.focus();

  }
);
      
      const deleteButton =
        document.createElement("button");

      deleteButton.type =
        "button";

      deleteButton.className =
        "budget-delete";

      deleteButton.textContent =
        "Remove";


      deleteButton.addEventListener(
        "click",
        () => {

          delete budgets[category];

          saveBudgets();

          renderBudgets();

          renderBudgetHealth();

        }
      );


      // ---------------------------------------
      // APPEND
      // ---------------------------------------

      row.appendChild(
        name
      );

      row.appendChild(
        info
      );

      row.appendChild(
        progressContainer
      );

      row.appendChild(
        status
      );

      row.appendChild(
        editButton
      );

      row.appendChild(
        deleteButton
      );


      budgetList.appendChild(
        row
      );

    }
  );

}


// =========================================
// BUDGET HEALTH
// =========================================

function renderBudgetHealth() {

  const safeElement =
    $("budget-safe-count");

  const warningElement =
    $("budget-warning-count");

  const overElement =
    $("budget-over-count");

  const monthElement =
    $("budget-health-month");


  if (
    !safeElement ||
    !warningElement ||
    !overElement
  ) {
    return;
  }


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


  if (monthElement) {

    monthElement.textContent =
      monthLabel;

  }


  // =========================================
  // CALCULATE EXPENSE PER CATEGORY
  // =========================================

  const monthlyExpenses = {};


  transactions.forEach(
    (transaction) => {

      if (
        transaction.type === "income"
      ) {
        return;
      }


      if (!transaction.date) {
        return;
      }


      const date =
        new Date(
          `${transaction.date}T00:00:00`
        );


      if (
        date.getFullYear() !==
          currentYear ||
        date.getMonth() !==
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


      const category =
        transaction.category;


      if (
        monthlyExpenses[category] ===
        undefined
      ) {

        monthlyExpenses[category] =
          0;

      }


      monthlyExpenses[category] +=
        amountInIDR;

    }
  );


  // =========================================
  // CALCULATE HEALTH STATUS
  // =========================================

  let safeCount = 0;

  let warningCount = 0;

  let overCount = 0;


  Object.entries(budgets).forEach(
    ([category, budget]) => {

      const used =
        monthlyExpenses[category] || 0;


      const percentage =
        budget > 0
          ? (used / budget) * 100
          : 0;


      if (used > budget) {

        overCount++;

      } else if (percentage >= 80) {

        warningCount++;

      } else {

        safeCount++;

      }

    }
  );


  // =========================================
  // UPDATE DASHBOARD
  // =========================================

  safeElement.textContent =
    safeCount;

  warningElement.textContent =
    warningCount;

  overElement.textContent =
    overCount;

}
// =========================================
// SAVE BUDGET
// =========================================

function handleSaveBudget() {

  const categoryInput =
    $("budget-category");

  const amountInput =
    $("budget-amount");

  if (
    !categoryInput ||
    !amountInput
  ) {
    return;
  }


  const category =
    categoryInput.value;

  const rawAmount =
    amountInput.value.trim();


  if (!rawAmount) {

    showBanner(
      "Please enter a budget amount.",
      "warning"
    );

    return;
  }


  const amount =
    parseAmount(
      rawAmount,
      BASE_CURRENCY
    );


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {

    showBanner(
      "Budget amount must be greater than 0.",
      "warning"
    );

    return;
  }


  budgets[category] =
    amount;


  saveBudgets();

  renderBudgets();


  amountInput.value = "";

}

// =========================================
// DARK MODE
// =========================================

function applyTheme(theme) {

  const toggleButton =
    $("theme-toggle");


  if (theme === "dark") {

    document.body.classList.add(
      "dark-mode"
    );


    if (toggleButton) {

      toggleButton.textContent =
        "☀️ Light Mode";

    }

  } else {

    document.body.classList.remove(
      "dark-mode"
    );


    if (toggleButton) {

      toggleButton.textContent =
        "🌙 Dark Mode";

    }

  }

}


function loadTheme() {

  const savedTheme =
    localStorage.getItem(
      THEME_STORAGE_KEY
    );


  if (
    savedTheme === "dark" ||
    savedTheme === "light"
  ) {

    return savedTheme;

  }


  return "light";

}


function toggleTheme() {

  const isDark =
    document.body.classList.contains(
      "dark-mode"
    );


  const newTheme =
    isDark
      ? "light"
      : "dark";


  applyTheme(
    newTheme
  );


  localStorage.setItem(
    THEME_STORAGE_KEY,
    newTheme
  );

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

       const cancelButton =
  $("cancel-edit");

if (cancelButton) {
  cancelButton.hidden = true;
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

  const cancelButton =
  $("cancel-edit");

if (cancelButton) {
  cancelButton.hidden = false;
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
// CANCEL EDIT
// =========================================

function handleCancelEdit() {

  const form =
    $("expense-form");

  const cancelButton =
    $("cancel-edit");

  const submitButton =
    form
      ? form.querySelector(
          'button[type="submit"]'
        )
      : null;


  currentEditingId =
    null;


  if (form) {
    form.reset();
  }


  if (submitButton) {

    submitButton.textContent =
      "Save Transaction";

  }


  if (cancelButton) {

    cancelButton.hidden =
      true;

  }


  clearErrorMessages();

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
// IMPORT TRANSACTIONS
// =========================================

function importTransactionsFromCSV(file) {

  if (!file) {
    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    (event) => {

      try {

        const csvText =
          event.target.result;


        const lines =
          csvText
            .split(/\r?\n/)
            .filter(
              (line) =>
                line.trim() !== ""
            );


        if (lines.length < 2) {

          showBanner(
            "CSV file contains no transaction data.",
            "warning"
          );

          return;
        }


        const importedTransactions =
          lines
            .slice(1)
            .map(
              (line) =>
                parseCSVLine(line)
            )
            .filter(
              (row) =>
                row.length >= 7
            );


        if (
          importedTransactions.length === 0
        ) {

          showBanner(
            "No valid transactions found in CSV.",
            "warning"
          );

          return;
        }


        importedTransactions.forEach(
          (row) => {

            const [
              type,
              title,
              amount,
              currency,
              category,
              date,
              note
            ] = row;


            const numericAmount =
              parseAmount(
                amount,
                currency || BASE_CURRENCY
              );


            if (
              !Number.isFinite(
                numericAmount
              ) ||
              numericAmount <= 0
            ) {
              return;
            }


            let id;

            if (
              typeof crypto !== "undefined" &&
              crypto.randomUUID
            ) {

              id =
                crypto.randomUUID();

            } else {

              id =
                Date.now().toString() +
                Math.random()
                  .toString(36)
                  .slice(2);

            }


            transactions.push({

              id: id,

              type:
                type === "income"
                  ? "income"
                  : "expense",

              title:
                title || "Imported Transaction",

              amount:
                numericAmount,

              currency:
                currency || BASE_CURRENCY,

              category:
                CATEGORIES.includes(
                  category
                )
                  ? category
                  : CATEGORIES[0],

              date:
                date || "",

              note:
                note || ""

            });

          }
        );


        saveTransactions();

        renderAll();


        showBanner(
          "Transactions imported successfully.",
          "warning"
        );


      } catch (error) {

        showBanner(
          "Failed to import CSV file.",
          "error"
        );

      }

    };


  reader.onerror =
    () => {

      showBanner(
        "Could not read the CSV file.",
        "error"
      );

    };


  reader.readAsText(file);

}

// =========================================
// PARSE CSV LINE
// =========================================

function parseCSVLine(line) {

  const values = [];

  let current = "";

  let insideQuotes = false;


  for (
    let i = 0;
    i < line.length;
    i++
  ) {

    const char =
      line[i];


    if (
      char === '"'
    ) {

      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {

        current += '"';

        i++;

      } else {

        insideQuotes =
          !insideQuotes;

      }

    } else if (
      char === "," &&
      !insideQuotes
    ) {

      values.push(
        current
      );

      current = "";

    } else {

      current += char;

    }

  }


  values.push(
    current
  );


  return values;

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

  renderBudgets();

  renderBudgetHealth();

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

      budgets =
        loadBudgets();

      EXCHANGE_RATES =
  loadExchangeRates();


// =========================================
// LOAD THEME
// =========================================

const savedTheme =
  loadTheme();

applyTheme(
  savedTheme
);

      // Initial render
      renderAll();
      
      renderExchangeRates();

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
// THEME BUTTON
// =========================================

const themeToggle =
  $("theme-toggle");

if (themeToggle) {

  themeToggle.addEventListener(
    "click",
    toggleTheme
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
// IMPORT BUTTON
// =========================================

const importButton =
  $("import-data");

const importFile =
  $("import-file");


if (
  importButton &&
  importFile
) {

  importButton.addEventListener(
    "click",
    () => {

      importFile.click();

    }
  );


  importFile.addEventListener(
    "change",
    () => {

      const file =
        importFile.files[0];

      if (file) {

        importTransactionsFromCSV(
          file
        );

      }


      importFile.value =
        "";

    }
  );

}

// =========================================
// EXCHANGE RATE BUTTON
// =========================================

const saveRatesButton =
  $("save-rates");

if (saveRatesButton) {

  saveRatesButton.addEventListener(
    "click",
    handleSaveExchangeRates
  );

}

// =========================================
// CANCEL EDIT BUTTON
// =========================================

const cancelEditButton =
  $("cancel-edit");

if (cancelEditButton) {

  cancelEditButton.addEventListener(
    "click",
    handleCancelEdit
  );

}

// =========================================
// BUDGET BUTTON
// =========================================

const saveBudgetButton =
  $("save-budget");

if (saveBudgetButton) {

  saveBudgetButton.addEventListener(
    "click",
    handleSaveBudget
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