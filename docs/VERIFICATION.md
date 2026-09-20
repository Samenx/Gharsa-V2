# Verification

The implementation was exercised locally with a real PostgreSQL 18 database, Express HTTP requests, a production Vite build, and Chromium browser tests. These checks cover the implemented development environment, not a deployed payment gateway or production load profile.

## Automated checks

- `npm test`: 14 integration groups, all passing (rechecked September 20, 2026). Each run creates and removes a separate PostgreSQL database.
- `npm run test:e2e`: customer, administrator, and responsive storefront journeys.
- `npm run build`: optimized frontend production build.
- Dependency audit after upgrading `sharp`: no reported vulnerabilities.

### Database/API coverage

- Register, duplicate registration, invalid login, profile updates, addresses and ownership, password changes, token revocation, logout.
- Customer denial at administration endpoints; content-manager isolation from inventory/orders/users; immediate backend effect of account/permission changes.
- Custom roles, assignment checks, protected primary administrator, and refusal to edit/reset/delete a more privileged account through a limited role.
- Product/category creation, update, duplication and deletion; nested filtering, search, sale/price filtering, circular hierarchy rejection.
- Every seeded product can be reopened and saved through the admin product API. Customer responses exclude internal cost prices.
- Stock adjustments/history; two concurrent checkouts for one available unit produce one order and one rejection.
- Multi-item checkout failure leaves inventory unchanged. Client-supplied prices/totals are ignored.
- Cart persistence, wishlist add/remove, review moderation and computed ratings.
- Coupons: scope, minimum, start/expiry, limits, cap, percentage/fixed calculations; shipping/tax configuration and disabled COD.
- Checkout idempotency; customer order ownership; stock deduction and one-time restoration; invalid status transitions rejected.
- Pages/sections: publication, duplication, section ordering, safe HTML, rejection of unsafe links, navigation changes, site settings and SEO persistence.
- Contact inbox changes, testimonials, invalid image rejection, upload/re-encoding, alt/title updates, reference-aware media deletion and audit records.

### Browser coverage

- Guest add-to-cart and refresh persistence; registration merges that cart into the customer's server cart.
- Quantity update, coupon application, checkout, successful order, order history and order detail navigation.
- Wishlist, review submission and logout.
- Administrator login and loaded dashboard data; all sidebar destinations.
- Create a product, record inventory, view stock history, add a homepage section, verify public rendering, delete the section and test product.
- Mobile navigation, category selection, search and contact form submission.
- No horizontal overflow on the tested public pages at 390 px. Additional visual inspection covers 768, 1024 and 1440 px widths.

Browser fixtures are identifiable test customers/messages. The test teardown removes those fixtures and restores their order stock. Uploaded media used in API tests is removed. No test data is needed by the production application.

## Reference inspection

The reference homepage, About, Contact, shop and product pages were inspected through their HTML/styles/assets and rendered browser pages. The original dark-green header, pale navigation, cream category bar, slider artwork, botanical promotion, category images, product photography, testimonial treatment, footer background and logo informed the implementation.

The reference shop route showed an empty alternate catalogue during inspection. Its public catalogue and product pages exposed 15 plant products, which were imported as local seed data. The rebuild's shop is connected to PostgreSQL and displays that catalogue with working filters and pagination.

The reference's own lazy-loaded images and sandbox/cookie notices were not reproduced as application behavior. Responsive navigation, functional shop filtering, account flows and administration are implemented natively.

## Screenshots

- [Homepage desktop](screenshots/home-desktop.png)
- [Homepage mobile](screenshots/home-mobile.png)
- [Shop](screenshots/shop-desktop.png)
- [Product detail](screenshots/product-desktop.png)
- [About](screenshots/about-desktop.png)
- [Contact](screenshots/contact-desktop.png)
- [Admin desktop](screenshots/admin-desktop.png)
- [Admin mobile](screenshots/admin-mobile.png)

## Deployment limits

- Payments: cash on delivery only. Online gateways require a real provider integration; no payment is simulated.
- Contact submissions are saved to the inbox. Outgoing email/SMS is not configured.
- Public SEO metadata is client-rendered. Sitemap and robots are served by Express.
- Seed stock quantities are representative, not synchronized live inventory.
- No production hosting, load test, external penetration test, or real delivery/payment transaction was performed.

## V2 continuation verification — September 20, 2026

The production build and all 14 API integration groups passed. The existing three
storefront browser journeys passed. V2 browser checks cover persistent guest
wishlist, comparison, FAQ search, Office collections, Arabic RTL mobile routes,
and administration module loading. FAQ publishing is checked in both English and
Arabic, including the translated answer and deletion through the confirmation
modal. Teardown removes matching FAQ fixtures if a run fails before UI cleanup.

Additional API groups exercise localized content and delivery estimates; variation
and bundle checkout with stock restoration; newsletter consent, deduplication and
welcome-discount redemption; and delivered-order return/guarantee eligibility,
private evidence ownership and administrative review.

These passing checks do not establish complete V2 acceptance. Google OAuth is not
implemented: `/api/v2/site` reports `google_enabled: false`. Email subscriptions
and stock-event outbox records persist, but there is no email transport/worker;
`email_enabled` is false. Both integrations require implementation and external
configuration. Complete Arabic content coverage and the full source requirements
still need an acceptance review. Return and guarantee policies are seeded as drafts.
