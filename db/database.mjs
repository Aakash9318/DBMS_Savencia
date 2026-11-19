import { readFile, mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const readSql = name => readFile(new URL(name, import.meta.url), 'utf8');

export async function openDatabase(dataDir = 'memory://') {
  if (dataDir !== 'memory://') await mkdir(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir);
  try {
    const { rows } = await db.query("SELECT to_regclass('commerce.orders') AS initialized");
    if (!rows[0].initialized) {
      const scripts = await Promise.all(['schema.sql', 'seed.sql', 'permissions.sql'].map(readSql));
      await db.transaction(async tx => {
        for (const sql of scripts) await tx.exec(sql);
      });
    }
    await db.exec("SET search_path = commerce, public; SET TIME ZONE 'Asia/Dubai';");
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export function asAnalyst(db, action) {
  return db.transaction(async tx => {
    await tx.exec('SET LOCAL ROLE admap_analyst');
    return action(tx);
  });
}

const period = '($1::integer = 0 OR placed_at >= current_date - ($1::integer - 1))';

export async function dashboard(db, days) {
  return asAnalyst(db, async tx => {
    const sales = await tx.query(`
      WITH selected AS (SELECT * FROM paid_orders WHERE ${period}),
        buyers AS (SELECT customer_id, count(*) AS orders FROM selected GROUP BY customer_id)
      SELECT coalesce(sum(revenue),0) AS revenue, count(*)::int AS orders,
             coalesce(avg(revenue),0) AS average,
             (SELECT count(*)::int FROM buyers WHERE orders >= 2) AS repeat_customers
      FROM selected`, [days]);

    const trends = await tx.query(`
      WITH first_day AS (
        SELECT CASE WHEN $1::int = 0 THEN coalesce(min(placed_at)::date, current_date)
                    ELSE current_date - ($1::int - 1) END AS day FROM paid_orders
      ), buckets AS (
        SELECT start::date AS day FROM first_day,
          generate_series(day::timestamp, current_date::timestamp,
            CASE WHEN $1::int IN (0, 90) THEN interval '7 days' ELSE interval '1 day' END) AS dates(start)
      )
      SELECT b.day::text, coalesce(sum(o.revenue),0) AS revenue
      FROM buckets b LEFT JOIN paid_orders o ON o.placed_at >= b.day AND
        o.placed_at < b.day + CASE WHEN $1::int IN (0,90) THEN 7 ELSE 1 END
      GROUP BY b.day ORDER BY b.day`, [days]);

    const products = await tx.query(`
      WITH sales AS (
        SELECT i.product_id, sum(i.quantity)::int AS units
        FROM order_items i JOIN paid_orders o ON o.id = i.order_id
        WHERE ${period} GROUP BY i.product_id
      ), catalog AS (
        SELECT p.*, coalesce(s.units, 0) AS units FROM product_stock p
        LEFT JOIN sales s ON s.product_id = p.id
      )
      SELECT dense_rank() OVER (ORDER BY units DESC)::int AS rank, catalog.*
      FROM catalog ORDER BY rank, product`, [days]);

    const customers = await tx.query(`
      SELECT c.id, c.name AS customer, count(o.id)::int AS orders, sum(o.revenue) AS spent,
             max(o.placed_at)::date::text AS last_order
      FROM customers c JOIN paid_orders o ON o.customer_id = c.id
      WHERE ${period} GROUP BY c.id, c.name
      ORDER BY orders DESC, spent DESC, c.id`, [days]);

    const orders = await tx.query(`
      SELECT id, customer, placed_at::date::text AS placed_on, subtotal, total, discount_code,
             discount_amount, payment_status, payment_method, district, delivery_status, status, item_count
      FROM order_summary WHERE ${period}
      ORDER BY placed_at DESC, id DESC`, [days]);

    const districts = await tx.query(`
      SELECT d.id, d.name, d.slug, count(o.id)::int AS orders, coalesce(sum(o.revenue),0) AS revenue
      FROM districts d LEFT JOIN (SELECT * FROM paid_orders WHERE ${period}) o ON o.district_id = d.id
      GROUP BY d.id ORDER BY d.id`, [days]);

    return {
      sales: sales.rows[0], trends: trends.rows, products: products.rows,
      customers: customers.rows, orders: orders.rows, districts: districts.rows
    };
  });
}

export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createOrder(db, input) {
  const { customerId, districtId, method, items, discountCode = '' } = input ?? {};
  const positiveId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  if (!positiveId(customerId) || !positiveId(districtId) || !['card', 'wallet'].includes(method)) {
    throw new RequestError('Choose a customer, delivery district, and payment method.');
  }
  if (!Array.isArray(items) || !items.length || items.length > 8 || items.some(item =>
    !positiveId(item?.productId) || !positiveId(item.quantity) || item.quantity > 99
  ) || new Set(items.map(item => item.productId)).size !== items.length) {
    throw new RequestError('Add 1–8 different products, with a quantity of 1–99 each.');
  }
  if (typeof discountCode !== 'string' || discountCode.length > 30) {
    throw new RequestError('Enter a valid discount code.');
  }
  const code = discountCode.trim().toUpperCase();
  const sortedItems = [...items].sort((left, right) => left.productId - right.productId);

  return db.transaction(async tx => {
    const { rows: [references] } = await tx.query(`
      SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1) AS customer,
             EXISTS(SELECT 1 FROM districts WHERE id = $2) AS district,
             (SELECT id FROM discounts WHERE active AND code = $3) AS discount_id`,
      [customerId, districtId, code]);
    if (!references.customer || !references.district) throw new RequestError('Customer or district was not found.');
    if (code && !references.discount_id) throw new RequestError('That discount code is unavailable.');

    const { rows: [{ id }] } = await tx.query(`
      INSERT INTO orders (customer_id, discount_id, status) VALUES ($1, $2, 'confirmed') RETURNING id`,
      [customerId, references.discount_id]);

    for (const item of sortedItems) {
      const parameters = [item.productId, item.quantity];
      const { rows } = await tx.query(`
        UPDATE inventory SET quantity = quantity - $2
        WHERE product_id = $1 AND quantity >= $2 RETURNING product_id`, parameters);
      if (!rows.length) {
        const { rows: [product] } = await tx.query('SELECT name FROM products WHERE id = $1', [item.productId]);
        throw new RequestError(product ? `Insufficient stock for ${product.name}.` : 'A product is unavailable.', 409);
      }
      await tx.query(`
        INSERT INTO order_items (product_id, quantity, order_id, unit_price)
        SELECT id, $2, $3, price FROM products WHERE id = $1`, [...parameters, id]);
    }

    await tx.query(`
      UPDATE orders o SET discount_amount = round(s.subtotal * d.percent_off / 100, 2)
      FROM order_summary s, discounts d WHERE o.id = $1 AND s.id = o.id AND d.id = o.discount_id`, [id]);
    await tx.query(`
      INSERT INTO payments (order_id, amount, method, status, paid_at)
      SELECT id, total, $2, 'captured', placed_at FROM order_summary WHERE id = $1`, [id, method]);
    await tx.query("INSERT INTO deliveries (order_id, district_id, status) VALUES ($1, $2, 'queued')", [id, districtId]);

    const { rows: [saved] } = await tx.query('SELECT id, total FROM order_summary WHERE id = $1', [id]);
    return saved;
  });
}

export async function orderOptions(db) {
  const { rows } = await db.query(`
    SELECT
      (SELECT json_agg(c ORDER BY c.name) FROM (SELECT id, name FROM customers) c) AS customers,
      (SELECT json_agg(p ORDER BY p.product) FROM (SELECT id, product, quantity FROM product_stock) p) AS products,
      (SELECT json_agg(d ORDER BY d.id) FROM (SELECT id, name FROM districts) d) AS districts,
      (SELECT json_agg(code ORDER BY code) FROM discounts WHERE active) AS discounts`);
  return rows[0];
}

export async function orderDetails(db, id) {
  return asAnalyst(db, async tx => {
    const { rows: [order] } = await tx.query(`
      SELECT id, customer, placed_at::date::text AS placed_on, subtotal, total, discount_code,
             discount_amount, payment_status, payment_method, district, delivery_status, status
      FROM order_summary WHERE id = $1`, [id]);
    if (!order) throw new RequestError('Order not found.', 404);
    const { rows: items } = await tx.query(`
      SELECT p.name AS product, i.quantity, i.unit_price, i.quantity * i.unit_price AS total
      FROM order_items i JOIN products p ON p.id = i.product_id
      WHERE i.order_id = $1 ORDER BY p.name`, [id]);
    return { order, items };
  });
}

export async function loadReports() {
  const sql = await readSql('analysis.sql');
  return sql.split('\n-- @query ').map(block => {
    const [header, ...lines] = block.replace(/^-- @query /, '').trim().split('\n');
    const [id, title, technique, description] = header.split(' | ');
    return { id, title, technique, description, sql: lines.join('\n').trim() };
  });
}
