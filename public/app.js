import { api, aed, dateLabel, escapeHtml as e, icon, number, orderLabel, periodSelect, periods, roundAed } from './ui.js';
import { revenueChart } from './chart.js';
import { cityPage, mountCity } from './city.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#order-dialog');
const nav = {
  overview: ['Overview', 'overview'],
  orders: ['Orders', 'orders'],
  customers: ['Customers', 'customers'],
  products: ['Products', 'products'],
  sql: ['SQL Lab', 'sql']
};
const headings = {
  overview: ['Commerce overview', 'Track orders, payments, and customer activity.'],
  orders: ['Orders', 'Review payments and deliveries or create a demo order.'],
  customers: ['Customers', 'See who comes back and how much they spend.'],
  products: ['Products', 'Compare sales rankings and check available inventory.'],
  sql: ['SQL Lab', 'Explore the PostgreSQL queries behind the capstone.']
};
let current, snapshot, city, disposeChart, reports, selectedReport, reportRequest = 0, activeRequest = 0;
let days = 30;
let loading = false;
let loadError = '';
let filters = { search: '', status: 'all', page: 1 };
const pageSize = 12;

const announce = message => { document.querySelector('#announcement').textContent = message; };
const route = () => {
  const value = location.hash.slice(1);
  return Object.hasOwn(nav, value) || value === 'city' ? value : 'overview';
};
const badge = status => status
  ? `<span class="status status-${status.replace(' ', '-')}">${e(status)}</span>`
  : '<span class="muted">—</span>';
const orderButton = (label = 'New order') => `<button class="primary-button" type="button" data-new-order>${icon('plus', 17)}${label}</button>`;
const skeleton = '<div class="panel placeholder" role="status">Loading commerce data…</div>';

function layout(page) {
  const [heading, description] = headings[page];
  return `
    <aside class="sidebar">
      <a href="#overview" class="brand" aria-label="ADMAP Commerce overview"><span class="brand-mark">${icon('logo', 22)}</span><span>ADMAP<small>Commerce Analytics</small></span></a>
      <div class="sidebar-section">WORKSPACE</div>
      <nav class="sidebar-nav" aria-label="Commerce dashboard">
        ${Object.entries(nav).map(([key, [label, glyph]]) => `<a href="#${key}" ${page === key ? 'aria-current="page"' : ''}>${icon(glyph, 17)}${label}</a>`).join('')}
      </nav>
      <div class="sidebar-section city-section">CITY</div>
      <nav class="sidebar-nav" aria-label="City dashboard"><a href="#city">${icon('city', 17)} Dubai city</a></nav>
      <div class="sidebar-foot">${icon('db', 19)}<div><strong>PostgreSQL</strong><span>Synthetic demo data</span></div></div>
    </aside>
    <div class="workspace">
      <header class="workspace-top">
        <span class="breadcrumb">DBMS dashboard <span>/</span> <strong>${nav[page][0]}</strong></span>
        <a class="top-city-link" href="#city">${icon('map', 16)} Dubai city</a>
      </header>
      <main class="content">
        <div class="page-heading">
          <div><h1>${heading}</h1><p>${description}</p></div>
          <div class="heading-actions">${page !== 'sql' ? periodSelect(days) : ''}${page === 'orders' ? orderButton() : ''}</div>
        </div>
        <div id="content-body" ${page === 'sql' ? '' : 'aria-busy="true"'}></div>
      </main>
    </div>`;
}

function navigate() {
  const next = route();
  if (current === next) return;
  filters = { search: '', status: 'all', page: 1 };
  disposeChart?.();
  disposeChart = undefined;
  city?.dispose();
  city = undefined;
  current = next;
  document.body.classList.toggle('city-page', current === 'city');
  document.title = `ADMAP | ${current === 'city' ? 'Dubai' : nav[current][0]}`;
  app.innerHTML = next === 'city' ? cityPage(days) : layout(next);
  if (next === 'city') city = mountCity(app.querySelector('#city-stage'));
  if (next === 'sql') void showReports();
  else renderData();
  window.scrollTo(0, 0);
}

