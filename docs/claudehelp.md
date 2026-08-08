Download the React DevTools for a better development experience: https://react.dev/link/react-devtools
e1b488b3-acde-47b6-9286-e33e132089aa?src=direct:1 Banner not shown: beforeinstallpromptevent.preventDefault() called. The page must call beforeinstallpromptevent.prompt() to show the banner.
react-dom_client.js?v=a44a0e57:5273 ReferenceError: timer is not defined
    at refresh (Chat.jsx:2237:20)
    at Chat.jsx:2247:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=a44a0e57:12903:13)
    at runWithFiberInDEV (react-dom_client.js?v=a44a0e57:850:66)
    at commitHookEffectListMount (react-dom_client.js?v=a44a0e57:6616:153)
    at commitHookPassiveMountEffects (react-dom_client.js?v=a44a0e57:6651:55)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7700:6)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7712:14)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5)

The above error occurred in the <Chat> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

defaultOnCaughtError @ react-dom_client.js?v=a44a0e57:5273
ErrorBoundary.jsx:14 [ErrorBoundary] ReferenceError: timer is not defined
    at refresh (Chat.jsx:2237:20)
    at Chat.jsx:2247:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=a44a0e57:12903:13)
    at runWithFiberInDEV (react-dom_client.js?v=a44a0e57:850:66)
    at commitHookEffectListMount (react-dom_client.js?v=a44a0e57:6616:153)
    at commitHookPassiveMountEffects (react-dom_client.js?v=a44a0e57:6651:55)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7700:6)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7712:14)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5) 
    at Chat (http://localhost:5173/src/pages/Chat.jsx?t=1786136402276:259:48)
    at div (<anonymous>)
    at div (<anonymous>)
    at ChatsLayout (http://localhost:5173/src/pages/ChatsLayout.jsx?t=1786136402276:24:21)
    at RenderedRoute (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:4105:26)
    at Routes (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:4785:19)
    at ErrorBoundary (http://localhost:5173/src/components/ErrorBoundary.jsx:6:3)
    at Suspense (<anonymous>)
    at Router (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:4737:29)
    at BrowserRouter (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:7157:26)
    at NetworkProvider (http://localhost:5173/src/context/NetworkContext.jsx:8:35)
    at CallProvider (http://localhost:5173/src/context/CallContext.jsx:13:32)
    at App (http://localhost:5173/src/App.jsx?t=1786136402276:194:32)
(anonymous) @ ErrorBoundary.jsx:14
react-dom_client.js?v=a44a0e57:5273 ReferenceError: timer is not defined
    at refresh (Chat.jsx:2237:20)
    at Chat.jsx:2247:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=a44a0e57:12903:13)
    at runWithFiberInDEV (react-dom_client.js?v=a44a0e57:850:66)
    at commitHookEffectListMount (react-dom_client.js?v=a44a0e57:6616:153)
    at commitHookPassiveMountEffects (react-dom_client.js?v=a44a0e57:6651:55)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7700:6)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7712:14)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5)

The above error occurred in the <Chat> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

defaultOnCaughtError @ react-dom_client.js?v=a44a0e57:5273
ErrorBoundary.jsx:14 [ErrorBoundary] ReferenceError: timer is not defined
    at refresh (Chat.jsx:2237:20)
    at Chat.jsx:2247:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=a44a0e57:12903:13)
    at runWithFiberInDEV (react-dom_client.js?v=a44a0e57:850:66)
    at commitHookEffectListMount (react-dom_client.js?v=a44a0e57:6616:153)
    at commitHookPassiveMountEffects (react-dom_client.js?v=a44a0e57:6651:55)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7700:6)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5)
    at reconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7712:14)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=a44a0e57:7687:5) 
    at Chat (http://localhost:5173/src/pages/Chat.jsx?t=1786136402276:259:48)
    at div (<anonymous>)
    at div (<anonymous>)
    at ChatsLayout (http://localhost:5173/src/pages/ChatsLayout.jsx?t=1786136402276:24:21)
    at RenderedRoute (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:4105:26)
    at Routes (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:4785:19)
    at ErrorBoundary (http://localhost:5173/src/components/ErrorBoundary.jsx:6:3)
    at Suspense (<anonymous>)
    at Router (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:4737:29)
    at BrowserRouter (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=a44a0e57:7157:26)
    at NetworkProvider (http://localhost:5173/src/context/NetworkContext.jsx:8:35)
    at CallProvider (http://localhost:5173/src/context/CallContext.jsx:13:32)
    at App (http://localhost:5173/src/App.jsx?t=1786136402276:194:32)
(anonymous) @ ErrorBoundary.jsx:14
CallContext.jsx:238 CallProvider channel status: SUBSCRIBED
uatodeiavtsthcgqvebh.supabase.co/rest/v1/users?on_conflict=id:1  Failed to load resource: the server responded with a status of 403 ()
uatodeiavtsthcgqvebh.supabase.co/rest/v1/users?on_conflict=id:1  Failed to load resource: the server responded with a status of 403 ()