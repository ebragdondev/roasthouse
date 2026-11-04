# ROASTHOUSE — Phase 7: The Next Chapter

An original coffee-company strategy simulator with six focused departments, a redesigned interface, commercial contracts, executive decisions, a 13-week scenario forecaster, sustainability strategy, milestones, and optional authenticated cloud saves.

Phase 7 preserves the existing Phase 1–6 operating simulation (22 markets, 11 modeled currencies, 44 purchasable properties, corporate finance, franchises, warehouses, marketing, research, customer loyalty, staffing, IPOs, acquisitions, etc.). This is an independent original simulation, not a copy of Coffee Inc 2's graphics, code, or assets.

## Downloads and how to play

- **Offline edition:** Open the standalone `index.html` in a modern browser. The complete game is bundled into one file. Progress autosaves in browser storage; JSON export/import lets you back up or move your game.
- **Cloud edition:** Deploy the **entire source project** to Cloudflare Pages, and bind a Cloudflare D1 database as described below. Then the in-game Account menu supports real registration/login, authenticated cloud save slots, and cross-device restoration. Uploading `index.html` alone **does not provide secure cloud accounts**.
- Click **+ 1 week** to settle a week; the Run, Pause, and 1×/2×/4× controls still work.
- Open **Overview / CEO briefing** for choices, **Products / Commercial deals** for new revenue, **Corporate / Strategy** for brand policies, and **Finance / Forecasting** for 13-week scenario projections.
- Use **Ctrl+K** or **⌘K** to search all management screens; only six high-level departments appear in the sidebar.

## All six main departments

| Department | Focused views |
|---|---|
| Overview | Command center, CEO briefing, milestones, news |
| My Cafes | Store operations, design & service, customers, team, marketing, inventory, unit economics |
| Expansion | Global markets, city atlas, real estate, franchises, market research, rivals, acquisitions |
| Products | Product studio, R&D, sourcing, warehouses, commercial deals |
| Corporate | Strategy, headquarters, executive team |
| Finance | Statements, 13-week forecasting, banking, public markets, founder wealth |

The Account button is independent of the department navigation.

## Cloudflare Pages + D1 setup (required for real accounts/cloud saves)

Requirements: a Cloudflare account, a Pages project, and access to D1.

1. Install Node.js 20+ and install the project's build dependency: `npm install`.
2. Create a D1 database (this returns a `database_id`):
   ```bash
   npx wrangler login
   npx wrangler d1 create roasthouse-saves
   ```
3. Create database tables in the **remote** D1 database:
   ```bash
   npx wrangler d1 execute roasthouse-saves --remote --file=./migrations/0001_auth_saves.sql
   ```
4. Connect this source repository to your Cloudflare **Pages** project. Set **Build command** to `npm run build` and **Build output directory** to `dist`. Keep the project's `functions/` and `server/` directories in the repository; those are required for the account and save APIs.
5. Under **Workers & Pages → your Pages project → Settings → Bindings**, add a **D1 database** binding whose variable name is exactly **`DB`**, selecting `roasthouse-saves`. Redeploy the Pages project so Functions receive the binding. For local development you may use Wrangler's Pages local D1 binding workflow.
6. Open the deployed HTTPS site. Select **Account → Create an account**, register and choose **Save here** for one of the four cloud slots. Your game then syncs after every mutation. Other devices can sign in and use **Restore**.

Cloudflare's Pages documentation (current as of November 2026): [D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/), [local development](https://developers.cloudflare.com/pages/functions/local-development/), [routing](https://developers.cloudflare.com/pages/functions/routing/).

**Do not publish the Cloud Edition until you've configured D1 and completed your own security review.** This is a starter authentication implementation. It includes salted PBKDF2-SHA256 password hashing, 30-day HTTP-only SameSite session cookies (Secure on HTTPS), origin checks for mutations, basic login rate limiting, per-user save isolation, optimistic revision checking, and bounded save size. It does **not** yet include email ownership verification, password recovery, multi-factor authentication, human/bot verification, managed abuse response, account deletion UI, or an administrative console. For a public multi-user release, add those protections before accepting real users.

### Cloud save behavior

