# Final Thai + icon polish — Demo final prep (2026-10-11)

Started on `phaser-rebuild` at `b30b0b61`. Localization and icon polish only. No gameplay, balance, HUD
architecture, environment or locked monster art changes. No Mage/Ninja work and no deployment.

## Localization

Every interface string goes through the existing table (`src/ui/i18n/strings.ts`, `t()`). The `th` table is
type-checked against `en`, and a unit test checks that every Thai entry is non-empty with the same `{placeholders}`.
English output is unchanged, so English-mode tests read the same text as before.

| Grade | What |
|---|---|
| A — already localized | HUD, bottom strip, quest tracker, chat, Character / Inventory, Shop, Settings, potion / dodge labels, Enraged / Winding up |
| C → localized in this pass (132 keys) | Skills window chrome (points, Reset, active slots, assign hints, tier headers, Now / Next / Rank 1, Requires, type, lock reasons, empty states); quest window and NPC dialogue chrome (phases, Rewards, Accept / Complete / Continue, service buttons and notes); loot / system feed (Gold, drops, bag full, checkpoint, party wipe, dungeon failed, quest accepted / done / complete, skill learned); world notices (LEVEL UP, QUEST COMPLETE, Unlocked!, ENRAGED!, BOSS DEFEATED variants, You were defeated, Retry point updated); skill-failure notes; respawn panel; item detail meta line, stat-section titles and compare captions; Daily / Weekly; Job selection and Job screen; Area Map legend / position; controls list; Enhancement / Enchant / Craft / Warp chrome; "Coming soon" |
| B — English by game-data choice | Item, equipment, monster, NPC, map and job names; quest titles, descriptions, objective lines and reward contents; skill descriptions and stat lines; gate messages, tutorial hints and map-entry messages (map / story data). The Settings language hint already says so. |
| D — developer only | `?lang=`, `?envArt=off`, `?iconArt=off`, debug API. Not reachable from the Demo UI. |

**Terminology:** existing terms are kept, and a unit test locks the shared ones:

- ตัวละคร, กระเป๋า, สกิล, เควส, เพิ่มเติม
- แชท / ทั้งหมด / ปาร์ตี้ / ระบบ
- อุปกรณ์ / ของใช้ / วัตถุดิบ
- สวมใส่ / ถอด / ใช้
- โกลด์ / เพชร
- บ้าคลั่ง, เตรียมโจมตี!, เช็กพอยต์, ดันเจี้ยน, เควสสำเร็จ, เลเวลอัป, เปลี่ยนอาชีพ, ร้านค้า, ปิด

The Demo has no Buy or Back control (the Shop is a read-only preview), so no string was added for either.

**Overflow:** reviewed in Thai and English at 960×540, 844×390 and 640×360.

- Skills buttons and tabs fit (IP-6), and so do the Character / Inventory tabs, slot labels and actions (CI-11).
- Long item details keep using their existing scroll region.
- No global font change.

## Icons

All icons are code-drawn in this repo (`src/ui/art/iconArt.ts`): 96×96 transparent canvases in the game's
illustrated language, with a dark ink outline, soft gradient shading and a lit top-left. They contain no text and
no rarity frame; rims, counts and badges stay UI layers. No image generation or third-party art was used. Each icon
is drawn once on first use and reused as a cached data URL (IP-5: 18 cached, reopening windows draws nothing new).

- **Items (P0 and P1, all 30):**
  - small / medium HP and MP potions
  - slime gel, slime sample, wolf fang, mushroom cap, boar tusk, Guardian bark
  - enhancement / enchant / protection stones, success booster, boss fragment, rare craft material
  - two blueprints, four eggs, the egg ticket
  - town / dungeon warp scrolls, additional dungeon ticket
  - material box, weekly chest, stat reset (test)
- **Equipment (all 25):** drawn by slot and weapon type, with set palettes: traveler leather, Guardian
  green-bronze, Warborn steel, Berserker crimson, oak wood; rings and necklace take the item's gem colour.
- **Currency:** gold coins and a diamond. One shared mark (`currencyIcon`) is used in Character, Inventory and
  Shop (IP-3).
- **Passives / procs:** Heavy Armor Mastery, Sword Mastery, Guardian Instinct, Battle Instinct.
  - They sit on a muted round plate; actives keep their bright medallion PNGs, so the two never read alike.
  - Every Skills row now shows its icon.
  - The two procs show their plate in the HUD status row; other statuses keep their glyphs.
- **Empty equipment slots:** faint silhouettes (helm, chest, glove, boot, necklace, ring, plus the existing sword
  and shield) for the 9 real slots, above the existing slot name (IP-2).
- **HUD potion buttons:** the same flask art as the bag.
- **Fallback:**
  - An id without a drawing keeps its lettered disc or vector glyph.
  - `?iconArt=off` forces that fallback everywhere, including the vector currency marks (IP-7).

## W-3 hardening

Power Slash gameplay is correct and unchanged. The test failed because MP regenerates continuously (1.5 MP/s of
game time) both before the cast (after MP is set to 50) and after it, and it checked a fixed 42 ≤ MP < 43 window
after wall-clock sleeps (it failed at MP ≈ 43.05).

The check now uses game time (`world.now`) and the debug log:

- **MP:** must equal 50 − 8 + regen × elapsed, within 0.1.
- **Cooldown:** remaining + time since the cast must be about 4 s, with 1 ms of float slack.
- **Hit and animation:** awaited from the log instead of fixed sleeps.

Result: `--warrior-review` passes W-3 3/3. Combat check 17 (Guard) uses the same kind of MP window and was not part
of this pass; it can be hardened the same way (see the gaps below).

## QA

- **Typecheck and build:** PASS.
- **Unit tests:** 623/623 (5 new).
- **`--icon-review`:** 10/10 (new: IP-1…IP-7).
- **Other reviews:** character 21/21, HUD 40/40, chat 14/14, story 12/12, warrior 24/24, HUD status 14/14.
- **Full browser suite:** 484/484 in one run (the previous 477 plus IP-1…IP-7), with W-3 passing and combat p95 13.9 ms (max 27.8 ms) in the suite's combat check. No file changed during the run (SHA-1 before and after), and the lowest recorded free RAM was about 3.2 GB.

## Remaining visual gaps (after this pass)

| Priority | Gap |
|---|---|
| P0 | **Production NPC figures** (six Town roles). They are a readable 2x chibi, but share one body told apart only by robe tint. This is the only Demo Candidate blocker. |
| P1 | Production PNGs for the code-drawn icons and props (icons, standing stones, mushrooms, ruin pillars, sarcophagi, banners, carpet, cobwebs). They can replace the drawings under the same ids, with no code change. |
| P1 | Crypt door / gate frame and portal tile art; pond water texture. |
| P1 | Real-phone check: notch / safe-area and thumb reach on the HUD at 844×390. |
| P2 | Game-data English (item, monster, quest and map names, quest objectives, skill descriptions, gate / tutorial lines) if a full Thai content pass is wanted. |
| P2 | Combat check 17 (Guard MP window): same game-time hardening as W-3. |
| P2 | Rarely seen items (Guardian Crown, Berserker set, blueprints) reuse their slot drawing with a set palette; unique art later. |
