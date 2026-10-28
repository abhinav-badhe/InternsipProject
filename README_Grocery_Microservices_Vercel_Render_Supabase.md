# Grocery Store Omnichannel Commerce & Predictive Inventory Platform

**Architecture:** Strict domain-oriented microservices\
**Deployment:** Vercel (web frontends), Render (backend services and
workers), Supabase (PostgreSQL databases and private object storage
where appropriate)\
**Status:** Architecture and implementation specification --- not a
claim that the services are already implemented.

## 1. Project purpose

This platform allows customers to purchase grocery products through a
web storefront or WhatsApp. Store staff manage products, prices, stock,
orders, picking, delivery, and analytics. Forecasting estimates demand
and stockout risk; it is decision support and never the authority for
stock, price, order, or payment state.

### Customer capabilities

-   Register, sign in, manage a profile, and view order history.
-   Browse categories and search products, brands, SKUs, pack sizes, and
    units.
-   Add exact sellable variants to a cart and check out.
-   See current price, availability, delivery fee, and estimated
    delivery options before confirming.
-   Order through WhatsApp, review the resolved product/variant and
    quantity, approve substitutions explicitly, and confirm the final
    order.
-   Pay using a hosted payment-provider checkout.
-   Access invoices and order/delivery updates.

### Store staff capabilities

-   Manage categories, products, brands, variants, barcodes, prices, and
    promotions.
-   Receive stock, record adjustments and damage/expiry/write-offs,
    count physical stock, and review movement history.
-   Pick and pack orders using configured stock rotation rules for
    perishable goods.
-   Manage dispatch, failed delivery, returns, cancellations, refunds,
    and customer support handoff.
-   View sales summaries, low-stock alerts, demand forecasts, and
    reorder suggestions.

## 2. Non-negotiable architecture rules

1.  **Strict microservices:** each business service is independently
    deployable, has its own runtime/configuration, owns its data, and
    exposes versioned APIs/events. Do not merge services into one
    deployable backend for convenience.
2.  **Database-per-service:** each service gets a separate Supabase
    project/PostgreSQL database in production when strict data isolation
    is required. A shared Supabase project with separate schemas is a
    local/development cost-saving compromise only and must be documented
    as such; it is not equivalent to database-per-service isolation.
3.  **No cross-service table access or foreign keys.** Services exchange
    stable identifiers through APIs/events. A service may not read or
    write another service's tables.
4.  **PostgreSQL is the source of truth** for transactional business
    state. Redis/cache, search indexes, analytics tables, and ML outputs
    are derived or auxiliary.
5.  **No distributed database transactions.** Use explicit workflow/saga
    state, idempotent commands, compensating actions, and
    reconciliation.
6.  **Reliable events:** use a transactional outbox in each producer
    service, versioned event envelopes, at-least-once delivery,
    idempotent consumers, bounded retries, and dead-letter handling.
7.  **Security by default:** validate authentication and authorization
    on every protected service endpoint; enforce object-level
    authorization; fail closed; keep internal services private.
8.  **AI cannot bypass policy.** The AI layer may use only authorized
    backend tools and approved catalog/order/availability data. It
    cannot directly access databases, secrets, filesystem, or
    unrestricted APIs.
9.  **Payment truth comes from verified provider events and
    reconciliation**, not the browser, WhatsApp, or an LLM.
10. **Inventory allocation is concurrency-safe.** Forecasts and search
    results never guarantee live availability; checkout must reserve
    stock transactionally.
11. **No secrets in source control or frontend variables.** Only
    explicitly public configuration may use a `VITE_` or `NEXT_PUBLIC_`
    prefix.
12. **Do not claim production readiness until the release gates in this
    README pass.**

## 3. Deployment topology

``` text
Customer Web (Vercel) ─┐
Store Admin (Vercel) ──┼──> Public API Gateway / BFF (Render)
                       │              │
WhatsApp Provider ─────┘              ├──> Identity & Access
                                      ├──> Catalog
                                      ├──> Pricing & Promotions
                                      ├──> Inventory
                                      ├──> Cart
                                      ├──> Order
                                      ├──> Payment
                                      ├──> Fulfillment & Delivery
                                      ├──> WhatsApp Adapter
                                      ├──> Notification
                                      ├──> Invoice
                                      └──> Analytics / ML API

Private Render services communicate over private networking where available.
Background workers consume messages from the broker and call provider APIs.

Each service ──> its own Supabase PostgreSQL database/project
Each service ──> its own migration history and restricted database credentials

Outbox publishers ──> managed RabbitMQ-compatible broker ──> consumer workers
Private object storage ──> product images and invoice PDFs
Redis-compatible cache ──> rate limits / short-lived cache only
```

