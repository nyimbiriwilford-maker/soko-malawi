# SokoMW Project Index

## Stack
React 19 + Vite 8, React Router v7, Tailwind v4, Framer Motion
Supabase (Postgres/RLS, Auth PKCE, Realtime, Storage, Edge Functions)
WebRTC (calling), @huggingface/transformers (visual search)

## Entry & Routing
- src/main.jsx — DOM mount, SW registration
- src/App.jsx — router, auth hydration, layout shell

## Global State
- src/context/CallContext.jsx — WebRTC call state
- src/hooks/usePresence.js — online/typing/presence sync

## Auth & Profile
- src/pages/Login.jsx, LoginPage.jsx, AuthCallback.jsx, Onboarding.jsx
- src/pages/Profile.jsx, PublicProfile.jsx

## Marketplace / Discovery
- src/pages/Home.jsx, ListingDetail.jsx, PostListing.jsx, SearchPage.jsx
- src/pages/ShopsPage.jsx, ShopPage.jsx, ShopSetup.jsx, ShopDashboard.jsx

## Chat & Calling
- src/pages/ChatsLayout.jsx, ChatListPanel.jsx, Chat.jsx
- src/components/CallManager.jsx, GlobalCallListener.jsx, PersistentCallShell.jsx, MiniCallBar.jsx

## Verification & Trust
- src/lib/verification.js
- src/components/VerificationWizard.jsx
- src/pages/Admin.jsx, AdminVerificationHub.jsx

## Statuses / Looking For
- src/pages/StatusPage.jsx, StatusUploadModal.jsx
- src/pages/LookingFor/LookingFor.jsx

## Backend (supabase/functions/)
send-otp, verify-otp, initiate-payment, verify-transaction,
send-call-push, notify-wanted-alerts, image-search, broadcast-email

## Directory sizes
components/ (52), pages/ (35), hooks/ (14), lib/ (7), utils/ (8), constants/ (7)