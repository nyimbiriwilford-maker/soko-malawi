# Deal confirmation — Notifications flow

Deal confirmation was removed from Chat UI. The full process runs in **Notifications**.

## Flow

1. **Seller and buyer** exchange at least **4 messages** on a **listing** chat.
2. Chat silently creates a **`deal_ready`** notification for the **seller** (no chat UI).
3. Seller opens **Notifications → Deals** (or All) → **Confirm deal**.
4. **DealEducationModal** explains trust scores; seller sends the request.
5. Buyer receives **`deal_request`** → **Confirm deal** or **Decline** (in Notifications).
6. On confirm: seller gets **`deal_confirmed`**; buyer gets **`deal_vouching`**.
7. **Vouch** opens the seller profile with `?vouch=1`.

## Key files

| File | Role |
|------|------|
| `src/utils/dealNotificationFlow.js` | Prompt, send, confirm, decline helpers |
| `src/utils/vouchUtils.js` | Core `sendDealRequest` / `confirmDeal` / trust RPCs |
| `src/pages/Chat.jsx` | Silent `maybePromptDealReady` only (no deal bars/cards) |
| `src/pages/Notifications.jsx` | Actions + education modal |
| `src/components/DealEducationModal.jsx` | Seller education before send |
| `src/components/DealPillButton.jsx` | Deprecated (not mounted) |
| `src/components/DealRequestCard.jsx` | Deprecated for chat (legacy messages link to Notifications) |

## Notification types

| Type | Recipient | Actions |
|------|-----------|---------|
| `deal_ready` | Seller | Confirm deal → modal → send request |
| `deal_request` | Buyer | Confirm deal / Decline |
| `deal_confirmed` | Seller | Vouch (→ profile) |
| `deal_declined` | Seller | Info only |
| `deal_vouching` | Buyer | Vouch (→ profile) |

## Anti-fraud (unchanged)

- Min **4** messages (`MIN_DEAL_MESSAGES`)
- Listing at least **24 hours** old
- Max **5** deal requests per seller per 7 days
- One active deal per listing pair (30-day window)

## Testing checklist

1. As seller, message a buyer 4+ times on a listing chat.
2. Seller sees **Ready to confirm this deal?** in Notifications.
3. Confirm deal → buyer sees **Deal confirmation request**.
4. Buyer confirms → both get follow-up notifications; trust/vouch paths work.
5. Chat has no “Confirm deal” pill; old `deal_request` messages show a link to Notifications.
