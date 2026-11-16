# AvenueX refinement — 16 November 2026

## Included
- Deal builder uses a live Stock Master item-code selector, per-item quantity builder and deal image upload.
- POS item-code dropdown remains live from Stock Master; customer type, phone/WhatsApp, retail vs online delivery, rider, delivery fee, GST, special discount and Cash on Delivery / manual USD methods added.
- POS actions separated into Save, Save & Print and Clear Bill.
- Thermal receipt layout set to 80 mm with lighter compact text and bill, date, cashier, customer, phone, channel, rider, item codes, quantities, discounts, GST, delivery charge, payment, received and balance.
- Merchant-only delivery ETA, default delivery fee, delivery discount and GST settings; customer checkout ETA is read-only.
- Added separate customer-only `storefront.html` page with product/deal listing, cart quantity controls, checkout, GPS coordinate capture and complaint form.
- Storefront and merchant workspace share local browser data; new customer orders and support messages can appear in merchant workspace.
- COD orders are recorded under Cash; COD is collected when merchant marks Delivered. Manual non-COD payment can be marked received.
- Returns record refund-pending/refunded status. Paid refunds are recorded in the refund register and summarized in reports.
- Wastage reduces available stock. Product/sales bulk selection and delete-all actions and delete-all deals action added.
- Windows launcher uses PowerShell; Python is not required.

## Not included / requires production services
- Public hosted multi-device store and cloud database.
- Server-side authentication, customer/merchant role enforcement and secure multi-user permissions.
- Live map route-distance calculation and current petrol-price integration. Current delivery charge uses merchant-configured flat fee less discount.
- Payment gateway settlement or automatic USD/Payoneer/Wise verification.
- WhatsApp API, remote push notifications and true real-time chat.
- A local browser password is only a basic device lock, not production-grade security.

## Avenuex rider + thermal receipt update
- Added merchant rider profiles with rider name, bike/vehicle number, phone number and optional notes; profiles can be added or removed at any time.
- Added rider assignment per online order. Assigned rider name, bike and contact are saved on the order and shown in customer order tracking.
- Added customer-side order tracking by checkout phone number so the customer can view order progress and assigned rider contact.
- POS rider selection now uses the saved rider profiles; printed POS and online invoices include rider and bike/contact details when assigned.
- Added thermal receipt roll setting for 58mm and 80mm, with compact bold receipt typography.
- Refined the customer shop page with modern responsive product cards and cleaner spacing.


## V4 — compact POS receipt and bank payment display
- Defaulted thermal receipt to compact 58mm roll, with 80mm still selectable.
- Reworked print layout for narrow width, compact line spacing, clear item/amount alignment and bold totals.
- Removed unnecessary storefront hover/shadow effects.
- Added merchant-configured customer bank choices at checkout for bank transfer.
- Saved the customer-selected bank on the order and displayed it on the invoice with PAID / RECEIVED or PENDING status after merchant verification.