async function loadDashboard() {
  const request = ++activeRequest;
  loading = true;
  loadError = '';
  const body = document.querySelector('#content-body');
  if (current !== 'sql') body?.setAttribute('aria-busy', 'true');
  try {
    const result = await api(`/api/dashboard?days=${days}`);
    if (request !== activeRequest) return;
    snapshot = result;
    announce(`Commerce data updated for ${periods[days].toLowerCase()}.`);
  } catch (error) {
    if (request !== activeRequest) return;
    loadError = error.message;
  }
  loading = false;
  if (current !== 'sql') renderData();
}

function renderData() {
  if (loading || !snapshot || loadError) {
    if (current === 'city') {
      if (loadError) city.showError(loadError);
    } else {
      const body = document.querySelector('#content-body');
      body.setAttribute('aria-busy', String(loading));
      body.innerHTML = loadError
        ? `<div class="panel placeholder" role="alert">${e(loadError)} <button class="text-button" data-retry>Retry</button></div>`
        : skeleton;
    }
    return;
  }
  if (current === 'city') {
    city.update(snapshot.districts);
    return;
  }
  disposeChart?.();
  disposeChart = undefined;
  const body = document.querySelector('#content-body');
  body.setAttribute('aria-busy', 'false');
  body.innerHTML = current === 'overview' ? overview(snapshot) : tablePage(current);
  if (current === 'overview') disposeChart = revenueChart(body.querySelector('.revenue-chart'), snapshot.trends);
  else renderRows();
}

function overview(data) {
  const { sales, orders, products, trends } = data;
  const cards = [
    ['Net revenue', roundAed(sales.revenue), 'Captured payments after discounts', 'money', 'teal'],
    ['Paid orders', number.format(sales.orders), 'Confirmed and paid', 'orders', 'blue'],
    ['Repeat customers', number.format(sales.repeat_customers), 'Two or more paid orders', 'customers', 'plum'],
    ['Average order value', aed(sales.average), 'Per paid order', 'average', 'gold']
  ];
  const top = products.filter(product => product.units > 0).slice(0, 3);
  return `
    <div class="metric-grid">${cards.map(([label, value, sub, glyph, tone]) => `
      <section class="panel metric">
        <span class="metric-icon tone-${tone}">${icon(glyph, 19)}</span>
        <div><h2>${label}</h2><strong>${value}</strong><p>${sub}</p></div>
      </section>`).join('')}</div>
    <div class="insight-grid">
      <section class="panel revenue-panel">
        <div class="panel-heading"><div><h2>Revenue over time</h2><p>Captured payments · ${[0, 90].includes(days) ? 'Weekly' : 'Daily'}</p></div><span class="chart-unit">AED</span></div>
        <div class="revenue-chart">
          <canvas role="img" aria-label="Captured revenue by date. Values are available below."></canvas>
          <span class="chart-tip" hidden></span>
        </div>
        <details class="sr-only chart-values">
          <summary>Show revenue values</summary>
          <ul>${trends.map(row => `<li>${dateLabel(row.day)} · ${aed(row.revenue)}</li>`).join('')}</ul>
        </details>
      </section>
      <section class="panel products-panel">
        <div class="panel-heading"><div><h2>Best sellers</h2><p>Ranked by units sold</p></div><a class="text-button" href="#products">All products</a></div>
        <div class="mini-products">${top.length ? top.map(product => `
          <div class="mini-product">
            <span class="product-rank">${product.rank}</span><div><strong>${e(product.product)}</strong><span>${e(product.category)}</span></div><b>${number.format(product.units)} <small>units</small></b>
            <div class="unit-track"><span style="width:${100 * product.units / top[0].units}%"></span></div>
          </div>`).join('') : '<p class="empty-text">No product sales in this period.</p>'}</div>
      </section>
    </div>
    <section class="panel recent-panel">
      <div class="panel-heading"><div><h2>Recent orders</h2><p>Latest activity across all payment statuses</p></div><a class="text-button" href="#orders">All orders</a></div>
      ${orderTable(orders.slice(0, 5), false)}
    </section>`;
}

