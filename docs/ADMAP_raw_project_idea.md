# ADMAP --- Raw Project Idea

**Working title:** ADMAP\
**Expanded title:** Multi-Merchant Advertising, E-Commerce and
Geospatial Analytics System\
**Project type:** DBMS capstone with a web application, analytics
dashboard and interactive 3D city map\
**Status:** Early concept / raw idea --- scope and implementation
details can evolve.

------------------------------------------------------------------------

## 1. The idea in one paragraph

ADMAP is a platform for an advertising agency that works with multiple
businesses, including e-commerce stores and physical local shops. The
agency uses the platform to manage advertising campaigns, record
campaign interactions, connect trackable campaign activity to purchases
where evidence is available, and analyse business performance. The
platform brings together campaign data, merchant information, products,
inventory, orders, payments and customer purchasing behaviour. Its main
visual feature is an interactive 3D city map that displays participating
businesses, campaign coverage and aggregated sales or conversion
activity by area.

The central idea is:

**Advertisements → customer interactions → purchases → business outcomes
→ geographical intelligence.**

ADMAP is not intended to be a full advertising network or a replacement
for major ad platforms. It is a manageable, demonstrable prototype that
uses simulated and sample business data.

------------------------------------------------------------------------

## 2. The problem it aims to solve

Small and medium-sized businesses may advertise through different
channels and sell through different routes:

-   An online store may receive orders through its website.
-   A local shop may record purchases through a point-of-sale (POS)
    system.
-   A restaurant may use campaign-specific coupons or QR codes.
-   An advertising agency may manage campaigns for several businesses at
    once.

The information can be scattered across campaign reports, store records
and sales records. It can therefore be difficult to answer questions
such as:

-   Which campaigns are associated with the most purchases?
-   Which businesses are getting the strongest results?
-   Which products are selling well?
-   Which neighbourhoods generate the most recorded sales?
-   Which campaigns are spending money without producing enough
    measurable conversions?
-   Which customer groups make repeat purchases?

ADMAP aims to bring these records into one relational system and make
the resulting information easier to explore.

------------------------------------------------------------------------

## 3. Who uses the platform?

### A. Agency administrator

The agency administrator has an overview of the whole platform. They
can:

-   Add and manage business clients.
-   Create and manage advertising campaigns.
-   Assign campaigns to locations or target areas.
-   Review campaign interactions and reported conversions.
-   Compare campaign performance.
-   Explore the city map and analytics.
-   Generate reports.

### B. Business owner

A participating business owner can have a limited business-specific
view. They can:

-   View their business profile and store locations.
-   Manage their products and stock records.
-   Review orders and payments recorded for their business.
-   View campaigns associated with their business.
-   See their own sales and campaign performance.

### C. Analyst (optional role)

An analyst can explore reports and compare performance, without
necessarily having permission to edit business or campaign records.

### D. Customer (represented in the data)

Customers are primarily represented through customer, interaction and
order records. A full public-facing shopping application is optional and
is not required for the first prototype.

------------------------------------------------------------------------

## 4. Main product modules

### 4.1 Command Center

The landing page for the agency administrator.

Possible summary metrics:

-   Number of active businesses.
-   Number of active campaigns.
-   Total advertising spend recorded.
-   Total attributed revenue recorded.
-   Recorded clicks and conversions.
-   Conversion rate.
-   Campaign return on advertising spend (ROAS).
-   Top-performing businesses and campaigns.

Metrics must be calculated from stored records. Any demo figures should
be clearly identified as sample or simulated data.

### 4.2 Business Network

A directory of participating businesses.

A business may be:

-   An e-commerce store.
-   A physical retail shop.
-   A restaurant or café.
-   Another local service or merchant.

A business may have one or more physical locations. It may also have
products, orders and campaigns associated with it.

### 4.3 Campaign Manager

The agency can create and manage campaigns.

A campaign may contain:

-   Campaign name and description.
-   Client business.
-   Start and end dates.
-   Budget.
-   Advertising channel.
-   Target city or neighbourhood.
-   Campaign status.
-   Associated promotional code or QR identifier.
-   Recorded impressions, clicks and conversions.

Possible campaign channels include social media, search, website
promotion, QR promotion and local advertising. For the prototype, these
are recorded as campaign data; the system does not need to publish real
advertisements to external networks.

### 4.4 Commerce Records

This module preserves the e-commerce and order-management foundation of
the original DBMS assignment.

It can manage:

-   Customers.
-   Products and categories.
-   Product variants, if needed.
-   Inventory.
-   Orders and order items.
-   Payments.
-   Discounts and promotional codes.
-   Deliveries for online orders.
-   In-store/POS orders for local businesses.

