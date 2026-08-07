Instructions for DeepSeek — Chat Media Placeholder: WhatsApp-Style Blur

Change: Make the blurred placeholder match WhatsApp's style — darker, heavier blur, with a clean download icon and file size hint. Not just a blurred image — a polished locked-media look.

Task 1 — Update CSS in chat-thread.css
css
/* BEFORE */
.chat-media-placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-height: 120px;
  position: relative;
  overflow: hidden;
  background: #000;
}

.chat-media-placeholder-blur {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(18px);
  transform: scale(1.1);
  opacity: 0.6;
}

.chat-media-placeholder-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: 13px;
}

.chat-media-placeholder-inner svg {
  width: 32px;
  height: 32px;
  opacity: 0.9;
}

/* AFTER */
.chat-media-placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-height: 120px;
  position: relative;
  overflow: hidden;
  background: #1a1a1a;
}

.chat-media-placeholder-blur {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(24px);
  transform: scale(1.15);
  opacity: 0.45;
}

/* Dark overlay on top of blur */
.chat-media-placeholder::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 0;
}

.chat-media-placeholder-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1px;
}

/* Download circle button — WhatsApp style */
.chat-media-placeholder-btn {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  backdrop-filter: blur(4px);
}

.chat-media-placeholder-btn svg {
  width: 26px;
  height: 26px;
  color: #fff;
  stroke: #fff;
}

.chat-media-placeholder-label {
  font-size: 11px;
  color: rgba(255,255,255,0.85);
  font-weight: 400;
}
Task 2 — Update the placeholder JSX in renderMedia
jsx
// AFTER
<div className="chat-media-placeholder" onClick={...}>
  <img
    src={msg.media_url}
    className="chat-media-placeholder-blur"
    draggable={false}
    alt=""
  />
  <div className="chat-media-placeholder-inner">
    <div className="chat-media-placeholder-btn">
      {Icon.download ? Icon.download() : <Download size={26} strokeWidth={2} />}
    </div>
    <span className="chat-media-placeholder-label">
      {isVideo ? 'Tap to load video' : 'Tap to load photo'}
    </span>
  </div>
</div>

If Icon.download does not exist in the project's Icon helper, use <Download size={26} strokeWidth={2} /> from lucide-react — check which is already imported in Chat.jsx and use whichever is available.

Do NOT touch
_pendingLoad flag logic
onClick tap-to-load handler
Any emoji picker or input bar changes
Deliverable
CSS updated with darker overlay, heavier blur, download circle button styles
JSX updated with download button circle + label
Build passes