const emptyRow = columns => `<tr><td colspan="${columns}" class="empty-cell">No records match this view.</td></tr>`;
function orderTable(rows, full) {
  return `<div class="table-scroll"><table>
    <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th>${full ? '<th>Delivery district</th>' : ''}<th class="align-right">Total</th></tr></thead>
    <tbody>${rows.map(row => `<tr>
      <td><button type="button" class="order-id" data-order-id="${row.id}">${orderLabel(row.id)}</button></td>
      <td>${e(row.customer)}</td><td class="muted">${dateLabel(row.placed_on)}</td><td>${badge(row.payment_status)}</td>
      ${full ? `<td>${e(row.district ?? '—')}</td>` : ''}<td class="align-right money-cell">${aed(row.total)}</td>
    </tr>`).join('') || emptyRow(full ? 6 : 5)}</tbody></table></div>`;
}

function customerTable(rows) {
  return `<div class="table-scroll"><table>
    <thead><tr><th>Customer</th><th>Type</th><th>Paid orders</th><th>Last order</th><th class="align-right">Net spend</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td class="emphasis">${e(row.customer)}</td>
      <td>${badge(row.orders >= 2 ? 'repeat' : 'one-time')}</td><td>${number.format(row.orders)}</td>
      <td class="muted">${dateLabel(row.last_order)}</td><td class="align-right money-cell">${aed(row.spent)}</td></tr>`).join('') || emptyRow(5)}
    </tbody></table></div>`;
}

function productTable(rows) {
  return `<div class="table-scroll"><table>
    <thead><tr><th>Rank</th><th>Product</th><th>SKU</th><th>Units sold</th><th>In stock</th><th class="align-right">Price</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td class="muted">${row.units ? row.rank : '—'}</td><td><b>${e(row.product)}</b><small class="cell-sub">${e(row.category)}</small></td>
      <td class="muted">${e(row.sku)}</td><td>${number.format(row.units)}</td><td>${number.format(row.quantity)}${row.quantity <= row.reorder_level ? ` ${badge('low stock')}` : ''}</td>
      <td class="align-right money-cell">${aed(row.price)}</td></tr>`).join('') || emptyRow(6)}
    </tbody></table></div>`;
}

const tableConfig = {
  orders: {
    options: [['all', 'All payments'], ['captured', 'Captured'], ['pending', 'Pending'], ['failed', 'Failed'], ['missing', 'No payment']],
    search: row => `${orderLabel(row.id)} ${row.customer} ${row.district ?? ''}`,
    match: (row, value) => (row.payment_status ?? 'missing') === value,
    template: rows => orderTable(rows, true)
  },
  customers: {
    options: [['all', 'All customers'], ['repeat', 'Repeat'], ['one-time', 'One-time']],
    search: row => row.customer,
    match: (row, value) => (row.orders >= 2 ? 'repeat' : 'one-time') === value,
    template: customerTable
  },
  products: {
    options: [['all', 'All stock levels'], ['low', 'Low stock'], ['healthy', 'Above reorder level']],
    search: row => `${row.product} ${row.sku} ${row.category}`,
    match: (row, value) => (row.quantity <= row.reorder_level ? 'low' : 'healthy') === value,
    template: productTable
  }
};

