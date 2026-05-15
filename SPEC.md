# Blood on the Clocktower — Town Square Tracker
## Technical Specification (Updated 2026-05-15 — all open questions resolved)

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
| Responsive scaling | CSS `transform: scale()` on the board wrapper | Preserves the fixed 1920×1080 internal coordinate system; all positions and sizes remain valid without recalculation |

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
- Storyteller selects player count (5–20) by clicking the corresponding column in the Traveler Sheet (player track); the column highlights and locks in the count
- Player name fields are editable
- Life tokens are placed in default positions around the circle
- A **Start Game** button is visible in the bottom-right corner; Reset and Undo are hidden
- "Start Game" action transitions to ACTIVE — requires player count to be selected first

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
- **Board dimensions**: 1920×1080px internal coordinate space (16:9 landscape). All pixel values in this spec are in that coordinate space. The board scales uniformly to fill the viewport — see [Responsive Scaling](#10-responsive-scaling).
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
- Flipping alive → dead: ghost token and shroud ring appear automatically
- **Transition animation**: CSS opacity crossfade between the two `<img>` elements (200ms ease). No 3D flip — Figma shows discrete layer swap with no transform defined.

### 3. Ghost Token and Shroud Ring

When a player's life token flips from alive to dead, two elements appear automatically.

**Ghost token (vote token):**
- Appears automatically when `status` flips to `"dead"` (sets `hasVoteToken = true`)
- Click/tap to remove (sets `hasVoteToken = false`) — represents the player spending their ghost vote
- Removal is permanent for that game state; the ring remains after the ghost token is removed
- **Asset**: ghost figure icon (source image: 203×203px), rendered at **45×45px**
- **Backing ellipse**: 45×45px, 15% opacity warm fill, 0.5px warm stroke (#F4EFDC), 4px drop shadow (0,4 offset, 25% black)
- **Position**: top-right corner of the life token. Offset from life token top-left: **(+71px, −4px)**. This places the ghost token's left edge 21px right of the life token's right edge and 4px above the life token's top.

**Shroud ring:**
- Appears automatically when `status` flips to `"dead"`; persists permanently and cannot be removed
- Represents permanent dead status independently of the ghost vote
- **Rendering**: circular ring centered on the life token, rendered behind the token face so the token artwork remains visible
- **Dimensions (design decision — Figma node unavailable):** Circular stroke ring centered on the life token. Diameter: **110px** (5px margin outside the 100px token). Stroke: 2px, `rgba(255, 255, 255, 0.6)`. No fill. Rendered as a `border-radius: 50%` `<div>` positioned absolutely, centered behind the token face using `z-index` layering. No shadow or glow on the ring itself — the dead token artwork provides visual weight.
- No data model field needed — derived purely from `status === "dead"`

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
- In SETUP phase: clicking a column highlights it, sets `travelerSheetColumn` in Firebase, **and sets `playerCount`** — the Traveler Sheet column click is the player count selector (no separate UI element)
- Player counts 16–20 map to the 15+ column
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

### 7. Firebase Real-Time Sync

All state mutations write to Firebase. All connected clients subscribe to the `/game` path and re-render on change.

**Listener setup (in `app.js`):**
```javascript
const gameRef = firebase.database().ref('game');
gameRef.on('value', (snapshot) => {
  const state = snapshot.val();
  renderBoard(state);
});
```

**Write behavior:**
- All writes replace only the changed field(s) using `gameRef.child('field').set(value)` — no full-document overwrites except on Reset
- Name field writes fire on `blur` only (not `input`) to avoid write spam
- Drag end writes `players[i].seatIndex` for all swapped players in a single `update()` call

**Conflict handling:** Last-write-wins (Firebase default). No optimistic locking needed for a single-storyteller use case.

**Offline behavior:** Firebase SDK caches the last known state locally. If connectivity drops, mutations queue locally and sync when reconnected. No explicit offline UI needed for v1.

### 8. Edition Reference Panel

A reference panel in the right portion of the screen showing character names and ability descriptions for the current edition. In the Figma design this shows "Trouble Brewing" (the base set).

**Measured from Figma (frame-relative coordinates; frame canvas origin is at canvas x=217, y=53):**

| Element | x | y | width | height | right edge |
|---|---|---|---|---|---|
| Parchment background (1:233) | 1312 | 78 | 500 | 765 | 1812 |
| Title group / "Trouble Brewing" (1:419) | 1393 | 114 | 342 | 59 | 1735 |
| Characters group (1:343) | 1345 | 193 | 499 | 617 | 1844 |
| Titles column (character names) | 1345 | 212 | 69 | 569 | 1414 |
| Icons column | 1421 | 209 | 28 | 579 | 1449 |
| Descriptions column | 1460 | 212 | 384 | 576 | 1844 |

All content fits within the 1920px frame width (right edge 1844 < 1920).

**Title ("Trouble Brewing"):**
- Font: Libra BT Regular 40px, black fill, centered
- Flanked by two nested decorative vector border frames (0.5px black stroke)

**Three-column character list:**
- **Names column** (x≈1562, width 69px): Libra BT Regular 10px
  - Townsfolk / Outsiders: `#256187` (teal-blue)
  - Minions / Demon: `#811010` (dark red)
- **Icons column** (x≈1638, width 28px): small vector icons, colored to match role category
- **Descriptions column** (x≈1677, width 384px): Baskerville Regular 9.18px, black

**Section headings** (Libra BT 15px):
- "Townsfolk" at y≈246, `#256187`
- "Outsiders" at y≈577, `#256187`
- "minions" at y≈693, `#811010`
- "demon" at y≈806, `#811010`

**Footer:** "*Not the first night" at approximately (1910, 845) — Baskerville 9.19px, black; decorated with a golden vector badge (`#E2CC86` approx)

**Parchment background container (1:233):**
- Position: frame x=1312, y=78, 500×765px
- Fill: image asset (imageRef `b9990f8ca86a8dccf902b610efeb901a0cd097c5`), scale mode fill
- Treat as a static image background; export via Figma API and serve as a local asset
- Stroke and border detail cannot be confirmed (Figma API rate-limited); implement as image-only, no additional CSS border required unless visual testing reveals a gap

**Characters in this edition (Trouble Brewing):**
- Townsfolk: Washerwoman, Librarian, Investigator, Chef, Empath, Fortune Teller, Undertaker, Monk, Ravenkeeper, Virgin, Slayer, Soldier, Mayor
- Outsiders: Butler, Drunk, Recluse, Saint
- Minions: Poisoner, Spy, Scarlet Woman, Baron
- Demon: Imp

**Interactivity:** none — read-only reference panel.

**Scope:** treat as a static image asset in the initial implementation. Future editions swap the image. The parchment container background should be exported separately from the character content if possible.

### 9. Game Reset

- Reset button is visible only during ACTIVE phase (see [Section 11 — Control Buttons](#11-control-buttons))
- Clicking reset shows a confirmation dialog before executing
- On confirm: writes default SETUP state to Firebase, which propagates to all connected devices
- **Placement**: bottom-right corner of the 1920×1080 frame. Not in Figma; implement as a small button.
- **Font**: Baskerville (or `"Baskerville", "Baskerville Old Face", Georgia, serif` stack)
- **Label**: "Reset"
- **Confirmation dialog (design decision — not in Figma):**
  - Overlay: `rgba(0, 0, 0, 0.65)` covering the full 1920×1080 board
  - Dialog box: ~320×140px, centered; parchment-colored background (`#F4EFDC`), 2px solid border `#84722B`, 8px border-radius
  - Message: "Reset game?" — Libra BT 20px, black, centered
  - Buttons: side-by-side, Baskerville 13px
    - **Confirm**: ~100×32px, dark teal background (`#143847`), `#F4EFDC` text
    - **Cancel**: ~100×32px, transparent background, dark teal border `#143847`, `#143847` text
  - Cancel is the default focused button (pressing Escape also cancels)

### 11. Control Buttons (Bottom-Right)

A small button cluster sits in the bottom-right corner of the 1920×1080 frame, outside the token circle.

**Visibility by phase:**

| Button | SETUP | ACTIVE |
|--------|-------|--------|
| Start Game | visible | hidden |
| Reset | hidden | visible |
| Undo | hidden | visible |

**Start Game button:**
- Visible only during SETUP phase
- Disabled (greyed out) until `playerCount` is set
- On click: transitions `phase` from `"setup"` to `"active"` in Firebase; button is replaced by Reset + Undo
- Typography: TBD (match game aesthetic)

**Reset button:**
- Label: "Reset"
- **Font**: Baskerville (`"Baskerville", "Baskerville Old Face", Georgia, serif`)
- Small; exact pixel size not in Figma — implement at roughly 80×28px
- On click: shows confirmation dialog (see [Section 9](#9-game-reset))

**Undo button:**
- Label: "Undo"
- Adjacent to Reset button (placed to the left of Reset)
- **Font**: Baskerville (`"Baskerville", "Baskerville Old Face", Georgia, serif`)
- **Size**: ~80×28px (same as Reset button)
- **Styling**: match Reset button appearance exactly; disabled state uses 40% opacity and `cursor: not-allowed`
- Reverts the board to the most recent previous game state
- **Implementation**: client-side in-memory state stack (single level). A snapshot of the full Firebase game document is captured before each state-mutating action (token flip, drag, name change, phase transition). One press reverts to that snapshot, writes it to Firebase, and clears the stack. Undo history is **not** persisted to Firebase — it is lost on page refresh or if another device mutates state.
- Disabled when no undo snapshot is available

### 10. Responsive Scaling

The board always fills the full viewport width. Height follows automatically, preserving the 16:9 aspect ratio. The internal coordinate system stays at 1920×1080 — no pixel values elsewhere in this spec need to change.

**Implementation:**

The HTML structure uses two elements:

```html
<div id="board-wrapper">   <!-- sized in CSS to reserve the correct height -->
  <div id="board">         <!-- 1920×1080px, scaled via transform -->
    ...
  </div>
</div>
```

CSS:

```css
html {
  min-width: 640px; /* scrollbars appear below this viewport width */
}

#board-wrapper {
  width: 100%;
  /* height is set dynamically by JS to match the scaled board height */
  position: relative;
  overflow: hidden;
}

#board {
  width: 1920px;
  height: 1080px;
  transform-origin: top left;
  /* transform: scale() is set dynamically by JS */
  position: absolute;
  top: 0;
  left: 0;
}
```

JavaScript (recalculate on load and on every `resize` event):

```javascript
function updateScale() {
  const scale = window.innerWidth / 1920;
  document.getElementById('board').style.transform = `scale(${scale})`;
  document.getElementById('board-wrapper').style.height = `${1080 * scale}px`;
}

window.addEventListener('resize', updateScale);
updateScale();
```

**Minimum width:** `640px`. Below this the browser shows a horizontal scrollbar and the board renders at `640 / 1920 ≈ 33%` scale (life tokens appear at ~33px — small but legible for reference; intended use is on a large shared screen). Adjust this value if testing reveals the board becomes unusable at a different breakpoint.

**Interact.js coordinate adjustment:** Drag snap targets are computed in the 1920×1080 coordinate space. Interact.js operates in screen coordinates, so snap targets and restrict boundaries must be multiplied by the current `scale` factor when building the `seatPositions` array. Recalculate snap targets whenever the window resizes.

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
- [x] Responsive/scaling → scale-to-fill-width: board scales so its width always fills the viewport, height follows 16:9 aspect ratio; scrollbars appear below 640px viewport width
- [x] Rotation behavior → tokens fixed to computed positions; banners always horizontal

### Resolved by Design Decision (2026-05-15)

- [x] **Ghost token appearance** — ghost token and shroud ring now appear automatically on death. Ghost token click removes it; ring persists. Resolved.
- [x] **Alive Traveler token** — no separate traveler asset in Figma. Use the Alive asset for now; replace when art is provided. Compromise accepted.
- [x] **Reset button placement** — confirmed bottom-right corner. Baskerville font.
- [x] **Undo button** — client-side in-memory only (one level), styled to match Reset. See Section 11.
- [x] **Confirmation dialog** — not in Figma. Design decision made: parchment-colored box, teal Confirm/Cancel buttons, Escape cancels. See Section 9.
- [x] **Edition Reference Panel parchment background** — image ref `b9990f8ca86a8dccf902b610efeb901a0cd097c5` confirmed from Figma node 1:233. Position and dimensions already in Section 8. Added to assets table.
- [x] **Shroud ring exact styling** — not in Figma. Design decision made: 110px diameter, `rgba(255,255,255,0.6)` stroke, 2px weight. See Section 3.
- [x] **SETUP phase UI** — player count selected by clicking the Traveler Sheet column. Start Game button in bottom-right transitions to ACTIVE.
- [x] **Dark mode / theming** — not supported. Single fixed visual theme only.

---

## Figma Assets Reference

Figma file key: `mRZw6L1s9H7TOW4XFsgc7K`

| Asset | Figma imageRef | Source size | Rendered size | Local filename |
|---|---|---|---|---|
| Background | `7e8dce6958b0d5e6a095e78c647ce7808f7bc5d8` | 3840×2160 | 1920×1080 (fill) | `background.png` ✓ |
| Alive token | `3e7d2e9329c4543adc15269328396248ab01b0ed` | 200×200 | 100×100 | `token-alive.png` ✓ |
| Dead token | `0679a1b72478d72d71170a828fcb748c37be2a00` | 200×200 | 100×100 | `token-dead.png` ✓ |
| Ghost/vote token | `36acec05a0fd896e80f057b67a0f9214abe46f85` | 90×90 | 45×45 | `token-ghost.png` ✓ |
| Traveler Sheet texture | `97815547e01b713d06e176dd7b2dc1eddbae44e7` | 1000×280 | 500×140 | `traveler-sheet-bg.png` ✓ |
| Edition panel parchment (1:233) | `b9990f8ca86a8dccf902b610efeb901a0cd097c5` | 1000×1530 | 500×765 | `edition-panel-bg.png` ✓ |

Export all assets via the Figma API at 1× (pixel-perfect) for the 1920×1080 fixed layout.
