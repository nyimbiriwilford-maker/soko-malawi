pushNotifications.js:46 [push] subscribed
:5173/favicon.svg:1  Failed to load resource: net::ERR_CONNECTION_REFUSED
client:865 WebSocket connection to 'ws://localhost:5173/?token=_hFY6zc1Jzao' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ client:865
:5173/icons/icon-192.png:1  Failed to load resource: net::ERR_CONNECTION_REFUSED
(index):1 Error while trying to use the following icon from the Manifest: http://localhost:5173/icons/icon-192.png (Download error or resource isn't a valid image)
CallContext.jsx:237 CallProvider channel status: SUBSCRIBED
Home.jsx:1  Failed to load resource: net::ERR_CONNECTION_REFUSED
react-dom_client.js?v=1c83588b:5273 TypeError: Failed to fetch dynamically imported module: http://localhost:5173/src/pages/Home.jsx

The above error occurred in one of your React components.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

defaultOnCaughtError @ react-dom_client.js?v=1c83588b:5273
logCaughtError @ react-dom_client.js?v=1c83588b:5299
runWithFiberInDEV @ react-dom_client.js?v=1c83588b:850
inst.componentDidCatch.update.callback @ react-dom_client.js?v=1c83588b:5338
callCallback @ react-dom_client.js?v=1c83588b:4094
commitCallbacks @ react-dom_client.js?v=1c83588b:4102
runWithFiberInDEV @ react-dom_client.js?v=1c83588b:850
commitClassCallbacks @ react-dom_client.js?v=1c83588b:6662
reappearLayoutEffects @ react-dom_client.js?v=1c83588b:7541
recursivelyTraverseReappearLayoutEffects @ react-dom_client.js?v=1c83588b:7587
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7040
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7029
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6974
flushLayoutEffects @ react-dom_client.js?v=1c83588b:8670
commitRoot @ react-dom_client.js?v=1c83588b:8583
commitRootWhenReady @ react-dom_client.js?v=1c83588b:8078
performWorkOnRoot @ react-dom_client.js?v=1c83588b:8050
performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=1c83588b:9058
performWorkUntilDeadline @ react-dom_client.js?v=1c83588b:35
ErrorBoundary.jsx:14 [ErrorBoundary] TypeError: Failed to fetch dynamically imported module: http://localhost:5173/src/pages/Home.jsx 
    at Lazy (<anonymous>)
    at RenderedRoute (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=1c83588b:4105:26)
    at Routes (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=1c83588b:4785:19)
    at ErrorBoundary (http://localhost:5173/src/components/ErrorBoundary.jsx:6:3)
    at Suspense (<anonymous>)
    at Router (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=1c83588b:4737:29)
    at BrowserRouter (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=1c83588b:7157:26)
    at NetworkProvider (http://localhost:5173/src/context/NetworkContext.jsx:8:35)
    at CallProvider (http://localhost:5173/src/context/CallContext.jsx:13:32)
    at App (http://localhost:5173/src/App.jsx?t=1785355895738:191:32)
(anonymous) @ ErrorBoundary.jsx:14
react_stack_bottom_frame @ react-dom_client.js?v=1c83588b:12893
inst.componentDidCatch.update.callback @ react-dom_client.js?v=1c83588b:5340
callCallback @ react-dom_client.js?v=1c83588b:4094
commitCallbacks @ react-dom_client.js?v=1c83588b:4102
runWithFiberInDEV @ react-dom_client.js?v=1c83588b:850
commitClassCallbacks @ react-dom_client.js?v=1c83588b:6662
reappearLayoutEffects @ react-dom_client.js?v=1c83588b:7541
recursivelyTraverseReappearLayoutEffects @ react-dom_client.js?v=1c83588b:7587
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7040
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7029
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6957
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:7046
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=1c83588b:7478
commitLayoutEffectOnFiber @ react-dom_client.js?v=1c83588b:6974
flushLayoutEffects @ react-dom_client.js?v=1c83588b:8670
commitRoot @ react-dom_client.js?v=1c83588b:8583
commitRootWhenReady @ react-dom_client.js?v=1c83588b:8078
performWorkOnRoot @ react-dom_client.js?v=1c83588b:8050
performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=1c83588b:9058
performWorkUntilDeadline @ react-dom_client.js?v=1c83588b:35
client:875 WebSocket connection to 'ws://localhost:5173/?token=_hFY6zc1Jzao' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ client:875
client:885 [vite] failed to connect to websocket.
your current setup:
  (browser) localhost:5173/ <--[HTTP]--> localhost:5173/ (server)
  (browser) localhost:5173/ <--[WebSocket (failing)]--> localhost:5173/ (server)
Check out your Vite / network configuration and https://vite.dev/config/server-options.html#server-hmr .
connect @ client:885
:5173/icons/icon-512.png:1  GET http://localhost:5173/icons/icon-512.png net::ERR_CONNECTION_REFUSED
(index):1 Error while trying to use the following icon from the Manifest: 