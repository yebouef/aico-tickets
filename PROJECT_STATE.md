# AICO Ticket Sales — Project State

A self-contained checkpoint so a future chat session can pick up where the current one left off without re-reading the whole conversation history.

## What this app is

A single-page web app for the AICO gala on **July 4, 2026**. One `index.html` file, hosted on GitHub Pages, installable as a PWA. Handles event ticket sales, raffle ticket sales, complimentary (VIP) tickets, table assignments, and QR-code-based door check-in. Backed by Firebase Firestore for real-time multi-device sync.

## URLs

- **Repo:** https://github.com/yebouef/aico-tickets
- **GitHub Pages live URL (works):** https://yebouef.github.io/aico-tickets/
- **Custom domain (intended but NOT YET CONFIGURED in GitHub):** https://tickets.aicocolumbus.org/
- **Scanner page:** append `?mode=scan` to whichever URL is being used
- **Public ticket page:** append `?ticket=<SaleId>` to whichever URL is being used

## Architecture overview

- **Frontend:** a single `index.html` (~217KB) with all CSS + JS inlined as a single ES module.
- **Backend:** Firebase Firestore for sales/sellers/comps/raffleSales/config docs. Anonymous Firebase Auth for all access. Firestore rules require `request.auth != null`.
- **Email:** EmailJS (free tier) for buyer/archive confirmations. Service ID, template ID, public key live in the `config/app` Firestore doc.
- **Portal sync:** optional integration with the AICO Membership Portal (Supabase). Uses a `service_role` key (no email/password auth, bypasses captcha and RLS). Config in `config/portal` Firestore doc.
- **PWA:** `manifest.webmanifest` + `service-worker.js` + PNG icons in repo root. Installable on iOS and Android. Offline-capable.

## Key Firestore collections / documents

- `/sales/{saleId}` — event ticket sales. saleId starts with `S`.
- `/comps/{compId}` — complimentary tickets. compId starts with `C`.
- `/raffleSales/{saleId}` — raffle ticket sales. saleId starts with `R`.
- `/sellers/{auto-id}` — seller accounts. Fields: `name`, `password`, optional `raffleRangeStart`, `raffleRangeEnd`.
- `/config/app` — single doc with public URL, event info, EmailJS keys, tables array, raffle config, etc.
- `/config/portal` — single doc with Supabase URL + service role key + chosen gala event ID.

## Features built

### Auth & roles
- Anonymous Firebase Auth for everyone (silent, on page load).
- App-level login: sellers (name + password stored in Firestore) and Admin (shared password `AICO2026`).
- Sellers see Sales / Raffle / Dashboard / Scanner tabs. Admin sees Dashboard + Scanner only.
- Dashboard re-locks when a seller leaves it.

### Event ticket sales
- Sale form with buyer name (member-picker linked to Portal), email, date (auto-set, locked), seller name (locked from session), payment (Cash/Zelle/Other), line items, amount received, balance.
- Categories: Adult-Member, Adult-Non-member, Child-Member-Family, Child-Non-member-Family.
- Inventory tracking (default 100, configurable).
- Post-sale popup with email confirmation status. No QR shown to seller (security).
- Auto-email to buyer (if provided) and AICO archive email.

### Raffle (physical double-roll tickets)
- Toggle to enable in Raffle Setup card.
- Sale form: buyer (member-picker, links to Portal), phone, email, **starting ticket number + count**, payment.
- App expands starting number + count into the list, e.g. `20096-001` + 3 → `20096-001`, `20096-002`, `20096-003`.
- Auto-advance: when the seller opens the Raffle tab or after a sale, the starting number pre-fills with the next number in that seller's assigned range (if `raffleRangeStart`/`raffleRangeEnd` set on their seller record).
- Lookup-by-number on the admin dashboard for draw night.
- Confirmation emails to buyer + archive. Supports an optional separate EmailJS template for raffle (`emailjsTemplateRaffleId` config field).
- Dashboard search, KPIs (tickets sold, revenue, unique buyers), CSV export.

### Complimentary tickets (VIPs)
- "Complimentary Tickets" card in dashboard. Add name + optional email + guest count + notes.
- Each comp gets its own ID (`C...`), QR code, ticket page.
- Auto-email to recipient (if email) and archive.
- Counts toward table capacity but not toward sales/inventory.
- Shown in Sales Log with yellow tint and "COMP" badge.

### Tables
- Tables Setup card: add tables one at a time or "Quick: add N tables of N seats" bulk button. Each table has name + capacity.
- Table Assignments card: list of all sales + comps with a dropdown to assign a table. Live capacity tracking with fill bar; warns on over-capacity.
- Scanner shows a big TABLE banner at the top of valid results.

