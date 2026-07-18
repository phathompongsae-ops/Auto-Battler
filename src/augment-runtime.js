// Demo 1 Map 1 augment runtime — DOM-free definitions + pure aggregation helpers.
// Offer IDs come from the canonical encounter data (data/design/map1-encounters-v1.json
// stages 5/10 `augmentOffer`); the two option effects per offer mirror the canonical
// contract (docs/GAME_DATA_CONTRACT_V1.md "Map 1 augment candidates"). No option is
// invented here. UI labels are Thai to match the runtime's existing hardcoded text.
//
// Loaded as a classic <script> in autochess.html (sets globalThis.AugmentRuntime) and
// evaluated by the Node test harness with a sandbox global of the same name.
globalThis.AugmentRuntime = (function () {
  'use strict';

  // The 7 canonical Class 1 lines, in canonical order (tiebreak for class selection).
  const CLASS_ORDER = ['fighter', 'swordman', 'archer', 'mage', 'summoner', 'acolyte', 'merchant'];

  // offerId -> exactly two options. kind drives the runtime effect; value is the magnitude.
  const OFFERS = {
    'augment.map1.after_5': [
      { id: 'after5_team_hp', kind: 'team_max_hp_pct', value: 8,
        labelTh: 'ทีม +8% HP', descTh: 'เพิ่มพลังชีวิตสูงสุดของทั้งทีม 8%' },
      { id: 'after5_class_atk', kind: 'class_atk_pct', value: 15,
        labelTh: 'สายอาชีพ +15% ATK', descTh: 'เพิ่มพลังโจมตีกายภาพและเวท 15% ให้สายอาชีพที่มีมากที่สุดในทีม' },
    ],
    'augment.map1.after_10': [
      { id: 'after10_team_as', kind: 'team_atk_speed_pct', value: 10,
        labelTh: 'ทีม +10% ความเร็วโจมตี', descTh: 'เพิ่มความเร็วโจมตีของทั้งทีม 10%' },
      { id: 'after10_class_mana', kind: 'class_start_mana_pct', value: 50,
        labelTh: 'สายอาชีพ เริ่มด้วยมานา 50%', descTh: 'สายอาชีพที่มีมากที่สุดในทีมเริ่มการต่อสู้ด้วยมานา 50%' },
    ],
  };

  // Fail-closed: unknown/malformed offer id returns null (caller skips the offer, run continues).
  function getOfferOptions(offerId) {
    const opts = OFFERS[offerId];
    return Array.isArray(opts) && opts.length === 2 ? opts : null;
  }

  const sumKind = (list, kind) =>
    (Array.isArray(list) ? list : []).reduce((s, a) => (a && a.kind === kind ? s + (a.value || 0) : s), 0);

  function teamMaxHpPct(list) { return sumKind(list, 'team_max_hp_pct'); }
  function teamAtkSpeedPct(list) { return sumKind(list, 'team_atk_speed_pct'); }
  function classAtkPct(list, classLine) {
    if (!classLine) return 0;
    return (Array.isArray(list) ? list : []).reduce(
      (s, a) => (a && a.kind === 'class_atk_pct' && a.classLine === classLine ? s + (a.value || 0) : s), 0);
  }
  function classStartManaPct(list, classLine) {
    if (!classLine) return 0;
    // Only one such augment is possible per run; take the strongest if somehow duplicated.
    return (Array.isArray(list) ? list : []).reduce(
      (m, a) => (a && a.kind === 'class_start_mana_pct' && a.classLine === classLine ? Math.max(m, a.value || 0) : m), 0);
  }

  // Deterministic class choice for class-focused augments: the most-represented owned class
  // line at selection time; ties broken by canonical order; default 'fighter' if none owned.
  function pickClassLine(ownedCounts) {
    const counts = ownedCounts || {};
    let best = CLASS_ORDER[0], bestN = -1;
    for (const cls of CLASS_ORDER) {
      const n = counts[cls] || 0;
      if (n > bestN) { bestN = n; best = cls; }
    }
    return best;
  }

  return { CLASS_ORDER, OFFERS, getOfferOptions, teamMaxHpPct, teamAtkSpeedPct, classAtkPct, classStartManaPct, pickClassLine };
})();
