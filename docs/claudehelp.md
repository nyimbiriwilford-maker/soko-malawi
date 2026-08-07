Instructions for DeepSeek:

Instructions for DeepSeek — Chat Media Placeholder: Blurred Preview Instead of Opaque

Change: The placeholder should show a blurred version of the actual image as the background, not a solid color. The image content should not be clearly visible — just enough to hint that media is there.

Task 1 — Update the image placeholder in renderMedia

Replace the solid-color placeholder with a blurred image preview:

jsx
// BEFORE
<div className="chat-media-placeholder" onClick={...}>
  <div className="chat-media-placeholder-inner">
    {Icon.image()}
    <span>Tap to load photo</span>
  </div>
</div>

// AFTER
<div className="chat-media-placeholder" onClick={...}>
  <img
    src={msg.media_url}
    className="chat-media-placeholder-blur"
    draggable={false}
  />
  <div className="chat-media-placeholder-inner">
    {Icon.image()}
    <span>Tap to load photo</span>
  </div>
</div>
Task 2 — Update the video placeholder the same way
jsx
// BEFORE
<div className="chat-media-placeholder" onClick={...}>
  <div className="chat-media-placeholder-inner">
    {Icon.video()}
    <span>Tap to load video</span>
  </div>
</div>

// AFTER
<div className="chat-media-placeholder" onClick={...}>
  <img
    src={msg.media_url}
    className="chat-media-placeholder-blur"
    draggable={false}
  />
  <div className="chat-media-placeholder-inner">
    {Icon.video()}
    <span>Tap to load video</span>
  </div>
</div>

For video, msg.media_url points to the video file — the browser will not render a frame from it as an <img>. Leave it as-is; the blur layer will simply not render (transparent), and the dark overlay + icon will still show clearly.

Task 3 — Update chat-thread.css
css
/* BEFORE */
.chat-media-placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--chat-bubble-in, #f0f0f0);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-height: 120px;
}

.chat-media-placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-2, #888);
  font-size: 13px;
}

.chat-media-placeholder-inner svg {
  width: 32px;
  height: 32px;
  opacity: 0.5;
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

Key points:

position: relative + overflow: hidden on the placeholder contains the scaled blur
transform: scale(1.1) prevents blur edge artifacts (white halos at corners)
opacity: 0.6 darkens the blur so the icon and text are readable
background: #000 shows through as a dark base if the image hasn't loaded yet
Inner content is z-index: 1 so it sits above the blur layer
Do NOT touch
The _pendingLoad flag logic
The onClick tap-to-load handler
Any emoji picker or input bar changes
Deliverable
Confirm blurred <img> added to both image and video placeholders
Confirm CSS updated with blur layer styles
Build passes