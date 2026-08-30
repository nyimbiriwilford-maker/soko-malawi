TASK: All icons on the product page should use modern and premium icons.

DONE in src/pages/ListingDetail.jsx — every icon on the product page now uses lucide-react (the modern, premium icon set the rest of the codebase already uses). All 73 hand-rolled inline <svg> blocks and every decorative emoji were replaced with consistent, professionally designed lucide components with uniform stroke weights:

1. Spec / Overview icons — Monitor (Brand), Star (Model), HardDrive (Storage), Cpu (RAM), Palette (Color), Smartphone (SIM), Wifi (Network), BatteryCharging (Battery).

2. CTA buttons (mobile + desktop sidebar + sticky bar) — MessageCircle (Chat/WhatsApp), Phone (Call), Mail (Email), Heart with dynamic fill state (Favorites), Pencil (Edit), Trash2 (Delete).

3. Gallery — Star (Featured badge), Heart (favorite overlay), ChevronRight rotated (gallery arrows + breadcrumb separators), Home (Marketplace crumb), Video (video tag), Play (video thumb overlay), Package (no-photo placeholder + "You may also like" fallbacks).

4. Section headers — Sparkles (Key Features), Zap (Flash Sale), Boxes (Bulk Pricing), Wrench (Booking Rates), ShieldCheck (Buy with Confidence / deposit notice / condition), MapPin (Location + seller city + related-item rows), Bell (buyer-alerts cross-link), Flag (Report listing), ArrowUpRight (Open in Google Maps).

5. Listing Details rows — Tag (Category), SlidersHorizontal (Subcategory), ShieldCheck (Condition), Calendar (Posted), FileText (Listing ID), Eye (Views), Package (Availability), BadgeCheck (Status).

6. Seller card — BadgeCheck (verified), Zap (responsive), Clock (member since), ChevronRight (profile chevron).

7. Share — Copy/Check (Copy Link), MessageCircle (WhatsApp), Facebook, Twitter (Post on X), MoreHorizontal (More), Link2 + Check (share sheet rows).

8. Modals — Flag (report), CheckCircle (report submitted), Trash2 (delete confirm); report reasons got meaningful lucide icons (AlertTriangle scam, Package counterfeit, Ban prohibited, CircleAlert misleading, EyeOff inappropriate, FileText other). Availability chips: Check / Clock / X. FREE price uses Gift. Flash timer uses Flame.

Icon consistency: uniform stroke widths (2–2.5 for UI, 1.8 for spec tiles), colors preserved exactly as before (brand green #0F9D58, WhatsApp green, Facebook blue, etc.) so the design language is unchanged — only the icon geometry is now modern, crisp and coherent.

VERIFIED:
- 0 inline <svg> and 0 emoji icons remain on the page (verified by search).
- npx eslint — 4 problems, all pre-existing (actually 1 fewer than before this change: ShieldCheck unused-import error resolved).
- npm run build — success (fixed one missing-export: SimCard → Smartphone for lucide 0.400).
