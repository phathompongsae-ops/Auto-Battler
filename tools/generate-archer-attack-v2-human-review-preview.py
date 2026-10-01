#!/usr/bin/env python3
"""
Archer Attack v2 — Human Visual Review Preview (PR #72)

Builds review-only preview artifacts from the EXISTING, unmodified Attack v2
source frames. Does not touch the source PNGs, sidecar, source-map, or
validator in any way — read-only against production assets.

Frame order and timing are taken directly from the approved sidecar
(assets/units/hero.archer/hero.archer_attack_chibi_v2.json): fps=12,
frameCount=10, sequential 000..009, no interpolation, no per-frame
duration overrides recorded, so every frame holds for the same
1000/fps duration.

The only transformation applied is compositing each frame's existing
alpha channel over a flat neutral backdrop so the silhouette reads
clearly in GIF/PNG preview contexts that don't render transparency well.
No resize distortion (aspect ratio preserved), no crop, no color/level
adjustment, no motion blur, no frame drop, no frame duplication beyond
what already exists byte-for-byte in the source sequence.
"""

import json
from pathlib import Path
from PIL import Image, ImageDraw

FRAMES_DIR = Path('assets/units/hero.archer/attack-chibi-v2')
SIDECAR_PATH = Path('assets/units/hero.archer/hero.archer_attack_chibi_v2.json')
OUT_DIR = Path('docs/assets/review/character-production/archer/attack-production-v2')

NEUTRAL_BG = (58, 58, 58, 255)  # flat neutral gray, preview compositing only

sidecar = json.loads(SIDECAR_PATH.read_text())
FPS = sidecar['fps']
FRAME_COUNT = sidecar['frameCount']
LOOP_PRODUCTION_SEMANTICS = sidecar['loop']  # False — non-looping in production
DURATION_MS = round(1000 / FPS)  # 83ms @ 12 FPS, uniform: sidecar has no per-frame overrides

assert FPS == 12 and FRAME_COUNT == 10, 'sidecar timing changed unexpectedly — aborting preview build'

OUT_DIR.mkdir(parents=True, exist_ok=True)


def load_source_frame(index):
    path = FRAMES_DIR / f'hero.archer_attack_{index:03d}.png'
    img = Image.open(path).convert('RGBA')
    return path, img


def composite_on_neutral(rgba_img):
    """Preview-only compositing: flat neutral backdrop under the unmodified
    source alpha. Does not alter, resave, or touch the source file."""
    backdrop = Image.new('RGBA', rgba_img.size, NEUTRAL_BG)
    backdrop.alpha_composite(rgba_img)
    return backdrop.convert('RGB')


def build_animated_preview():
    frames = []
    for i in range(FRAME_COUNT):
        path, img = load_source_frame(i)
        frames.append(composite_on_neutral(img))

    out_path = OUT_DIR / 'archer-attack-production-v2-playback-preview.gif'
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=DURATION_MS,
        loop=0,  # infinite loop in the PREVIEW CONTAINER for reviewer convenience only;
                 # production sidecar loop=false is unaffected and unmodified
        optimize=False,
        disposal=2,
    )
    print(f'✓ Playback preview: {out_path} ({FRAME_COUNT} frames @ {DURATION_MS}ms/frame, container loops)')
    return out_path


def build_contact_sheet():
    # Uniform scale-down preserving exact aspect ratio (640x960 -> 200x300, ratio 0.6667 both)
    thumb_w, thumb_h = 200, 300
    cols, rows = 5, 2
    pad = 12
    label_h = 28
    sheet_w = cols * thumb_w + (cols + 1) * pad
    sheet_h = rows * (thumb_h + label_h) + (rows + 1) * pad

    sheet = Image.new('RGB', (sheet_w, sheet_h), NEUTRAL_BG[:3])
    draw = ImageDraw.Draw(sheet)

    for i in range(FRAME_COUNT):
        _, img = load_source_frame(i)
        composited = composite_on_neutral(img)
        thumb = composited.resize((thumb_w, thumb_h), Image.LANCZOS)  # uniform resize, aspect preserved exactly

        col = i % cols
        row = i // cols
        x = pad + col * (thumb_w + pad)
        y = pad + row * (thumb_h + label_h + pad)

        sheet.paste(thumb, (x, y))
        draw.text((x, y + thumb_h + 4), f'frame {i:03d}', fill=(230, 230, 230))

    out_path = OUT_DIR / 'archer-attack-production-v2-contact-sheet.png'
    sheet.save(out_path)
    print(f'✓ Contact sheet: {out_path} ({FRAME_COUNT} frames, order 000-009, uniform aspect-preserving scale)')
    return out_path


def write_preview_metadata(gif_path, sheet_path):
    meta = {
        'previewPackId': 'archer-attack-v2-human-review-preview',
        'purpose': 'Human PASS/FAIL visual review aid for PR #72 — presentation only, not a production asset',
        'sourcePR': 72,
        'sourceBranch': 'cc/archer-attack-v2-production-v1',
        'sourceFrameDirectory': str(FRAMES_DIR),
        'sourceSidecar': str(SIDECAR_PATH),
        'timing': {
            'sourceFps': FPS,
            'msPerFrame': DURATION_MS,
            'frameCount': FRAME_COUNT,
            'frameOrder': [f'{i:03d}' for i in range(FRAME_COUNT)],
            'productionLoopSemantics': LOOP_PRODUCTION_SEMANTICS,
            'note': 'GIF container is set to loop indefinitely purely so a human reviewer can watch multiple passes; this does NOT change the production sidecar, which remains loop=false.'
        },
        'transformationsApplied': [
            'RGBA source alpha composited over flat neutral backdrop (58,58,58) for legibility',
            'Uniform aspect-ratio-preserving resize for contact-sheet thumbnails only (640x960 -> 200x300)'
        ],
        'transformationsNotApplied': [
            'no frame interpolation',
            'no motion blur',
            'no color/level/hue adjustment',
            'no crop',
            'no reshaping/distortion',
            'no frame drop',
            'no frame reorder',
            'no source PNG file modified'
        ],
        'artifacts': [
            {'file': gif_path.name, 'type': 'animated GIF', 'shows': 'full 10-frame sequence in source order, looped for review'},
            {'file': sheet_path.name, 'type': 'contact sheet', 'shows': 'all 10 frames simultaneously, labeled, in source order'}
        ]
    }
    out_path = OUT_DIR / 'archer-attack-production-v2-preview-metadata.json'
    out_path.write_text(json.dumps(meta, indent=2))
    print(f'✓ Preview metadata: {out_path}')


if __name__ == '__main__':
    print(f'Building Archer Attack v2 human review preview (PR #72)')
    print(f'Source: {FRAMES_DIR} | FPS: {FPS} | Frames: {FRAME_COUNT} | ms/frame: {DURATION_MS}\n')
    gif_path = build_animated_preview()
    sheet_path = build_contact_sheet()
    write_preview_metadata(gif_path, sheet_path)
    print('\nDone. Source frames were not modified.')
