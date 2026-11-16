# Production roadmap

The current package is a local prototype. To turn it into the public multi-customer SaaS requested:

1. **Backend and tenant isolation**
   - PostgreSQL/Supabase schema with `tenant_id` on every business record.
   - Row-level security so a customer can never read another customer's products, sales, orders or reports.
   - Auth, email verification, password reset, owner/admin roles and audit log.
2. **Workbook parity**
   - Implement returns, partial collections, daily cashier ledger, opening receivable, recovery indicator and month-start reporting.
   - Build automated tests that compare the same input cases against Excel outputs.
3. **Multi-currency accounting**
   - Store transaction amount, transaction currency, FX rate, base-currency equivalent and rate timestamp.
   - Never overwrite the original transaction amount when rates change.
   - Configure gateway-supported currencies separately from display currencies.
4. **Online store**
   - Public catalog and checkout API, delivery settings, order lifecycle, stock reservation, cancellation and refunds.
5. **Payments and subscriptions**
   - Select a gateway only after confirming Pakistani merchant eligibility, supported customer currencies, settlement currency, fees and recurring-payment support.
   - Verify payment using signed webhooks/server-side API; only then activate monthly, quarterly, 6-month, yearly or lifetime subscription.
   - Never trust a browser redirect as proof of payment.
6. **Deployment**
   - Domain, HTTPS, production database, backups, monitoring, email service and privacy/terms pages.
   - Configure WhatsApp Business contact/API if automated messages are required.

No gateway, credentials, domain, hosting or cloud database are configured in this prototype. Live payment or public deployment must not be represented as complete until those integrations are tested.


## Branding / domain decision (November 2026)
- Product brand remains **Accounts Management**.
- Tagline: **Smart Accounts. Better Business.**
- Short web address selected by owner: `avenuex.online`.
- Domain purchase and ownership have not been verified in this package. After purchase, connect DNS, configure HTTPS, hosting, production backend, and customer-facing store routing.
- The current package remains a local browser prototype; it is not published or indexed on Google and is not a Play Store app.
