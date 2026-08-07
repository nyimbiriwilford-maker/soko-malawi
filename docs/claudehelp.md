Instructions for DeepSeek:

Instructions for DeepSeek — Emoji Picker: Block Keyboard on Textarea Tap

Problem: When the emoji picker is open and the user taps the textarea, the software keyboard appears and the emoji picker closes/gets pushed. The textarea must not trigger the keyboard while the picker is open. The user should only be able to reposition the cursor — no keyboard, no dismiss.

Task 1 — Prevent keyboard from appearing on textarea tap

When showEmoji is true, the textarea must not receive native focus (which triggers the keyboard). Use readOnly to suppress the keyboard while still allowing cursor repositioning via touch:

Find the textarea in Chat.jsx and add a conditional readOnly prop:

jsx
// BEFORE
<textarea
  ref={inputRef}
  ...
/>

// AFTER
<textarea
  ref={inputRef}
  readOnly={showEmoji}
  ...
/>

readOnly on a textarea prevents the software keyboard from appearing on iOS/Android while still allowing the user to tap to reposition the cursor. The field remains interactive for cursor placement but does not invoke the keyboard.

Task 2 — Re-enable input immediately when picker closes

When showEmoji becomes false (picker dismissed), the textarea must become writable again instantly. Since readOnly is driven by showEmoji state, this is automatic — no extra logic needed. Just confirm the readOnly={showEmoji} prop is the only change and no additional disabled or pointerEvents:none was added.

Task 3 — Prevent onFocus from firing the keyboard via blur guard

Even with readOnly, some Android browsers still briefly show the keyboard on tap. Add a onFocus guard that immediately blurs the textarea when the picker is open:

jsx
onFocus={(e) => {
  if (showEmoji) {
    e.target.blur()
    return
  }
  // existing onFocus logic here (if any)
}}

This is a belt-and-suspenders guard — readOnly handles iOS, blur() on focus handles Android.

Do NOT touch
cursorPosRef logic — keep intact
setShowEmoji(false) call sites already guarded — keep intact
CSS files
Any dismiss button handlers
Deliverable

Report back with:

Confirm readOnly={showEmoji} added to textarea
Confirm onFocus blur guard added
Confirm no disabled or pointerEvents added
Build passes