### Platform responsibilities

-   **Vercel:** customer-facing web application and store administration
    frontend. Configure separate Vercel projects for separate frontend
    apps, even if they live in one monorepo. Do not host long-running
    workers or rely on local filesystem persistence here.
-   **Render:** public API gateway/BFF, independently deployable service
    APIs, private internal services, webhook endpoints, queue
    consumers/background workers, scheduled jobs, and the analytics API.
-   **Supabase:** managed PostgreSQL for each service's owned data.
    Supabase Storage may hold private files if access policies and
    signed URLs are configured correctly. Do not expose service database
    credentials or the Supabase service-role key to browsers.
-   **Message broker:** use a managed RabbitMQ-compatible service for
    domain events and asynchronous jobs. Do not make a self-hosted
    broker on an ephemeral filesystem the default production design.
-   **Redis-compatible service:** optional for rate limiting, caching,
    and ephemeral state. It is not the durable order, inventory,
    payment, or conversation-history store.
-   **Payment provider:** select one provider before implementation. Use
    hosted checkout and verified webhooks.
-   **WhatsApp:** use the official WhatsApp Business Platform Cloud API
    or an approved business solution provider.

Vercel, Render, Supabase, broker, storage, and payment-provider plans
have different limits and costs. Confirm region, connection limits,
backup/restore capabilities, free-tier sleep/expiry behavior, and
production pricing before launch. Do not assume a free plan is suitable
for production.

## 4. Microservices and ownership

Every service must have its own deployable artifact, configuration,
health checks, logs, metrics, tests, API contract, event contracts, and
database credentials.

  ---------------------------------------------------------------------------
  Service                 Owns                        Must not own
  ----------------------- --------------------------- -----------------------
  API Gateway / BFF       Public routing, request     Core business records
                          limits, correlation IDs,    or business rules
                          response composition        belonging to domain
                                                      services

  Identity & Access       User identity integration,  Orders, stock, payment
                          profiles/role assignments,  ledger
                          sessions or identity        
                          mapping, authorization      
                          policies                    

  Catalog                 Categories, products,       Merchant pricing
                          brands, variants, SKUs,     decisions, stock
                          barcode and product         balances, orders
                          attributes                  

  Pricing & Promotions    Effective-dated prices,     Inventory allocation or
                          promotions, discount        payment status
                          eligibility, tax/rounding   
                          policy                      

  Inventory               Locations, stock            Order lifecycle,
                          lots/batches where needed,  payment state
                          on-hand/sellable/reserved   
                          quantities, movement        
                          ledger, reservations, stock 
                          counts                      

  Cart                    Customer carts and cart     Authoritative prices or
                          items, cart version, expiry stock; it requests
                                                      current values from
                                                      their owners

  Order                   Customer orders, immutable  Payment provider
                          item/price/tax/address      secrets, inventory
                          snapshots, order state      balances
                          machine, order              
                          workflow/saga state         

  Payment                 Payment attempts/intents,   Browser-supplied
                          provider references,        payment truth or
                          verified callbacks,         inventory records
                          refunds, reconciliation     
                          outcomes                    

  Fulfillment & Delivery  Picking, packing,           Catalog master data or
                          substitution proposals,     payment ledger
                          dispatch, delivery          
                          attempts, tracking events   

  WhatsApp Adapter        Provider webhook            Direct order or
                          verification,               inventory database
                          inbound/outbound message    writes
                          IDs, conversation state,    
                          identity mapping, message   
                          processing                  

  Notification            Templates, delivery         Order or payment state
                          attempts, provider message  as its own source of
                          IDs, retry status,          truth
                          opt-in/communication        
                          preferences as assigned by  
                          policy                      

  Invoice                 Invoice numbering/metadata, Payment confirmation or
                          generated document status   mutable order totals
                          and private object          
                          references                  

  Analytics / ML          Curated read models,        Authoritative
                          training datasets, forecast transactional stock,
                          versions, metrics,          price, order, or
                          stockout-risk and reorder   payment writes
                          recommendations             

  Audit                   Append-only security/admin  Replacing the domain
                          audit records and audit     service's transactional
                          access controls             records
  ---------------------------------------------------------------------------

### Service boundary rules

-   One service owns each business concept and its write path.
-   Other services use an API for synchronous decisions or consume
    events for asynchronous updates.
-   Never join tables across service databases. Build a documented read
    model when cross-service reporting is needed.
-   Shared libraries may contain primitives, logging, tracing, and
    generated contract types; they must not become a shared domain
    database layer.
-   Do not create circular synchronous dependencies. Identify a clear
    owner for each workflow and use events for downstream updates.
