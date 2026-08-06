Fix: chat list (conversations panel) cannot scroll on mobile. Root cause: chats-shell uses 100dvh on mobile but has no visualViewport-based height correction, unlike the chat thread which has --chat-vvh. Fix by adding the same visual viewport tracking to ChatsLayout.jsx.

1. Show the full ChatsLayout.jsx file (or at minimum the component body, imports, and any existing useEffect hooks).

2. Apply this fix to src/pages/ChatsLayout.jsx:

a) Add this import at the top if not already present:
   import { useEffect } from 'react'

b) Inside the ChatsLayout component, add this useEffect (place it as the first hook in the component, before any return/JSX):

useEffect(() => {
  const root = document.documentElement
  function apply() {
    const vv = window.visualViewport
    const h = vv ? Math.round(vv.height) : window.innerHeight
    const top = vv ? Math.round(vv.offsetTop) : 0
    root.style.setProperty('--chats-vvh', `${h}px`)
    root.style.setProperty('--chats-vv-top', `${top}px`)
  }
  apply()
  const vv = window.visualViewport
  vv?.addEventListener('resize', apply)
  vv?.addEventListener('scroll', apply)
  return () => {
    vv?.removeEventListener('resize', apply)
    vv?.removeEventListener('scroll', apply)
    root.style.removeProperty('--chats-vvh')
    root.style.removeProperty('--chats-vv-top')
  }
}, [])

3. In src/styles/chats.css, find the mobile rule for .chats-shell[data-has-thread='false'] (around lines 102-108):

Find:
.chats-shell[data-has-thread='false'] {

Show the full rule content, then replace the height/max-height/top values inside it with:
  top: var(--chats-vv-top, 0px);
  height: var(--chats-vvh, 100dvh);
  max-height: var(--chats-vvh, 100dvh);

4. Also find the main mobile .chats-shell rule (around lines 88-99) and update its height/max-height/top:

Find the lines inside that rule that set top, height, max-height (currently using --chat-vv-top and --chat-vvh from the thread) and replace with the new --chats-vvh variables:
  top: var(--chats-vv-top, 0px);
  height: var(--chats-vvh, 100dvh);
  max-height: var(--chats-vvh, 100dvh);

Note: --chat-vvh (set by Chat.jsx for the thread) and --chats-vvh (set by ChatsLayout.jsx for the list) are SEPARATE variables. Do not mix them up. The thread uses --chat-vvh; the list shell uses --chats-vvh.

5. Run npx eslint src/pages/ChatsLayout.jsx and npm run build. Report both results.

6. Confirm: grep -n "chats-vvh\|chats-vv-top" src/pages/ChatsLayout.jsx src/styles/chats.css — show all matches.