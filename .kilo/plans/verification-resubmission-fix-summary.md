# Verification Resubmission Fix - Implementation Summary

## Problem Statement
Users were failing to resubmit requested documents after admins requested additional information. The system had no automatic enforcement of deadlines, leaving requests stuck in `additional_info_required` status indefinitely with no clear admin action path.

## Solution Overview
Implemented automatic expiry for overdue verification requests and enhanced admin controls to handle deadline violations.

---

## Changes Made

### 1. Database Migration: Auto-Expire Function
**File**: `supabase/migrations/20260824_verification_auto_expire.sql`

**What it does**:
- Creates `auto_expire_overdue_verification_requests()` function
- Automatically transitions requests to `expired` status when:
  - Status is `additional_info_required`
  - `additional_info_deadline_at` has passed
  - No resubmission event exists after the deadline
- Logs status events for audit trail
- Notifies sellers that their request expired
- Scheduled to run hourly via `pg_cron`

**Key Features**:
- Only processes requests from last 180 days (avoids ancient data)
- SECURITY DEFINER function (runs with elevated privileges)
- Returns count and IDs of expired requests
- Can be manually triggered by admins

---

### 2. Frontend Library Updates
**File**: `src/lib/verification.js`

**Added Function**:
```javascript
export async function adminAutoExpireOverdueRequests()
```

**What it does**:
- Calls the database RPC function `auto_expire_overdue_verification_requests`
- Returns `{ count, requestIds }` for UI feedback
- Available to authenticated admin users

**Export**: Added to the module exports list

---

### 3. Admin UI Enhancements
**File**: `src/components/AdminVerificationDetail.jsx`

**Changes**:
1. **Import**: Added `adminAutoExpireOverdueRequests` import
2. **Handler Function**: Added `handleAutoExpireThis()` to trigger auto-expiry
3. **Deadline Warning Banner**: Shows red warning when deadline has passed
4. **Action Buttons**:
   - "Auto-expire this request" - Manually trigger expiry for this specific request
   - "Extend deadline +3 days" - Give seller more time (already existed)

**Visual Feedback**:
- Red warning banner with deadline timestamp
- Clear messaging: "Seller has not resubmitted after the deadline"
- Immediate action buttons for quick admin response

---

### 4. Seller UI Improvements
**File**: `src/components/VerificationWizard.jsx`

**Added Features**:
1. **Deadline Status Calculator**: 
   - `deadlineStatus` computed property that categorizes deadline:
     - `expired`: Deadline passed (red, high urgency)
     - `urgent`: < 24 hours remaining (orange)
     - `soon`: < 72 hours remaining (yellow)
     - `ok`: More than 3 days remaining

2. **Enhanced Deadline Display**:
   - Color-coded based on urgency
   - Shows time remaining in human-readable format
   - Warning message when expired: "your request may be auto-expired"
   - Visual indicators (⚠ icon) for expired deadlines

3. **Updated in Two Locations**:
   - Top banner (visible on all wizard steps when need-info is active)
   - Status step detailed view

---

## Workflow After Implementation

### Automatic Process (Hourly via pg_cron)
1. System checks for requests with `additional_info_required` status and passed deadline
2. Verifies no resubmission occurred after deadline
3. Auto-transitions to `expired` status
4. Sends notification to seller
5. Logs status event for audit

### Manual Admin Process
**When deadline is overdue**:
1. Admin opens verification detail
2. Sees red warning banner with deadline timestamp
3. Options:
   - Click "Auto-expire this request" → Immediately expires
   - Click "Extend deadline +3 days" → Gives seller more time
   - Use "Override status" → Full control to any status
   - Manually approve/reject if documents are acceptable

### Seller Experience
**Before deadline expires**:
- Sees countdown: "2 days remaining" / "23 hours remaining"
- Color-coded urgency indicators
- Clear call-to-action to resubmit

**After deadline expires**:
- Red warning: "⚠ Deadline has passed — submit quickly to avoid auto-expiry"
- Can still attempt to resubmit (if admin hasn't expired it yet)
- Receives notification if request is auto-expired

---

## Technical Details

### Database Function Signature
```sql
CREATE OR REPLACE FUNCTION public.auto_expire_overdue_verification_requests()
RETURNS TABLE(
  expired_count integer,
  request_ids uuid[]
)
```

### Cron Schedule
```
'0 * * * *'  -- Every hour at minute 0
```

### Status Transition
```
additional_info_required → expired
```

### Notifications
- **To Seller**: "Verification request expired" with reason
- **Link**: `/verify` (to start new request)
- **Message**: Includes original deadline timestamp

---

## Testing Checklist

- [ ] Run migration: `supabase migration up`
- [ ] Verify function exists: `SELECT * FROM pg_proc WHERE proname = 'auto_expire_overdue_verification_requests'`
- [ ] Check cron job: `SELECT * FROM cron.job WHERE jobname = 'soko_auto_expire_verifications'`
- [ ] Test manual trigger from admin UI
- [ ] Verify seller sees deadline warnings
- [ ] Confirm expired requests show correctly in admin queue
- [ ] Test notification delivery to seller
- [ ] Verify status event logging works

---

## Rollback Plan

If issues arise, to rollback:

1. **Stop cron job**:
```sql
SELECT cron.unschedule('soko_auto_expire_verifications');
```

2. **Drop function**:
```sql
DROP FUNCTION IF EXISTS public.auto_expire_overdue_verification_requests();
```

3. **Revert code changes** (git):
```bash
git checkout HEAD~1 src/lib/verification.js
git checkout HEAD~1 src/components/AdminVerificationDetail.jsx
git checkout HEAD~1 src/components/VerificationWizard.jsx
```

---

## Benefits

1. **Automated Cleanup**: No more stuck requests indefinitely
2. **Clear Admin Actions**: Explicit UI for handling overdue requests
3. **Better Seller Communication**: Clear deadline status with urgency indicators
4. **Audit Trail**: All auto-expiries logged with timestamps
5. **Manual Override Available**: Admins can extend, override, or manually approve
6. **Scalable**: Runs automatically without admin intervention
7. **Safe**: Only affects requests from last 180 days, respects resubmissions

---

## Future Enhancements (Optional)

- Add email notifications before deadline expires (24h warning)
- Configurable expiry delay (grace period after deadline)
- Dashboard metrics for expired vs resubmitted rates
- Bulk admin action to extend all overdue deadlines
- Seller can request deadline extension through UI

---

## Files Modified

1. `supabase/migrations/20260824_verification_auto_expire.sql` (NEW)
2. `src/lib/verification.js` (MODIFIED - added function + export)
3. `src/components/AdminVerificationDetail.jsx` (MODIFIED - added UI controls)
4. `src/components/VerificationWizard.jsx` (MODIFIED - enhanced deadline display)

---

**Implementation Date**: 2026-08-24
**Status**: ✅ Complete