-   Only the gateway and explicitly required public webhook endpoints
    are internet-facing. Internal service endpoints must use Render
    private networking or authenticated service-to-service access.
-   Every service-to-service call has timeouts, bounded retries,
    correlation IDs, and an explicit failure policy.

## 5. Recommended repository layout

A monorepo is allowed; deployment boundaries remain independent.

``` text
grocery-platform/
├── apps/
│   ├── customer-web/                 # Vercel
│   └── store-admin-web/              # Vercel
├── services/
│   ├── api-gateway/
│   ├── identity-service/
│   ├── catalog-service/
│   ├── pricing-service/
│   ├── inventory-service/
│   ├── cart-service/
│   ├── order-service/
│   ├── payment-service/
│   ├── fulfillment-service/
│   ├── whatsapp-adapter/
│   ├── notification-service/
│   ├── invoice-service/
│   └── analytics-service/
├── workers/
│   ├── outbox-publisher/
│   ├── event-consumers/
│   └── forecast-scheduler/
├── packages/
│   ├── contracts/                    # Versioned API/event schemas only
│   ├── observability/
│   ├── test-utilities/
│   └── lint-config/
├── database/
│   └── service-migrations/           # Separate migration folder per service
├── infrastructure/
│   ├── render/
│   ├── vercel/
│   └── scripts/
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── api/
│   ├── events/
│   ├── runbooks/
│   └── threat-model/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

This is the target structure, not a claim that these files already
exist.

## 6. Technology baseline

Use one consistent baseline rather than leaving implementation agents to
choose alternatives independently.

-   **Frontend:** React + TypeScript + Vite for the customer web and
    admin web, deployed as separate Vercel projects.
-   **Backend:** Node.js LTS + TypeScript + NestJS for the gateway and
    service APIs. Use a consistent validation library and generated
    OpenAPI contracts.
-   **Package management:** pnpm workspaces for the monorepo; pin
    runtime/package-manager versions and commit the lockfile.
-   **Transactional database:** PostgreSQL on Supabase, with a separate
    production project/database and least-privilege credentials per
    service.
-   **Messaging:** managed RabbitMQ-compatible broker with durable
    queues, acknowledgements, retries, dead-letter queues, and TLS.
-   **Cache/rate limiting:** managed Redis-compatible service only where
    required.
-   **Object storage:** private Supabase Storage bucket or another
    private object store for product images and invoices; use signed,
    expiring access URLs.
-   **Observability:** structured logs, request/correlation IDs,
    OpenTelemetry-compatible traces and metrics, redaction,
    health/readiness endpoints, and alerts.
-   **CI/CD:** Git-based checks for lint, typecheck,
    unit/integration/contract tests, architecture rules,
    dependency/security scans, and migration review.

Pin supported versions in the repository. Do not mix Python and Node.js
backend frameworks without an explicit architecture decision and a
concrete need.

## 7. Database design and consistency

### Database-per-service

For strict production isolation, create a separate Supabase
project/database for each service that needs persistent state. Each
service must have its own:

-   Database connection secret and restricted database role.
-   Migration history and migration execution process.
-   Backup/restore and data-retention policy.
-   Schema, indexes, constraints, and operational ownership.
-   Documented data classification and recovery target.

For local development, a single local PostgreSQL instance may host
separate databases to reduce setup overhead. Do not use cross-database
joins or shared credentials. If a single Supabase project is temporarily
used for cost reasons, use distinct schemas and restricted roles,
document the compromise, and do not describe it as full
database-per-service isolation.

Use Supabase's recommended connection pooling mode for the application's
connection pattern. Keep connection pools bounded; do not open an
unbounded connection per request. Test migrations and restore procedures
before production.

### Data rules

-   Use UUIDs or another consistently selected stable identifier format.
-   Use `NUMERIC`/decimal-safe arithmetic for money; never use binary
    floating-point for monetary calculations.
-   Store currency explicitly and define rounding rules.
-   Store quantities with explicit units and conversion rules.
-   Use UTC timestamps in storage and localize only at presentation
    boundaries.
-   Use constraints for uniqueness, non-negative quantities where
    applicable, valid state values, and required relationships inside
    the service database.
-   Snapshot product description, SKU, unit, quantity, unit price,
    discounts, tax, currency, and relevant delivery/customer details on
    the order so later edits do not rewrite history.
-   Store private object keys, not permanent public URLs, for invoices
    and private documents.
-   Use versioned migrations; never edit an already-applied production
    migration in place.
-   Use synthetic or anonymized data in development and tests.

## 8. Grocery-specific catalog and inventory rules

### Catalog

-   A product describes the general item; a variant/SKU identifies the
    exact sellable pack or configuration.
-   SKU and barcode uniqueness rules must be explicit.
-   Define whether products can belong to multiple categories and how
    category hierarchy validation works.
-   Model units such as `g`, `kg`, `ml`, `l`, and `each` explicitly. Do
    not compare or convert quantities without a defined conversion.
-   Model active/inactive status and prevent discontinued variants from
    being newly purchased.
-   Store images in private or appropriately public object storage, and
    validate upload type and size.

### Inventory

Inventory is owned only by the Inventory service. At minimum, model
location, SKU/variant ID, movement history, stock counts, reservations,
and current balance projections.

-   Keep an append-only stock movement ledger with reason, quantity,
    actor/source, timestamp, and reference ID.
-   Update the ledger and balance projection in one local database
    transaction.
-   Use an atomic conditional update, row lock, or equivalent
    concurrency-safe transaction to prevent overselling.
-   Distinguish physical on-hand, reserved, sellable, damaged, expired,
    quarantined, and incoming stock as required by store policy.
-   Reservation records need an expiry time, status, unique reference,
    and idempotent reserve/release/consume operations.
-   Expired reservations must be released by a reliable scheduled/worker
    process; correctness must not depend only on a cleanup job.
-   Payment success and inventory reservation expiry can race. Define
    the workflow so the order/payment process reconciles this condition
    instead of silently overselling.
-   For perishable products, decide whether batch/expiry tracking and
    FEFO picking are required. If required, stock allocation must select
    eligible lots and picking must follow the configured rule.
-   Physical stock counts and manual adjustments require authorized
    actors, reason codes, audit events, and reconciliation.

## 9. Pricing, cart, checkout, and order lifecycle

### Pricing

The Pricing service owns the price calculation. It must define
effective-date boundaries, discount stacking/exclusions, tax
calculation, rounding, currency, and how a price change is communicated
to a customer.

The frontend/cart total is indicative. The backend recalculates the
final price during checkout and returns a versioned quote or equivalent
immutable checkout summary.

### Checkout invariants

1.  Validate customer identity and address/delivery eligibility.
2.  Resolve every cart line to an active sellable SKU.
3.  Recalculate price, discounts, tax, delivery fees, and total on the
    server.
4.  Check current availability and reserve inventory safely.
5.  Persist the order workflow and idempotency key.
6.  Create/confirm payment through the Payment service and provider.
7.  Confirm the order only according to the defined payment and
    fulfilment policy.
8.  Publish events through the transactional outbox.
9.  Release reservations on cancellation/failure when appropriate;
    reconcile ambiguous payment results before releasing or reusing
    stock.
10. Return the existing result for a repeated idempotency key instead of
    creating a duplicate order.

### State machines

Document allowed transitions before implementation. At minimum, define
separate state machines for:

-   **Order:** pending confirmation, awaiting payment, confirmed,
    picking, partially fulfilled where supported, fulfilled/delivered,
    cancellation requested, cancelled, and exception states.
-   **Payment:** created, pending, authorized where supported,
    captured/paid, failed, expired, refund pending, partially refunded,
    refunded, and reconciliation required.
-   **Reservation:** active, consumed, released, expired.
-   **Fulfillment:** pending, picking, substitution required, packed,
    dispatched, delivered, failed delivery, returned/cancelled where
    supported.

These are candidate states; finalize the exact vocabulary and transition
matrix with the business before coding. A state change must be validated
by the service that owns that state.

### Cross-service workflow

Use an explicit saga/workflow coordinator or a clearly documented
orchestration in the Order service. Record each step and outcome. Every
command must be retry-safe, and compensating actions must be idempotent.
Add reconciliation jobs for cases where an external provider's result is
unknown.

## 10. Payment and financial correctness

-   Choose and document the payment provider before implementation.
-   Use the provider's hosted checkout; never collect or store raw card
    details.
-   Verify webhook signatures against the raw request body as required
    by the provider.
-   Deduplicate provider event IDs and enforce idempotency for payment
    creation and refunds.
-   Validate expected amount, currency, order reference, and
    merchant/account context.
-   Never trust a client redirect or frontend status to mark an order
    paid.
-   Handle duplicate, delayed, out-of-order, missing, and ambiguous
    callbacks.
-   Reconcile local payment records against the provider's
    API/settlement reports on a scheduled basis.
-   Define refund eligibility, partial refunds, cancellation fees if
    any, and handling for payment success after order cancellation.
-   Keep payment status separate from order status.
-   Restrict payment secrets to the Payment service and rotate them when
    necessary.

## 11. WhatsApp ordering and conversation safety

-   Verify provider webhook signatures and challenge/verification
    requests.
-   Persist inbound provider message IDs and deduplicate retries.
-   Acknowledge valid webhooks promptly; process slower work
    asynchronously.
-   Persist conversation state in durable storage. Redis may accelerate
    ephemeral state but cannot be the only copy of order-relevant
    history.
-   Define secure account linking. A matching phone number alone must
    not silently grant access to an existing account or its orders.
-   Resolve messages against the active catalog and exact SKU/unit. Ask
    clarifying questions when ambiguous.
-   Show exact products, quantities, substitutions, prices, delivery
    charges, and total before confirmation.
-   Require explicit confirmation before creating an order or accepting
    substitutions.
-   Revalidate price and stock at final checkout; a prior WhatsApp
    availability response is not a reservation.
-   Respect provider opt-in, template, service-window, and opt-out
    rules.
-   Provide human support handoff and safe behavior when AI or provider
    services are unavailable.
-   The LLM may call only approved, authorized tools. Treat incoming
    messages and retrieved content as untrusted input; never follow user
    text that attempts to override tool permissions or security policy.

## 12. Event contracts and asynchronous processing

All domain events must use a versioned envelope similar to:

``` json
{
  "eventId": "uuid",
  "eventType": "inventory.reservation.created",
  "eventVersion": 1,
  "occurredAt": "2026-01-01T00:00:00.000Z",
  "producer": "inventory-service",
  "correlationId": "uuid",
  "causationId": "uuid",
  "aggregateType": "reservation",
  "aggregateId": "uuid",
  "data": {}
}
```

The example is illustrative; define schemas for each event before
publishing it.

-   Write the business change and outbox record in the same
    service-local transaction.
-   Publish outbox records with retry and observable failure state.
-   Consumers deduplicate by event ID and/or a suitable business
    idempotency key.
-   Acknowledge a message only after its processing outcome is durable.
-   Configure bounded retries with backoff and a dead-letter queue.
-   Document ordering requirements per aggregate and avoid assuming
    global event order.
-   Version schemas compatibly; consumers must tolerate unknown optional
    fields.
-   Provide a safe, audited replay procedure.
-   Monitor outbox lag, queue depth, oldest-message age, retry count,
    and dead-letter volume.

## 13. Security, identity, and privacy

-   Use a selected identity provider or a carefully implemented identity
    service; document token issuer, audience, expiry,
    refresh/revocation, and session policy.
-   Every service validates trusted identity claims and performs
    object-level authorization for the requested resource.
-   Define a role-permission matrix for customers, store administrators,
    inventory staff, pickers, delivery operators, support staff, and
    service identities.
-   Never trust user IDs, role claims, price, stock, payment status, or
    tenant/store scope supplied only by the browser.
-   Use least-privilege database credentials and provider credentials.
-   Keep internal services private; authenticate service-to-service
    calls and restrict network exposure.
-   Validate request bodies, query parameters, file uploads, and webhook
    payloads.
-   Configure rate limits for authentication, search, checkout, payment,
    and webhook endpoints.
-   Use secure cookies and CSRF protection if cookie-based sessions are
    used; configure CORS to known frontend origins.
-   Redact passwords, access tokens, refresh tokens, OTPs, payment
    secrets, and unnecessary personal data from logs.
-   Encrypt traffic, backups, and private object storage according to
    platform capabilities.
-   Define data retention, deletion/export workflows, audit retention,
    and incident-response procedures.
-   Run dependency, secret, container, and static security scans in CI.
-   Test that one customer cannot access another customer's orders,
    invoices, addresses, or tracking data.

## 14. Search, analytics, and machine learning

### Search

PostgreSQL/catalog remains authoritative. A dedicated search engine is
optional and must be added only if required by scale or relevance needs.
If added, it is a derived index populated from versioned events; search
results must be revalidated against authoritative pricing and inventory
before checkout.

### Forecasting and stockout risk

-   Forecast at the selected SKU/location/time granularity and document
    the forecast horizon.
-   Use historical sales, calendar effects, promotions, price history,
    stock availability, supplier lead times, receipts, returns, and
    relevant local events when available.
-   Treat stockout periods carefully because observed sales can
    understate actual demand when products were unavailable.
-   Split training and evaluation data chronologically to prevent
    future-data leakage.
-   Establish a simple baseline before adopting complex models.
-   Evaluate with agreed metrics such as MAE/WAPE and report results by
    category and forecast horizon.
-   Store model version, training window, feature version, generated
    time, data freshness, and evaluation metrics with each forecast.
-   Provide a fallback for new products or insufficient history.
-   Define drift checks and a retraining schedule.
-   Reorder suggestions are recommendations. A manager or explicit
    replenishment policy must approve purchase orders; the model must
    not silently change stock or confirm availability.

## 15. API and service contracts

-   Publish an OpenAPI specification for each HTTP service.
-   Validate inputs at the service boundary and return a consistent
    error format without exposing secrets or stack traces.
-   Use API versioning for breaking changes and compatibility tests for
    consumers.
-   Define authentication and authorization requirements per endpoint.
-   Paginate list endpoints and set maximum page sizes.
-   Use idempotency keys for retryable mutations.
-   Set request, connection, and downstream timeouts.
-   Include request/correlation IDs in logs and suitable responses.
-   Provide liveness and readiness endpoints that do not expose
    credentials or internal diagnostics.
-   Document public versus internal endpoints and CORS behavior.
-   Never make direct frontend-to-database calls that bypass the
    backend's business authorization rules.

## 16. Environment configuration

Create a `.env.example` with names and safe placeholders only. Keep
actual values in local ignored environment files or the deployment
platform's secret configuration.

Example variable names (each service should receive only the variables
it needs):

``` dotenv
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
SERVICE_NAME=catalog-service
PUBLIC_API_BASE_URL=http://localhost:3000