### Scanner (door check-in)
- Dedicated `?mode=scan` URL. Uses `qr-scanner` library via jsDelivr ESM.
- Camera viewfinder + manual entry fallback. After scan, hides camera and shows large result panel.
- Three states: ✓ VALID (green, big Check In button) / ⛔ ALREADY CHECKED IN (red, with timestamp + scanner name) / ⚠ TICKET NOT FOUND (yellow).
- Check-in writes `scannedAt: serverTimestamp()` and `scannedBy: <user name>` to the sale/comp doc.
- Works for both event ticket QRs (`?ticket=S...`) and comp QRs (`?ticket=C...`).
- Shows full sale details: buyer, guests, line items, table, payment status, balance-due warning.
- Auto-scrolls result into view on mobile so the seller doesn't have to scroll.

### Dashboard order (top-down)
1. KPIs (overview)
2. Sales Log (interleaved sales + comps, chronological)
3. Raffle Sales (with lookup-by-number panel)
4. Complimentary Tickets
5. Event & Ticket Settings (locked by default; toggle to edit; save with confirm)
6. Sellers (name + password + raffle range per seller, inline-editable)
7. Raffle Setup (same lock pattern)
8. Tables Setup (closer to event)
9. Table Assignments (final step)
10. Membership Portal Sync Settings (modal-accessed via ⚙ Portal in header)

### PWA
- Installable. Standalone display mode. Theme color #1d4ed8.
- Service worker caches app shell (network-first, cache fallback). Cross-origin requests (Firebase, CDNs) bypass the cache.
- Android shortcut for "Scanner" via long-press of app icon.
- Install button surfaces in header when `beforeinstallprompt` fires.

### i18n
- Full EN/FR translation. Toggle in header. Stored in localStorage.
- Number formatting and date formatting locale-aware.

## Currently known issues / TODO

- [ ] **Public app URL points to `tickets.aicocolumbus.org` but the domain isn't yet configured as a GitHub Pages custom domain.** Result: Scanner tab and email QR codes break. Fix: either change Public app URL back to `https://yebouef.github.io/aico-tickets/` in admin settings, OR set up DNS (CNAME `tickets` → `yebouef.github.io`) + add custom domain in GitHub repo Settings → Pages. (As of last conversation: user was about to do one of these.)
- [ ] **Raffle email "Please bring this ticket" line:** template fix proposed — wrap `View your ticket online...` and `Please bring this ticket` lines in `{{#ticket_url}}...{{/ticket_url}}` Mustache conditional in the EmailJS template. Sent the user the full rewritten template. User said they'll apply it.
- [ ] **Inverse-conditional raffle reminder:** user is interested in adding a raffle-specific "keep your physical tickets" message via `{{^ticket_url}}...{{/ticket_url}}`. Pending their decision.
- [ ] **Scanner debugging note:** user reported scanner not working. Diagnosed as Public-URL-pointing-to-unconfigured-custom-domain. Pending: user choosing the fix.
- [ ] **Captcha on Supabase:** previously the user had Supabase captcha protection enabled and got errors. Now using service_role key which bypasses captcha entirely. Captcha can stay on for Portal logins.

## How to push code changes (user-side)

```
cd ~/Documents/AICO/aico-tickets
rm -f .git/*.lock
git pull --rebase   # if needed
git add .
git commit -m "..."
git push
```

GitHub PAT is cached in macOS Keychain.

## Conventions in this codebase

- Single `index.html`. All logic inline. ES module `<script type="module">`.
- ID prefixes: sales = `S`, comps = `C`, raffleSales = `R`.
- i18n keys named in camelCase. Both `en` and `fr` must be updated when adding strings.
- Lock pattern: cards starting "locked" by default with 🔒 badge, click "🔓 Edit settings" to unlock, confirm dialog on save.
- File mounts in sandbox: workspace at `/sessions/<session>/mnt/AICO/aico-tickets/`.

## EmailJS template (current draft)

```
Hi {{buyer_name}},

Thank you for your purchase. Here are the details for {{event_name}}.

Event: {{event_name}}
Date: {{event_date}}
Location: {{event_location}}

Tickets:
{{tickets_summary}}

Total: {{total}}
Payment: {{payment}}
Sale ID: {{sale_id}}
{{#ticket_url}}

View your ticket online (with QR code for entry):
{{ticket_url}}

Please bring this ticket (printed or on your phone) to the event.
{{/ticket_url}}

Questions? Reply to this email or contact us at {{contact_email}}.

Best regards,
— AICO
```

Subject: `Your AICO ticket — {{event_name}}`

## Last commits (newest first)

```
73b86d6 Raffle: support a separate EmailJS template (falls back to main if blank)
4caffbe Raffle: confirmation emails + auto-advance starting number per seller range
0544442 Portal: use Supabase service role key instead of email/password auth
c774dfa Reorder dashboard cards by daily-use priority
dadaac8 Raffle: link buyer to AICO member/non-member picker (auto-fills phone+email)
0795e8b Portal: sync everything, no per-device retyping
fdf99a3 Sync portal settings via Firestore so every device picks them up
b232ffb Add raffle ticket tracking
5fe4cf0 Add PWA support, comps in log, scanner table banner
```

Plus four PR-merged commits done outside this chat (#1–#4): gitignore, scanner URL fix, open-ticket button, scanner-opens-same-tab.