The system can use simulated transactions or manually entered sample
records. A full checkout experience is optional.

### 4.5 Campaign Interaction and Conversion Tracking

The platform records events such as:

-   Advertisement impression.
-   Advertisement click.
-   Landing-page visit.
-   QR scan.
-   Promotional-code use.
-   Purchase/conversion.

Where a campaign identifier, tracking link, QR code or promotional code
connects an interaction to a purchase, the system can record that
relationship.

**Important limitation:** A click or impression does not automatically
prove that it caused a purchase. The dashboard should distinguish
directly trackable or attributed conversions from general sales.
Attribution rules should be stated clearly in reports.

### 4.6 Analytics Engine

The analytics module turns stored records into business insights.

Possible analysis:

-   Campaign performance over time.
-   Advertising spend versus attributed revenue.
-   Click-through and conversion rates.
-   Business performance comparison.
-   Product sales rankings.
-   Repeat-customer analysis.
-   Average order value.
-   Revenue by category.
-   Sales by neighbourhood.
-   Campaign performance by channel.
-   Orders and conversions by date.

### 4.7 3D City Intelligence Map

The map is the signature visual feature of ADMAP.

The first version can focus on one demonstration city, such as Dubai,
and a limited set of neighbourhoods or districts.

Possible map interactions:

-   Pan, zoom and rotate the city.
-   Display 3D building geometry where map data supports it.
-   Show participating business locations as markers.
-   Select a business to open its information panel.
-   Display campaign coverage by area.
-   Display aggregated sales or conversion intensity as a heatmap.
-   Filter by business type, campaign, date range or metric.
-   Compare selected neighbourhoods.

Potential map layers:

1.  **Business layer:** locations of participating merchants.
2.  **Campaign layer:** areas targeted by active campaigns.
3.  **Interaction layer:** aggregated impressions, clicks or QR scans by
    area, where location data is available.
4.  **Sales layer:** aggregated recorded orders or attributed
    conversions by area.
5.  **Performance layer:** campaign or business performance by district.

The map should show aggregated or appropriately anonymised information.
It should not expose individual customers' precise movements or private
location histories.

The 3D city is a visualization of geographic data, not a requirement to
construct a perfect digital replica of an entire city. A small
demonstration area is sufficient for a first version.

------------------------------------------------------------------------

## 5. Example end-to-end scenario

A local clothing store called **Urban Threads** joins the platform.

1.  The agency creates an Urban Threads business profile and adds its
    store location.
2.  The business's products and stock are entered into the system.
3.  The agency creates a campaign called **Summer Collection**.
4.  The campaign has a budget, dates, channel and target district.
5.  A customer sees a campaign link or scans a campaign QR code.
6.  ADMAP records the interaction with its campaign identifier.
7.  The customer makes a purchase online or in the store and uses a
    campaign-specific code, or the purchase is otherwise linked using an
    agreed tracking method.
8.  The order, order items and payment are recorded.
9.  The system updates the business and campaign analytics.
10. The dashboard shows the recorded campaign interactions and
    purchases. The map can show aggregated activity for the relevant
    district.

Example campaign values are illustrative only:

-   Campaign budget: ₹50,000.
-   Campaign duration: 30 days.
-   Target area: Downtown Dubai.
-   Example purchase: ₹3,000.
-   Example attribution: purchase linked through a campaign-specific
    promotional code.

This scenario can be implemented with simulated data; it does not
require a real advertising partnership.

------------------------------------------------------------------------

## 6. Dashboard ideas

### Agency overview

-   Active campaigns.
-   Participating businesses.
-   Recorded advertising spend.
-   Recorded attributed revenue.
-   Total orders and conversions.
-   Campaign performance trend.

### Campaign analytics

-   Spend by campaign.
-   Clicks and impressions.
-   Conversion count and conversion rate.
-   Attributed revenue.
-   ROAS.
-   Performance by channel and date.

### Business analytics

-   Business ranking by revenue or order count.
-   Sales by business category.
-   Online versus in-store orders.
-   Best-performing products.
-   Low-stock products.

### Customer analytics

-   New versus repeat customers.
-   Customers with the most orders.
-   Highest customer spending.
-   Average order value.
-   Purchase frequency.
-   Product/category preferences, where supported by order history.

### Geographic analytics

-   Businesses by district.
-   Campaign coverage.
-   Aggregated interactions by area.
-   Aggregated orders or attributed revenue by area.
-   Comparison of selected districts.