# Set only on the service that needs this database
DATABASE_URL=

# Set only where required
BROKER_URL=
REDIS_URL=
INTERNAL_SERVICE_TOKEN=
OTEL_EXPORTER_OTLP_ENDPOINT=

# Payment service only
PAYMENT_PROVIDER=
PAYMENT_API_KEY=
PAYMENT_WEBHOOK_SECRET=

# WhatsApp adapter only
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

# Private storage configuration
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
```

These are illustrative names, not a universal environment file to copy
into every service. Validate required configuration at startup and fail
closed when required secrets, URLs, or security settings are missing.
Never provide privileged backend secrets to Vercel frontend builds.

## 17. Local development

Prerequisites:

-   Git
-   A supported Node.js LTS version pinned in the repository
-   pnpm version pinned through the package-manager field/Corepack or
    the team's chosen setup
-   Docker for local PostgreSQL, broker, and optional Redis
-   Access to development Supabase projects only when testing hosted
    services
-   Test credentials for payment and WhatsApp sandboxes where available

Suggested workflow:

``` bash
git clone <repository-url>
cd grocery-platform
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

Then:

1.  Fill only local/test values; do not use production secrets.
2.  Start local infrastructure using the repository's documented Compose
    file.
3.  Apply migrations separately for each service.
4.  Start required services and workers using documented scripts.
5.  Run lint, typecheck, unit tests, integration tests, and architecture
    checks.
