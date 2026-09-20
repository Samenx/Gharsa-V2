# GHARSA

An independent plant shop built with React, Vite, React Router, Express, and PostgreSQL. The storefront uses the existing GHARSA site's branding, locally hosted catalogue images, page content, and green/cream visual identity. It does not run, embed, or call WordPress or WooCommerce.

## Requirements

- Node.js 22.12 or newer and npm
- PostgreSQL 15 or newer
- pgAdmin 4, optional
- A modern browser

## Quick start

```bash
npm install
cp backend/.env.example backend/.env
```

Create the database, fill in `backend/.env`, then run:

```bash
npm run migrate
npm run seed
npm run dev
```

- Store: http://localhost:5173
- Administration: http://localhost:5173/admin
- API health: http://localhost:5000/api/health

The frontend and backend can also run separately:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

The seed creates the first Super Admin using `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_NAME`. Sign in through `/login`. Passwords are hashed with bcrypt. The seed will not reset an existing primary administrator's password or overwrite existing store content.

To import the complete 100-plant spreadsheet and its care profiles, run:

```bash
npm run import:plants --workspace backend -- /path/to/GHARSA_Complete_Plant_Database_100_No_Blanks.xlsx
```

The importer updates matching product names, adds missing plants, preserves existing product images, and stores the full care, safety, placement, price, and source details as structured product fields.

**This workspace is already configured:** the development admin email is `admin@gharsa.local`. Its randomly generated password is in the ignored, owner-readable `backend/.env` file under `SUPER_ADMIN_PASSWORD`. No password is committed to source code.

## PostgreSQL and pgAdmin 4

