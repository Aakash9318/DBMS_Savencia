import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asAnalyst, createOrder, dashboard, loadReports, openDatabase, orderDetails, readSql } from '../db/database.mjs';


const db = await openDatabase();
after(() => db.close());

const draft = {
  customerId: 1, districtId: 2, method: 'wallet', discountCode: 'WELCOME10',
  items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 2 }]
};
const stock = async database => (await database.query('SELECT product_id, quantity FROM inventory ORDER BY product_id')).rows;
const cents = value => Math.round(Number(value) * 100);

test('seeded order totals, reports, and all four date ranges reconcile', async () => {
  const { rows: [seed] } = await db.query(`
    SELECT count(*)::int AS orders, count(*) FILTER (WHERE payment_status IS NULL)::int AS missing_payments,
           count(*) FILTER (WHERE payment_status IS NOT NULL AND payment_amount <> total)::int AS unbalanced,
           count(*) FILTER (WHERE placed_at > current_timestamp)::int AS future_orders
    FROM order_summary`);
  assert.equal(seed.orders, 566);
  assert.ok(seed.missing_payments > 0);
  assert.equal(seed.unbalanced, 0);
  assert.equal(seed.future_orders, 0);

  for (const days of [7, 30, 90, 0]) {
    const data = await dashboard(db, days);
    const paid = data.orders.filter(order => order.status === 'confirmed' && order.payment_status === 'captured');
    assert.equal(data.sales.orders, paid.length);
    assert.equal(data.sales.repeat_customers, data.customers.filter(customer => customer.orders >= 2).length);
    assert.equal(data.districts.reduce((total, district) => total + district.orders, 0), paid.length);
    const amount = paid.reduce((total, order) => total + cents(order.total), 0);
    assert.equal(cents(data.sales.revenue), amount);
    assert.equal(data.districts.reduce((total, district) => total + cents(district.revenue), 0), amount);
    assert.equal(data.trends.reduce((total, point) => total + cents(point.revenue), 0), amount);
    const products = data.products;
    assert.equal(products[0].rank, 1);
    assert(products.some(product => product.units === 0));
    assert.equal(products.reduce((sum, product) => sum + product.units, 0), paid.reduce((sum, order) => sum + order.item_count, 0));
  }

  const reports = await loadReports();
  assert.equal(reports.length, 10);
  for (const report of reports) {
    const result = await asAnalyst(db, tx => tx.query(report.sql));
    assert.ok(result.rows.length, report.id);
    if (report.id === 'best-sellers') {
      assert.equal(Number(result.rows[0].rank), 1);
      assert.equal(Number(result.rows.at(-1).units_sold), 0);
    }
  }
});

test('analyst can query approved views but cannot view emails or update stock', async () => {
  assert.ok((await asAnalyst(db, tx => tx.query('SELECT id, name FROM customers LIMIT 1'))).rows.length);
  await assert.rejects(asAnalyst(db, tx => tx.query('SELECT email FROM customers')), { code: '42501' });
  await assert.rejects(asAnalyst(db, tx => tx.query('UPDATE inventory SET quantity = 0')), { code: '42501' });
});

test('TCL savepoint demonstration restores stock', async () => {
  const before = await stock(db);
  const result = await db.exec(await readSql('transaction.sql'));
  assert.equal(result.find(entry => entry.rows[0]?.reserved_quantity)?.rows[0].reserved_quantity, before[0].quantity - 1);
  assert.deepEqual(await stock(db), before);
});

test('orders atomically reserve stock, snapshot line prices, and record payments and deliveries', async () => {
  const before = await stock(db);
  const overview = await dashboard(db, 30);
  const saved = await createOrder(db, draft);
  const { order, items } = await orderDetails(db, saved.id);
  assert.equal(saved.total, '492.30');
  assert.equal(order.subtotal, '547.00');
  assert.equal(order.discount_amount, '54.70');
  assert.equal(order.discount_code, 'WELCOME10');
  assert.equal(order.payment_status, 'captured');
  assert.equal(order.payment_method, 'wallet');
  assert.equal(order.district, 'Business Bay');
  assert.equal(order.delivery_status, 'queued');
  assert.equal(items.length, 2);
  const after = await stock(db);
  assert.equal(after[0].quantity, before[0].quantity - 1);
  assert.equal(after[1].quantity, before[1].quantity - 2);

  const updated = await dashboard(db, 30);
  assert.equal(updated.orders[0].id, saved.id);
  assert.equal(updated.sales.orders, overview.sales.orders + 1);
  assert.equal(cents(updated.sales.revenue), cents(overview.sales.revenue) + cents(saved.total));
  assert.equal(updated.districts[1].orders, overview.districts[1].orders + 1);
  await db.query('UPDATE products SET price = price + 1 WHERE id = 1');
  assert.equal((await orderDetails(db, saved.id)).items[0].unit_price, '249.00');
});

test('an out-of-stock second item rolls back the first reservation and the order', async () => {
  const before = await stock(db);
  const count = (await dashboard(db, 0)).orders.length;
  await assert.rejects(createOrder(db, {
    ...draft, items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 99 }]
  }), { status: 409 });
  assert.deepEqual(await stock(db), before);
  assert.equal((await dashboard(db, 0)).orders.length, count);
  await assert.rejects(createOrder(db, { ...draft, discountCode: 'SPRING20' }), { status: 400 });
  await assert.rejects(createOrder(db, { ...draft, items: [null] }), { status: 400 });
});

test('competing orders cannot oversell the same inventory', async () => {
  await db.query('UPDATE inventory SET quantity = 1 WHERE product_id = 13');
  const order = { ...draft, discountCode: '', items: [{ productId: 13, quantity: 1 }] };
  const results = await Promise.allSettled([createOrder(db, order), createOrder(db, order)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected')?.reason.status, 409);
  assert.equal((await stock(db)).at(-1).quantity, 0);
});

test('a file-backed database preserves changes across a restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'admap-test-'));
  let local;
  try {
    local = await openDatabase(directory);
    const saved = await createOrder(local, draft);
    await local.close();
    local = await openDatabase(directory);
    assert.equal((await orderDetails(local, saved.id)).order.total, saved.total);
    assert.equal((await dashboard(local, 0)).orders.length, 567);
  } finally {
    if (local && !local.closed) await local.close();
    await rm(directory, { recursive: true, force: true });
  }
});
