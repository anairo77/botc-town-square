# Blood on the Clocktower — Town Square Tracker
## Technical Specification (Updated 2026-05-15 from Figma)

---

## Project Overview

A browser-based digital implementation of the physical Town Square board used in the tabletop game Blood on the Clocktower. The Storyteller uses this tool to track player life/death state, vote token availability, and character distribution during a game session. The board is displayed on a shared screen or tablet visible to all players.

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Language | Vanilla HTML/CSS/JavaScript | No build step needed; simple state; GitHub Pages compatible |
| Hosting | GitHub Pages | Free static hosting |
| Real-time sync | Firebase Realtime Database | Free tier sufficient; CDN-compatible with vanilla JS; real-time document sync across devices |
| Drag and drop | Interact.js ([github.com/taye/interact.js](https://github.com/taye/interact.js)) | Handles mouse and touch with one API; built-in snap modifier; no framework required |
| Player count | 5–20, set at game start, fixed for the session | Matches physical game rules |
| State persistence | Firebase (primary) + localStorage (offline fallback TBD) | Game state survives browser close/refresh and syncs across devices |

---

## Architecture

```
GitHub Pages (static host)
└── index.html
    ├── style.css
    ├── app.js              # main entry, Firebase init, game controller
    ├── board.js            # circular layout, token rendering
    ├── drag.js             # Interact.js configuration, snap targets
    ├── traveler-sheet.js   # character distribution table logic
    └── firebase-config.js  # Firebase project credentials (public read/write rules)

Firebase Realtime Database
└── /game                   # single game document (see Data Model)
```

No npm, no bundler, no framework. All dependencies loaded via `<script>` CDN tags:
- Firebase SDK (compat v9 or modular — TBD based on CDN availability at implementation time)
- Interact.js

---

## Game Phases

```
SETUP → ACTIVE → (RESET → SETUP)
```

**SETUP phase:**
- Storyteller selects player count (5–20)
- Storyteller selects the matching column in the Traveler Sheet
- Player name fields are editable
- Life tokens are placed in default positions around the circle
- "Start Game" action transitions to ACTIVE

**ACTIVE phase:**
- Player count is locked
- Traveler Sheet column selection is locked (display only)
- Life tokens can be flipped (alive ↔ dead)
- Vote tokens can be added to / removed from dead players
- Player name fields remain editable
- Tokens can be dragged to reorder seating

**RESET:**
- Returns all state to SETUP defaults
- Clears all player names
- Restores all life tokens to alive/parchment state
- Removes all vote tokens
- Clears player count and Traveler Sheet selection
- Requires confirmation before executing

---

## Data Model (Firebase)

```json
{
  "game": {
    "phase": "setup",
    "playerCount": null,
    "travelerSheetColumn": null,
    "players": [
      {
        "id": 0,
        "name": "",
        "status": "alive",
        "isTraveler": false,
        "hasVoteToken": false,
        "seatIndex": 0
      }
    ]
  }
}
```

**Field notes:**
- `phase`: `"setup"` | `"active"`
- `playerCount`: integer 5–20, null until selected
- `travelerSheetColumn`: integer 5–15 (15 represents 15+), null until selected
- `players`: ordered array; length equals `playerCount`
- `status`: `"alive"` | `"dead"`
- `isTraveler`: boolean; affects which life token asset is displayed
- `hasVoteToken`: boolean; only meaningful when `status === "dead"`
- `seatIndex`: integer; the player's position in the circular seating order (0 = top, clockwise)

**Firebase rules (development):** Open read/write. Before any public deployment, rules should be tightened (single-document write lock, no user auth required for this use case).

---

## Feature Specifications

### 1. Circular Token Layout

- Life tokens are arranged in a circle, evenly spaced, matching physical seating positions
- There is always a gap (no token) at 12 o'clock
- For **even** player counts: gap at both 12 o'clock and 6 o'clock; players fill the left and right arcs symmetrically
- For **odd** player counts: gap at 12 o'clock, player at 6 o'clock
- Token positions are computed mathematically from `playerCount` using a half-step offset so the gap always lands at the top:
  ```
  angle = (2π / playerCount) * (seatIndex + 0.5) - π/2
  x = centerX + radius * cos(angle)
  y = centerY + radius * sin(angle)
  ```
  The `+ 0.5` shifts all tokens half a slot clockwise from 12 o'clock, placing the gap between `seatIndex 0` and `seatIndex (playerCount - 1)` at exactly 12 o'clock. For even counts this also produces a symmetric gap at 6 o'clock; for odd counts `seatIndex floor(playerCount / 2)` lands exactly at 6 o'clock.
- **Board dimensions**: 1920×1080px fixed (16:9 landscape). No responsive scaling — designed for a shared landscape display or tablet.
- **Background**: Full-frame dark atmospheric medieval town scene (night, clock tower, cobblestones). Single image fills the entire 1920×1080 canvas.
- **Player circle**: 888×888px bounding box at frame offset (231px, 83px). Center: **(675, 527)** within the 1920×1080 frame. **Radius: 444px** (fixed; does not scale with player count).
- **Token size**: 100×100px rendered.
- **Token backing ellipse**: 100×100px, 15% opacity warm fill, 0.5px warm stroke (#F7EFCD), drop shadow (0,0 offset, 10px blur, 5px spread, 20% black).

### 2. Life Tokens

Three visual states, each using a distinct asset:
- **Alive** — parchment clock face with Roman numerals, warm aged coloring (source image: 724×724px)
- **Dead** — same clock face with blood stains, dark overlay (source image: 450×450px)
- **Alive Traveler** — no separate traveler token art exists in the current Figma design; treat as same image as Alive until a traveler asset is provided

Interactions:
- In ACTIVE phase: click/tap to toggle between `alive` and `dead`
- `isTraveler` flag switches the alive asset; does not affect the dead asset
- Flipping alive → dead: vote token does not appear automatically (Storyteller adds it manually)
- **Transition animation**: CSS opacity crossfade between the two `<img>` elements (200ms ease). No 3D flip — Figma shows discrete layer swap with no transform defined.

### 3. Vote Tokens

- Small token displayed adjacent to a life token when `hasVoteToken === true` and `status === "dead"`
- Click/tap to remove (sets `hasVoteToken = false`)
- A "spare vote tokens" zone exists on the board; clicking/tapping a spare token assigns it to the selected dead player
- **Vote token asset**: ghost figure icon (source image: 203×203px), rendered at **45×45px**
- **Backing ellipse**: 45×45px, 15% opacity warm fill, 0.5px warm stroke (#F4EFDC), 4px drop shadow (0,4 offset, 25% black)
- **Position**: top-right corner of the life token. Offset from life token top-left: **(+71px, −4px)**. This places the ghost token's left edge 21px right of the life token's right edge and 4px above the life token's top.
- **Spare vote token zone**: no spare zone is designed in the current Figma. Treatment is TBD — implement as a clickable dead token gaining a vote token on first click, or defer until spare zone is designed.

### 4. Player Name Fields

- Each life token has an editable text field rendered as a banner **below** the token circle
- Editable in both SETUP and ACTIVE phases
- Field value syncs to Firebase on blur (not on every keystroke, to avoid write spam)
- **Rotation**: name banners do **not** rotate. All four tokens in the Figma show "player" in the same horizontal orientation regardless of position around the circle. Text is always displayed horizontally.
- **Banner dimensions**: ~89×28px total group
- **Position**: centered on the token, top edge at token_y + 95px (5px inside the bottom of the 100px token; banner extends ~23px below token bottom)
- **Background**: dark teal horizontal gradient (approximately `#143847` → `#274A5A` → `#143847`), with small decorative corner tab pieces at both ends
- **Font**: "Libra BT" Regular, 11px
- **Text color**: `#F4EFDC` (warm off-white)
- **Text alignment**: centered horizontally within the banner
- **Max character length**: not specified in Figma; implement at ~12–14 characters before text overflows the 89px banner width at 11px

### 5. Traveler Sheet (Character Distribution Table)

Reference data (hardcoded, not from Firebase):

| Players | Townsfolk | Outsiders | Minions | Demons |
|---------|-----------|-----------|---------|--------|
| 5       | 3         | 0         | 1       | 1      |
| 6       | 3         | 1         | 1       | 1      |
| 7       | 5         | 0         | 1       | 1      |
| 8       | 5         | 1         | 1       | 1      |
| 9       | 5         | 2         | 1       | 1      |
| 10      | 7         | 0         | 2       | 1      |
| 11      | 7         | 1         | 2       | 1      |
| 12      | 7         | 2         | 2       | 1      |
| 13      | 9         | 0         | 3       | 1      |
| 14      | 9         | 1         | 3       | 1      |
| 15+     | 9         | 2         | 3       | 1      |

Interactions:
- In SETUP phase: clicking a column highlights it and sets `travelerSheetColumn` in Firebase
- Selecting player count (5–20) should auto-select the matching column (20 → uses 15+ column)
- In ACTIVE phase: table is read-only, selected column remains highlighted
- **Container**: 500×140px at frame position **(1312, 861)** (bottom-right of the 1920×1080 frame)
- **Background**: parchment/paper texture image
- **Outer border**: 15px warm golden stroke (`#84722B` approx, 40% opacity)
- **Inner border**: two nested 1px border rectangles at 97% opacity (470×110px and 464×104px)
- **Column highlight**: 31×100px rectangle, 79% opacity warm gray (`#D9D9D9`), 4px drop shadow; positioned over the selected player count column
- **Typography colors**:
  - Row labels ("players", "townsfolk", "outsiders", "minions", "demons"): `#000000`
  - Townsfolk / Outsiders / Minions number cells: `#256187` (teal-blue)
  - Demons number cells: `#6B1010` (dark red)
- Implement the table as live HTML/CSS (not images) using the same color scheme

### 6. Drag and Drop (Interact.js)

Purpose: Storyteller can reorder seating by dragging life tokens to different positions around the circle.

Behavior:
- Each life token is a draggable element
- Snap targets are the computed seat positions around the circle
- On drag end, token snaps to nearest unoccupied seat position
- If dropped on an occupied seat, tokens swap positions (swap `seatIndex` values)
- Vote token, if present, moves with its life token
- Player name field moves with its life token
- `seatIndex` values are updated in Firebase after each drag

Interact.js configuration sketch:
```javascript
interact('.life-token').draggable({
  listeners: {
    move: dragMoveListener,
    end: snapToNearestSeat
  },
  modifiers: [
    interact.modifiers.snap({
      targets: seatPositions,   // array of {x, y} computed from circular layout
      range: Infinity,
      relativePoints: [{ x: 0.5, y: 0.5 }]
    }),
    interact.modifiers.restrict({
      restriction: '#board',
      endOnly: true
    })
  ]
})
```

- **Drag handle**: the entire 100×100px life token circle is the drag handle (no sub-zone)
- **Drag opacity**: no specific drag treatment defined in Figma; use 70% opacity on the dragged element as a sensible default

### 8. Edition Reference Panel (newly identified in Figma)

A large parchment-styled panel fills the upper-right portion of the screen, displaying character names and ability descriptions for the current edition. In the Figma design this shows "TROUBLE BREWING" (the base set).

- **Position**: approximately (970, 50) to (1370, 720) within the 1920×1080 frame (≈400×670px)
- **Styling**: aged parchment background, ornate border, serif typography — matches the Traveler Sheet aesthetic
- **Interactivity**: none in current Figma design; it is a read-only reference
- **Scope**: treat as a static image asset in the initial implementation. Future editions would swap the image.

### 9. Game Reset

- Reset button always visible (or accessible via menu)
- Clicking reset shows a confirmation dialog before executing
- On confirm: writes default SETUP state to Firebase, which propagates to all connected devices
- **Placement**: no reset button is designed in the current Figma. Implement as a small button in the bottom-left corner of the screen (outside the token circle). Style to match the teal/parchment palette.
- **Confirmation dialog**: not designed in Figma. Use a simple modal overlay (semi-transparent dark background) with a parchment-styled dialog box, "Reset game?" message, and Confirm / Cancel buttons matching the teal color scheme.

---

## Firebase Setup (for implementor)

1. Create a free Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** (not Firestore)
3. Set database rules to open for development:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Copy the Firebase config object into `firebase-config.js`:
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     databaseURL: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Load Firebase via CDN in `index.html` before `app.js`

Firebase config values in a public repo are safe for this use case — they identify the project but do not grant access beyond what the database rules allow.

---

## GitHub Pages Setup (for implementor)

1. Create a new GitHub repository
2. Push all files to the `main` branch (or a `gh-pages` branch)
3. In repository Settings → Pages → set source to the appropriate branch and `/ (root)` folder
4. Site will be available at `https://<username>.github.io/<repo-name>/`

No build step required. All files are served as-is.

---

## Open Questions

### Resolved by Figma (2026-05-15)

- [x] Board background asset and dimensions → 1920×1080px fixed, atmospheric town scene image
- [x] Life token dimensions → 100×100px; alive = parchment clock (724px source), dead = bloody clock (450px source)
- [x] Vote token asset and dimensions → ghost icon (203px source), rendered 45×45px, top-right of dead token at (+71, −4)
- [x] Flip/transition animation → CSS opacity crossfade 200ms (no 3D flip)
- [x] Player name field position, typography, rotation → horizontal banner at token bottom, Libra BT 11px, no rotation
- [x] Traveler Sheet position and styling → 500×140px at (1312, 861), parchment texture, teal/red number colors
- [x] Responsive/scaling → fixed 1920×1080px; no scaling designed
- [x] Rotation behavior → tokens fixed to computed positions; banners always horizontal

### Still Open

- [ ] **Spare vote token zone** — not in Figma. Decision needed: (a) dead player gains vote token via a second tap on the token, or (b) design a spare zone later. Current implementation plan: single tap on a dead-no-vote-token player adds a vote token; single tap on a vote token removes it.
- [ ] **Alive Traveler token** — no separate traveler asset in Figma. Use the Alive asset for now; replace when art is provided.
- [ ] **Reset button placement** — not in Figma. Defaulting to bottom-left corner; confirm with designer.
- [ ] **Confirmation dialog** — not in Figma. Implementing a simple modal; confirm styling later.
- [ ] **Edition Reference Panel exact dimensions** — panel is visible in Figma but JSON was truncated before its node; approximate position used. Needs precise export.
- [ ] **SETUP phase UI** — Figma only shows ACTIVE state. Player count selector and column selection UI must be designed or implemented with developer defaults.
- [ ] **Dark mode / theming** — not addressed in Figma; not in scope for v1.

---

## Figma Assets Reference

Figma file key: `mRZw6L1s9H7TOW4XFsgc7K`

| Asset | Figma imageRef | Source size | Rendered size |
|---|---|---|---|
| Background | `7e8dce6958b0d5e6a095e78c647ce7808f7bc5d8` | 4096×2305 | 1920×1080 (fill) |
| Alive token | `3e7d2e9329c4543adc15269328396248ab01b0ed` | 724×724 | 100×100 |
| Dead token | `0679a1b72478d72d71170a828fcb748c37be2a00` | 450×450 | 100×100 |
| Ghost/vote token | `36acec05a0fd896e80f057b67a0f9214abe46f85` | 203×203 | 45×45 |
| Traveler Sheet texture | `97815547e01b713d06e176dd7b2dc1eddbae44e7` | unknown | 500×140 |

Export all assets via the Figma API at 1× (pixel-perfect) for the 1920×1080 fixed layout.