1. Install PostgreSQL and start its database service.
2. In pgAdmin, choose **Register → Server**. Enter a display name such as `Local PostgreSQL`.
3. Under **Connection**, enter your server host, port (usually `5432`), maintenance database `postgres`, and PostgreSQL username/password.
4. Right-click **Databases → Create → Database**. Name the database `gharsa` and select its owner.
5. Set matching `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `backend/.env`.
6. Run `npm run migrate`, followed by `npm run seed`.
7. Refresh **Schemas → public → Tables** in pgAdmin to inspect the schema and persisted data.

Alternatively, from PostgreSQL's command line:

```sql
CREATE DATABASE gharsa;
```

Use a dedicated database role and password for deployed installations. The application role needs access to its database; it does not need cluster-wide superuser privileges during normal operation. Use an appropriate migration owner when applying schema changes.

### Included local database helper

For a self-contained development environment with PostgreSQL binaries installed:

```bash
npm run db:start
npm run migrate
npm run seed
npm run dev
```

The helper stores data in `.local/postgres` (ignored by Git), binds to `127.0.0.1`, and uses the configured `DB_PORT`, `DB_USER`, and `DB_PASSWORD`. It requires a nonempty database password. The preconfigured workspace uses port `55432`, database `gharsa`, and role `gharsa`. pgAdmin can connect using those values and the password in `backend/.env`.

```bash
npm run db:status
npm run db:stop
```

The database survives application restarts. Keep `.local/postgres` or use your normal PostgreSQL service; deleting that directory deletes this local database. Uploaded images are in `backend/uploads` and must also be retained.

## Environment variables

See [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example).

| Variable                                                  | Purpose                                       |
| --------------------------------------------------------- | --------------------------------------------- |
| `PORT`                                                    | Express port, normally `5000`                 |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection                         |
| `JWT_SECRET`                                              | Random signing secret, at least 32 characters |
| `JWT_EXPIRES_IN`                                          | Session lifetime, default `1d`                |
| `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`                   | Initial primary administrator                 |
| `SUPER_ADMIN_PASSWORD`                                    | Seed password, at least 12 characters         |
| `FRONTEND_URL`                                            | Exact allowed browser origin                  |
| `PUBLIC_URL`                                              | Public website URL for sitemap/robots         |
| `NODE_ENV`                                                | `development` or `production`                 |
| `VITE_API_URL`                                            | Frontend API base, default `/api`             |

Generate a signing secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

JWTs live in browser session storage. Guest carts use local storage. Authenticated carts, profiles, addresses, orders, wishlist entries, and store content live in PostgreSQL. Permissions and account status are loaded from the database for every authenticated API request; tokens do not embed trusted roles. Password changes and logout revoke prior tokens. Sessions expire at the configured lifetime and require signing in again.

## Store features

- All 15 products from the reference's public catalogue, their available galleries, and the requested category/subcategory hierarchy.
- Homepage, About, Contact, shop/search, product detail, cart, checkout, and customer account pages.
- Search across product names/descriptions/SKUs and assigned categories; price, category, and sale filters; sorting and pagination.
- Server-side coupon validation, JOD totals, configurable shipping/tax, and cash on delivery.
- Transactional inventory, ordered row locks to prevent overselling, and checkout idempotency keys to prevent duplicate orders.
- Cancellation/refund restores stock once; terminal orders cannot be reopened. Completing a cash-on-delivery order marks payment as paid.
- Customer profile, saved addresses, password changes, orders, wishlist, and moderated reviews.
- Local images, responsive layouts, keyboard navigation, accessible form labels, image zoom, and feedback/error states.

Initial stock quantities are representative seed inventory, not a claim about the reference store's live stock. Confirm quantities and shipping settings before taking real orders. `WELCOME10` is a seeded 10% coupon with a JOD 5 minimum and one use per customer. Testimonials and company copy can be edited in the CMS.

## Administration

Every editing operation goes through authenticated, permission-checked API endpoints and persists in PostgreSQL.

| Area               | Capabilities                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Dashboard          | Sales, orders, customers, products, stock alerts, recent activity, best sellers, daily chart                   |
| Products           | Create/edit/delete/duplicate, visibility, prices, categories, media gallery, attributes, related products, SEO |
| Categories         | Nested hierarchy, images, ordering, visibility, cycle prevention, SEO                                          |
| Inventory          | Set/add/remove stock through a new quantity, reason, low-stock threshold, stock status, audit history          |
| Orders             | Customer/address/items, trusted totals, payment status, allowed status transitions, stock restoration          |
| Customers/users    | Create/edit/disable/reactivate, password reset, role assignment, customer orders; safe deletion rules          |
| Roles              | Custom roles and permission selection; protected built-in roles; no delegation of permissions the actor lacks  |
| Pages/page builder | Create/edit/publish/unpublish/duplicate/delete, slug/SEO, add/edit/hide/duplicate/reorder sections             |
| Homepage           | Slider, benefits, promotion, categories, product selection, testimonials, section order                        |
| Navigation         | Menus, arbitrary nested items, category/page links, custom destinations, ordering                              |
| Coupons            | Fixed/percentage discounts, dates, minimum, cap, usage limits, product/category eligibility                    |
| Reviews            | Approve, hide, delete; approved reviews determine storefront averages                                          |
| Media              | Upload, preview, metadata/alt text, reusable selection, prevent deletion of referenced images                  |
| Inbox              | Search, view, read/unread, delete contact submissions                                                          |
| Settings           | Branding, contacts, notice, footer, shipping, tax, page size, COD availability                                 |
| SEO                | Page/product/category metadata, canonical URL, indexing flag; sitemap.xml and robots.txt                       |
| Audit              | Actor, action, resource, description, timestamp                                                                |

The primary Super Admin cannot be disabled or deleted and must retain the Super Admin role. Built-in roles are protected; create a custom role to adjust responsibilities. `CONTENT_MANAGER` does not receive inventory, orders, user, or role administration permissions. User role assignment separately requires `roles.edit`.

Products start with **zero stock** when created. Use Inventory to add units with a reason. Duplicated products are inactive and also start at zero stock. Used coupons cannot be deleted because their redemption history is retained; deactivate them instead. Categories in use must be reassigned before deletion. Customers with orders can be disabled rather than deleted.

### CMS sections

Supported section types: Hero, Image Slider, Text, Rich Text, Image + Text, Category Grid, Product Grid, Featured Products, Popular Products, Sale Products, Testimonials, CTA Banner, Features, Contact Form, Gallery, and sanitized Custom HTML.

The page builder has guided slide/image/benefit controls and section ordering buttons. The Sections editor also exposes JSON configuration for advanced settings. For example:

```json
{
  "source": "popular",
  "limit": 4,
  "columns": 4,
  "showPrice": true,
  "showRating": true,
  "showAddToCart": true,
  "product_ids": []
}
```

An empty product selection uses the selected automatic source. Category cards use `category_ids`. Product and category IDs are visible in the relevant API/admin records. Rich content is sanitized; arbitrary scripts and unsafe URLs are rejected. Pages must be published to appear at their slug. Core application routes cannot be used as CMS slugs.

The reference's slider contains typography baked into its images. Replace a slide image or add overlay text through the page builder to change that artwork's message. The default “For $50 order” benefit text follows the requested reference wording; actual shipping is calculated in JOD from Site Settings.

## API and architecture

```text
frontend/
  src/api/                HTTP client and money presentation
  src/components/         Storefront, CMS rendering, common UI
  src/context/            Auth, guest/server cart, global state
  src/pages/              Customer flows
  src/pages/admin/        Protected editors and operations
  src/styles/             Responsive storefront/admin CSS
  public/images/          Optimized, locally served reference assets
