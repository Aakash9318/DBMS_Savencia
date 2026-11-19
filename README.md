# DBMS_Savencia_Capstone

ADMAP is a DBMS capstone for a demo e-commerce store in Dubai. The commerce dashboard shows orders, payments, deliveries, repeat customers, product rankings, and stock. The city dashboard shows paid orders and revenue by delivery district using the same database.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm start
```

Open [ADMAP](http://127.0.0.1:3000/) in a browser. On first run, the app creates an embedded PostgreSQL database in `.data/` and seeds 566 synthetic orders. The data directory persists across restarts. There is no separate database service to configure. To run an isolated demo with fresh data every time, use `ADMAP_DATA_DIR=memory:// npm start`.

```sh
npm test
```

The tests use temporary databases. They cover report execution, reconciliation across dashboards, read-only privileges, savepoint rollback, checkout, inventory contention, and persistence.

## Capstone walkthrough

1. Open **Overview**, change the date range, and inspect the revenue and best sellers.
2. In **Orders**, open an order to see its items, payment, discount, and delivery. Use **New order** to record a synthetic purchase and reserve stock. `WELCOME10` and `WEEKEND15` are active discount codes.
3. In **Customers**, filter to repeat buyers. In **Products**, compare sales ranks and check the low-stock filter.
4. In **SQL Lab**, run the best sellers, repeat customers, joins, subqueries, and set-operation reports.
5. Open **Dubai city**, select a delivery district, and switch between the day and night skyline photographs or open the 3D map. The map uses mapped building footprints and a satellite basemap. Drag to orbit, Shift-drag to pan, and use the camera controls to zoom or see all four districts. The 3D mode requires WebGL 2.

The [capstone notes](docs/capstone.md) contain the ER diagram, normalization walkthrough, rubric mapping, and Dubai asset credits. The [raw concept](docs/ADMAP_raw_project_idea.md) records the initial advertising and multi-merchant proposal.
