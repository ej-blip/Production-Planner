---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/bench.html","public/board.html","public/summary.html","public/history.html","public/setup.html"]
---

# Production Planner app screens

Scope: every screen in public/ (Management, bench iPads, floor board, day summary, history, setup). Mode: Operate.
Audience and job: management plans and releases the day at a desk; bench and cage operators read targets, batches and crew and send status and requests on iPads under bright factory light.
Constraints: no gamification, no helper text, status never by colour alone, large touch targets on bench screens, standard web controls.

## Direction contract

THESIS: The app is a set of engineering drawing sheets for the day's production. It refuses the dark-slate, rounded-card, neon-accent dashboard every generated app ships.
OWN-WORLD: Pale drafting paper (#e9f0f7) with a two-weight blue grid. Near-white sheets with 1px blue-grey rules and 3px corners. Ink is deep Prussian blue (#0f2747). The shell is a cyanotype title block (#173f6e) with white lettering. Redline orange-red marks faults and shortfalls, with amber and green as state colours. Barlow for text, Barlow Condensed capitals for labels and figures, tabular numerals.
STORY: Each person sees their sheet: what's planned, who's where, and what changed. They act on it with plain buttons.
FIRST VIEWPORT: The title-block header runs full width: sheet name, date cell, status cell, target cell and live state, each a labelled cell divided by white rules. The work areas sit below on the grid paper, with the primary action in the title block or the first sheet.
FORM: Pinned by the user (engineering blueprint / grid paper). Signature move: the title block, with labelled cells carrying real plan data. seed: none (pinned direction, concept-seed not run)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
