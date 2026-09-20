# GHARSA V2 implementation tracking

Source: user-supplied GHARSA_V2_Implementation_Script_WITH_ORIGINAL_IMAGES.pdf (10 pages). Original screenshot pages retained in docs/v2-reference. Their purpose is visual reference, not embedding competitor sites or shipping screenshots as interactive UI.

- [ ] Relational migrations, translations, V2 RBAC/resources
- [ ] Variation stock, cart/order snapshots, bundle pricing
- [ ] Delivery rules, policy eligibility, returns/guarantee claims
- [ ] Newsletter welcome discount, stock alerts, durable email outbox
- [ ] Secure Google authorization-code integration (external credentials needed)
- [ ] English/Arabic UI/content, RTL, guest wishlist/compare
- [ ] Visual product specifications/descriptions, placement, regional calendars
- [ ] FAQ, announcement, hero, newsletter, footer
- [ ] Full V2 admin controls
- [ ] Integration/browser tests, migrations on local database, docs

Existing account credentials, orders, and user-managed V1 content must be preserved. Seed additions must be idempotent. External Google and SMTP credentials must be supplied locally; no fake live login/email delivery.

## Resumed verification — September 20, 2026

The checklist above is the original acceptance backlog, not an accurate inventory
of missing code. Migrations 001–004 and substantial V2 API, storefront and admin
implementation are present. All 14 API integration groups and the production build
pass. See [verification details](VERIFICATION.md#v2-continuation-verification--september-20-2026).

The previous Arabic mobile failure no longer reproduces. The FAQ browser test now
uses the application's confirmation modal, checks actual Arabic publishing, and
cleans up its fixtures after failures.

Confirmed outstanding implementation: Google OAuth and an outgoing email worker/
transport. These are disabled in code, not merely waiting for credentials. Full
translation coverage and remaining source requirements need a final acceptance
review before marking the original checklist complete.
