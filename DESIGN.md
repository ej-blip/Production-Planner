---
name: Production Planner
description: Daily production plan, dispatch and kanban, drawn as engineering sheets on blueprint grid paper.
colors:
  paper: "#e8eff6"
  grid-minor: "rgba(23, 63, 110, 0.055)"
  grid-major: "rgba(23, 63, 110, 0.12)"
  sheet: "#f9fbfd"
  inset: "#eef3f9"
  raised: "#ffffff"
  btn: "#e3eaf3"
  btn-hover: "#d4dfeb"
  rule: "#c5d2e1"
  rule-strong: "#8ea4bf"
  ink: "#0f2747"
  ink-2: "#2c4a6e"
  muted: "#4f6785"
  print: "#173f6e"
  print-2: "#1f4f88"
  print-deep: "#0f2f55"
  print-ink: "#f4f8fc"
  print-muted: "#bdd0e6"
  print-rule: "rgba(255, 255, 255, 0.22)"
  accent: "#1d5fae"
  accent-soft: "#dde9f7"
  on-accent: "#ffffff"
  ok: "#1b7643"
  ok-soft: "#dcefe2"
  amber: "#93570a"
  amber-soft: "#f6e7c9"
  red: "#b9381a"
  red-soft: "#f8e0d8"
  violet: "#5f48a6"
  violet-soft: "#e7e2f5"
  note: "#fbf2cf"
  note-rule: "#d4ad45"
  note-ink: "#4a3405"
  k-cage: "#4f6785"
  k-assembly: "#a86400"
  k-testing: "#1d5fae"
  k-hardware: "#5f48a6"
  k-packing: "#1b7643"
  verizon: "#b8262c"
  global: "#1d5fae"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.05em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.02em"
  title:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.06em"
  body:
    fontFamily: "Barlow, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  button:
    fontFamily: "Barlow, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.07em"
  label-small:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  photo: "2px"
  sheet: "3px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.print}"
    textColor: "{colors.print-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sheet}"
    padding: "10px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.print-2}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sheet}"
    padding: "10px 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.inset}"
  button-titleblock-primary:
    backgroundColor: "{colors.print-ink}"
    textColor: "{colors.print}"
    rounded: "{rounded.sheet}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sheet}"
    padding: "12px"
  title-block:
    backgroundColor: "{colors.print}"
    textColor: "{colors.print-ink}"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
  figure-cell:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "12px 16px"
  tag:
    typography: "{typography.label}"
    rounded: "{rounded.sheet}"
    padding: "3px 8px"
  status-note:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "10px 12px"
  status-note-waiting:
    backgroundColor: "{colors.inset}"
  pinned-note:
    backgroundColor: "{colors.note}"
    textColor: "{colors.note-ink}"
    rounded: "{rounded.sheet}"
    padding: "10px 12px"
  crew-chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "10px 14px"
  crew-chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  request-row:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    padding: "10px 12px"
  dialog:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "20px"
    width: "480px"
---

# Design System: Production Planner

## Overview

**Creative North Star: "The Day's Drawing Set"**

Every screen is an engineering drawing sheet for today's production. Pale drafting paper with a two-weight blue grid sits behind everything; work lives on near-white sheets ruled in blue-grey; a cyanotype title block runs across the top of every page carrying the sheet name and the live plan figures in labelled cells. The ink is deep Prussian blue, and the only loud colour is a redline orange-red for faults and shortfalls.

The system is dense and precise at the desk (Management, Summary, History) and glanceable at arm's length on bench iPads under bright factory light. It is professional and plain: standard web controls, condensed capitals for labels and figures, tabular numerals everywhere. It deliberately refuses the dark-slate, rounded-card, neon-accent dashboard look, and it never gamifies: no cartoon characters, stars, playful names or toy colours.

The screen speaks only in titles, labels and numbers. There is no instructional or helper text; the drawing itself explains the work.

**Key Characteristics:**
- Blueprint grid paper ground (16px minor, 80px major), fixed behind the page.
- Cyanotype title block header with labelled data cells divided by thin white rules.
- Near-white sheets with 1px blue-grey rules and 3px corners; flat, no resting shadows.
- Sections divided by ruled lines, not by separate floating cards.
- Barlow for text, Barlow Condensed capitals for labels and figures, tabular numerals.
- Status always carried by words plus a coloured rule, never by colour alone.

