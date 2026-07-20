# Class 1 Identity Matrix v1

The exact approved Archer is the style/quality benchmark only. Its face, eyes, elf ears, green hood, green/gold costume, ornate bow and pose identity are reserved and were not copied.

| Class | Gender | Primary silhouette and color | Weapon/class cue | Forbidden overlap |
|---|---|---|---|---|
| Fighter | Male | Broad crimson/iron brawler, spiky hair and headband | Paired iron gauntlets | Swordman, Knight or Berserker massing |
| Swordman | Male | Slim cobalt/silver novice armor, swept hair | Slender longsword and small buckler | Fighter gauntlets or advanced Knight/Blade Master/Duelist cues |
| Archer | Female | Exact green-hooded approved master | Ornate bow and quiver | All Archer-specific identity remains exclusive |
| Mage | Male | Violet triangular robe and pointed cap | Crystal staff | Summoner contract tools or evolved caster regalia |
| Summoner | Male | Teal high-collar coat and contract tabs | Grimoire plus ring seal | Mage hat/staff or large baked summoned creature |
| Acolyte | Female | Ivory/sky-blue veil and light A-line tunic | Simple sun-ring support staff | Archer face/body or advanced Priest/Inquisitor cues |
| Merchant | Male | Ochre travel gear, cap and loaded backpack | Ledger, coin pouch and compact axe | Generic NPC, Tycoon luxury or Trickster language |

## Source evidence and decisions

- Canonical gender, tier, role and evolution boundaries: `data/design/hero-codex-v1.json`.
- Current project visual policy: `data/design/character-art-style-lock-and-migration-contract-v1.json`.
- Current role language: `data/demo1-localization.json`.
- Legacy identity evidence: `assets/<class>.png`, `assets/v5/body_<class>.png` and `assets/v5/face_<class>.png`.
- Exact Archer approval evidence: exact master binary and `data/design/archer-neutral-master-exact-file-approval-v1.json`.

Legacy procedural art and v5 concept art differed in detail and sometimes tool choice. The current style contract and hero codex were treated as authoritative. Legacy images informed class cues only; no legacy pixel was copied into a final candidate.

Mage/Summoner overlap was resolved by reserving a crystal staff and pointed cap for Mage, while Summoner uses a contract grimoire and ring seal. Swordman's shield was reduced to a small novice buckler to prevent Knight drift. Merchant follows the newer travel-merchant backpack/ledger/axe language rather than the older briefcase-only sprite.