function tablePage(page) {
  const options = tableConfig[page].options;
  return `<section class="panel records-panel">
    <div class="table-toolbar">
      <label class="search-field">${icon('search', 17)}<input aria-label="Search ${page}" placeholder="Search ${page}" data-filter-search value="${e(filters.search)}"></label>
      <label class="filter-select"><select data-filter-status aria-label="Filter ${page}">${options.map(([value, label]) =>
        `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select>${icon('chevron', 14)}</label>
    </div>
    <div id="record-data"></div><div id="pagination" class="pagination"></div>
  </section>`;
}

function renderRows() {
  const config = tableConfig[current];
  if (!config || !snapshot || !document.querySelector('#record-data')) return;
  const query = filters.search.toLowerCase().trim();
  const results = snapshot[current].filter(row =>
    (filters.status === 'all' || config.match(row, filters.status)) && config.search(row).toLowerCase().includes(query));
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  filters.page = Math.max(1, Math.min(filters.page, pageCount));
  const index = (filters.page - 1) * pageSize;
  document.querySelector('#record-data').innerHTML = config.template(results.slice(index, index + pageSize));
  document.querySelector('#pagination').innerHTML = `<span>${results.length ? `${index + 1}–${Math.min(index + pageSize, results.length)} of ${results.length}` : '0 results'}</span>
    <div><button type="button" class="outline-button" data-page="-1" ${filters.page === 1 ? 'disabled' : ''}>Previous</button>
    <button type="button" class="outline-button" data-page="1" ${filters.page === pageCount ? 'disabled' : ''}>Next</button></div>`;
}

async function showReports() {
  let body = document.querySelector('#content-body');
  body.innerHTML = '<div class="panel placeholder" role="status">Loading SQL reports…</div>';
  try {
    reports ??= await api('/api/reports');
  } catch (error) {
    if (current === 'sql') body.innerHTML = `<div class="panel placeholder" role="alert">${e(error.message)} <button class="text-button" data-retry-sql>Retry</button></div>`;
    return;
  }
  if (current !== 'sql') return;
  body = document.querySelector('#content-body');
  selectedReport = reports.find(report => report.id === selectedReport?.id) ?? reports[0];
  body.innerHTML = `<div class="sql-grid">
    <section class="panel sql-list"><h2>Query library</h2><div class="sql-list-entries">
      ${reports.map(report => `<button type="button" class="query-button" data-report="${e(report.id)}" aria-pressed="false">
      <b>${e(report.title)}</b><span>${e(report.technique)}</span></button>`).join('')}
    </div></section><div class="sql-main" id="selected-report"></div>
  </div>`;
  showQuery(selectedReport.id);
}

function showQuery(id) {
  selectedReport = reports.find(report => report.id === id);
  ++reportRequest;
  for (const button of app.querySelectorAll('[data-report]')) {
    button.setAttribute('aria-pressed', String(button.dataset.report === id));
  }
  document.querySelector('#selected-report').innerHTML = `
    <section class="panel"><div class="panel-heading"><div><h2>${e(selectedReport.title)}</h2><p>${e(selectedReport.description)}</p></div>
      <button class="primary-button" type="button" data-run>${icon('play', 16)} Run query</button></div>
      <pre class="sql-code"><code>${e(selectedReport.sql)}</code></pre>
    </section>
    <section class="panel"><div class="panel-heading"><div><h2>Results</h2><p>Read-only preview · Up to 50 rows</p></div></div>
      <div id="sql-results" aria-live="polite"><p class="empty-text">Run the query to view its results.</p></div>
    </section>`;
}

async function runQuery(button) {
  const id = selectedReport.id;
  const request = ++reportRequest;
  const result = document.querySelector('#sql-results');
  button.disabled = true;
  result.innerHTML = '<p class="empty-text">Running query…</p>';
  try {
    const data = await api(`/api/reports/${id}`);
    if (request !== reportRequest || current !== 'sql') return;
    result.innerHTML = `<div class="table-scroll"><table>
      <thead><tr>${data.columns.map(key => `<th>${e(key.replaceAll('_', ' '))}</th>`).join('')}</tr></thead>
      <tbody>${data.rows.map(row => `<tr>${data.columns.map(key => `<td>${e(row[key] ?? '—')}</td>`).join('')}</tr>`).join('') || emptyRow(data.columns.length)}</tbody>
      </table></div><p class="result-count">${data.truncated ? 'Showing the first 50 rows.' : `${data.rows.length} row${data.rows.length === 1 ? '' : 's'}`}</p>`;
  } catch (error) {
    result.innerHTML = `<p class="empty-text" role="alert">${e(error.message)}</p>`;
  } finally {
    button.disabled = false;
  }
}

function dialogHeading(label, text) {
  return `<div class="dialog-heading"><div><h2 id="order-heading">${label}</h2><p>${text}</p></div>
    <button class="icon-button" type="button" data-close aria-label="Close">${icon('close', 20)}</button></div>`;
}
let orderProducts = [];

function addLine() {
  const items = dialog.querySelector('.order-lines');
  if (items.children.length >= 8) return;
  items.insertAdjacentHTML('beforeend', `<div class="order-line">
    <label>Product<select name="product" required><option value="">Choose a product</option>
      ${orderProducts.map(row => `<option value="${row.id}" ${row.quantity ? '' : 'disabled'}>${e(row.product)} · ${row.quantity} available</option>`).join('')}
    </select></label>
    <label>Quantity<input type="number" name="quantity" min="1" max="99" value="1" required></label>
    <button class="icon-button" type="button" data-remove aria-label="Remove item">${icon('close', 16)}</button></div>`);
  syncLines();
  return items.lastElementChild.querySelector('select');
}

function syncLines() {
  const lines = [...dialog.querySelectorAll('.order-line')];
  for (const line of lines) line.querySelector('[data-remove]').disabled = lines.length === 1;
  dialog.querySelector('[data-add-line]').disabled = lines.length >= 8;
}

async function newOrder() {
  dialog.innerHTML = dialogHeading('New order', 'Record a paid order for the demo store.') + '<p class="dialog-loading" role="status">Loading order options…</p>';
  dialog.showModal();
  const loadingMessage = dialog.querySelector('.dialog-loading');
  try {
    const { customers, products, districts, discounts } = await api('/api/order-options');
    if (!dialog.open || !loadingMessage.isConnected) return;
    orderProducts = products;
    dialog.innerHTML = dialogHeading('New order', 'Record a paid order for the demo store.') + `
      <form id="new-order-form">
        <div class="form-grid">
          <label>Customer<select name="customer" required><option value="">Choose a customer</option>${customers.map(row => `<option value="${row.id}">${e(row.name)}</option>`).join('')}</select></label>
          <label>Delivery district<select name="district" required><option value="">Choose a district</option>${districts.map(row => `<option value="${row.id}">${e(row.name)}</option>`).join('')}</select></label>
        </div>
        <div class="order-lines"></div>
        <button class="text-button add-line" type="button" data-add-line>${icon('plus', 16)} Add another item</button>
        <div class="form-grid">
          <label>Payment method<select name="method" required><option value="card">Card</option><option value="wallet">Wallet</option></select></label>
          <label>Discount<select name="discount"><option value="">No discount</option>${discounts.map(code => `<option value="${e(code)}">${e(code)}</option>`).join('')}</select></label>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="dialog-footer"><button class="outline-button" type="button" data-close>Cancel</button>
        <button class="primary-button" type="submit">Create paid order</button></div>
      </form>`;
    addLine();
    dialog.querySelector('[name=customer]').focus();
  } catch (error) {
    loadingMessage.textContent = error.message;
  }
}

async function submitOrder(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const payload = {
    customerId: Number(data.get('customer')), districtId: Number(data.get('district')),
    method: data.get('method'), discountCode: data.get('discount'),
    items: data.getAll('product').map((id, index) => ({
      productId: Number(id), quantity: Number(data.getAll('quantity')[index])
    }))
  };
  const submit = form.querySelector('[type=submit]');
  const errorNode = form.querySelector('.form-error');
  submit.disabled = true;
  errorNode.hidden = true;
  try {
    const saved = await api('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (form.isConnected && dialog.open) dialog.close();
    filters = { search: '', status: 'all', page: 1 };
    await loadDashboard();
    showNotice(`Order ${orderLabel(saved.id)} created · ${aed(saved.total)}`);
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

async function showOrder(id) {
  dialog.innerHTML = dialogHeading(`Order ${orderLabel(id)}`, 'Payment, items, and delivery details.') + '<p class="dialog-loading" role="status">Loading order…</p>';
  dialog.showModal();
  const loadingMessage = dialog.querySelector('.dialog-loading');
  try {
    const { order, items } = await api(`/api/orders/${id}`);
    if (!dialog.open || !loadingMessage.isConnected) return;
    dialog.innerHTML = dialogHeading(`Order ${orderLabel(id)}`, `${e(order.customer)} · ${dateLabel(order.placed_on)}`) + `
      <div class="order-detail">
        <dl class="detail-grid">
          <div><dt>Order status</dt><dd>${badge(order.status)}</dd></div>
          <div><dt>Payment</dt><dd>${badge(order.payment_status)} ${order.payment_method ? e(order.payment_method) : ''}</dd></div>
          <div><dt>Delivery district</dt><dd>${e(order.district ?? '—')}</dd></div>
          <div><dt>Delivery status</dt><dd>${badge(order.delivery_status)}</dd></div>
        </dl>
        <div class="table-scroll"><table>
          <thead><tr><th>Item</th><th>Qty</th><th class="align-right">Amount</th></tr></thead>
          <tbody>${items.map(item => `<tr><td>${e(item.product)}</td><td>${item.quantity}</td><td class="align-right">${aed(item.total)}</td></tr>`).join('') || emptyRow(3)}</tbody>
        </table></div>
        <dl class="order-totals"><div><dt>Subtotal</dt><dd>${aed(order.subtotal)}</dd></div>
          ${order.discount_code ? `<div><dt>Discount · ${e(order.discount_code)}</dt><dd>−${aed(order.discount_amount)}</dd></div>` : ''}
          <div class="total"><dt>Total</dt><dd>${aed(order.total)}</dd></div>
        </dl>
      </div>`;
  } catch (error) {
    loadingMessage.textContent = error.message;
  }
}

function showNotice(message) {
  document.querySelector('.notice')?.remove();
  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.setAttribute('role', 'status');
  notice.textContent = message;
  document.body.append(notice);
  setTimeout(() => notice.remove(), 4300);
}

window.addEventListener('hashchange', navigate);
app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-new-order')) void newOrder();
  if (button.hasAttribute('data-retry')) void loadDashboard();
  if (button.hasAttribute('data-retry-sql')) void showReports();
  if (button.dataset.orderId) void showOrder(Number(button.dataset.orderId));
  if (button.dataset.report) showQuery(button.dataset.report);
  if (button.hasAttribute('data-run')) void runQuery(button);
  if (button.dataset.page) {
    const delta = Number(button.dataset.page);
    filters.page += delta;
    renderRows();
    const nextButton = app.querySelector(`[data-page="${delta}"]:not(:disabled)`) ?? app.querySelector('[data-page]:not(:disabled)');
    nextButton?.focus();
  }
});
app.addEventListener('input', event => {
  if (!event.target.hasAttribute('data-filter-search')) return;
  filters.search = event.target.value;
  filters.page = 1;
  renderRows();
});
app.addEventListener('change', event => {
  if (event.target.id === 'date-range') {
    days = Number(event.target.value);
    filters.page = 1;
    void loadDashboard();
  } else if (event.target.hasAttribute('data-filter-status')) {
    filters.status = event.target.value;
    filters.page = 1;
    renderRows();
  }
});
dialog.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.hasAttribute('data-close')) dialog.close();
  if (button?.hasAttribute('data-add-line')) addLine()?.focus();
  if (button?.hasAttribute('data-remove')) {
    button.closest('.order-line').remove();
    syncLines();
    dialog.querySelector('[data-add-line]').focus();
  }
});
dialog.addEventListener('submit', submitOrder);

navigate();
void loadDashboard();
