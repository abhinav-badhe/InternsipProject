# Codebase assessment — 4 November 2026

The platform is a substantial working prototype, not a verified production release. This assessment is based on source inspection, production compilation, the existing automated tests, and browser checks of both frontends with the backend stopped. No remote database was migrated or modified.

## Implemented in source

| Area | Evidence and completion boundary |
| --- | --- |
| Workspace | 18 projects: root, two React 19/Vite/Tailwind v4 apps, 12 services including the gateway, two shared packages, and one worker package. |
| Core commerce | Catalog/search/disambiguation, pricing/taxes/promotions, stock ledger/reservations, checkout saga, order lifecycle, fulfillment, and invoices have implementations, migrations, and service tests. Tests use mocks; they do not establish live integration readiness. |
| Identity and gateway | Password hashing, JWTs, customer/staff authentication, MFA, route forwarding, and rate limiting exist. Authorization and production secret handling need review (see below). |
| Storefront | Search/filter/sort, pack variants, cart, authentication, addresses, orders, wallet, referrals, subscriptions, recipes, and payment screens exist. Several API clients substitute sample data on failure. |
| Seller hub | Inventory, catalog, orders, pick/pack scanner, invoices, forecasts, WhatsApp simulator, riders, suppliers, and customer analytics screens exist. Some operational data is initialized from samples or generated locally. |
| Add-ons | Voice transcription, shopping-list OCR, multilingual WhatsApp, delivery/rider workflows, purchase orders, wallets, subscriptions, coupons, recommendations, and CLV/churn have code. Provider credentials and live acceptance checks remain necessary. |
| Wave picking and e-way bills | Source contains wave APIs and e-way bill routes despite tracker entries saying not started. E-way bill numbers/acknowledgements are generated locally; this does not establish government integration. |
| Resilience | Outbox publishing, retries/DLQ, migration gates, and disaster-recovery helpers have tests. The running worker's broker adapter currently logs dispatch instead of publishing to a durable broker. |

## Open work and release blockers

1. **Secrets:** tracked source includes embedded database credentials, for example `workers/event-workers/src/worker.runner.ts`. Remove embedded credentials, require environment configuration, and rotate exposed credentials before deployment. Credential values are intentionally omitted here.
2. **Authorization:** public registration forwards a client-provided role to `AuthService.register`. Restrict self-registration to customer accounts and authorize staff provisioning. This finding is from source inspection, not a live exploit test.
3. **Payments:** provider order IDs are constructed locally. Payment verification accepts a `test_sig_` prefix, including in production; split-payment confirmation also needs a verification review. Live payment processing is not complete merely because the UI and routes exist.
4. **Provider delivery:** notification dispatch generates a local message ID; durable broker delivery and live notification-provider behavior need implementation/verification. WhatsApp, OCR, and transcription also have simulation/configuration-dependent paths.
5. **Infrastructure:** no checked-in CI workflow, Docker Compose setup, or functional lint configuration was found. Root `pnpm lint` currently fails because no workspace defines a lint script.
6. **Roadmap accuracy:** the implementation tracker labels every phase complete while leaving many detailed tasks unchecked. The add-on tracker also understates some existing code. Do not use its percentages as release evidence. Proactive WhatsApp reordering/reminders and WhatsApp location ordering still lack verified complete flows.
7. **Frontend coverage:** this pass improves the primary storefront, cart, and seller shell. Existing forms, tables, and other modals still need broader shadcn, form-validation, table, and toast adoption to meet every `STYLE.md` rule. Both apps remain Vite apps; the document specifies Next.js App Router. No framework migration was attempted.
8. **Remaining polish:** bundled sample catalog images sometimes do not match the named product. Both frontend bundles still trigger Vite's warning for chunks above 500 kB. Live auth, checkout, database concurrency, delivery, payment, and external provider flows need integration testing.

## Changes made in this pass

- Installed all workspace dependencies and verified the updated frozen lockfile; pinned `pnpm@11.15.1` in `packageManager`.
- Fixed root `build` to build every workspace and root `typecheck` to check services/shared packages and both apps.
- Applied OKLCH teal tokens, Plus Jakarta Sans / JetBrains Mono, compact radii, flat borders, visible focus, and reduced-motion support. Primary teal is darker than the reference token to keep white control text readable.
- Reorganized storefront actions into a responsive header and services strip; made address selection available on mobile and replaced custom category scrollbar code with native scrolling.
- Added a shadcn Sheet sourced from the official registry, using Radix Dialog primitives for cart focus management, Escape dismissal, and a full-width mobile panel.
- Added mobile seller navigation, clearer action labels, readable product titles/prices, sample-data notices, and accessible control names.
- Fixed selected-pack cart quantities, capped quantity increases at available stock, and replaced offline wallet credits with an inactive zero balance. This also removes an uncaught wallet-fetch rejection during offline browsing.
- Preserved the pre-existing user edits to `STYLE.md`.

## Verification

- Existing service/worker suite: **68 tests passed, zero failures** across 13 test-running workspaces.
- `pnpm build`: all workspace builds pass; frontend chunk-size warnings remain.
- `pnpm typecheck`: passes for backend/shared packages and both apps.
- `pnpm install --frozen-lockfile`: passes after adding the sheet dependencies.
- Browser: Playwright with installed Microsoft Edge, because the Browser plugin is unavailable. Checked `http://127.0.0.1:5173` and `http://127.0.0.1:5174` at 1440×1000 and 390×844.
- Verified meaningful page content, expected titles, no framework overlay or uncaught page errors, search suggestions/Escape, empty-result reset, add-to-cart, independent pack quantities, cart viewport bounds, cart focus trapping/return, and mobile admin navigation. Screenshots were visually inspected.
- Console still reports expected unavailable-backend proxy/API errors and some missing image resources. These checks validate preview behavior, not a clean live-service session. Screenshots and temporary QA scripts are outside the repository.
