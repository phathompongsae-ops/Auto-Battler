# Demo 1 UI / Layout Implementation Plan

## Purpose

Turn the UI audit into small, reviewable implementation tasks without overlapping core-runtime ownership.

This plan deliberately separates DOM/CSS presentation work from Three.js/gameplay work.

## Guardrails

- Do not change combat logic, targeting, economy, stage flow, drag-and-drop rules, or game-loop timing.
- Do not tune the camera or board geometry in a DOM/CSS task.
- Do not integrate Asset Manager, Animation Framework, or Effect Framework in the same PR as layout work.
- Keep every implementation PR small enough to revert independently.
- Any gameplay-related verification must use x4 speed and state the modules/files exercised.

---

# Work package 1 — Canonical reference lock

**Owner:** Coco

**Files:** documentation and reference asset metadata only

Deliverables:

- Canonical reference screenshot path or external source note
- Target viewport and aspect ratio
- Annotation showing:
  - top HUD boundary
  - left panel boundary
  - right panel boundary
  - board-safe corridor
  - Shop Drawer boundary
  - primary action location

Acceptance:

- One reference is marked canonical for Demo 1.
- Other screenshots are marked secondary inspiration, not simultaneous targets.

---

# Work package 2 — CSS token foundation

**Owner:** Coco

**Allowed:** `autochess.html` CSS only

**Forbidden:** DOM relocation, JavaScript, `src/game.js`

Deliverables:

- Shared spacing, panel-width, radius, touch-target, typography, and overlay tokens
- Existing values migrated to tokens with no intended visual redesign

Acceptance:

- Screens at 800×360 and 844×390 remain functional.
- No selector behavior changes.
- Shop, Bag, and drag/drop remain unchanged.
- `git diff --check` passes.

---

# Work package 3 — Top HUD layout lock

**Owner:** Coco

**Allowed:** DOM/CSS presentation only

Deliverables:

- Stable one-row HUD at supported landscape phone sizes
- Clear grouping for survival/wave, economy/level, and speed/pause
- Standard touch targets

Acceptance:

- No wrapping at 800×360 and 844×390.
- No important board row is hidden due to increased HUD height.
- All existing button IDs and JavaScript bindings remain intact.

---

# Work package 4 — Side-panel hierarchy

**Owner:** Coco

Deliverables:

- Locked left/right widths
- Compact short-height behavior
- Boss visibility priority
- Team panel fallback scroll/collapse behavior

Acceptance:

- Center corridor remains above the documented minimum.
- Boss identity is visible without scrolling on boss stages.
- Panels do not cover primary actions.

---

# Work package 5 — Shop and Item Bag presentation

**Owner:** Coco

Deliverables:

- Locked drawer height
- One-row Shop cards in landscape
- Clear portrait/name/class/price hierarchy
- Presentation-level Shop/Bag mutual exclusivity on compact screens

Acceptance:

- Existing purchase/equipment state is unchanged.
- Existing IDs and handlers are preserved.
- Drawer transitions do not trigger renderer recreation.
- Real-device smoke check is required if compositor-sensitive CSS changes are introduced.

---

# Work package 6 — Board, camera, bench, deployment visual pass

**Owner:** CC

Precondition:

- Work packages 1–5 approved or their measurements locked.
- `docs/BOARD_CAMERA_UI_VISUAL_ACCEPTANCE_SPEC.md` is the measurable acceptance source for this pass.

Scope:

- Camera framing
- Board screen position
- Bench visual distinction
- Deployment-zone readability
- Three.js tile presentation

Acceptance:

- Both primary viewports, 800×360 and 844×390, satisfy the Board–Camera–UI acceptance spec.
- All board columns and the complete bench row remain visible.
- Touch and mouse raycasts stay aligned with visible tiles.
- Shop/Bag and portrait-overlay round trips preserve board framing.
- Combat/placement tests run at x4.
- Test modules/files and camera constants are explicitly listed.
- Before/after screenshots are attached for both primary viewports.
- Bench and placement rules remain unchanged.
- No duplicate event listeners, renderer recreation, or render-loop paths.

---

# Work package 7 — Visual skin

**Owner:** Coco

Precondition:

- Layout measurements are stable.

Deliverables:

- Reference-aligned palette
- Panel textures/borders
- Typography scale
- Canonical icon mapping
- Shop-card visual treatment

Acceptance:

- No layout shift outside documented tolerance.
- Missing icons use an approved fallback.
- Asset provenance follows Demo 1 asset policy.

---

# Work package 8 — UI motion

**Owner:** Coco

Precondition:

- Asset/animation presentation conventions reviewed.

Deliverables:

- Standard transition durations
- Button press feedback
- Drawer open/close motion
- Phase presentation feedback
- Reduced-motion fallback

Acceptance:

- Presentation events never apply damage or gameplay state.
- No transition blocks pointer cleanup.
- No new console errors after repeated open/close cycles.

---

# Suggested PR sequence

1. `docs: lock Demo 1 UI reference and measurements`
2. `ui: centralize layout tokens`
3. `ui: lock landscape top HUD`
4. `ui: lock side-panel hierarchy`
5. `ui: refine Shop and Bag layout`
6. CC-owned board/camera/bench visual PR
7. `ui: apply Demo 1 visual skin`
8. `ui: add presentation motion`

Do not combine steps 2–5 into one large PR unless the first CSS-only pass proves that separation would create unavoidable duplicate edits.

---

# Regression matrix

For every UI implementation PR:

| Area | Check |
|---|---|
| 800×360 | No overlap, clipping, or HUD wrapping |
| 844×390 | Primary target layout matches approved reference proportions |
| Tablet landscape | Panels do not become excessively wide |
| Safe areas | Left/right controls remain reachable |
| Shop | Open/close repeatedly; no transparent/white compositor artifact on real device when relevant |
| Bag | Open/close and item selection remain functional |
| Drag/drop | Bench→Board, Board→Board, Board→Bench |
| Orientation | Portrait overlay behavior remains correct once canonical |
| Combat | If runtime-adjacent code is touched, targeted waves at x4 |
| Console | No new errors or warnings caused by the change |

# Stop conditions

Stop and hand work to CC when any requested visual change requires:

- changing camera projection or position
- changing board/tile meshes
- reading or mutating gameplay state in a new way
- moving units or modifying placement resolution
- changing combat phase transitions
- modifying the renderer or animation loop

This boundary prevents Coco presentation work from overlapping CC runtime ownership.