- Browser progress is always saved locally under `roasthouse-phase7-v1` (when browser storage is available).
- Registration and sign-in do **not** silently replace or upload your current game. Pick a save slot and explicitly **Restore** a remote copy or **Save here** to upload this device's game.
- Four per-account save slots: `autosave`, `slot1`, `slot2`, `slot3`. Once a slot is selected, gameplay changes debounce into automatic cloud saves.
- The save API tracks revisions and refuses stale writes (409 Conflict). After a conflict, refresh slots and either restore the cloud version or deliberately overwrite with the local version.
- Export a standalone JSON backup from Account at any time. A JSON file can be restored even if the backend is unavailable.
- A previous Phase 6 save on the same browser origin is imported into Phase 7 **without overwriting the old Phase 6 key**. Earlier Phase 1–5 imports remain supported. A downloaded `file://` copy and a hosted site do not share browser storage.
- User passwords are stored as salted hashes, not plain text. Session tokens are randomly generated and stored only as SHA-256 hashes in the database.

### Authentication and storage APIs

```
POST  /api/auth/register       email + password
POST  /api/auth/login          email + password
GET   /api/auth/me             current user / availability
POST  /api/auth/logout         invalidate this session
GET   /api/saves               list current user's four save slots
GET   /api/saves/:slot         get a save (with revision)
PUT   /api/saves/:slot         update save with expectedRevision
DELETE /api/saves/:slot        delete one save
```

All save APIs are session-authenticated. Saves are isolated by user ID and slot. The server does not trust a user ID passed from the browser.

## Source architecture

```
functions/api/auth/                Cloudflare Pages Functions for registration, login, logout, sessions
functions/api/saves/               Cloudflare Pages Functions for save-slot CRUD
server/common.js                   Crypto, request validation, cookie management, guards
migrations/0001_auth_saves.sql     D1 database schema
src/customer-economy.ts            Typed pure cohort model
src/empire-world.ts                Global world + capital markets and franchises
src/engine.ts                      Weekly deterministic reducer + accounting + save migration
src/phase7.ts                      CEO events, commercial deals, sustainability, milestones
src/phase7-forecast.ts             Pure 13-week scenario predictions on cloned states
src/phase7-ui.ts                   Six-department navigation, phase7 screens, cloud client
src/ui.ts                          Original 26 screens, actions, and persistence adapter
template.html                      New responsive espresso/olive visual system
scripts/build.cjs                  Compiles all modules into one browser HTML
tests/phase7-simulation.cjs        Economic stress and save migration tests
tests/cloud-api.cjs                Account/save endpoint integration with SQLite test DB
tests/mobile_quick.py             Chromium mobile navigation smoke test
tests/cloud_client_mock.py        Chromium cloud client interaction smoke test
```

## Build and tests

```bash
npm install
npm run verify
python tests/mobile_quick.py         # optional Chromium + Python Playwright
python tests/cloud_client_mock.py    # optional Chromium + Python Playwright
```

The build produces `dist/index.html` and a root `index.html`. `npm run verify` checks the typed customer model, the original economic engine with new accounting, Cloudflare API authorization against a compatible in-memory SQLite wrapper, and the standalone build. Actual production Cloudflare D1/network deployment was **not** performed in this package.

### Accounting rules for Phase 7

- Commercial contract receipts count toward company **revenue** only when weekly company-owned unit sales reach the agreed quantity. Franchisee unit sales never count toward owned-store fulfillment.
- Commercial onboarding fees, strategy changes, and boardroom spending deduct cash immediately and are expensed once at the following weekly close.
- Sustainability purchases are capital investments and are not charged to weekly operating profit; their incremental weekly overhead is a recurring operating expense.
- Corporate receipts and expenses remain denominated in integer USD cents. Weekly net profit reconciles against revenue, operating expenses, and interest.
- The 13-week forecast runs on deep copies of the full game state. It cannot change the currently active game, and its synthetic scenarios are not guaranteed forecasts.

## Limitations

This is a sophisticated original strategy-game model, not GAAP/IFRS accounting, a security-audited production identity service, or a faithful reproduction of any proprietary game. The legacy UI/engine still contain some JavaScript under TypeScript `@ts-nocheck` modules; the customer model itself is strictly typed. No real securities, currency rates, or company information are used.
