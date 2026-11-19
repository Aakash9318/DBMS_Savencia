-- DCL | Analytics may read approved relations; customers' email stays outside its grants.
SET search_path = commerce, public;
CREATE ROLE admap_analyst NOLOGIN;
GRANT USAGE ON SCHEMA commerce TO admap_analyst;
GRANT SELECT ON order_summary, paid_orders, product_stock, districts, order_items, products, categories TO admap_analyst;
GRANT SELECT (id, name, referred_by) ON customers TO admap_analyst;
-- Demonstrate a privilege change and its removal.
GRANT UPDATE ON inventory TO admap_analyst;
REVOKE UPDATE ON inventory FROM admap_analyst;