## Colors

A cool drafting palette of paper, Prussian ink and cyanotype blue, with three state colours used only to mark state.

### Primary
- **Cyanotype Print** (print): the title block background and the fill of every primary button. Hover lifts to **Lighter Print** (print-2); the button edge and the title block's bottom rule are **Deep Print** (print-deep).
- **Drafting Blue** (accent): links, focus outlines, in-progress status, selected crew chips, the active phase tab, drop targets. Its soft wash (accent-soft) backs selected and in-progress fills.

### Secondary
- **Redline** (red, red-soft): faults, shortfalls ("Did 30 of 36"), faulty-unit requests, errors, people marked away.
- **Signal Amber** (amber, amber-soft): waiting-on-someone states, help requests, manual crew placements, the "Reported" request state.
- **Pass Green** (ok, ok-soft): "Hit target", done requests.

### Tertiary
- **Markup Yellow** (note, note-rule, note-ink): pinned notes only; a markup note stuck on the sheet.
- **Bench keys** (k-cage, k-assembly, k-testing, k-hardware, k-packing) and **network keys** (verizon, global): the outline and initials colour of crew badges and station icons, always paired with initials or a station code.

### Neutral
- **Drafting Paper** (paper) with **Grid Lines** (grid-minor, grid-major): the page ground.
- **Sheet White** (sheet): every work surface, dialog and figure cell. **Raised White** (raised): fields, secondary buttons, request rows, note cards. **Inset** (inset): waiting notes, done rows, secondary-button hover. **Button Grey** (btn, btn-hover): unselected phase tabs and stepper segments.
- **Prussian Ink** (ink): all body text and headings. **Ink 2** (ink-2): dialog field labels, done-row text. **Muted Ink** (muted): table headers, figure labels, sub-lines.
- **Rule** (rule): internal dividers and the 1px gaps between ruled cells. **Strong Rule** (rule-strong): sheet, field and button outlines.
- **Title-block lettering** (print-ink, print-muted, print-rule): white values, pale-blue labels and the white cell dividers inside the title block.

### Named Rules
**The State-Only Colour Rule.** Red, amber and green mark state and nothing else. They never decorate a heading, a section or a button at rest.

**The Words-First Status Rule.** Every status is a word in condensed capitals inside a 1px rule of its colour (Waiting, Hit target, Did 30 of 36, Sent, Responding, Reported). Colour reinforces; it never carries meaning alone. The connection light sits next to the word "Live" or "Offline"; crew badges carry initials.

## Typography

**Display Font:** Barlow Condensed (with Barlow, Arial Narrow)
**Body Font:** Barlow (with Segoe UI, system-ui)

**Character:** A drafting-office pairing: the condensed capitals read like title-block lettering and dimension callouts; plain Barlow carries names and sentences. Tabular numerals are set on the body so every figure lines up.

### Hierarchy
- **Display** (Barlow Condensed 600, 26px, uppercase, 0.05em): the sheet name in the title block (Production Planner, Floor Board). 23px under 700px.
- **Headline** (Barlow Condensed 600, 22px, 0.02em): title-block values and the connection state; dialog titles (uppercase, 0.04em). 19px under 700px.
- **Title** (Barlow Condensed 600, 19px, uppercase, 0.06em): sheet headings, ruled off by a 1px rule beneath.
- **Body** (Barlow 400, 16px, 1.4): names, batch text, request text. Fields stay at 16px so iOS never zooms.
- **Button** (Barlow 600, 15px): every button label, sentence case.
- **Label** (Barlow Condensed 600, 13-15px, uppercase, 0.05-0.1em): title-block cell labels (13px, 0.1em), table headers and figure labels (14px, 0.07em), status tags (14px, 0.05em), dialog field labels (15px, 0.04em).

### Named Rules
**The Lettering Rule.** Labels, headers, tags and figures are condensed capitals; names, batch text and button labels are plain Barlow in sentence case. Never set a running sentence in capitals.

