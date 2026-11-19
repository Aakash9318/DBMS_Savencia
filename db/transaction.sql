-- TCL | Rehearse a stock reservation without changing the demo dataset.
BEGIN;
SET LOCAL search_path = commerce, public;
SAVEPOINT reservation;
UPDATE inventory SET quantity = quantity - 1
WHERE product_id = 1 AND quantity >= 1
RETURNING product_id, quantity AS reserved_quantity;
ROLLBACK TO SAVEPOINT reservation;
SELECT product_id, quantity AS restored_quantity FROM inventory WHERE product_id = 1;
COMMIT;