------------------------------------------------------------------------

## 7. Rough database entities

This is an initial conceptual list, not a final normalized schema.

### Core agency and access

-   `Users`
-   `Roles`
-   `Businesses`
-   `BusinessLocations`

### Commerce

-   `Customers`
-   `Categories`
-   `Products`
-   `ProductVariants` (optional)
-   `Inventory`
-   `Orders`
-   `OrderItems`
-   `Payments`
-   `Discounts`
-   `Deliveries`

### Advertising

-   `Campaigns`
-   `CampaignChannels` (or a channel attribute/reference table)
-   `CampaignLocations` / `CampaignTargets`
-   `Advertisements` (optional)
-   `CampaignEvents`
-   `Conversions` (or a clearly defined conversion relationship)

### Geography

-   `Cities`
-   `Districts` / `Areas`
-   `Locations`

The final design should avoid unnecessary duplication. Primary keys,
foreign keys, uniqueness rules, check constraints and appropriate
normalization should be demonstrated.

------------------------------------------------------------------------

## 8. How the idea aligns with the DBMS capstone

The project must continue to demonstrate the requirements from the
assignment.

  -----------------------------------------------------------------------
  Assignment requirement              ADMAP implementation
  ----------------------------------- -----------------------------------
  ER model                            Agency, businesses, locations,
                                      campaigns, customers, products,
                                      orders, payments and interactions

  Relational model                    Tables with primary and foreign
                                      keys

  1NF, 2NF, 3NF and BCNF              Normalization of business,
                                      campaign, product, order and event
                                      data

  DDL, DML, DCL and TCL               Schema creation, data manipulation,
                                      permissions and transaction control

  Inner, outer and self joins         Campaign-business reports,
                                      customer-order reports, and any
                                      suitable hierarchical or
                                      related-record analysis

  Nested and correlated subqueries    Above-average customer spend,
                                      businesses exceeding campaign
                                      benchmarks, products with sales
                                      above category averages

  UNION, INTERSECT and MINUS/EXCEPT   Compare customer sets, campaign
                                      audiences or product sets where
                                      supported by the chosen SQL dialect

  Views and indexing                  Campaign summary, business sales
                                      summary, inventory alert and
                                      customer purchase views; indexes
                                      for common joins and filters

  Window functions and CTEs           Rank campaigns, businesses and
                                      products; calculate monthly trends
                                      and customer purchase rankings
  -----------------------------------------------------------------------

The original e-commerce requirements remain represented through
products, inventory, orders, payments, discounts, deliveries and
customer behaviour. Advertising and geography extend the scenario rather
than replace its commerce foundation.

------------------------------------------------------------------------

## 9. Example SQL questions the system should answer

The project should be designed so that the database can answer questions
such as:

1.  Which campaigns generated the highest attributed revenue?
2.  Which businesses have the highest order volume?
3.  Which products are the best sellers across all participating
    businesses?
4.  Who are the repeat customers?
5.  Which customers have spent more than the average customer?
6.  Which campaigns have the highest ROAS?
7.  Which districts have the highest recorded sales?
8.  Which businesses have low inventory?
9.  How does campaign performance change month by month?
10. Rank campaigns within each advertising channel by attributed
    revenue.
11. Find businesses whose campaign conversion rate is above their
    category average.
12. Compare online orders with in-store orders.

These questions should be implemented with the SQL techniques required
by the assignment, including joins, subqueries, set operations, views,
CTEs and window functions.

------------------------------------------------------------------------

## 10. Data strategy

The prototype can use synthetic data generated with Python.

Suggested initial scale:

  Data type                        Suggested volume
  -------------------- ----------------------------
  Businesses                                 30--50
  Business locations                         40--70
  Customers                                200--500
  Products                                 100--300
  Campaigns                                 50--100
  Orders                                 800--1,500
  Order items                          1,500--3,000
  Payments               Related to recorded orders
  Campaign events                  Several thousand
  Districts / areas                           5--15

The data should contain realistic variety:

-   Multiple merchant categories.
-   Both online and physical businesses.
-   Different campaign channels and budgets.
-   Campaigns with strong and weak performance.
-   Repeat and one-time customers.
-   Successful, failed and cancelled transactions.
-   Different order dates and delivery statuses.
-   Campaign interactions that do and do not lead to recorded purchases.
-   Geographic locations attached to businesses and, where legitimately
    available, aggregated events or orders.

All generated records should be internally consistent. For example,
order items should refer to existing products, payments should refer to
existing orders, and campaign conversions should follow the chosen
attribution rules.

------------------------------------------------------------------------

