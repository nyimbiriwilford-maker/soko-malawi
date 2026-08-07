Remove the existing emoji picker CSS and JSX completely and rebuild it from scratch. Keep all existing emoji functions and state — only replace the UI and styles.

═══════════════════════════════════
STEP 1 — IDENTIFY EVERYTHING TO REMOVE
═══════════════════════════════════

1. In src/pages/Chat.jsx, show the exact line numbers of:
   - The full emoji picker JSX block (from {showEmoji && ( to its closing )})
   - Any inline <style> rules for emoji inside the Chat.jsx <style> block

2. In src/styles/chat-thread.css, grep -n "emoji" and show every line number and rule that contains "emoji" — we will delete all of them.

3. Confirm these existing functions/state are kept untouched (do NOT delete):
   - showEmoji state + setShowEmoji
   - emojiTab state + setEmojiTab
   - recentEmojis state
   - insertEmoji function
   - emojiPickerRef ref
   - EMOJI_CATEGORIES import
   - EMOJI_BY_ID import
   - DEFAULT_EMOJI_TAB

═══════════════════════════════════
STEP 2 — DELETE ALL EXISTING EMOJI PICKER CODE
═══════════════════════════════════

4. Delete the entire {showEmoji && (...)} JSX block from Chat.jsx.

5. Delete every CSS rule in chat-thread.css that contains "emoji" in its selector. Remove them all — every single one.

═══════════════════════════════════
STEP 3 — BUILD NEW EMOJI PICKER
═══════════════════════════════════

6. Add this new JSX back in the same location where the old picker was in Chat.jsx:

{showEmoji && (
  <div
    ref={emojiPickerRef}
    className="ep-wrap"
    onClick={e => e.stopPropagation()}
  >
    {/* Recent strip */}
    <div className="ep-recent">
      {recentEmojis.length > 0
        ? recentEmojis.map((em, i) => (
            <button key={i} type="button" className="ep-btn" onClick={() => insertEmoji(em)}>{em}</button>
          ))
        : <span className="ep-recent-empty">🕘 Recent emojis appear here</span>
      }
    </div>

    {/* Emoji grid */}
    <div className="ep-grid">
      {(EMOJI_BY_ID[emojiTab]?.emojis || []).map((em, i) => (
        <button key={i} type="button" className="ep-btn" onClick={() => insertEmoji(em)}>{em}</button>
      ))}
    </div>

    {/* Category tabs */}
    <div className="ep-tabs">
      {EMOJI_CATEGORIES.map(cat => (
        <button
          key={cat.id}
          type="button"
          className={`ep-tab${emojiTab === cat.id ? ' ep-tab--active' : ''}`}
          onClick={() => setEmojiTab(cat.id)}
          aria-label={cat.label}
          title={cat.label}
        >
          {cat.icon}
        </button>
      ))}
    </div>
  </div>
)}

7. Add this new CSS at the END of src/styles/chat-thread.css:

/* ── Emoji Picker ─────────────────────────────── */
.chat-thread .ep-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1200;
  background: var(--bg, #fff);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.13);
  display: flex;
  flex-direction: column;
  height: 52vh;
  max-height: 520px;
  overflow: hidden;
  touch-action: pan-y;
}

/* Recent strip */
.chat-thread .ep-recent {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 6px 8px;
  gap: 2px;
  border-bottom: 1px solid rgba(0,0,0,0.07);
  flex-shrink: 0;
  min-height: 48px;
  align-items: center;
  -webkit-overflow-scrolling: touch;
}

.chat-thread .ep-recent-empty {
  font-size: 11px;
  color: #aaa;
  padding: 0 4px;
  white-space: nowrap;
}

/* Emoji grid */
.chat-thread .ep-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 0;
  min-height: 0;
  padding: 4px 4px 8px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

/* Emoji buttons */
.chat-thread .ep-btn {
  font-size: 24px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 2px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
}
.chat-thread .ep-btn:active {
  background: rgba(0,0,0,0.07);
}

/* Category tabs */
.chat-thread .ep-tabs {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
  border-top: 1px solid rgba(0,0,0,0.07);
  padding: 2px 4px;
  gap: 0;
  height: 44px;
  align-items: center;
  -webkit-overflow-scrolling: touch;
}

.chat-thread .ep-tab {
  flex-shrink: 0;
  font-size: 20px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 8px;
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.chat-thread .ep-tab--active {
  opacity: 1;
  background: rgba(26,122,74,0.12);
}

.chat-thread .ep-tab:active {
  background: rgba(0,0,0,0.08);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .chat-thread .ep-wrap {
    background: #1a1f1c;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
  }
  .chat-thread .ep-recent {
    border-bottom-color: rgba(255,255,255,0.08);
  }
  .chat-thread .ep-tabs {
    border-top-color: rgba(255,255,255,0.08);
  }
  .chat-thread .ep-btn:active {
    background: rgba(255,255,255,0.1);
  }
}

Run npx eslint src/pages/Chat.jsx and npm run build. Confirm both pass. Also confirm grep -n "ep-wrap\|ep-grid\|ep-tabs" src/pages/Chat.jsx returns the new JSX lines.