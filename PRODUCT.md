# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Management (planner):** plans tomorrow's production at a desk computer. They decide who's in, the work mix, who goes on which bench, then release the plan. During the day they watch the floor board, answer bench requests and review the day summary and history.
- **Bench operators:** use one iPad per bench (Assembly, Testing, Hardware Check, Packing) on the factory floor under bright lighting, at arm's length, often with gloves or in a hurry. They need the day's target, the batches, who is on the bench, and quick status and request buttons.
- **Production cage:** has its own iPad. It releases parts per batch and handles stock requests.

## Product Purpose
A daily production planning, dispatch and kanban system for a manufacturing floor that builds Gen4 and Tap units. It replaces whiteboards, roster photos and WhatsApp/Teams messages with one live source: plan the day, release it to the benches, track each batch bench by bench, and keep requests and notes visible where the work happens. Success means everyone on the floor sees the same plan and the same changes without asking.

## Positioning
A capacity-aware planner built for this floor's real rules: bench limits, tester pairs, skill dots per person and the three phases of the day. A batch moves across benches like a sticky note on a whiteboard, and each bench reports "hit target" or the real number it finished.

## Operating Context
- Daily flow on the Management screen: Who's in → Work mix → Benches → Release.
- The floor board has a column per bench (Cage → Assembly → Testing → Hardware → Packing). Each column holds one status note per batch, plus pinned notes and photos (e.g. a pallet split).
- Bench screens open straight from an iPad home-screen icon. Bench and management have different PINs; there are no email logins.
- Requests come from the benches: help, stock and faulty units. Each moves open → accepted → done, and Management gets live alerts.
- A day summary (with print, PDF and copy as text) and a history across days.
- It is currently a personal project, but it must still work for real. The workplace may adopt its own all-in-one app.

## Capabilities and Constraints
- Static HTML/CSS/JS in `public/`, with Firebase (Firestore and anonymous auth) and Firebase Hosting. Pushing to main auto-deploys.
- Each bench screen opens at its own URL. Practice mode runs against the local emulator.
- Capacity rules live in `js/capacity.js` and the planner engine in `index.html`; the two must stay in sync.
- Terminology: benches (Assembly, Testing, Hardware Check, Packing), Production Cage, batches, phases (Start, Second, Finish), skill dots (0–3), target, "Hit target"/short.

## Brand Commitments
- Professional, not gamified. No cartoon characters, game rooms, stars, playful shop names ("Maged's Mart") or toy colours (user, 2026-11-19).
- No instructional or helper text in the UI: titles, labels and numbers only.
- The user likes an engineering-blueprint / grid-paper look and wants to steer away from the look every AI-built HTML app shares.

## Evidence on Hand
- Real staff names and skills (`public/js/starter-data.js`), real configuration presets, and practice seed data (`scripts/seed-practice.mjs`).
- No logo or brand assets exist. Unit icons for the iPad home screen are in `public/icons/`.

## Product Principles
1. One live source of truth: if it's on a whiteboard or in a chat today, it belongs here.
2. Glanceable at arm's length on the floor; dense and precise at the desk.
3. Functionality first; the look serves the work.
4. The design itself explains things, so no help text is needed.

## Accessibility & Inclusion
- Bench iPads are read under bright factory lighting with gloves on, so they need large touch targets and high contrast.
- Status must never be shown by colour alone.