6.  Use provider sandboxes and synthetic data for end-to-end tests.

Exact commands must be added to the repository once package scripts and
local infrastructure files exist. Do not document commands as working
until they have been executed successfully.

## 18. Deployment: Vercel

Create a separate Vercel project for each frontend app in the monorepo.

1.  Push the repository to GitHub or another supported Git provider.
2.  Import the repository into Vercel.
3.  Set the project root to `apps/customer-web` or
    `apps/store-admin-web`.
4.  Configure the correct framework/build settings for the chosen
    frontend and monorepo package manager.
5.  Set only public frontend variables, such as the public API base URL,
    for each Preview and Production environment.
6.  Configure production and preview URLs explicitly in the backend CORS
    allowlist.
7.  Deploy a preview and test against a non-production backend and
    database.
8.  Promote to production only after acceptance tests pass.

Do not expose database URLs, service tokens, payment secrets, WhatsApp
secrets, or Supabase service-role keys to frontend code. Preview
deployments must not silently use production customer data or production
payment credentials.

## 19. Deployment: Render

Deploy each backend API as its own Render service. Use a public web
service only when it must receive internet traffic (for example, the
gateway and provider webhooks). Use private services for internal HTTP
APIs and background workers for queue consumers that do not need inbound
HTTP traffic.

