-- @query order-payments | Orders with payments and deliveries | Inner + outer joins | Combine order headers with customers, payment records, and delivery status. Pending orders can have no payment record.
SELECT o.id AS order_id, c.name AS customer, o.status, o.payment_status,
       o.payment_amount, d.name AS district, o.delivery_status
FROM order_summary o
INNER JOIN customers c ON c.id = o.customer_id
LEFT JOIN districts d ON d.id = o.district_id
ORDER BY o.placed_at DESC, o.id DESC;

-- @query referrals | Customer referrals | Self join | Match each referred customer to the customer who referred them.
SELECT c.name AS customer, ref.name AS referred_by
FROM customers c JOIN customers ref ON ref.id = c.referred_by
ORDER BY ref.name, c.name;

-- @query repeat-customers | Repeat customers | CTE + HAVING | Count customers with at least two confirmed, paid orders.
WITH purchase_history AS (
    SELECT customer_id, count(*) AS paid_orders, sum(revenue) AS total_spent
    FROM paid_orders GROUP BY customer_id HAVING count(*) >= 2
)
SELECT c.name AS customer, h.paid_orders, h.total_spent
FROM purchase_history h JOIN customers c ON c.id = h.customer_id
ORDER BY h.paid_orders DESC, h.total_spent DESC, c.id;

-- @query best-sellers | Best-selling products | CTE + DENSE_RANK | Rank the catalog by paid units sold. Products with the same unit count share a rank.
WITH sales AS (
    SELECT i.product_id, sum(i.quantity) AS units_sold
    FROM order_items i JOIN paid_orders o ON o.id = i.order_id
    GROUP BY i.product_id
)
SELECT dense_rank() OVER (ORDER BY coalesce(s.units_sold, 0) DESC) AS rank,
       p.sku, p.name AS product, coalesce(s.units_sold, 0) AS units_sold
FROM products p LEFT JOIN sales s ON s.product_id = p.id
ORDER BY rank, p.name;

-- @query larger-payments | Above-average payments | Nested subquery | Find confirmed, captured payments greater than the mean captured payment.
SELECT p.id AS order_id, c.name AS customer, p.revenue AS captured_amount
FROM paid_orders p JOIN customers c ON c.id = p.customer_id
WHERE p.revenue > (SELECT avg(revenue) FROM paid_orders)
ORDER BY p.revenue DESC, p.id;

-- @query category-pricing | Items above category average | Correlated subquery | Compare each product's price with the mean of its own category.
SELECT c.name AS category, p.name AS product, p.price
FROM products p JOIN categories c ON c.id = p.category_id
WHERE p.price > (SELECT avg(peer.price) FROM products peer WHERE peer.category_id = p.category_id)
ORDER BY c.name, p.price DESC, p.id;

-- @query active-districts | Customers in Downtown or Business Bay | UNION | Return customers with a paid delivery in either district, with duplicates removed.
WITH buyers AS (
    SELECT customer_id FROM paid_orders WHERE district_id = (SELECT id FROM districts WHERE slug = 'downtown')
    UNION
    SELECT customer_id FROM paid_orders WHERE district_id = (SELECT id FROM districts WHERE slug = 'business-bay')
)
SELECT c.id AS customer_id, c.name AS customer FROM buyers JOIN customers c ON c.id = buyers.customer_id
ORDER BY c.name, c.id;

-- @query overlap | Customers in both districts | INTERSECT | Find customers with paid deliveries in both Downtown Dubai and Business Bay.
WITH buyers AS (
    SELECT customer_id FROM paid_orders WHERE district_id = (SELECT id FROM districts WHERE slug = 'downtown')
    INTERSECT
    SELECT customer_id FROM paid_orders WHERE district_id = (SELECT id FROM districts WHERE slug = 'business-bay')
)
SELECT c.id AS customer_id, c.name AS customer FROM buyers JOIN customers c ON c.id = buyers.customer_id
ORDER BY c.name, c.id;

-- @query never-purchased | Customers without a paid order | EXCEPT | Subtract paying customers from the full customer list.
WITH buyers AS (
    SELECT id FROM customers
    EXCEPT
    SELECT customer_id FROM paid_orders
)
SELECT c.id AS customer_id, c.name AS customer FROM buyers JOIN customers c ON c.id = buyers.id
ORDER BY c.name, c.id;

-- @query district-sales | District sales | View + LEFT JOIN | Roll up paid deliveries by district while retaining districts with zero sales.
SELECT d.name AS district, count(o.id) AS paid_orders, coalesce(sum(o.revenue), 0) AS revenue_aed
FROM districts d LEFT JOIN paid_orders o ON o.district_id = d.id
GROUP BY d.id ORDER BY revenue_aed DESC, d.name;
