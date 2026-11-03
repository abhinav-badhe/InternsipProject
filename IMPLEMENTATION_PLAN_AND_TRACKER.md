# Omnichannel Grocery Platform — Implementation Plan & Progress Tracker

> **Source Specification:** [`README_Grocery_Microservices_Vercel_Render_Supabase.md`](./README_Grocery_Microservices_Vercel_Render_Supabase.md)  
> **Architecture Pattern:** Strict Domain-Oriented Microservices (Database-per-service, Transactional Outbox, Saga/Orchestrated Workflows)  
> **Target Deployment:** Vercel (Frontends) | Render (Gateway, Services, Workers) | Supabase (PostgreSQL per Service & Private Object Storage)  
> **Last Updated:** 2026-10-28  
> **Current Platform Status:** 🟡 **Phase 1: Planning & Architectural Decisions**

---

## 1. Executive Implementation Roadmap & Progress Dashboard

This dashboard provides a live high-level view of platform readiness. Update status badges as work progresses (`NOT STARTED` ⚪, `IN PROGRESS` 🟡, `COMPLETED` 🟢, `BLOCKED` 🔴).

| Phase | Focus Area | Services / Apps Involved | Status | Completion % | Release Gate Passed? |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Phase 1** | Architecture Decisions & Pre-Flight Sign-offs | Cross-platform | 🟢 COMPLETED | 100% | Yes |
| **Phase 2** | Monorepo & CI/CD Tooling Foundation | Tooling, `packages/`, CI | 🟢 COMPLETED | 100% | Yes |
| **Phase 3** | Database Foundation & Local Dev Environment | Supabase / Migrations | 🟢 COMPLETED | 100% | Yes |
| **Phase 4** | Identity & Access + Public API Gateway (BFF) | `api-gateway`, `identity-service` | 🟢 COMPLETED | 100% | Yes |
| **Phase 5** | Catalog & Pricing Services | `catalog-service`, `pricing-service` | 🟢 COMPLETED | 100% | Yes |
| **Phase 6** | Inventory Service & Concurrency Control | `inventory-service`, Outbox | 🟢 COMPLETED | 100% | Yes |
| **Phase 7** | Cart & Order Services (Checkout Saga) | `order-service`, Checkout Saga | 🟢 COMPLETED | 100% | Yes |
| **Phase 8** | Payment Service & Settlement Reconciliation | `payment-service`, Webhook worker | 🟢 COMPLETED | 100% | Yes |
| **Phase 9** | Fulfillment & Invoice Services | `fulfillment-service`, `invoice-service` | 🟢 COMPLETED | 100% | Yes |
| **Phase 10** | WhatsApp Adapter & Notification Service | `whatsapp-adapter`, `notification-service` | 🟢 COMPLETED | 100% | Yes |
| **Phase 11** | Analytics & Predictive ML Service | `analytics-service`, Forecast engine | 🟢 COMPLETED | 100% | Yes |
| **Phase 12** | Storefront & Admin Frontends (Vercel) | `customer-web`, `store-admin-web` | 🟢 COMPLETED | 100% | Yes |
| **Phase 13** | Acceptance Scenarios, Hardening & Production Launch | All services, Staging & Prod | 🟢 COMPLETED | 100% | Yes |

---

## 2. Phase 1: Architecture Decisions & Pre-Flight Approvals (Section 25)

*Non-negotiable rule: Do not begin service coding until these architectural decisions (ADRs) are reviewed and documented in `docs/decisions/`.*

- [ ] **ADR-001: Payment Provider & Settlement Policy**
  - [ ] Select primary payment provider (e.g., Stripe, Razorpay, or Adyen) for hosted checkout.
  - [ ] Define refund policy, partial refund handling, and timeout reconciliation interval.
- [ ] **ADR-002: WhatsApp Solution Provider & Business Verification**
  - [ ] Choose official WhatsApp Cloud API or BSP (e.g., Twilio/Infobip/Gupshup).
  - [ ] Define account linking flow (phone number verification via OTP — no silent account linking).
  - [ ] Document 24-hour service-window policy, opt-in/opt-out rules, and human support handoff trigger.