**The Tabular Rule.** Numbers are always tabular so targets, counts and times align in columns and title-block cells.

## Layout

The page ground is the grid: 16px minor squares with an 80px major grid, fixed to the viewport. The title block is sticky at the top, full width, a single wrapping row of cells: sheet name, then labelled data cells (date, plan state, target, connection), then actions pushed to the right. Each cell is divided by a 1px white rule; the block ends in a 3px deep-print rule.

Work sits below on sheets. Inside a sheet, regions are separated by rules rather than nested cards: figure strips and station grids use a 1px gap over a rule-coloured background so the gaps draw the lines. The floor board is a row of bench columns (Cage, Assembly, Testing, Hardware, Packing), each a sheet holding its batch status notes.

Spacing runs on a small step (6, 8, 12, 16, 20px): 8px between controls, 10-12px inside notes and rows, 12-16px inside figure cells, 20px inside dialogs. Buttons are at least 40px tall; dialog fields are 12px padded at 16px type.

Breakpoints at 1150px (Management layout), 900px (crew board stacks to one column) and 700px (title block stacks: sheet name takes the full row, cells wrap with rules beneath, request rows fold to icon plus body).

## Elevation & Depth

Flat. Sheets, notes, figures and rows sit on the paper with a 1px rule and no shadow; depth comes from the paper-to-sheet tone step and the rules. Shadows appear only on things that float above the drawing for a moment: dialogs, toasts and tooltips, and a chip being dragged. Hover on a clickable note draws a soft accent ring rather than lifting it.

### Shadow Vocabulary
- **Dialog float** (`box-shadow: 0 24px 48px -24px rgba(15, 39, 71, 0.55)`): floor dialogs. The PIN box uses a deeper `0 30px 60px -30px rgba(0, 0, 0, 0.6)` over the print-blue ground.
- **Drag ghost** (`box-shadow: 0 8px 24px rgba(15, 39, 71, 0.23)`): a crew chip in mid-drag.
- **Popover** (`box-shadow: 0 8px 20px rgba(15, 39, 71, 0.2)` to `0 18px 40px rgba(15, 39, 71, 0.25)`): history tooltips, Management toasts and alerts.
- **Hover ring** (`box-shadow: 0 0 0 3px var(--accent-soft)`): clickable status notes.

### Named Rules
**The Flat Sheet Rule.** Nothing on the paper casts a shadow at rest. If it is part of the drawing, it is outlined; only transient things float.

## Shapes

Square-cornered drafting forms: 3px corners on sheets, buttons, fields, tags, notes, badges and dialogs; 2px on photos. The only round shapes are the connection light, skill dots, and scrollbar thumbs. Borders are 1px throughout (strong rule for outlines, light rule for dividers); the one heavy stroke is the 3px rule under the title block. Dragging uses a 2px dashed drop outline.

## Components

### Buttons
Plain, solid and unmistakably clickable.
- **Shape:** 3px corners, 1px border, 40px minimum height, 10px 16px padding.
- **Primary:** cyanotype print fill with white lettering and a deep-print edge (Release plan, Resolved, Received).
- **Hover / Focus:** fill lifts to lighter print over 0.12s; focus is a 2px drafting-blue outline offset 2px.
- **Secondary:** white with ink text and a strong-rule outline (Save draft, + Note); hover goes to inset with an ink-2 edge.
- **Title-block buttons:** transparent with white lettering and a translucent white outline; the title block's primary is inverted (white fill, print text). External links carry a small drawn arrow.
- **Disabled:** 50% opacity.

### Tags
- **Style:** condensed capitals in a 1px rule of the state colour with its soft wash behind (Responding, Sent, Reported, Waiting, Hit target).
- **State:** neutral (muted ink, strong rule), in progress (accent), hit (ok), short (red), help/reported (amber).

### Cards / Containers
- **Corner Style:** 3px.
- **Background:** sheet white.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px strong rule; the heading is ruled off with a 1px light rule.
- **Internal Padding:** 12-16px.

### Inputs / Fields
- **Style:** white field, 1px strong-rule outline, 3px corners, 16px Barlow, placeholder in a mid blue-grey.
- **Focus:** border turns drafting blue with a 2px accent-soft outline.
- **In the title block:** translucent white field with a white outline and dark colour scheme for the date picker.