For each service:

1.  Create a Render service from the repository and select its
    service-specific root/build configuration.
2.  Configure build and start commands that build and run only that
    service plus required shared packages.
3.  Set a distinct service name and only its required environment
    variables.
4.  Add the service's own database URL and least-privilege credentials.
5.  Configure health checks, request timeouts, logs, and resource
    sizing.
6.  Apply migrations through a controlled release/pre-deploy process,
    not every application instance at startup.
7.  Configure private networking for internal service calls and restrict
    public access.
8.  Deploy to staging first; verify contracts, migrations, event
    processing, and rollback.
9.  Configure workers separately from web APIs and monitor their queue
    lag and failures.

Render filesystems are ephemeral by default. Do not store invoices,
product images, durable queue data, or application state only on the
service filesystem. Use private object storage and managed services. If
a persistent disk is considered for infrastructure, understand its
scaling and deployment limitations before relying on it.

### Render service inventory

  -----------------------------------------------------------------------
  Render service          Service type            Publicly reachable?
  ----------------------- ----------------------- -----------------------
  API Gateway / BFF       Web service             Yes

  Catalog, Pricing,       Private service unless  No, except explicitly
  Inventory, Cart, Order, a deliberate public     approved routes
  Payment, Fulfillment    route is required       
  APIs                                            

  Identity & Access API   Private service unless  Prefer no direct public
                          deliberate public login access
                          routes are routed       
                          through the gateway     

  WhatsApp Adapter        Web service for         Yes, webhook route only
                          provider callbacks      where possible

  Notification, Invoice,  Private service unless  Prefer no
  Analytics APIs          a documented public     
                          endpoint is required    

  Outbox publishers and   Background worker       No inbound public
  queue consumers                                 endpoint

  Forecast scheduler /    Cron job or worker      No
  reconciliation jobs                             
  -----------------------------------------------------------------------