## 11. Feasible technical direction

A possible stack:

  Layer             Suggested technology
  ----------------- ---------------------------------------------------
  Frontend          React
  Styling           Tailwind CSS
  Backend           Python + Flask
  Database          MySQL
  Charts            Chart.js
  3D map            MapLibre GL JS with suitable 3D building/map data
  Data generation   Python

The stack is a proposal, not a fixed requirement. The database and SQL
work should remain central to the academic submission.

### Practical 3D map plan

1.  Start with a working 2D map and business markers.
2.  Add 3D building extrusions using available map/building data.
3.  Add business selection and information panels.
4.  Add campaign coverage and aggregated sales layers.
5.  Add filters and district comparisons.

This staged approach reduces the risk of spending the whole project
timeline on map styling.

------------------------------------------------------------------------

## 12. Scope boundaries: what not to build initially

To keep the project achievable, the first version does **not** need:

-   A real advertising exchange or ad-serving network.
-   Integration with every social media advertising API.
-   Real-time data feeds from actual merchants.
-   A complete public shopping marketplace.
-   A full payment gateway.
-   A perfect 3D replica of Dubai.
-   Individual customer movement tracking.
-   Machine-learning predictions.

These can be described as future enhancements if appropriate, but should
not be promised as implemented features.

------------------------------------------------------------------------

## 13. Suggested development order

### Stage 1 --- Define the business workflow

Decide exactly how an agency, merchant, campaign, customer interaction
and purchase relate to one another.

### Stage 2 --- Design the ER model and relational schema

Identify entities, relationships, keys, constraints and normalization
requirements.

### Stage 3 --- Implement the database

Create tables, constraints, sample data, transactions, views and
indexes.

### Stage 4 --- Build the core application

Implement business, campaign, product, inventory, order and payment
workflows.

### Stage 5 --- Build analytics

Create SQL queries and backend endpoints for campaign, business,
customer, product and geographic reports.

### Stage 6 --- Build the dashboard

Create the command center and dedicated analytics pages.

### Stage 7 --- Build the 3D city experience

Add the map, business markers, geographic filters, campaign layers and
aggregated sales visualization.

### Stage 8 --- Test and document

Validate transactions, constraints, joins, reports, attribution rules,
data consistency and dashboard calculations.

------------------------------------------------------------------------

## 14. Main risks and how to manage them

  -----------------------------------------------------------------------
  Risk                                Practical response
  ----------------------------------- -----------------------------------
  The idea becomes too large          Limit the first version to a few
                                      business categories and one city

  No real merchant or ad-platform     Use synthetic data and
  access                              manual/sample imports

  Purchases cannot reliably be        Use campaign-specific links, QR
  attributed to ads                   codes and coupon codes; label
                                      attribution clearly

  3D mapping takes too long           Build the map in stages, starting
                                      with a small district

  Dashboard metrics disagree          Define each metric and its SQL
                                      calculation centrally

  Too much frontend work distracts    Complete the relational model and
  from DBMS                           core SQL requirements early

  Location data raises privacy        Use business locations and
  concerns                            aggregated, consent-based or
                                      simulated data
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 15. The core identity of the project

ADMAP should feel like an advertising agency's intelligence command
center.

It connects three worlds:

1.  **Commerce:** businesses, products, inventory, customers, orders and
    payments.
2.  **Advertising:** campaigns, channels, interactions, promotional
    codes and conversions.
3.  **Geography:** stores, districts, campaign coverage and aggregated
    sales patterns.

The database is the foundation. The application manages the records. The
analytics explain what is happening. The 3D map makes the geographic
patterns visible.

**The intended result:** a feasible DBMS capstone that preserves the
original e-commerce and customer analytics requirements while presenting
them through a much more distinctive advertising and geospatial
intelligence product.

------------------------------------------------------------------------

## 16. Open decisions for the next planning session

These decisions should be made before finalizing the schema:

-   Final project name: ADMAP or another name.
-   Demonstration city: Dubai, Delhi NCR or a fictional city.
-   Map style: realistic 3D, futuristic or hybrid.
-   Whether business owners get separate logins.
-   Whether orders are entered manually, imported or created through a
    small demo storefront.
-   Which campaign attribution method(s) will be implemented.
-   Which metrics are essential for the first dashboard.
-   Which map layers are achievable with available geographic data.

**Current recommendation:** Build the first version around one agency,
multiple merchants, a limited set of campaigns, simulated commerce and
interaction data, and one carefully chosen city area. Make the database
and analytics reliable first; make the 3D experience the standout
presentation layer.
