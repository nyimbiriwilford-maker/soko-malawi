# FloatingIncomingCall & NotificationToast fixes

## Task 1 — Differentiate Answer icon for video calls

**File:** `src/components/FloatingIncomingCall.jsx`

**Change:** Answer button conditionally renders `Video` icon for video calls, `Phone` for voice:

```diff
- <Phone size={22} strokeWidth={2.5} color="#fff" />
+ {isVideo ? <Video size={22} strokeWidth={2.5} color="#fff" /> : <Phone size={22} strokeWidth={2.5} color="#fff" />}
```
```diff
- aria-label="Answer call"
+ aria-label={isVideo ? 'Answer video call' : 'Answer call'}
```

Decline stays `PhoneOff` regardless.

## Task 2 — Fix missing avatar on call-type notifications

**File:** `src/components/NotificationToast.jsx`

**Root cause:** The toast's avatar fetch (`useSenderProfile`) was keyed on `visible?.data?.sender_id` only. Call-type notifications (`missed_call`, `missed_video`) store the caller's user ID under `caller_id`, not `sender_id`. So `actorId` was `undefined` → no profile fetch → no avatar.

Similarly, `displayName` only checked `sender_name`, but calls use `caller_name`.

**Fix:**

1. Actor ID resolution (line 129):
```diff
- const senderProfile = useSenderProfile(visible?.data?.sender_id)
+ const actorId = visible?.data?.sender_id || visible?.data?.caller_id || visible?.data?.decliner_id || visible?.data?.voucher_id || visible?.data?.viewer_id || visible?.data?.buyer_id || visible?.data?.seller_id || visible?.data?.user_id || null
+ const senderProfile = useSenderProfile(actorId)
```

2. Display name resolution (line 205):
```diff
- const displayName = visible?.data?.sender_name || visible?.title || getTitle(visible?.type)
+ const displayName = visible?.data?.sender_name || visible?.data?.caller_name || visible?.data?.decliner_name || visible?.data?.voucher_name || visible?.data?.viewer_name || visible?.data?.buyer_name || visible?.data?.seller_name || visible?.title || getTitle(visible?.type)
```

### Notification type coverage

| Type | Key used for actor ID | Key used for display name | Avatar before fix | Avatar after fix |
|---|---|---|---|---|
| `new_message` | `sender_id` | `sender_name` | ✅ Working | ✅ Working |
| `missed_call` | `caller_id` | `caller_name` | ❌ Missing | ✅ Resolved |
| `missed_video` | `caller_id` | `caller_name` | ❌ Missing | ✅ Resolved |
| `missed_call` (declined) | `decliner_id` | `decliner_name` | ❌ Missing | ✅ Resolved |
| `new_vouch` | `voucher_id` | `voucher_name` | ❌ Missing | ✅ Resolved |
| `listing_view` | `viewer_id` | `viewer_name` | ❌ Missing | ✅ Resolved |
| `listing_offer` | `buyer_id` | `buyer_name` | ❌ Missing | ✅ Resolved |
| `deal_ready` | `buyer_id` | `buyer_name` | ❌ Missing | ✅ Resolved |
| `deal_request` | `seller_id` (no buyer) | `seller_name` | ❌ Missing | ✅ Resolved |
| `deal_confirmed` | `buyer_id` | `buyer_name` | ❌ Missing | ✅ Resolved |
| `deal_declined` | `buyer_id` | `buyer_name` | ❌ Missing | ✅ Resolved |
| `deal_vouching` | `seller_id` | `seller_name` | ❌ Missing | ✅ Resolved |
| `listing_sold` | fallback chain | fallback chain | ❌ Missing | ✅ Resolved (if any name key present) |
| `listing_comment` | fallback chain | fallback chain | ❌ Missing | ✅ Resolved (if `sender_name` present as string) |
| `booking_*` | fallback chain | fallback chain | ❌ Missing | ✅ Resolved (if any name key present) |

## Build

```
✓ 2095 modules transformed.
✓ built in 3.58s
```
