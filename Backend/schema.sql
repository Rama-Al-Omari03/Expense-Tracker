CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(20) NOT NULL CHECK (category IN ('Food', 'Transport', 'Bills', 'Entertainment', 'Other')),
  date DATE NOT NULL
);

INSERT INTO expenses (title, amount, category, date) VALUES
  ('Groceries', 42.75, 'Food', CURRENT_DATE - 1),
  ('Bus pass', 25.00, 'Transport', CURRENT_DATE - 3),
  ('Electricity bill', 68.40, 'Bills', CURRENT_DATE - 6),
  ('Movie night', 18.50, 'Entertainment', CURRENT_DATE - 8),
  ('Notebook', 7.99, 'Other', CURRENT_DATE - 10);
