-- DML | Deterministic synthetic data over the 90 days leading up to installation.
SET search_path = commerce, public;
SET TIME ZONE 'Asia/Dubai';

INSERT INTO districts (name, slug) VALUES
    ('Downtown Dubai', 'downtown'), ('Business Bay', 'business-bay'),
    ('DIFC', 'difc'), ('Dubai Design District', 'd3');

INSERT INTO categories (name) VALUES ('Home & Living'), ('Tech'), ('Lifestyle');

INSERT INTO products (category_id, sku, name, price) VALUES
    (1,'HL-101','Arc Table Lamp',249), (1,'HL-102','Dune Ceramic Set',149),
    (1,'HL-103','Linen Throw',119), (1,'HL-104','Studio Vase',89),
    (2,'TC-201','Halo Wireless Charger',129), (2,'TC-202','Orbit Headphones',329),
    (2,'TC-203','Pocket Speaker',179), (2,'TC-204','Braided USB-C Cable',49),
    (3,'LS-301','Everyday Tote',79), (3,'LS-302','Metro Travel Flask',95),
    (3,'LS-303','Field Notes Set',45), (3,'LS-304','Daybreak Sunglasses',189);

INSERT INTO inventory (product_id, quantity)
SELECT id, CASE WHEN id IN (1, 6, 10) THEN id % 7 + 2 ELSE 20 + id * 3 END FROM products;

INSERT INTO discounts (code, percent_off, active) VALUES
    ('WELCOME10',10,true), ('WEEKEND15',15,true), ('SPRING20',20,false);

INSERT INTO customers (name, email)
SELECT f.name || ' ' || l.name,
       lower(replace(f.name || '.' || l.name, ' ', '')) || '@example.test'
FROM unnest(ARRAY['Aisha','Omar','Mariam','Zain','Sara','Khalid','Lina','Yusuf','Noor','Amir','Hana','Adam','Leila','Faris','Nadia','Sami'])
    WITH ORDINALITY AS f(name, seq)
CROSS JOIN unnest(ARRAY['Al Mansoori','Haddad','Rahman','Nassar','Malik','Khan','Saad','Aziz'])
    WITH ORDINALITY AS l(name, seq)
ORDER BY f.seq, l.seq;

UPDATE customers SET referred_by = ((id - 2) % 12) + 1 WHERE id > 12 AND id % 5 = 0;

INSERT INTO orders (customer_id, discount_id, placed_at, status)
SELECT 1 + (n * 31 + n / 19) % CASE WHEN n % 4 = 0 THEN 125 ELSE 84 END,
       CASE WHEN n % 11 = 0 THEN 2 WHEN n % 5 = 0 THEN 1 END,
       least(current_timestamp - interval '1 second',
             current_date - ((n * 43 + n / 7) % 90) * interval '1 day'
             + ((n * 37) % 1300) * interval '1 minute'),
       CASE WHEN n % 19 = 0 THEN 'cancelled' WHEN n % 13 = 0 THEN 'pending' ELSE 'confirmed' END
FROM generate_series(1, 566) AS series(n)
ORDER BY n;

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT o.id, p.id,
       CASE WHEN o.id % 17 = 0 THEN 3 WHEN o.id % 5 = 0 THEN 2 ELSE 1 END, p.price
FROM orders o
CROSS JOIN LATERAL generate_series(0, o.id % 3) AS line(offset_number)
JOIN products p ON p.id = CASE WHEN line.offset_number = 0 AND o.id % 4 = 0 THEN 5
                              ELSE 1 + (o.id * 7 + o.id / 4 + line.offset_number * 3) % 12 END
ON CONFLICT (order_id, product_id) DO NOTHING;

UPDATE orders o
SET discount_amount = round(lines.subtotal * d.percent_off / 100, 2)
FROM discounts d,
    (SELECT order_id, sum(quantity * unit_price) AS subtotal FROM order_items GROUP BY order_id) lines
WHERE d.id = o.discount_id AND lines.order_id = o.id;

INSERT INTO payments (order_id, amount, method, status, paid_at)
SELECT o.id, o.total, CASE WHEN o.id % 3 = 0 THEN 'wallet' ELSE 'card' END,
       CASE o.status WHEN 'confirmed' THEN 'captured' WHEN 'cancelled' THEN 'failed' ELSE 'pending' END,
       CASE WHEN o.status = 'confirmed' THEN o.placed_at END
FROM order_summary o
WHERE o.status <> 'pending' OR o.id % 2 = 0;

INSERT INTO deliveries (order_id, district_id, status, delivered_at)
SELECT o.id, CASE
        WHEN district_bucket < 8 THEN 1
        WHEN district_bucket < 14 THEN 2
        WHEN district_bucket < 18 THEN 3 ELSE 4 END,
       CASE WHEN o.placed_at < current_date - interval '3 days' THEN 'delivered'
            WHEN o.placed_at < current_date - interval '1 day' THEN 'in transit' ELSE 'queued' END,
       CASE WHEN o.placed_at < current_date - interval '3 days' THEN o.placed_at + interval '2 days' END
FROM orders o
CROSS JOIN LATERAL (SELECT abs(hashint4(o.id)::bigint) % 20 AS district_bucket) district_seed
WHERE o.status = 'confirmed';

-- Leave a catalog/customer edge case for outer joins and set difference.
INSERT INTO products (category_id, sku, name, price) VALUES (3,'LS-305','Weekender Pouch',99);
INSERT INTO inventory (product_id, quantity) SELECT id, 16 FROM products WHERE sku = 'LS-305';