Exact Render service names, root directories, build commands, and start
commands must match the actual repository and be verified during
deployment. Do not copy guessed commands into production configuration.

## 20. Deployment: Supabase

For production database-per-service isolation:

1.  Create a separate Supabase project for each persistent service.
2.  Select regions close to the Render services where supported to
    reduce latency.
3.  Create restricted service-specific database credentials; do not
    reuse an owner/admin credential across application services.
4.  Configure connection pooling according to the service's connection
    pattern and provider limits.
5.  Store each database URL only in the matching Render service's secret
    configuration.
6.  Run that service's reviewed migrations through a controlled
    deployment process.
7.  Configure backups and point-in-time recovery according to the
    selected plan and business RPO/RTO.
8.  Test restoration to a non-production environment.
9.  If Supabase Storage is used, create private buckets, enforce
    appropriate access policies, and use short-lived signed URLs for
    private invoices.
10. Keep database and service-role secrets out of browser code, logs,
    and Git.

Supabase Auth may be used as a managed identity provider if that
decision is explicitly adopted. If used, document how the Identity
service maps verified identities to application roles and how every
backend service validates issuer, audience, expiry, and authorization.
Do not mix incompatible identity strategies across services.

## 21. CI/CD and release gates

Every pull request must pass:

-   Formatting, linting, typechecking, and production build.
-   Unit tests and service-level integration tests.
-   Architecture boundary checks: no forbidden imports, cross-service
    database access, or dependency cycles.
-   OpenAPI/event-schema validation and contract compatibility tests.
-   Migration validation against a clean test database and, where
    feasible, the previous released schema.
-   Dependency, secret, and static security scans.
-   Authorization tests for customer/store data isolation.
-   Concurrency tests for final-unit reservation, duplicate checkout,
    and reservation expiry.
-   Payment tests for forged signatures, duplicate/out-of-order
    callbacks, delayed status, and reconciliation.
-   WhatsApp tests for invalid signatures, duplicate messages, ambiguous
    products, opt-out, and explicit confirmation.
-   Event tests for duplicate delivery, consumer retry, dead-letter
    handling, and replay.
-   End-to-end purchase tests across web and WhatsApp using provider
    sandboxes.
-   Performance tests against agreed traffic targets before production.

A green unit-test suite alone is not a production release gate.

## 22. Observability and operations

-   Emit structured logs with timestamp, service name, environment,
    request/correlation ID, and safe outcome fields.
-   Redact secrets and personal information; never log credentials,
    OTPs, raw payment secrets, or unnecessary message contents.
-   Capture request latency, error rates, database pool saturation,
    provider failures, queue depth, outbox lag, dead-letter count,
    reservation expiry, payment reconciliation backlog, and forecast
    freshness.
-   Define alerts with owners and runbooks.
-   Set explicit business-approved availability, RPO, RTO, latency, and
    capacity targets.
-   Back up databases and regularly test restore procedures.
-   Document rollback, migration recovery, event replay, provider
    outage, stock reconciliation, and credential rotation.
-   Separate development, staging, and production accounts/secrets/data.
-   Avoid claiming high availability unless it is actually configured
    and tested.

## 23. Required acceptance scenarios

Do not release until the relevant tests demonstrate:

1.  Two customers compete for the last sellable unit; no overselling
    occurs.
2.  Repeated checkout requests with the same idempotency key do not
    create duplicate orders or charges.
3.  A forged or invalidly signed payment webhook cannot mark an order
    paid.
4.  A delayed payment success is reconciled correctly if the order or
    reservation has changed.
5.  A customer cannot read another customer's order, address, invoice,
    or tracking data.
6.  An expired reservation is safely released and cannot be consumed
    twice.
7.  A stock movement and its balance projection cannot diverge silently.
8.  A duplicate WhatsApp message cannot create a duplicate order.
9.  An ambiguous WhatsApp product request asks for clarification rather
    than guessing a SKU.
