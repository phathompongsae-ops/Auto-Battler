# External Asset License Ledger

This ledger records external asset candidates before import. An entry in this file does not mean the asset is canonical or integrated.

| Candidate | Author | License | Commercial use | Attribution required | Intended scope | Status |
|---|---|---|---:|---:|---|---|
| Fantasy UI Borders | Kenney | CC0 1.0 Universal | Yes | No | UI panel and drawer borders | Approved candidate; not downloaded in this session |
| Fantasy RPG Icons | drummyfish | CC0 | Yes | No | Items, weapons, spells, bag, currency | Approved candidate; not downloaded in this session |
| Fantasy RPG Icons 2 | drummyfish | CC0 | Yes | No | Currency, mana, heal, dagger, magic | Approved candidate; not downloaded in this session |
| Fantasy RPG Icons 3 | drummyfish | CC0 | Yes | No | Bow, shield, armor, poison, charge | Approved candidate; not downloaded in this session |
| Seamless looping magic/forcefield effect | zookeeper | CC0 | Yes | No | Shield, aura, portal, boss barrier prototype | Experimental candidate; not downloaded in this session |

## Required metadata after download

Each imported pack must add:

- original archive filename
- SHA-256 of the archive
- download date
- exact source URL
- author
- license text or license URL
- extracted file count
- selected file list
- rejected file list
- any modifications made by the project

## Repository location policy

Before approval:

`assets/external/_review/<pack-id>/`

After visual and license approval:

`assets/ui/external/<pack-id>/`

or

`assets/vfx/external/<pack-id>/`

Do not place external hero or monster images in canonical runtime folders without explicit project-lead approval.