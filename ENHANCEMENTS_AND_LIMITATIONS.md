# AvenueX online order and returns workflow update

## Added to this local preview
- Online checkout quantity selector (one or multiple units) with live stock validation.
- Delivery ETA choices: 30, 45, 60, 90, 120 minutes, or manual scheduling.
- Order lifecycle: Placed -> Confirmed -> Preparing -> Dispatched (rider) -> Delivered.
- Reject action for unaccepted orders.
- Confirming an online order creates matching Item Sales entries and an online bill number; it then consumes stock through the shared sales ledger.
- Print invoice action for accepted online orders.
- POS sale return quantity entry; returns reduce net sold quantity and restore available stock.
- Online order return quantity entry; returns update the linked online sale rows and stock availability.
- Browser notification attempts for new orders, confirmation, rider dispatch, delivery, and low stock (permission required; browser/device must be available).
- No Python dependency: use Start_Local_Demo_Windows.bat on Windows.

## Important production limitations
This is still a single-browser localStorage prototype. It is NOT secure multi-user SaaS and it does not synchronize data across devices. A browser password or client-side lock would not protect the data from someone with access to the browser profile/files, so this build does not pretend to provide production-grade authentication or tenant isolation. Production requires server-side authentication, hashed passwords, role-based access, tenant-scoped database policies, backups, audit logs and HTTPS.

Payment choices are recorded as order preferences only. Bank/card/wallet money will NOT be collected or automatically deposited until a real payment gateway/merchant account is configured and verified. Cash on delivery also needs manual cash reconciliation. Email/SMS/WhatsApp/push notifications require provider credentials and a hosted backend; browser notifications only work locally with permission.

Delivery ETA is a requested/selected estimate, not a guaranteed rider dispatch or live tracking system. Returns are recorded as quantities and stock adjustments; refunds/payment reversals remain manual until payment provider integration is implemented.

Do not use this local preview with real customer personal/payment data or sell it as a production-ready cloud product.


## November 2026 enhancements in this package
- Multi-product shopping cart with plus/minus quantity controls and stock validation.
- Bundle deals can be created from item codes and quantities with a fixed deal price; deal value is allocated across item sale lines so bill totals reconcile.
- Product picture upload (image files up to 1.5 MB) is shown in Stock Master and the online catalog.
- Optional local browser password lock (SHA-256 hash); this is only a convenience lock and does not secure files or provide multi-user login.
- Bank transfer account details can be entered in Settings and displayed during checkout; transfer verification remains manual.
- Cash on Delivery is classified under Cash in cash/monthly reports. COD collection is recorded when the order is marked Delivered.
- Returns now restore stock once and reduce net sales/report totals.
- Delivery status path: Placed -> Confirmed -> Preparing -> Dispatched -> Delivered; order invoice is created on acceptance and can be printed.

## Still not production-ready
The package remains a single-browser local prototype. Customer-facing public ordering from other devices, real secure user accounts, cloud sync, server-side inventory reservation, automatic bank/card payment settlement, automated refunds, remote notifications, and multi-tenant access control require a hosted backend and payment/provider integrations. The local password lock must not be described as production security.


## 16 Nov 2026 refinement
- Deal images and live item-code selection from Stock Master; quantities can be assembled from the code dropdown.
- Added a separate customer-only `storefront.html` page (same-browser local preview). POS adds Cash on Delivery, customer category, retail/online delivery channel, rider, delivery charge, GST and special discount; Save / Save & Print / Clear Bill are separate.
- Compact 80 mm thermal receipt includes GST, rider, customer, item codes, payment and balance.
- Settings own delivery ETA and fee/discount; customer checkout only displays the merchant-set ETA.
- Wastage, bulk delete, GPS address capture, local support inbox/replies and refund status are included.
- Manual payment confirmation for non-COD online orders; COD is reported as Cash and collected when marked Delivered.

**Still not live production:** no public customer portal across devices, server-side roles, secure cloud login, payment gateway, map-distance/petrol calculation or real-time remote support chat. The local password is not a production security boundary.