10. A substitution or price change requires explicit customer
    confirmation.
11. A broker outage does not lose committed domain events; outbox
    publication resumes after recovery.
12. A failed consumer is retried safely and dead-lettered for
    investigation when necessary.
13. A database migration failure does not leave the release marked
    healthy.
14. An invoice remains private and access is checked on every request.
15. Forecast output shows model version and freshness and never
    overrides live stock.
16. A backup can be restored within the agreed RTO and data loss stays
    within the agreed RPO.

## 24. Implementation sequence

Strict microservices do not mean building every service simultaneously.
Implement and validate the platform in controlled gates while preserving
independent deployability.

1.  **Architecture decisions:** approve service ownership, technology
    baseline, identity strategy, provider choices, regions, data
    retention, and production targets.
2.  **Repository and CI foundation:** workspace, service templates,
    code-quality checks, contract tooling, architecture enforcement,
    logging, tracing, and health checks.
3.  **Database foundation:** separate service databases, migration
    conventions, restricted credentials, backup/restore test.
4.  **Identity and gateway:** authentication, authorization matrix,
    service identity, CORS, rate limits, and protected routes.
5.  **Catalog and pricing:** product/category/variant model, unit rules,
    effective prices, promotions, and contracts.
6.  **Inventory:** stock ledger, balance projection, reservations,
    concurrency controls, expiry, and reconciliation.
7.  **Cart and Order:** quote/checkout workflow, immutable snapshots,
    state machines, idempotency, and saga recovery.
8.  **Payment:** hosted checkout, signed webhooks, refunds,
    reconciliation, and provider sandbox tests.
9.  **Fulfillment and Invoice:** picking, substitutions, delivery
    exceptions, private invoices, and access controls.
10. **WhatsApp and Notification:** webhook verification, identity
    linking, conversation state, customer confirmation, templates,
    retries, and human handoff.
11. **Analytics and ML:** curated data, baseline forecasting,
    backtesting, stockout-risk calculation, freshness, and dashboard.
12. **Production readiness:** security review, load/concurrency tests,
    restore exercise, alerting, runbooks, and staged release.

Each phase must have a reviewed design, implemented code, passing tests,
migration review, documented manual configuration, and an explicit
acceptance decision before the next phase begins.

## 25. Decisions that must be approved before production

Do not let an implementation agent silently invent these business or
infrastructure choices:

-   Payment provider, refund policy, and reconciliation schedule.
-   WhatsApp provider, account-linking process, opt-in policy, and
    message retention.
-   Delivery zones, fees, slots, failed delivery, returns, and
    substitutions.
-   Tax rules, rounding, discount stacking, and invoice numbering
    requirements.
-   Perishable stock lot/expiry tracking and FEFO requirements.
-   Exact service database/project allocation, regions, plan limits, and
    budget.
-   Managed message broker and Redis provider.
-   Identity provider, role-permission matrix, session policy, and
    privileged-user MFA.
-   Data retention/deletion rules and audit retention.
-   Availability, latency, load, RPO, RTO, and recovery objectives.
-   Forecast horizon, evaluation thresholds, retraining schedule, and
    reorder approval policy.

Record each decision with its rationale, owner, date, and consequences
in `docs/decisions/`.

## 26. Project status and contribution rules

This README describes the intended architecture and deployment approach.
It does **not** prove that services, databases, provider accounts,
migrations, or production deployments exist.

Contributors and coding agents must:

-   Read this README and the relevant service contract before changing
    code.
-   Work on one bounded service or phase at a time.
-   Avoid unrelated refactors and bulk file generation.
-   List files changed and explain why each change is necessary.
-   Run and report the actual commands and test results; never claim a
    check passed without running it.
-   Separate manual dashboard/provider actions from code changes.
-   Never invent credentials, deployed URLs, environment values, or
    successful provider configuration.
-   Update API/event contracts and this README when an approved
    architecture decision changes.
-   Stop and ask for a decision when a business-critical policy is
    unresolved.

## 27. Official deployment references

-   Vercel documentation: https://vercel.com/docs
-   Vercel monorepos: https://vercel.com/docs/monorepos
-   Render documentation: https://render.com/docs
-   Render service types: https://render.com/docs/service-types
-   Render private services: https://render.com/docs/private-services
-   Supabase database overview:
    https://supabase.com/docs/guides/database/overview
-   Supabase connection pooling:
    https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits

Check current provider documentation and pricing before deployment
because platform limits and plan capabilities can change.

------------------------------------------------------------------------

**Architecture principle:** preserve strict microservice ownership and
independent deployment, while making every cross-service workflow
explicit, retry-safe, observable, testable, and recoverable.
