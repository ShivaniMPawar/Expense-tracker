from flask import Flask, jsonify, request, render_template  # add render_template
from flask import Flask, jsonify, request
import sqlite3
from datetime import date

app = Flask(__name__)
DB = "expenses.db"

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row  # lets us return rows as dicts
    return conn

def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name     TEXT    NOT NULL,
            amount   REAL    NOT NULL,
            category TEXT    NOT NULL,
            date     TEXT    DEFAULT CURRENT_DATE
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/')
def home():
    return render_template('index.html')  # change this line

@app.route('/expenses', methods=['GET'])
def get_expenses():
    conn = get_db()
    expenses = conn.execute("SELECT * FROM expenses ORDER BY date DESC").fetchall()
    conn.close()
    return jsonify([dict(e) for e in expenses])

@app.route('/add', methods=['POST'])
def add_expense():
    data = request.json

    # ── server side validation ──────────────────────────────
    name     = str(data.get('name', '')).strip()
    amount   = data.get('amount', None)
    category = str(data.get('category', '')).strip()
    date_val = data.get('date', str(date.today()))

    # name checks
    if not name:
        return jsonify({"error": "Name cannot be empty!"}), 400
    if len(name) < 2:
        return jsonify({"error": "Name must be at least 2 characters!"}), 400

    # amount checks
    if amount is None or amount == '':
        return jsonify({"error": "Amount cannot be empty!"}), 400
    try:
        amount = float(amount)
    except ValueError:
        return jsonify({"error": "Amount must be a number!"}), 400
    if amount <= 0:
        return jsonify({"error": "Amount must be greater than 0!"}), 400
    if amount > 100000:
        return jsonify({"error": "Amount cannot exceed ₹1,00,000!"}), 400

    # date check — no future dates
    from datetime import datetime
    try:
        expense_date = datetime.strptime(date_val, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format!"}), 400
    if expense_date > date.today():
        return jsonify({"error": "Date cannot be in the future!"}), 400

    # ── all good — save to db ───────────────────────────────
    conn = get_db()
    conn.execute(
        "INSERT INTO expenses (name, amount, category, date) VALUES (?, ?, ?, ?)",
        (name, amount, category, str(expense_date))
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Expense added successfully!"})

@app.route('/delete/<int:id>', methods=['DELETE'])
def delete_expense(id):
    conn = get_db()
    conn.execute("DELETE FROM expenses WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted!"})
@app.route('/expenses/month/<string:month>', methods=['GET'])
def get_by_month(month):
    conn = get_db()
    expenses = conn.execute(
        "SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC",
        (month,)
    ).fetchall()
    conn.close()
    return jsonify([dict(e) for e in expenses])

@app.route('/summary', methods=['GET'])
def summary():
    conn = get_db()
    rows = conn.execute(
        "SELECT category, SUM(amount) as total FROM expenses GROUP BY category"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/budget-status', methods=['GET'])
def budget_status():
    budget = request.args.get('budget', 0, type=float)
    month  = request.args.get('month', str(date.today())[:7])
    
    conn = get_db()
    
    # debug — let's see what month is being received
    print(f"DEBUG: month received = {month}")
    print(f"DEBUG: budget received = {budget}")
    
    row = conn.execute(
        "SELECT SUM(amount) as total FROM expenses WHERE strftime('%Y-%m', date) = ?",
        (month,)
    ).fetchone()
    conn.close()
    
    spent   = row['total'] or 0
    percent = (spent / budget * 100) if budget > 0 else 0
    
    # debug — see what spent is calculated
    print(f"DEBUG: spent = {spent}")
    
    return jsonify({
        "spent"  : spent,
        "budget" : budget,
        "percent": round(percent, 1),
        "status" : "danger" if percent >= 100 else "warning" if percent >= 80 else "safe",
        "month"  : month  # send month back so we can see it in browser
    })

if __name__ == '__main__':
    init_db()  # creates expenses.db automatically on first run
    app.run(debug=True)
