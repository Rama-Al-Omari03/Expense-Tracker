require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 3001;
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "expense_tracker",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || undefined,
  connectionTimeoutMillis: 5000,
});

app.use(cors());
app.use(express.json());

const categories = ["Food", "Transport", "Bills", "Entertainment", "Other"];
const expenseColumns = "id, title, amount::float8 AS amount, category, to_char(date, 'YYYY-MM-DD') AS date";

function validateExpense(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const amount = body.amount;
  const category = typeof body.category === "string" ? body.category : "";
  const date = typeof body.date === "string" ? body.date : "";
  const dateValue = new Date(`${date}T00:00:00.000Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(dateValue.getTime())
    && dateValue.toISOString().slice(0, 10) === date;
  const errors = [];

  if (!title) errors.push("Title is required.");
  if (title.length > 100) errors.push("Title must be 100 characters or fewer.");
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    errors.push("Amount must be a number greater than 0.");
  }
  if (!categories.includes(category)) errors.push("Choose a valid category.");
  if (!validDate) errors.push("Date must be a valid date in YYYY-MM-DD format.");

  return { errors, expense: { title, amount, category, date } };
}

function parseExpenseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sendDatabaseError(res, error) {
  console.error("PostgreSQL request failed:", error.message);
  return res.status(500).json({
    message: "Database request failed. Check that PostgreSQL is running and the DB_* settings in your .env file are correct.",
  });
}

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error.message);
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the Expense Tracker API!" });
});

app.get("/api/expenses", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${expenseColumns} FROM expenses ORDER BY id ASC`
    );
    return res.json(result.rows);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});
app.get("/api/expenses/:id", async (req, res) => {
  const id = parseExpenseId(req.params.id);
  if (!id) return res.status(404).json({ message: "Expense not found." });

  try {
    const result = await pool.query(
      `SELECT ${expenseColumns} FROM expenses WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Expense not found." });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post("/api/expenses", async (req, res) => {
  const { errors, expense } = validateExpense(req.body || {});
  if (errors.length > 0) return res.status(400).json({ message: errors.join(" ") });

  try {
    const result = await pool.query(
      `INSERT INTO expenses (title, amount, category, date)
       VALUES ($1, $2, $3, $4)
       RETURNING ${expenseColumns}`,
      [expense.title, expense.amount, expense.category, expense.date]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  const id = parseExpenseId(req.params.id);
  if (!id) return res.status(404).json({ message: "Expense not found." });

  const { errors, expense } = validateExpense(req.body || {});
  if (errors.length > 0) return res.status(400).json({ message: errors.join(" ") });

  try {
    const result = await pool.query(
      `UPDATE expenses
       SET title = $1, amount = $2, category = $3, date = $4
       WHERE id = $5
       RETURNING ${expenseColumns}`,
      [expense.title, expense.amount, expense.category, expense.date, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Expense not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  const id = parseExpenseId(req.params.id);
  if (!id) return res.status(404).json({ message: "Expense not found." });

  try {
    const result = await pool.query(
      `DELETE FROM expenses WHERE id = $1 RETURNING ${expenseColumns}`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Expense not found." });
    return res.json({ message: "Expense deleted successfully.", expense: result.rows[0] });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.listen(port, () => {
  console.log(`Expense Tracker API running at http://localhost:${port}`);
  pool.query("SELECT 1")
    .then(() => console.log(`Connected to PostgreSQL database "${process.env.DB_NAME || "expense_tracker"}".`))
    .catch((error) => {
      console.error("Could not connect to PostgreSQL. Check the DB_* settings in your .env file and verify the database is running.");
      console.error("Connection detail:", error.message);
    });
});
