let myChart = null;

// set today's date in the date input automatically
document.getElementById('date').valueAsDate = new Date();

// load all expenses when page first opens
window.onload = loadExpenses;

// ── core function — loads expenses for selected month ──────────────
function getSelectedMonth() {
  const val = document.getElementById('month-filter').value;
  if (val === 'all') return null;
  return val;
}

function loadExpenses() {
  const month = getSelectedMonth();
  const url   = month ? `/expenses/month/${month}` : '/expenses';

  fetch(url)
    .then(res => res.json())
    .then(data => {
      renderTable(data);
      updateTotal(data);
      loadChart();
    });
}

// ── called when dropdown changes ───────────────────────────────────
function filterByMonth() {
  const month   = getSelectedMonth();
  const countEl = document.getElementById('filter-count');
  const url     = month ? `/expenses/month/${month}` : '/expenses';

  fetch(url)
    .then(res => res.json())
    .then(data => {
      renderTable(data);
      updateTotal(data);
      loadChart();
      countEl.textContent = month ? data.length + ' expense(s) found' : '';

      // re-check budget automatically if budget is already set
      const budget = document.getElementById('budget-input').value;
      if (budget && budget > 0) checkBudget();
    });
}

// ── render table ───────────────────────────────────────────────────
function renderTable(expenses) {
  const tbody = document.getElementById('expense-table');
  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No expenses found</td></tr>';
    return;
  }
  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td>${e.id}</td>
      <td>${e.name}</td>
      <td class="fw-bold">₹${parseFloat(e.amount).toFixed(2)}</td>
      <td><span class="badge text-white badge-${e.category.toLowerCase()}">${e.category}</span></td>
      <td>${e.date}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteExpense(${e.id})">Delete</button></td>
    </tr>
  `).join('');
}

// ── update total card ──────────────────────────────────────────────
function updateTotal(expenses) {
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  document.getElementById('total-amount').textContent = '₹' + total.toFixed(2);
}

// ── add expense ────────────────────────────────────────────────────
function addExpense() {
  const name     = document.getElementById('name').value.trim();
  const amount   = document.getElementById('amount').value;
  const category = document.getElementById('category').value;
  const date     = document.getElementById('date').value;
  const msg      = document.getElementById('msg');

  // ── client side validation ────────────────────────────────
  if (!name) {
    showMsg('Name cannot be empty!', 'danger');
    document.getElementById('name').focus();
    return;
  }
  if (name.length < 2) {
    showMsg('Name must be at least 2 characters!', 'danger');
    document.getElementById('name').focus();
    return;
  }
  if (!amount) {
    showMsg('Amount cannot be empty!', 'danger');
    document.getElementById('amount').focus();
    return;
  }
  if (parseFloat(amount) <= 0) {
    showMsg('Amount must be greater than 0!', 'danger');
    document.getElementById('amount').focus();
    return;
  }
  if (parseFloat(amount) > 100000) {
    showMsg('Amount cannot exceed ₹1,00,000!', 'danger');
    document.getElementById('amount').focus();
    return;
  }
  if (!date) {
    showMsg('Please select a date!', 'danger');
    return;
  }
  // future date check — compare as strings to avoid timezone issues
const today    = new Date().toISOString().split('T')[0]; // gives "2026-03-19"
const selected = date; // already in "2026-03-19" format from input
if (selected > today) {
  showMsg('Date cannot be in the future!', 'danger');
  return;
}
  

  // ── all good — send to server ─────────────────────────────
  fetch('/add', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      name,
      amount  : parseFloat(amount),
      category,
      date
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      // server caught something client missed
      showMsg(data.error, 'danger');
      return;
    }
    showMsg('Expense added successfully!', 'success');
    document.getElementById('name').value   = '';
    document.getElementById('amount').value = '';
    loadExpenses();
    setTimeout(() => {
      document.getElementById('msg').textContent = '';
    }, 2000);
  });
}

// ── helper to show messages ───────────────────────────────────────
function showMsg(text, type) {
  const msg       = document.getElementById('msg');
  msg.textContent = text;
  msg.className   = `mt-2 fw-bold text-${type}`;
}

// ── delete expense ─────────────────────────────────────────────────
function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  fetch('/delete/' + id, { method: 'DELETE' })
    .then(() => {
      const month   = getSelectedMonth();
      const countEl = document.getElementById('filter-count');
      const url     = month ? `/expenses/month/${month}` : '/expenses';

      fetch(url)
        .then(res => res.json())
        .then(data => {
          renderTable(data);
          updateTotal(data);
          loadChart();
          // update count only if a month is selected
          if (month) {
            countEl.textContent = data.length + ' expense(s) found';
          } else {
            countEl.textContent = '';
          }
          // re-check budget if it was already set
          const budget = document.getElementById('budget-input').value;
          if (budget && budget > 0) checkBudget();
        });
    });
}

// ── chart ──────────────────────────────────────────────────────────
function loadChart() {
  const month = getSelectedMonth();
  const url   = month ? `/expenses/month/${month}` : '/expenses';

  fetch(url)
    .then(res => res.json())
    .then(data => {
      // group by category manually
      const grouped = {};
      data.forEach(e => {
        grouped[e.category] = (grouped[e.category] || 0) + parseFloat(e.amount);
      });

      const labels = Object.keys(grouped);
      const values = Object.values(grouped);
      const colors = ['#28a745','#17a2b8','#dc3545','#fd7e14','#6f42c1','#6c757d'];

      if (myChart) myChart.destroy();

      myChart = new Chart(document.getElementById('myChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label          : 'Amount Spent (₹)',
            data           : values,
            backgroundColor: colors.slice(0, labels.length),
            borderRadius   : 6
          }]
        },
        options: {
          responsive: true,
          plugins   : { legend: { display: false } },
          scales    : { y: { beginAtZero: true } }
        }
      });
    });
}

// ── budget check ───────────────────────────────────────────────────
function checkBudget() {
  const budget = document.getElementById('budget-input').value;
  if (!budget || budget <= 0) {
    alert('Please enter a valid budget amount!');
    return;
  }

  const month = getSelectedMonth();
  const now   = new Date();
  const currentMonth = now.getFullYear() + '-' +
                       String(now.getMonth() + 1).padStart(2, '0');
  const finalMonth = month || currentMonth;

  fetch(`/budget-status?budget=${budget}&month=${finalMonth}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById('budget-section').style.display = 'block';
      document.getElementById('budget-spent').textContent = '₹' + data.spent.toFixed(2);
      document.getElementById('budget-limit').textContent  = '₹' + data.budget.toFixed(2);

      const bar     = document.getElementById('budget-bar');
      const percent = Math.min(data.percent, 100);
      bar.style.width = percent + '%';
      bar.textContent = data.percent + '%';
      bar.className   = 'progress-bar';

      if (data.status === 'danger') {
        bar.classList.add('bg-danger');
      } else if (data.status === 'warning') {
        bar.classList.add('bg-warning');
      } else {
        bar.classList.add('bg-success');
      }

      const alertBox = document.getElementById('budget-alert');
      alertBox.style.display = 'block';

      if (data.status === 'danger') {
        alertBox.className   = 'alert alert-danger mb-0 fw-bold';
        alertBox.textContent = '🚨 Over budget! You have exceeded your monthly limit.';
      } else if (data.status === 'warning') {
        alertBox.className   = 'alert alert-warning mb-0 fw-bold';
        alertBox.textContent = '⚠️ Warning! You have used ' + data.percent + '% of your budget.';
      } else {
        alertBox.className   = 'alert alert-success mb-0 fw-bold';
        alertBox.textContent = '✅ On track! You have used ' + data.percent + '% of your budget.';
      }
    });
}