### Navigation
The title block is the navigation. Page links are title-block buttons on the right (Requests with a red count, Floor board, Day summary, History, Workers, Setup, Lock). Management's daily flow is a four-step stepper (Who's in, Work mix, Benches, Review and release): numbered segments in sheet white, the current step washed in accent-soft with a drafting-blue edge. Phase tabs (Start, Second, Finish) are button-grey segments; the active one is filled drafting blue.

### Title Block (signature)
Full-width cyanotype header with its own faint 16px white grid. The sheet name in condensed capitals, then cells that each pair a small pale-blue label with a large white value (Day, Plan, Target, Packed, Connection). A target cut below plan turns soft orange (#ffc98a) and shows the planned figure beside it. Cells are divided by 1px white rules; on phones they stack with rules beneath.

### Figure Strip
A ruled strip of labelled figures: cells sit on a rule-coloured ground with 1px gaps so the gaps draw the grid lines; each cell has a muted condensed label over a condensed figure.

### Batch Status Note (signature)
The kanban sticky note: one per batch per bench on the floor board. White card, 1px outline and 3px corners, batch name in bold, a sub-line with a small configuration swatch, and a status tag. The outline takes the state colour (accent in progress, ok on hit, red on short); waiting notes go inset grey. Clickable notes show the accent hover ring. This bordered card is a confirmed exception to the ruled-sections rule: it is the user's sticky-note concept.

### Pinned Note
Markup yellow with a gold rule and dark brown text, bold pre-line text, an optional photo and a small meta line with underlined text actions. Used only for notes pinned to a bench or to everyone.

### Crew Chips and Badges
Draggable crew chips are bordered (1px strong rule, 3px corners, 10px 14px padding, 600 weight) because they are drag handles; this is a confirmed exception to the ruled-sections rule. Selected chips fill drafting blue; away chips go red-soft with a red edge; manual placements get an amber edge. Crew badges and station icons are small 3px squares outlined in the bench key colour with a 9% wash and condensed initials or station code. Skill shows as filled dots.

### Request Rows
A single bordered list with rows ruled by 1px dividers: a 40px outlined icon square (help amber, stock accent, faulty red, each with a drawn SVG icon), title and sub-line, a status tag, and a primary action. Open help requests pulse amber (disabled under reduced motion); done rows go inset.

### Dialogs
Sheet-white, 480px max, 20px padding, 1px strong rule, 3px corners, dialog-float shadow over a 42% Prussian scrim. Uppercase condensed title, condensed-capital field labels, actions right-aligned.

### PIN Screen
A sheet-white box (420px max) on a cyanotype print ground carrying the blueprint grid in white; condensed title, wide-tracked 20px PIN field, full-width 46px primary button, error in redline.

## Do's and Don'ts

### Do:
- **Do** keep the blueprint grid on the page ground (16px minor, 80px major). The user asked for it; the detector rule codex-grid-background is ignored on purpose in `.impeccable/config.json`.
- **Do** open every page with the cyanotype title block, its labelled cells carrying real plan data.
- **Do** divide regions inside a sheet with 1px rules or 1px gaps over the rule colour, not with nested cards.
- **Do** set every status as a word in condensed capitals inside a 1px rule of its state colour.
- **Do** use 3px corners and 1px borders everywhere; keep buttons at least 40px tall and fields at 16px type.
- **Do** draw icons as inline SVG in the text colour.
- **Do** keep numerals tabular.

### Don't:
- **Don't** add instructional or helper text: titles, labels and numbers only.
- **Don't** show status by colour alone; pair every colour with a word, initials or a code.
- **Don't** put shadows on resting sheets, notes, chips or rows; only dialogs, popovers and drag ghosts float.
- **Don't** add bordered cards inside sheets. The only confirmed exceptions are batch status notes on the floor board and draggable crew chips.
- **Don't** use red, amber or green for decoration; they mark state only.
- **Don't** gamify: no cartoon characters, stars, playful names or toy colours.
- **Don't** drift toward the dark-slate, rounded-card, neon-accent dashboard look.
