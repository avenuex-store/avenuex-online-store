# Accounts Management — Professional Workbook-Based Prototype

**Brand:** Accounts Management  
**Tagline:** Smart Accounts. Better Business.  
**Default currency:** PKR  
**Owner contact configured in the prototype:** hadidaniish@gmail.com
**Planned domain:** `avenuex.online` (not yet connected; configure DNS and hosting after purchase)

## Open the application
1. Extract the ZIP file.
2. Open `index.html` in a modern browser (Chrome or Edge recommended).
3. The demo data is loaded from `workbook-seed-data.json` on first open. Because browsers restrict `fetch()` from local files, use the included local server:
   - Windows: open PowerShell in this folder and run `python -m http.server 8000`
   - Then visit `http://localhost:8000`
   - If Python is not installed, use VS Code Live Server.
4. The browser stores edits in local storage. Use **Export backup** regularly.

## Data basis
The product seed and transaction history were extracted from `Sale_Point_POS_Print_Ready File Updated(1).xlsm`:
- Stock Master: six populated SKUs (codes 1001, 1002, 1003, 1004, 1005, 1106).
- Item Sales: 41 populated item-line transactions, including the original bill numbers, cashier, customer, quantities, rates, discounts, payment type and date.
- The workbook's available quantities reconcile to the extracted sale lines: 81, 67, 87, 17, 42 and 102 respectively.
- The source workbook is included unchanged as `source-workbook-original.xlsm`.

## Included prototype workflows
- PKR-first currency display, with PKR, USD, EUR, GBP, AED, SAR, CAD and AUD selectors.
- Editable indicative FX rates (each foreign currency rate is expressed as PKR per one unit).
- POS multi-item bill; item-code lookup fills product name, available quantity and sale rate.
- Discount %, bill totals, payment method, amount received, balance and printable receipt.
- Stock master add/edit, CSV import, low-stock warning, and out-of-stock selling guard.
- Item Sales register and CSV export.
- Online store preview with multi-item cart, quantity +/- controls, bundle deals, product images, customer order form, order lifecycle and stock deduction on acceptance.
- Currency-aware dashboard and monthly summaries.

## Important limitations — not a live SaaS yet
This is a professional local prototype, not a hosted production service. It does **not** yet provide:
- Secure customer signup/login, password reset, roles, or tenant-isolated cloud data.
- Live hosting/domain, Google indexing, or a public customer storefront.
- Real payment gateway checkout, settlement, refunds, webhook verification, or automatic subscription activation.
- WhatsApp API messaging.
- Full Excel parity for every workbook formula, return-entry workflow, cashier collection/recovery ledger, opening receivable, or formal accounting profit.

The currency selectors and conversion are implemented for transaction display and reporting. A currency being selectable does **not** mean a payment processor will accept it. Real online payments require an eligible merchant account and a payment gateway that supports the merchant's country, settlement currency and customer payment methods. Do not accept payment details in this local demo.

## Workbook calculation notes
- Gross = quantity × sale rate.
- Discount = gross × discount percentage.
- Net = gross − discount.
- Available stock = opening + stock in − sold + returns.
- Bill number pattern follows `YYMMDD-CashierID`.
- The source workbook labels its Recovery / Profit field as a recovery indicator, not accounting net profit.
- Verify all formulas against Excel-calculated outputs before production deployment.

## Files
- `index.html`, `styles.css`, `app.js`: local web prototype.
- `workbook-seed-data.json`: extracted product and sample transaction data.
- `workbook-calculation-spec.md`: workbook rules and validation checklist.
- `source-workbook-original.xlsm`: original workbook preserved unchanged.
- `PRODUCTION-ROADMAP.md`: remaining backend and deployment work.


## AvenueX update and Windows launch
- Brand: Accounts Management; domain target: https://avenuex.online (DNS/hosting must still be configured separately).
- The Windows launcher now uses built-in PowerShell; Python is not required. Run `Start_Local_Demo_Windows.bat`.
- Sales register supports bill-level edit (reopen for correction), cancel, permanent delete, and POS/online returns with stock and report adjustments.
- Settings supports four phone contacts and four support email addresses.
- Browser notifications can be enabled for orders while the local app is open. This is NOT remote push; reliable mobile alerts require hosted backend and push service.
- Protected reset exports a backup, asks twice, then clears sales, stock master and online orders while preserving settings.
- This remains a local prototype. The optional browser password is not production authentication. Multi-tenant cloud database, real email/WhatsApp sending, remote notifications, payment gateway, SEO deployment and Play Store packaging require production implementation and external accounts.

## Latest AvenueX workflow update
See `ENHANCEMENTS_AND_LIMITATIONS.md` for the online order lifecycle, quantity selection, ETA choices, invoice creation/printing, returns and important production limitations. Start on Windows with `Start_Local_Demo_Windows.bat`; Python is not required. This remains a local preview, not a hosted secure SaaS.


## AvenueX refinement update — 16 Nov 2026
- Deal builder now provides a live Stock Master code selector, quantity builder and deal image upload. Deal products use the selected stock codes and validate availability when added to cart.
- POS item code lookup remains connected to Stock Master; added customer type, retail/online-delivery channel, rider, delivery charge, GST, special discount and Cash on Delivery / USD manual payment choices.
- POS buttons are separated into Save, Save & Print and Clear Bill. Receipt uses a compact 80 mm thermal layout with bill/customer/channel/rider, item code, quantity, GST, discount, delivery, payment and balance details.
- Merchant settings control the customer-visible delivery promise, default delivery charge, delivery discount and store display name (`Avenuex.Online-Store`). Checkout delivery promise is read-only for the customer.
- Added wastage records (reduces available stock), select/delete and delete-all controls for products and sales, GPS coordinate capture for delivery address, local customer complaint inbox/replies, and return refund status.
- Added manual payment-received action for online bank/USD/manual methods. COD is classified as Cash; it is marked collected when the merchant marks the order Delivered.
- A separate `storefront.html` page exposes only the customer shopping experience (products, deals, cart, checkout, ETA, GPS address capture and complaints); it shares the same local browser data with the merchant dashboard.
- Windows launcher continues to use PowerShell and does not require Python.

## Boundaries before live deployment
This update is still a same-browser local prototype. Customer orders, complaint messages and merchant data are stored in that browser's local storage. The separate customer page is a local same-browser preview, not yet a public multi-device store; it has no server-side user roles, live map/routing distance, petrol-price feed, payment gateway settlement, WhatsApp delivery, or secure multi-user authentication. The delivery fee currently uses the merchant-set flat fee minus the configured discount; automatic km/petrol-based pricing needs a Maps/routing service, a current fuel-price source and a hosted backend. GPS capture adds coordinates to the address only when the customer grants browser permission. USD/Payoneer/Wise entries are manual payment instructions and are not automatic payment acceptance.
