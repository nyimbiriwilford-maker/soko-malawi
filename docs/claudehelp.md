Fix emoji picker on mobile — two changes to src/pages/Chat.jsx, src/styles/chat-thread.css, and src/constants/emojiCatalog.js.

═══════════════════════════════════
FIX 1 — Increase picker height on mobile
═══════════════════════════════════

In src/styles/chat-thread.css, inside the mobile @media block, find:

.chat-thread .emoji-picker-panel {
  bottom: 66px;  left: 6px;  right: 6px;  max-width: none;
  height: min(50dvh, 380px);
  max-height: min(50dvh, 380px);

Replace the height and max-height lines with:
  height: min(72dvh, 520px);
  max-height: min(72dvh, 520px);

═══════════════════════════════════
FIX 2 — Remove Recent from category tabs, replace top strip with Recent emojis
═══════════════════════════════════

Step A — Remove 'recent' from EMOJI_CATEGORIES in src/constants/emojiCatalog.js:

Find:
export const EMOJI_CATEGORIES = [
  { id: 'recent', label: 'Recent', icon: '\u{1F552}', emojis: [] },

Delete that line entirely so EMOJI_CATEGORIES starts with smileys.

Also find:
export const DEFAULT_EMOJI_TAB = EMOJI_CATEGORIES[0]?.id

This will now resolve to 'smileys' automatically — no change needed.

Step B — Replace the .emoji-frequent strip in Chat.jsx with a Recent emojis strip:

Find the full .emoji-frequent block in the picker JSX:

<div className="emoji-frequent">
  {EMOJI_FREQUENT.map((emoji, i) => (
    <button key={`freq-${i}-${emoji}`} type="button" className="emoji-btn emoji-btn-freq" onClick={() => insertEmoji(emoji)} title="Quick insert">{emoji}</button>
  ))}
</div>

Replace with:

<div className="emoji-recent-strip">
  {recentEmojis.length > 0 ? (
    recentEmojis.map((emoji, i) => (
      <button key={`recent-${i}-${emoji}`} type="button" className="emoji-btn emoji-btn-freq" onClick={() => insertEmoji(emoji)} title={emoji}>{emoji}</button>
    ))
  ) : (
    <span className="emoji-recent-strip-empty">🕘 Your recent emojis will appear here</span>
  )}
</div>

Step C — Remove the emojiTab === 'recent' branch from the emoji grid since Recent is now always shown in the top strip, not the grid. In the emoji-grid JSX:

Find:
{emojiTab === 'recent' ? (
  recentEmojis.length ? (
    recentEmojis.map((emoji, i) => (
      <button key={`recent-${i}-${emoji}`} type="button" className="emoji-btn" onClick={() => insertEmoji(emoji)}>{emoji}</button>
    ))
  ) : (
    <div className="emoji-recent-empty">
      <span className="emoji-recent-empty-icon">🕘</span>
      <span>No recent emojis yet — emojis you use will appear here.</span>
    </div>
  )
) : (
  (EMOJI_BY_ID[emojiTab]?.emojis || []).map((emoji, i) => (
    <button key={`${emojiTab}-${i}-${emoji}`} type="button" className="emoji-btn" onClick={() => insertEmoji(emoji)}>{emoji}</button>
  ))
)}

Replace with:

{(EMOJI_BY_ID[emojiTab]?.emojis || []).map((emoji, i) => (
  <button key={`${emojiTab}-${i}-${emoji}`} type="button" className="emoji-btn" onClick={() => insertEmoji(emoji)}>{emoji}</button>
))}

Step D — Update the category label in the header to handle 'recent' no longer being a tab (EMOJI_BY_ID will no longer have a 'recent' key). Find:

<span className="emoji-picker-cat-label">
  {EMOJI_BY_ID[emojiTab]?.label || 'Smileys'}
</span>

This already falls back to 'Smileys' so it's fine — no change needed.

Step E — Add CSS for the new recent strip in src/styles/chat-thread.css. Find the existing rule:

.chat-thread .emoji-frequent {

Replace the selector with:
.chat-thread .emoji-recent-strip {

Keep all the same CSS properties inside it. Then add one new rule directly after it:

.chat-thread .emoji-recent-strip-empty {
  font-size: 11px;
  color: #8a9a90;
  padding: 6px 10px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}

Also grep and rename any other reference to .emoji-frequent in chat-thread.css to .emoji-recent-strip so the styles stay consistent.

Step F — Check if EMOJI_FREQUENT is still imported/used anywhere in Chat.jsx after this change:
grep -n "EMOJI_FREQUENT" src/pages/Chat.jsx
If it is only used in the removed block, remove it from the import line too.

═══════════════════════════════════
VERIFICATION
═══════════════════════════════════

Run npx eslint src/pages/Chat.jsx src/constants/emojiCatalog.js and npm run build.

Confirm:
1. grep -n "recent" src/constants/emojiCatalog.js — 'recent' should NOT appear in EMOJI_CATEGORIES array
2. grep -n "emoji-frequent\|EMOJI_FREQUENT" src/pages/Chat.jsx src/styles/chat-thread.css — should return no results (fully replaced)
3. grep -n "emoji-recent-strip" src/pages/Chat.jsx src/styles/chat-thread.css — should appear in both files
4. Build passes, lint no new errors