# Feature: "My Tickets" section in the Member Portal profile

When an AICO member buys a gala ticket through the Tickets app, that purchase should appear in their Member Portal profile under a new "My Tickets" section — similar to the existing "Payment History" card but filtered to gala-type payments.

## Where this lives

- **Not** in the tickets app (`~/Documents/AICO/aico-tickets/index.html`)
- **In** the membership Portal source: `~/Documents/AICO/portal/index.html` (~4,225 lines, 269 KB)
- Portal repo: `git@github.com:yebouef/aico-backups.git` (the live HTML is also at `~/Documents/AICO/aico-membership-portal-online.html` — verify which is the source of truth before editing)

## How the data already flows

When a seller records a gala ticket sale in the Tickets app and then clicks "Sync to Membership Portal" in the admin dashboard, the Tickets app calls Supabase with the service-role key and inserts into:

1. **`contacts` table** — only when the buyer is a non-member (new `id: c-tix-<random>`). Skipped if the buyer was picked from the member dropdown.
2. **`payments` table** — one row per sale, regardless of member/non-member:
   - `id` = `p-tix-<saleId>` (e.g. `p-tix-SMP4XT73PMQ1`)
   - `member_id` = the AICO member's id (when buyer was a member), else `null`
   - `contact_id` = the contact's id (when buyer was non-member), else `null`
   - `date` = sale date (`YYYY-MM-DD`)
   - `amount` = `received` (what was paid, not the total)
   - `type` = `'gala'`
   - `event_id` = the configured Gala event id (from `events` table)
   - `notes` = a long pre-formatted string: `"Gala ticket sale (seller: X). Payment: Cash. Lines: 2×ADULT_MEMBER@$50, 1×CHILD_MEMBER@$25. Total: $125.00 · Received: $125.00. Buyer email: ..."`

So the data is already there. We just need to surface it in the Portal UI.

## What "My Tickets" should show

For the **currently signed-in member** (`CURRENT_PROFILE.member_id`), fetch all `payments` where `member_id = CURRENT_PROFILE.member_id` and `type = 'gala'`. For each row:

- **Event name** (join with `events` table on `event_id` to get `events.name` and `events.date`)
- **Sale date** (the `payments.date` field)
- **Amount paid** (the `payments.amount` field, formatted as currency)
- **Tickets purchased** — parsed from `notes` (the `Lines: ...` section) or just shown as "See receipt" if parsing is fragile
- **Link to view the online ticket** — only meaningful if we can resolve the sale ID:
  - Strip the `p-tix-` prefix from `payments.id` → `SMP4XT73PMQ1` → that's the sale ID
  - The view-ticket URL is `<publicUrl>?ticket=<saleId>` where `publicUrl` is the Tickets app's hosted URL (currently `https://tickets.aicocolumbus.org/` once that domain is verified, or `https://yebouef.github.io/aico-tickets/` as fallback)
  - This URL should be configurable in the Portal (admin setting) so it can be changed without code edits

## UI placement

The Portal already renders the member dashboard via a `buildGroup({prefix:'member', key:'history', icon, titleKey:'group_my_history', innerHtml: historyCardHtml})` call around line 2045. The existing "Payment History" card sits inside this group. Add a parallel card called "My Tickets" / "Mes billets" using the same `buildGroup` pattern.

Place it **above** the Payment History card (tickets are timely and visually richer; dues history is reference-like).

## i18n keys to add

In the existing `I18N` map in `portal/index.html`:

```js
en: {
  group_my_tickets: "My Tickets",
  my_tickets_empty: "No tickets yet. Past gala purchases will appear here.",
  my_tickets_view_ticket: "View ticket",
  my_tickets_paid: "Paid",
  my_tickets_amount: "Amount",
  my_tickets_event: "Event",
  ...
}
fr: {
  group_my_tickets: "Mes billets",
  my_tickets_empty: "Aucun billet pour l'instant. Vos achats passés apparaîtront ici.",
  my_tickets_view_ticket: "Voir le billet",
  my_tickets_paid: "Payé",
  my_tickets_amount: "Montant",
  my_tickets_event: "Événement",
  ...
}
```

## Data fetch — proposed Supabase query

```js
async function loadMyTickets(memberId){
  if(!memberId) return [];
  const { data, error } = await sb
    .from('payments')
    .select('id, date, amount, notes, events(id, name, date, location)')
    .eq('member_id', memberId)
    .eq('type', 'gala')
    .order('date', { ascending: false });
  if(error){ console.warn('loadMyTickets', error); return []; }
  return data || [];
}
```

This uses Supabase's relational join syntax to pull the event info in one query. Confirm the foreign-key relationship from `payments.event_id` to `events.id` is set in Supabase schema (it should be, per `aico-supabase-setup.sql`).

## Rendering — proposed card HTML

```js
function renderMyTickets(rows){
  if(!rows.length){
    return `<div class="card-empty">${t('my_tickets_empty')}</div>`;
  }
  return rows.map(r => {
    const saleId = (r.id||'').replace(/^p-tix-/, '');
    const ticketUrl = `${MY_TICKETS_VIEWER_BASE}?ticket=${encodeURIComponent(saleId)}`;
    const ev = r.events || {};
    return `
      <div class="ticket-row">
        <div class="ticket-event"><strong>${escapeHtml(ev.name || '—')}</strong></div>
        <div class="ticket-meta">
          ${t('my_tickets_event')}: ${escapeHtml(ev.date || '—')} · ${escapeHtml(ev.location || '')}
        </div>
        <div class="ticket-meta">
          ${t('my_tickets_paid')}: ${fmtDate(r.date)} · ${t('my_tickets_amount')}: $${(r.amount||0).toFixed(2)}
        </div>
        <a href="${ticketUrl}" target="_blank" rel="noopener" class="btn-secondary">${t('my_tickets_view_ticket')}</a>
      </div>
    `;
  }).join('');
}
```

## Configuration field

Add a Portal-side setting for the Tickets app URL so the "View ticket" link can be configured without code edits. Either:

- Hardcode in the Portal (simpler now): `const MY_TICKETS_VIEWER_BASE = 'https://tickets.aicocolumbus.org/';`
- Or: add a row in the Portal's `settings` table called `tickets_viewer_url` and read it on profile load. Cleaner long-term.

## Open questions to clarify with the user before building

1. **Non-member buyers**: should contacts (people who bought as non-members) ever see their tickets too? Probably not — they don't have Portal accounts. Skip.
2. **Show all-time tickets or only current-year?** Recommend all-time, sorted newest first.
3. **What happens if the buyer's email matches a member but the sync linked them as a contact?** Unlikely but possible. Out of scope for v1.
4. **Should clicking "View ticket" require any auth check on the Tickets app side?** Currently anyone with the URL can see the ticket. Same security model as before, no change needed.

## Definition of done

- Member signs in to Portal → sees a new "My Tickets" / "Mes billets" card on their profile page.
- Card lists their gala ticket purchases (event, date, amount, View ticket button).
- "View ticket" button opens the Tickets app ticket page in a new tab.
- Empty state: "No tickets yet. Past gala purchases will appear here."
- Works in EN and FR.
- No regression: existing Payment History card unaffected.

## How to onboard a fresh chat

> Read `~/Documents/AICO/aico-tickets/MY_TICKETS_FEATURE_PLAN.md` and `~/Documents/AICO/aico-tickets/PROJECT_STATE.md` to get oriented. We need to implement the My Tickets feature described in the plan, in `~/Documents/AICO/portal/index.html`. Confirm understanding before editing, then proceed.