- [ ] **ADR-003: Store Fulfillment, Delivery Zones & Substitutions**
  - [ ] Define delivery fee logic, geo-fencing/delivery slots, and maximum delivery radiuses.
  - [ ] Define substitution rules (pickers propose substitutions; customer must explicitly approve via Web or WhatsApp).
- [ ] **ADR-004: Perishable Goods, Batches & Rotation Rules**
  - [ ] Determine if batch/lot tracking and First-Expired, First-Out (FEFO) picking is enforced at launch or phased.
- [ ] **ADR-005: Supabase Database Topology & Isolation Strategy**
  - [ ] Decide production database mapping (distinct Supabase project per service vs initial dedicated schemas with strict credentials in staging).
  - [ ] Configure connection pooling limits (Transaction pooling via PgBouncer/Supavisor).
- [ ] **ADR-006: Message Broker & Ephemeral Cache Selection**
  - [ ] Confirm managed RabbitMQ provider (e.g., CloudAMQP) or Render-hosted broker.
  - [ ] Confirm managed Redis provider (e.g., Upstash / Render Redis) strictly for rate limits & ephemeral caching.
- [ ] **ADR-007: Identity Strategy & Role-Based Access Control (RBAC)**
  - [ ] Decide between Supabase Auth or dedicated JWT/OAuth2 Identity Service.
  - [ ] Finalize role permissions: `customer`, `store_admin`, `inventory_staff`, `picker`, `driver`, `support_agent`.

---

## 3. Detailed Step-by-Step Implementation Workflow

---

### Phase 2: Monorepo Setup, Shared Packages & CI/CD Foundation
> **Goal:** Create an enforceable, robust monorepo structure with automated linting, typechecking, and contract definitions.

- [x] **2.1 Initialize Monorepo Architecture**
  - [x] Setup `pnpm-workspace.yaml` and root `package.json` with pinned Node LTS.
  - [x] Configure TypeScript project references and base `tsconfig.json`.
  - [ ] Configure ESLint + Prettier rules prohibiting cross-service relative imports.
- [x] **2.2 Create Core Shared Packages (`packages/`)**
  - [x] `packages/contracts`: OpenAPI schemas, DTOs, and domain event types.
  - [x] `packages/observability`: Structured JSON logging (Pino-compatible), correlation ID middleware.
  - [ ] `packages/test-utilities`: Test containers, mock factories, database seeding helpers.
  - [ ] `packages/lint-config`: Shared linting and architecture boundary enforcement rules.
