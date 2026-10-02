const API_URL = "http://localhost:3001/api/expenses";
const categories = ["Food", "Transport", "Bills", "Entertainment", "Other"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

let expenses = [];
const alertArea = document.getElementById("alert-area");
const rows = document.getElementById("expense-rows");
const filter = document.getElementById("category-filter");
const loadingIndicator = document.getElementById("loading-indicator");
const tableContainer = document.getElementById("table-container");
const emptyState = document.getElementById("empty-state");
const editModal = new bootstrap.Modal(document.getElementById("edit-modal"));

function showAlert(message, type = "danger") {
  alertArea.replaceChildren();
  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.setAttribute("role", "alert");
  const text = document.createElement("span");
  text.textContent = message;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn-close";
  close.setAttribute("data-bs-dismiss", "alert");
  close.setAttribute("aria-label", "Close");
  alert.append(text, close);
  alertArea.append(alert);
}

function clearAlert() {
  alertArea.replaceChildren();
}

async function readResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}.`);
  }
  return data;
}

function updateSummary() {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const highest = expenses.reduce((max, expense) => Math.max(max, Number(expense.amount)), 0);
  document.getElementById("summary-total").textContent = money.format(total);
  document.getElementById("summary-count").textContent = String(expenses.length);
  document.getElementById("summary-highest").textContent = money.format(highest);
}

function categoryBadgeClass(category) {
  const classNames = {
    Food: "badge-food",
    Transport: "badge-transport",
    Bills: "badge-bills",
    Entertainment: "badge-entertainment",
    Other: "badge-other",
  };
  return classNames[category] || "badge-other";
}

function renderExpenses() {
  rows.replaceChildren();
  const selectedCategory = filter.value;
  const visibleExpenses = selectedCategory === "All"
    ? expenses
    : expenses.filter((expense) => expense.category === selectedCategory);

  visibleExpenses.forEach((expense) => {
    const row = document.createElement("tr");
    const titleCell = document.createElement("th");
    titleCell.scope = "row";
    titleCell.textContent = expense.title;
    const amountCell = document.createElement("td");
    amountCell.textContent = money.format(Number(expense.amount));
    const categoryCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge category-badge ${categoryBadgeClass(expense.category)}`;
    badge.textContent = expense.category;
    categoryCell.append(badge);
    const dateCell = document.createElement("td");
    dateCell.textContent = expense.date;
    const actionsCell = document.createElement("td");
    actionsCell.className = "text-nowrap";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-sm btn-outline-primary me-1";
    editButton.textContent = "Edit";
    editButton.dataset.action = "edit";
    editButton.dataset.id = String(expense.id);
    editButton.setAttribute("aria-label", `Edit ${expense.title}`);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-sm btn-outline-danger";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = String(expense.id);
    deleteButton.setAttribute("aria-label", `Delete ${expense.title}`);

    actionsCell.append(editButton, deleteButton);
    row.append(titleCell, amountCell, categoryCell, dateCell, actionsCell);
    rows.append(row);
  });

  const noExpenses = expenses.length === 0;
  const noMatches = !noExpenses && visibleExpenses.length === 0;
  tableContainer.hidden = noExpenses;
  emptyState.hidden = !noExpenses && !noMatches;
  emptyState.textContent = noMatches
    ? "No expenses match this category. Choose another category or select All."
    : "No expenses to show. Add one above to get started.";
}

async function loadExpenses() {
  clearAlert();
  loadingIndicator.hidden = false;
  tableContainer.hidden = true;
  emptyState.hidden = true;

  try {
    const response = await fetch(API_URL);
    expenses = await readResponse(response);
    updateSummary();
    renderExpenses();
    return true;
  } catch (error) {
    expenses = [];
    updateSummary();
    rows.replaceChildren();
    showAlert(`Could not load expenses. Make sure the backend and PostgreSQL are running. ${error.message}`);
    return false;
  } finally {
    loadingIndicator.hidden = true;
    if (expenses.length > 0) tableContainer.hidden = false;
    else if (!alertArea.hasChildNodes()) emptyState.hidden = false;
  }
}

function formDataToExpense(form) {
  const values = new FormData(form);
  return {
    title: String(values.get("title") || "").trim(),
    amount: Number(values.get("amount")),
    category: String(values.get("category") || ""),
    date: String(values.get("date") || ""),
  };
}

function validateOnPage(expense) {
  if (!expense.title) return "Title is required.";
  if (!Number.isFinite(expense.amount) || expense.amount <= 0) return "Amount must be greater than 0.";
  if (!categories.includes(expense.category)) return "Choose a valid category.";
  if (!expense.date) return "Date is required.";
  return "";
}

async function saveExpense(url, method, expense) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expense),
  });
  return readResponse(response);
}

document.getElementById("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const expense = formDataToExpense(form);
  const validationMessage = validateOnPage(expense);
  if (validationMessage) return showAlert(validationMessage, "warning");

  const button = document.getElementById("add-submit");
  button.disabled = true;
  try {
    await saveExpense(API_URL, "POST", expense);
    form.reset();
    if (await loadExpenses()) showAlert("Expense added successfully.", "success");
  } catch (error) {
    showAlert(error.message);
  } finally {
    button.disabled = false;
  }
});

filter.addEventListener("change", renderExpenses);

rows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const expense = expenses.find((item) => String(item.id) === button.dataset.id);
  if (!expense) return;

  if (button.dataset.action === "edit") {
    document.getElementById("edit-id").value = String(expense.id);
    document.getElementById("edit-title").value = expense.title;
    document.getElementById("edit-amount").value = String(expense.amount);
    document.getElementById("edit-category").value = expense.category;
    document.getElementById("edit-date").value = expense.date;
    editModal.show();
    return;
  }

  if (button.dataset.action === "delete") {
    clearAlert();
    button.disabled = true;
    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(expense.id)}`, { method: "DELETE" });
      await readResponse(response);
      if (await loadExpenses()) showAlert("Expense deleted successfully.", "success");
    } catch (error) {
      showAlert(error.message);
    } finally {
      button.disabled = false;
    }
  }
});

document.getElementById("edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const expense = {
    title: document.getElementById("edit-title").value.trim(),
    amount: Number(document.getElementById("edit-amount").value),
    category: document.getElementById("edit-category").value,
    date: document.getElementById("edit-date").value,
  };
  const validationMessage = validateOnPage(expense);
  if (validationMessage) return showAlert(validationMessage, "warning");

  const id = document.getElementById("edit-id").value;
  const button = document.getElementById("edit-submit");
  button.disabled = true;
  try {
    await saveExpense(`${API_URL}/${encodeURIComponent(id)}`, "PUT", expense);
    editModal.hide();
    if (await loadExpenses()) showAlert("Expense updated successfully.", "success");
  } catch (error) {
    showAlert(error.message);
  } finally {
    button.disabled = false;
  }
});

loadExpenses();