backend/
  src/config/             PostgreSQL pool and resource schemas
  src/controllers/        Generic admin resource controllers
  src/middleware/         Authentication and RBAC
  src/routes/             Auth, catalogue, admin, media REST routes
  src/services/           Checkout, inventory transitions, CMS writes, payments
  src/validators/         Request validation and safe URL rules
  src/utils/              Error handling
  database/migrations/    Versioned SQL schema
  database/seeds/         Idempotent seed, reference catalogue/assets
  tests/                  PostgreSQL integration tests
  uploads/                Validated uploaded images
```

Main API groups: `/api/auth`, `/api/products`, `/api/categories`, `/api/cart`, `/api/checkout`, `/api/orders`, `/api/reviews`, `/api/wishlist`, `/api/pages`, `/api/navigation`, `/api/settings`, `/api/contact`, and `/api/admin/*`. Coupon application is validated by `/api/cart/quote` and revalidated by `/api/checkout`.

Database tables include users/roles/permissions and their join tables, products/images/attributes/relations, categories, inventory transactions, carts/items, wishlists/items, orders/items, reviews, coupons/scopes/usage, pages/sections, menus/items, testimonials, contact messages, media, settings, addresses, and audit logs. Foreign keys and constraints protect references, prices, quantities, and uniqueness. Migration application is tracked in `schema_migrations`.

SQL values are parameterized. Dynamic table/column names come only from server-owned allowlists. Admin writes and audit entries share transactions. Media uploads validate decoded image content, reject unsupported formats, limit file size/pixel count, generate unique filenames, strip metadata, and encode WebP. The app uses Helmet, origin-restricted CORS, and request/auth/contact/checkout rate limits. Bearer tokens are explicitly attached to requests rather than automatically sent in cookies.

Cash on delivery is the implemented payment method. The payment adapter is in `backend/src/services/payments.js`. Additional gateways need server-side intent creation and verified webhook handling; there is no simulated card payment or card-number storage.

## Tests

```bash
npm test
```

The backend suite creates a uniquely named temporary database, migrates/seeds it, tests real HTTP/API operations against PostgreSQL, and drops that database afterward. The configured database user needs `CREATEDB` for this test command. Normal application operation does not need that permission.

Coverage includes authentication, customer/admin denial, content-manager isolation, permission changes, disabled accounts, protected primary admin, catalogue CRUD, hierarchy cycles, stock history, cart persistence, wishlist, review moderation, coupon scope/usage, trusted totals, order ownership, idempotency, cancellation/restocking, concurrent oversell prevention, CMS publishing/ordering/XSS sanitization, menus, settings, SEO, contact messages, image validation/reference protection, and audit records.

For browser tests, start the application first, then:

```bash
npx playwright install chromium
npm run test:e2e
```

Run browser tests against a development database. They exercise guest-cart migration, registration, login, checkout, order details, wishlist, review submission, real admin edits, page publication, all admin destinations, mobile navigation, filtering/search, and contact submission. Test-only customer/order/message fixtures are cleaned up; test orders' stock is restored.

```bash
npm run build
npm run format
```

## Production

```bash
npm ci
npm run migrate
npm run seed
npm run build
NODE_ENV=production npm start --workspace backend
```

Serve `frontend/dist` with a web server and route non-file frontend requests to `index.html`. Proxy `/api`, `/uploads`, `/sitemap.xml`, and `/robots.txt` to Express. [docs/nginx.conf](docs/nginx.conf) provides an example. Set `FRONTEND_URL` and `PUBLIC_URL` to the HTTPS site origin. Use a persistent PostgreSQL service and retain/back up uploaded images with the database. Supply your own production administrator password, database password, and JWT secret.

If a trusted reverse proxy supplies the client IP, set `TRUST_PROXY_HOPS` to its exact hop count; leave it at `0` for direct connections. This preserves meaningful rate limiting without trusting arbitrary forwarding headers. Terminate HTTPS at your reverse proxy.

Public page metadata is updated by the React app; this is a client-rendered Vite application, not an SSR implementation. Sitemap and robots are server-generated. No email service or online payment gateway is configured. Contact messages are stored in the admin inbox and checkout supports COD.

## Reference and verification

Reference: https://dev-greenwow.pantheonsite.io/ . Source catalogue and images were retrieved from its public endpoints; the application uses local copies. The reference's `/shop/` currently renders an empty alternate catalogue, while product pages and its public product catalogue contain 15 plants. This rebuild displays those real seeded products in a functioning shop.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for checked flows and limits of verification.
