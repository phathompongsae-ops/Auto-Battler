# UI Target Mockup Adoption Plan

## Purpose

Translate the latest approved fantasy UI mockup into a practical implementation target without changing core gameplay/runtime systems.

## Visual direction

- Deep navy panel interiors
- Brushed gold fantasy-metal borders
- Blue crystal/magical accents
- High contrast for mobile landscape readability
- Premium fantasy tone, but no panel should cover more board area than necessary

## Target screen structure

### Top HUD

- Keep the current information order: Menu, HP, Wave, Gold, Level/EXP, Speed, Pause.
- Convert each section to a compact framed capsule.
- Keep all controls on a single row at 844x390 and above.
- On 800x360, compress spacing and text before allowing wrapping.

### Left side

- `Team Link` remains the only persistent large left-side panel.
- Width target: 18-22vw, capped so it does not intrude into the board.
- Three Link slots remain visible.
- Long instructions may reduce to two lines or use a compact help label.

### Right side

- `Enemy Wave` remains the upper-right information panel.
- `Shop` remains below it.
- The old large `Team in Field` panel must not remain permanently stacked in the same column.
- Replace it with a compact count/badge or an optional drawer trigger.

### Bottom area

- Bag stays bottom-left.
- Status/instruction strip stays bottom-center.
- Start Battle remains bottom-right and visually dominant.
- The start button may use the ornate pressed/idle button asset pair.

## Panel hierarchy

1. Start Battle / critical actions
2. HP / wave / gold / level
3. Enemy Wave
4. Shop
5. Team Link
6. Bag and secondary controls
7. Temporary messages

## Board protection rules

- The center board must remain visually dominant.
- Side panels must not overlap the active placement area.
- Bottom status text must not hide the nearest deploy row.
- No decorative frame may extend pointer-blocking hitboxes beyond its visible bounds.

## Recommended implementation order

1. CSS variables and spacing tokens
2. Top HUD compression
3. Left and right panel width/position
4. Bottom action zone
5. Team-in-field collapse/drawer presentation
6. Decorative asset integration
7. Responsive verification

## Scope boundary

Coco may modify DOM structure and CSS presentation only.

Do not modify:

- Three.js camera
- Board geometry
- Combat logic
- Drag/drop coordinate conversion
- Unit state
- Economy logic
- Main loop

## Acceptance viewports

- 800x360
- 844x390
- 915x412

At every viewport:

- No persistent panel overlaps another.
- Start Battle remains fully tappable.
- Shop remains accessible.
- Team Link remains readable.
- Enemy information remains visible.
- The center board remains the largest visual area.
