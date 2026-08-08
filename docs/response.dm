# Call budget system — call time estimate review

Task source: `docs/claudehelp.dm` — "invest now current call budget system call time estimate work. dont write any code. give a response that i can use to improve it."

## Verdict

The estimate math works but disagrees with how calls actually behave in three places: the quality picker is cosmetic, in-call "time left" ignores the measured rate, and the learned-rate calibration is easily skewed.

## Findings

1. **The UI quality picker does not affect the call.** `shouldAutoLowData()` in `src/lib/callBudgetPrefs.js` always returns `false`, while the Custom card page offers "Data Saver 40 kbit/s / Balanced 200 kbit/s / High — no cap" (`CallBudget/index.jsx`, `QUALITIES`). Only the displayed estimate changes; the call runs identically regardless. Those estimates are fiction.

2. **Estimate constants mismatch labels and reality.**
   - Data Saver uses `RATES.video.lowData = 10000 B/s` (80 kbit/s) but the label says 40 kbit/s — 2x off.
   - Balanced is hardcoded at `35000 B/s` (280 kbit/s) in `CallBudget/index.jsx:customVideoSec` but the label says 200 kbit/s — 1.4x off.
   - Voice fallback `8000 B/s` (64 kbit/s) vs the measured baseline of 10–11 KB/s (now seen ~85 kbit/s) is ~30% optimistic, so voice "time left" reads longer than reality.

3. **In-call "time left" uses the static estimate, not live data.** `CallDataMeter.jsx:167` calls `effectiveEstimateDuration(...)` on remaining MB with a fixed rate. The data for a live rate estimate already exists in `useCallDataBudget.sampleUsage()` (real `getStats()` bytes); the meter should divide remaining bytes by a measured rolling rate instead.

4. **Flat-rate estimate ignores the adaptive bitrate curve.** Real enforcement (`useCallBudgetManager.js`, `ADAPTIVE_CAPS` 200k→80k→40k bit/s as the budget depletes) means consumption is not linear, but `estimateDuration` treats it as `budgetBytes / flatRate`. Budgeted video calls actually last longer than projected because quality steps down; nothing models the piecewise curve.

5. **Learned-rate calibration is skewable.** `getLearnedRates()` (`callBudgetPrefs.js`) averages the last ≤5 calls equally:
   - Does not exclude budget-capped calls (which ran at low caps), so mixed pools under-state the normal rate and future estimates become too optimistic.
   - No recency weighting — an old call weighs the same as today's.
   - No outlier handling — one short connection-setup-heavy call (min 12s) inflates the mean.
   - Arithmetic mean, not median — sensitive to spikes (billing overhead, retransmits).

## Recommended fixes (prioritized)

- **P1 — Wire or remove the quality picker:** either apply the saver/balanced/high selection to the actual sender bitrate at call start, or drop the picker and its hardcoded constants. If kept, make constants match the true caps (saver 40k, balanced 200k bit/s = `ADAPTIVE_CAPS` values).
- **P2 — Live in-call rate:** keep a rolling ~30s window of byte-deltas/sec in `useCallDataBudget.sampleUsage`, divide remaining bytes by that rate, and fall back to the static rate only in the first seconds. Self-corrects on any network.
- **P3 — Robust learning:** tag each usage-log entry with whether the call ran budget-capped; exclude capped calls (or learn per quality tier); use recency-weighted, duration-weighted median; drop outliers (e.g. duration < 60s).
- **P4 — Model the step curve:** for budgeted estimates, project consumption piecewise across the 50%/25%/10%-remaining thresholds at the stepped cap rate; or approximate with a budgeted-weighted average of the video step rates.
- **P5 — Fix voice fallback:** raise `RATES.voice.normal` from 8000 to the ~10,000–11,000 measured baseline.

## Outstanding (out of scope here)

Phase 5 enforcement UI (80% toast, 100% countdown, End Call / Add 10MB) is built and validated end-to-end on a real budgeted call; the remaining risk is only estimate accuracy, not enforcement.