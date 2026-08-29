TASK: On the product page, make ordering not visible for users for now. No online ordering — users connect to sellers through in-app chat, WhatsApp link, and call instead.

DONE — all ordering UI hidden; contact CTAs (Chat / WhatsApp / Call / Email) are now the only way to reach sellers:

1. Product page — src/pages/ListingDetail.jsx (mobile CTA card, desktop sidebar CTA stack, desktop sticky bottom bar)
   - "Place Order" button removed from all three CTA locations (mobile stack, desktop sidebar, desktop sticky footer bar).
   - "Pay on delivery / Inspect before paying / Rate after delivery" assurance row removed (it was tied to the order flow).
   - Quantity stepper (+/−) removed from the Bulk Pricing card, and the "Total: X for N units" line removed — these only fed the order total.
   - Place Order modal and the "Order Placed! … View My Orders" confirmation overlay fully removed, along with the PlaceOrderModal import and the showOrderModal / orderPlaced / quantity state, orderable and totalPrice computations.
   - Bulk Pricing table still shows tier discounts (informational only — "Quantity / Price per unit / You save" table headers kept, no order action).
   - Contact CTAs untouched and now primary: Chat with Seller (in-app chat), WhatsApp Seller (wa.me link), Call Seller (tel:), Email Seller (mailto:), plus Add to Favorites.

2. Buyer side — src/App.jsx
   - /orders route removed (and the OrdersPage lazy import) so the My Orders page is not reachable anywhere in the app.

3. Notifications — src/pages/Notifications.jsx
   - Order-related notification taps (order_placed / shipped / delivered / cancelled) no longer deep-link to /orders; they now open the related listing (fallback: the seller's profile).

4. Seller side — src/pages/ShopDashboard.jsx
   - "Orders" tab (OrderManager) removed from the shop dashboard tabs.
   - Overview stats de-orderified: "Orders received" card → "Buyer chats" (distinct people who messaged the seller, counted from the messages table), "Revenue (delivered)" card → "Listing saves", duplicate saves card → "Verification". Low-stock / restock banner kept (it's about products, not orders).

5. Kept for easy re-enabling later ("for now"):
   - src/components/PlaceOrderModal.jsx, src/components/OrderManager.jsx, src/pages/OrdersPage.jsx and src/lib/orders.js are left in the codebase but are no longer imported/routed by any user-facing page — nothing references them, so they add zero UI. To re-enable ordering later, restore the /orders route, the Orders tab, and the Place Order CTAs.

VERIFIED:
- npx eslint on edited files — only pre-existing issues remain (same unused-var / set-state-in-effect errors exist on HEAD; my removals introduced none).
- npm run build — success (8.14s), and no OrdersPage/PlaceOrder chunk is emitted in dist/assets, confirming the order flow is fully unwired from the app.