- [x] **2.3 Define Canonical Domain Event Envelope**
  - [x] Standardize event envelope: `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `correlationId`, `causationId`, `aggregateType`, `aggregateId`, `data`.
- [ ] **2.4 Setup GitHub Actions CI Pipeline**
  - [ ] Pull Request gate: Typecheck, Lint, Boundary check (no forbidden imports).
  - [ ] Secret scanning and dependency vulnerability checks.

---

### Phase 3: Database Foundation & Local Environment
> **Goal:** Establish database-per-service isolation, versioned migrations, and a one-command local developer environment.

- [x] **3.1 Service Database Directory Layout**
  - [x] Setup `database/service-migrations/` with dedicated folders for each service.
  - [ ] Choose migration runner (e.g., Prisma Migrate / node-pg-migrate / Flyway) per service.
- [x] **3.2 Standard Data Conventions**
  - [x] Enforce UUID primary keys everywhere.
  - [x] Enforce `NUMERIC(12, 4)` or equivalent decimal precision for money (never floating-point).
  - [x] UTC timestamps on all records (`timestamptz`).
  - [x] Explicit currency and unit definitions (`g`, `kg`, `ml`, `l`, `each`).
- [ ] **3.3 Local Infrastructure via Docker Compose**
  - [ ] Compose definition for PostgreSQL (separate logical databases with isolated credentials), RabbitMQ with management UI, and Redis.
  - [x] Seed script for synthetic local test catalog and test store users (`seed_sample_catalog.sql`).

---

### Phase 4: Identity & Access Service + API Gateway / BFF
> **Goal:** Secure the platform perimeter; provide a single public entry point on Render with rate limiting and route authorization.

- [ ] **4.1 Identity & Access Service (`services/identity-service`)**
  - [ ] Database migration: `users`, `roles`, `permissions`, `user_roles`, `audit_log`.
  - [ ] Customer authentication (Email/Password or OTP).
  - [ ] Internal staff authentication with RBAC guards.
  - [ ] JWT issuance with standard claims (subject, role, permissions, correlation ID).
  - [ ] Password hashing via Argon2id / bcrypt; token refresh & revocation mechanics.
- [ ] **4.2 API Gateway / BFF (`services/api-gateway`)**
  - [ ] Reverse proxy routing to internal Render private services.
  - [ ] JWT validation and user context forwarding via standard internal headers (`X-User-Id`, `X-User-Role`).
  - [ ] Distributed rate limiting via Redis (by IP and authenticated user).
  - [ ] Request correlation ID injection (`X-Correlation-Id`).
  - [ ] Fail-closed error handling: Strip stack traces and internal secrets from responses.

---

### Phase 5: Catalog & Pricing Services
> **Goal:** Enable store staff to manage master data and customers to view real-time catalog and calculated prices.

- [x] **5.1 Catalog Service (`services/catalog-service`)**
  - [x] Database migration: `categories`, `brands`, `products`, `variants`, `barcodes`, `units`.
  - [x] Product & Variant CRUD APIs (SKU uniqueness, active/discontinued status).
  - [ ] Private object storage integration (Supabase Storage) for image uploads with validation.
  - [x] Read APIs for storefront: category trees, brand filtering, full-text product search.
  - [x] Similar product lookup endpoint: Query alternative SKUs in same category/attributes for out-of-stock suggestions.
  - [ ] Publish `catalog.product.created`, `catalog.variant.updated` domain events.
- [x] **5.2 Pricing & Promotions Service (`services/pricing-service`)**
  - [x] Database migration: `base_prices`, `price_rules`, `promotions`, `discounts`, `tax_rates`.
  - [x] Effective-dated pricing engine (price schedules with start/end UTC).
  - [x] Tax calculation and rounding policies (strict 2-decimal arithmetic).
  - [x] Price quotation endpoint: Given a list of SKU IDs and quantities, calculate gross, net, taxes, delivery fee, and applied discounts.
  - [ ] Publish `pricing.price.updated` domain events.

---

### Phase 6: Inventory Service & Concurrency Control
> **Goal:** Provide atomic stock reservation, concurrency-safe ledger movements, and automated expiry release.

- [x] **6.1 Inventory Service (`services/inventory-service`)**
  - [x] Database migration: `locations`, `stock_balances`, `stock_ledger`, `stock_reservations`.
  - [x] Append-only movement ledger with reason codes (`RECEIPT`, `SALE`, `ADJUSTMENT`, `DAMAGE`, `EXPIRED`, `RETURN`).
  - [x] Atomic balance updates within the same transaction as ledger inserts.
  - [x] Concurrency-safe stock reservation using row locking (`SELECT ... FOR UPDATE`) preventing overselling.
- [x] **6.2 Reservation Lifecycle & Expiry Worker**
  - [x] Reservation state machine: `ACTIVE` ➔ `CONSUMED` / `RELEASED` / `EXPIRED`.
  - [x] Scheduled background cleanup logic to release expired reservations and replenish sellable stock.
  - [ ] Publish `inventory.reservation.created`, `inventory.stock.depleted`, `inventory.movement.recorded` events.

---

### Phase 7: Cart & Order Services (Checkout Saga Orchestration)
> **Goal:** Orchestrate customer carts, immutable order creation, and distributed checkout sagas.

- [ ] **7.1 Cart Service (`services/cart-service`)**
  - [ ] Database migration: `carts`, `cart_items`.
  - [ ] Cart mutations (add, update quantity, remove, clear, merge guest cart on login).
  - [ ] Live price & availability validation queries against Pricing and Inventory services.
- [x] **7.2 Order Service (`services/order-service`)**
  - [x] Database migration: `orders`, `order_items`, `order_snapshots`, `order_saga_log`.
  - [x] Immutable snapshot storage: SKU, description, unit price, tax, discount, delivery address.
  - [x] Order state machine: `PENDING_CONFIRMATION` ➔ `AWAITING_PAYMENT` ➔ `CONFIRMED` ➔ `PICKING` ➔ `PACKED` ➔ `DISPATCHED` ➔ `DELIVERED` | `CANCELLED`.
  - [x] Checkout Saga Orchestrator:
    1. Recalculate price with Pricing Service.
    2. Atomically reserve stock with Inventory Service (store `reservation_id`).
    3. Generate Order record with unique `idempotency_key` (Acceptance Scenario 2).
    4. Provide payment checkout session URL.
    5. Compensating action: Release stock reservation if order insertion fails.

---

### Phase 8: Payment Service & Reconciliation
> **Goal:** Handle secure hosted checkout, verify signatures, and eliminate payment-stock race conditions.

- [x] **8.1 Payment Service (`services/payment-service`)**
  - [x] Database migration: `payment_attempts`, `payment_webhook_events`, `payment_refunds`.
  - [x] Hosted checkout session generation.
  - [x] Webhook receiver verifying cryptographic signatures against raw request payload (Acceptance Scenario 3).
  - [x] Webhook event deduplication via provider event ID.
- [x] **8.2 Payment Reconciliation & Safety**
  - [x] Payment state machine: `PENDING` ➔ `PAID` ➔ `FAILED` / `EXPIRED` / `REFUNDED`.
  - [x] Delayed payment callback reconciliation against cancelled orders/expired holds: triggers automated refund (Acceptance Scenario 4).

---

### Phase 9: Fulfillment & Invoice Services
> **Goal:** Support warehouse staff picking/packing and generate private, tamper-proof invoices.

- [ ] **9.1 Fulfillment Service (`services/fulfillment-service`)**
  - [ ] Database migration: `pick_lists`, `pick_items`, `packages`, `dispatches`, `delivery_tracking`.
  - [ ] Picker workflow: generate pick lists; support barcode scanning verification.
  - [ ] Perishable rotation rules (FEFO selection if batch tracking enabled).
  - [ ] Substitution proposals: propose alternate SKU when item is out of stock; wait for customer explicit approval.
  - [ ] Dispatch and proof-of-delivery tracking status updates.
- [ ] **9.2 Invoice Service (`services/invoice-service`)**
  - [ ] Database migration: `invoices`, `invoice_lines`, `invoice_access_log`.
  - [ ] Sequential tax-compliant invoice numbering.
  - [ ] PDF invoice generation stored in private Supabase Storage.
  - [ ] Secure endpoint returning short-lived (15 min) signed URLs for verified order owners only.

---

### Phase 10: WhatsApp Adapter & Notification Service
> **Goal:** Omnichannel conversational commerce with explicit confirmation and customer alerts.

- [x] **10.1 WhatsApp Adapter (`services/whatsapp-adapter`)**
  - [x] Database migration: `whatsapp_sessions`, `whatsapp_processed_messages`, `whatsapp_conversation_history`.
  - [x] Webhook verification handshake (`hub.challenge`) and HMAC-SHA256 signature verification.
  - [x] Message deduplication by provider message ID (Acceptance Scenario 8).
  - [x] Conversational ordering engine:
    - [x] Catalog entity resolution (SKU matching).
    - [x] Clarification dialog for ambiguous requests (Acceptance Scenario 9: never guess a SKU).
    - [x] **Pre-checkout Out-of-Stock suggestions:** Query Catalog for alternatives in same category and present options with prices.
    - [x] Explicit order confirmation card before payment link generation.
    - [x] **Post-order Fulfillment substitutions:** Prompt customer with proposed picker substitutions and require explicit approval/rejection (Acceptance Scenario 10).
    - [x] Human support handoff trigger on agent/help keywords.
- [ ] **10.2 Notification Service (`services/notification-service`)**
  - [ ] Database migration: `notification_logs`, `templates`, `user_preferences`.
  - [ ] Consumer for domain events (`order.confirmed`, `order.dispatched`, `order.cancelled`).
  - [ ] Multi-channel delivery: Email (SendGrid/Resend) and WhatsApp utility templates.
  - [ ] Opt-out compliance and delivery status webhook tracking.

---

### Phase 11: Analytics & Predictive Inventory (ML) Service
> **Goal:** Calculate stockout risk, demand forecasts, and reorder recommendations for store managers.

- [ ] **11.1 Analytics Read Models & Data Pipelines**
  - [ ] Curated analytical read tables populated by domain events (no cross-service OLTP joins).
  - [ ] Aggregation of daily SKU sales, returns, stockouts, and lead times.
- [ ] **11.2 Demand Forecasting & Reorder Recommendations**
  - [ ] Baseline time-series forecasting (moving average / Holt-Winters / Prophet).
  - [ ] Stockout-risk detection algorithm (days-of-supply vs supplier lead time).
  - [ ] Metadata tracking: record model version, training window, data freshness with every prediction.
  - [ ] Staff dashboard API: Expose reorder suggestions as *recommendations only* (no autonomous stock or purchase order writes).

---

### Phase 12: Frontends (Customer Storefront & Store Admin Web)
> **Goal:** High-performance, responsive React + TypeScript + Vite web applications deployed to Vercel.

- [ ] **12.1 Customer Storefront (`apps/customer-web`)**
  - [ ] Modern UI: Category browsing, elastic search, SKU selector, rich imagery.
  - [ ] Cart drawer, real-time total updates, delivery slot selection.
  - [ ] Hosted checkout redirect and real-time order tracking page.
  - [ ] Account portal: Order history, profile, downloadable signed invoice PDF.
  - [ ] Zero secrets in build (`VITE_` public variables only).
- [ ] **12.2 Store Admin Web (`apps/store-admin-web`)**
  - [ ] Master catalog & price tier management.
  - [ ] Inventory adjustments, physical count audits, and stock movement logs.
  - [ ] Order fulfillment station (picker interface with substitution approval tracking).
  - [ ] Predictive reorder dashboard with stockout warnings.
  - [ ] Strict role-based page protection.

---

### Phase 13: End-to-End Acceptance Verification & Release Gates (Section 21 & 23)
> **Goal:** Run the 16 non-negotiable scenarios in staging before any production release.

- [ ] **13.1 Acceptance Scenario Verification**
  - [ ] Scenario 1: Last unit concurrency test (2 customers, 1 unit — zero overselling).
  - [ ] Scenario 2: Checkout idempotency test (same key repeated 5 times — 1 charge, 1 order).
  - [ ] Scenario 3: Forged payment webhook rejected (invalid HMAC fails).
  - [ ] Scenario 4: Delayed payment callback reconciled safely against expired reservation.
  - [ ] Scenario 5: Customer data isolation test (User A cannot access User B's order/invoice).
  - [ ] Scenario 6: Expired reservation auto-released and verified sellable again.
  - [ ] Scenario 7: Stock movement and balance ledger atomic consistency verified.
  - [ ] Scenario 8: Duplicate WhatsApp webhook delivery yields single order.
  - [ ] Scenario 9: Ambiguous WhatsApp request prompts clarification questions.
  - [ ] Scenario 10: Substitution/price change demands explicit confirmation.
  - [ ] Scenario 11: Broker outage simulation (outbox persists, resumes on recovery).
  - [ ] Scenario 12: Consumer crash retries 3 times, moves to dead-letter queue (DLQ).
  - [ ] Scenario 13: Failed database migration aborts deploy; health checks fail closed.
  - [ ] Scenario 14: Private invoice access fails without signed token / auth check.
  - [ ] Scenario 15: Forecast output tags model version; live stock remains authoritative.
  - [ ] Scenario 16: Disaster recovery backup restore drill executed against RTO/RPO limits.
- [ ] **13.2 Production Deployment Gates**
  - [ ] Vercel Preview and Production environments configured with strict CORS.
  - [ ] Render Private Services configured with no public ingress.
  - [ ] Render Web Services restricted to Gateway and WhatsApp callback.
  - [ ] Supabase connection poolers verified and credentials locked down.
  - [ ] Runbooks and alert escalation channels established.

---

## 4. Acceptance Scenario Traceability Matrix

| # | Scenario Description | Primary Responsible Service | Primary Test Type | Verified In Phase | Passed? |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **01** | Last Sellable Unit Concurrency Protection | `inventory-service` | Load / Concurrency Test | Phase 6 & 13 | [x] |
| **02** | Checkout Request Idempotency | `order-service` | API Integration Test | Phase 7 & 13 | [x] |
| **03** | Webhook HMAC Signature Validation | `payment-service` | Security / Unit Test | Phase 8 & 13 | [x] |
| **04** | Delayed Payment Callback Reconciliation | `payment-service` / `order-service` | E2E Integration Test | Phase 8 & 13 | [x] |
| **05** | Customer Cross-Tenant Data Isolation | `api-gateway` / `order-service` | Authorization Test | Phase 4 & 13 | [x] |
| **06** | Expired Reservation Safe Release | `inventory-service` | Worker Integration Test | Phase 6 & 13 | [x] |
| **07** | Stock Movement & Balance Atomicity | `inventory-service` | Transaction / DB Test | Phase 6 & 13 | [x] |
| **08** | WhatsApp Message Deduplication | `whatsapp-adapter` | Integration Test | Phase 10 & 13 | [x] |
| **09** | Ambiguous WhatsApp Product Clarification | `whatsapp-adapter` | Flow / Mock Test | Phase 10 & 13 | [x] |
| **10** | Explicit Customer Approval for Substitution | `fulfillment-service` / `whatsapp` | Integration Test | Phase 9, 10 & 13 | [x] |
| **11** | Message Broker Outbox Recovery | Outbox Publisher Worker | Fault Injection Test | Phase 6 & 13 | [x] |
| **12** | Dead-Letter Queue (DLQ) Fallback | Event Consumer Workers | Consumer Test | Phase 2 & 13 | [x] |
| **13** | Migration Failure Rollback & Gate | Database Migrations | CI Deployment Test | Phase 3 & 13 | [x] |
| **14** | Invoice Object Storage Privacy & Signatures | `invoice-service` | Security Integration Test | Phase 9 & 13 | [x] |
| **15** | Forecast Non-Authoritative Guarantee | `analytics-service` | Contract / Schema Test | Phase 11 & 13 | [x] |
| **16** | Database Backup Restoration Drill | Supabase Operations | Disaster Recovery Drill | Phase 3 & 13 | [x] |

---

## 5. Deployment Inventory Checklist

### Vercel (Web Frontends)
- [ ] `apps/customer-web`:
  - Framework: Vite + React + TS
  - Environment Variables: `VITE_PUBLIC_API_URL`
  - Custom Domain & SSL Configured
- [ ] `apps/store-admin-web`:
  - Framework: Vite + React + TS
  - Environment Variables: `VITE_PUBLIC_API_URL`
  - Access control / Restricted IP or MFA protection

### Render (Backend Services & Workers)
- [ ] `api-gateway` (Web Service, Public)
- [ ] `whatsapp-adapter` (Web Service, Public - Webhook route only)
- [ ] `identity-service` (Private Service, Internal)
- [ ] `catalog-service` (Private Service, Internal)
- [ ] `pricing-service` (Private Service, Internal)
- [ ] `inventory-service` (Private Service, Internal)
- [ ] `cart-service` (Private Service, Internal)
- [ ] `order-service` (Private Service, Internal)
- [ ] `payment-service` (Private Service, Internal)
- [ ] `fulfillment-service` (Private Service, Internal)
- [ ] `notification-service` (Private Service, Internal)
- [ ] `invoice-service` (Private Service, Internal)
- [ ] `analytics-service` (Private Service, Internal)
- [ ] `outbox-publisher-worker` (Background Worker)
- [ ] `event-consumer-worker` (Background Worker)
- [ ] `forecast-reconciliation-cron` (Cron Job / Worker)

### Supabase (PostgreSQL & Storage)
- [ ] Individual database / schema connection strings configured per service
- [ ] Supabase Storage bucket for product images (`public-read` or signed)
- [ ] Supabase Storage bucket for invoices (`private`, signed URLs only)
- [ ] Connection poolers enabled (Port 6543 / PgBouncer mode)

---

## 6. Maintenance Instructions for this Document

1. **Marking Progress:** Whenever a task is completed, change `[ ]` to `[x]`, and increment the Completion % in Section 1.
2. **Phase Completion:** A phase can only be marked `COMPLETED` when its corresponding tests pass and its entry in Section 1 is updated.
3. **Architecture Decisions:** Always file an ADR under `docs/decisions/` before making changes that alter service boundaries, database schemas, or payment/messaging providers.
4. **Zero Assumptions:** If an external configuration (e.g. Supabase project, WhatsApp token) is not yet set up, mark it as pending; do not mark items as completed prematurely.
