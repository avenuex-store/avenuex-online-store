# Workbook-derived calculation specification

Source: `Sale_Point_POS_Print_Ready File Updated(1).xlsm` (original copy included).

## Sheets
- POS Billing: printable receipt view selected by Bill No.
- Dashboard: net sales, cash/card sales, returns, receipts and receivable.
- Stock Master: product master, sold/returned/available quantities and stock values.
- Item Sales: one row per SKU line; repeated Sale ID supports multi-item bills.
- Sale Point: daily cash/card sales, discounts, returns, receipts, recovery and balance.
- Monthly Report: month-wise sales, quantity, returns and receipts.
- Instructions: operating workflow.

## Observed rules
1. Gross amount = Qty Sold × Sale Rate.
2. Discount amount is calculated from Sale Rate × Disc% in the workbook formula; verify percentage interpretation before production port.
3. Net amount = Gross Amount − Discount.
4. Cash Sale and Card Sale classify Net Amount by Payment Type.
5. Return Amount = Return Qty × Sale Rate.
6. Bill No = `TEXT(Date,"yymmdd") & "-" & TEXT(Cashier ID,"0")`.
7. Sold Qty = SUMIF Item Sales Qty Sold by Item Code.
8. Return Qty = SUMIF Item Sales Return Qty by Item Code.
9. Available Qty = Opening Qty + Stock In Qty − Sold Qty + Sales Return Qty.
10. Sale Value = Sale Rate × Available Qty; Actual Sale Value = Purchase Rate × Available Qty; Profit column = difference.
11. Recovery / Profit is a recovery indicator, not accounting net profit.
12. Receivable intended as opening receivable + net sales after returns − actual cashier receipts; exact cell formula must be validated.
13. POS receipt retrieves all Item Sales rows matching Bill No.
14. Monthly report groups by Month Start.

## Reconciliation performed for imported sample data
Six populated Stock Master products and 41 Item Sales lines were extracted. Calculated available quantities from Opening + Stock In − Sold match the workbook cached values: 81, 67, 87, 17, 42, 102.
