#!/usr/bin/env python3
"""
Generate mobile-first visual review artifacts for Archer Attack v2.

Produces:
1. Contact sheet: 10-frame grid preview (one image)
2. Animated GIF: playable v2 sequence
3. Diagnostic frames: annotated articulation zones
4. Frame comparison data
"""

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import os

FRAMES_DIR = 'assets/units/hero.archer/attack-chibi-v2'
OUTPUT_DIR = 'docs/reviews/archer-v2-review-artifacts'
W, H = 640, 960

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

def load_frame(index):
    """Load a single frame PNG."""
    path = f'{FRAMES_DIR}/hero.archer_attack_{index:03d}.png'
    return Image.open(path).convert('RGBA')

def create_contact_sheet():
    """Create a 2x5 grid contact sheet of all frames."""
    # Reduce frame size for mobile preview (2x5 grid)
    thumb_w, thumb_h = 160, 240  # quarter size
    sheet = Image.new('RGB', (2 * thumb_w + 30, 5 * thumb_h + 60), color='#1a1a1a')
    draw = ImageDraw.Draw(sheet)

    y_offset = 10
    for row in range(5):
        x_offset = 10
        for col in range(2):
            frame_idx = row * 2 + col
            if frame_idx >= 10:
                break
            frame = load_frame(frame_idx)
            frame_resized = frame.resize((thumb_w, thumb_h), Image.LANCZOS)
            sheet.paste(frame_resized, (x_offset, y_offset), frame_resized)

            # Label frame
            label_y = y_offset + thumb_h + 2
            draw.text((x_offset + 5, label_y), f'Frame {frame_idx:02d}', fill='#fff')

            x_offset += thumb_w + 10
        y_offset += thumb_h + 20

    sheet.save(f'{OUTPUT_DIR}/archer-v2-contact-sheet.png')
    print(f'✓ Contact sheet: {OUTPUT_DIR}/archer-v2-contact-sheet.png')

def create_animated_gif():
    """Create animated GIF for quick preview."""
    frames = [load_frame(i).convert('RGBA') for i in range(10)]

    frames[0].save(
        f'{OUTPUT_DIR}/archer-v2-animation.gif',
        save_all=True,
        append_images=frames[1:],
        duration=83,  # 12 FPS = 83ms per frame
        loop=0,
        optimize=False
    )
    print(f'✓ Animated GIF: {OUTPUT_DIR}/archer-v2-animation.gif')

def create_diagnostic_frames():
    """Create diagnostic overlays showing articulation zones."""
    # Highlight frames showing key articulation moments
    key_frames = {
        0: {'name': 'Ready (baseline)', 'zones': []},
        1: {'name': 'Raise (shoulder up)', 'zones': [(400, 200, 600, 400)]},
        2: {'name': 'Nock (arm prep)', 'zones': [(420, 250, 580, 480)]},
        3: {'name': 'Draw Mid (bend)', 'zones': [(380, 280, 600, 500)]},
        4: {'name': 'Full Draw (max)', 'zones': [(350, 150, 620, 600)]},
        5: {'name': 'Release (snap)', 'zones': [(380, 150, 600, 500)]},
        9: {'name': 'Exit (neutral)', 'zones': []}
    }

    for frame_idx, info in key_frames.items():
        frame = load_frame(frame_idx)
        draw = ImageDraw.Draw(frame)

        # Draw articulation zone boxes
        for x1, y1, x2, y2 in info['zones']:
            draw.rectangle([x1, y1, x2, y2], outline='#ff6b6b', width=3)

        # Add label
        label = f"Frame {frame_idx:02d}: {info['name']}"
        draw.text((10, 10), label, fill='#fff')

        frame.save(f'{OUTPUT_DIR}/archer-v2-frame-{frame_idx:02d}-diagnostic.png')

    print(f'✓ Diagnostic frames: {len(key_frames)} key moments')

def create_review_summary():
    """Create JSON summary of review artifacts and assessment."""
    summary = {
        "artifactVersion": 1,
        "generated": "2026-07-19",
        "candidate": "hero.archer.attack.chibi-production-candidate-v2",
        "artifacts": [
            {
                "type": "contact_sheet",
                "file": "archer-v2-contact-sheet.png",
                "purpose": "Quick visual scan of all 10 frames on mobile/tablet",
                "format": "2x5 grid, 160x240px thumbnails on dark background",
                "audience": ["mobile-reviewer", "designer", "quick-check"]
            },
            {
                "type": "animated_gif",
                "file": "archer-v2-animation.gif",
                "purpose": "Playable attack sequence at 12 FPS without loading individual frames",
                "format": "GIF, looping, 83ms per frame",
                "audience": ["mobile-reviewer", "motion-check"]
            },
            {
                "type": "diagnostic_frames",
                "files": ["archer-v2-frame-{00,01,02,03,04,05,09}-diagnostic.png"],
                "purpose": "Annotated frames with articulation zones highlighted in red",
                "keyMoments": ["ready", "raise", "nock", "draw-mid", "full-draw", "release", "exit"],
                "audience": ["motion-analyst", "detailed-review"]
            }
        ],
        "validator_status": {
            "technicalPass": True,
            "articulationPass": False,
            "marginalGates": [
                {"gate": "nock-draw-mid", "actual": 0.0154, "threshold": 0.020, "gap": -23},
                {"gate": "draw-mid-full-draw", "actual": 0.0148, "threshold": 0.025, "gap": -41},
                {"gate": "full-draw-release", "actual": 0.0265, "threshold": 0.030, "gap": -12}
            ]
        },
        "review_guidance": {
            "focus": "Perceptual articulation quality, not MAE metrics",
            "questions": [
                "Is the draw motion visually apparent frame-to-frame?",
                "Can you see the arm moving backward during frames 1-4?",
                "Is the shoulder rotation subtle but visible?",
                "Does the release snap (frame 5) feel distinct?",
                "Is the recovery (frames 6-9) smooth?"
            ],
            "assessment_criteria": [
                "Visual motion is CLEAR and readable at board scale",
                "Archer identity (face, hood, bow) is stable and recognizable",
                "No visual artifacts, glitches, or distortion",
                "Transition to/from idle is smooth without pops",
                "Release frame (5) marks a clear timing beat"
            ]
        }
    }

    with open(f'{OUTPUT_DIR}/archer-v2-review-guide.json', 'w') as f:
        json.dump(summary, f, indent=2)

    print(f'✓ Review guide: {OUTPUT_DIR}/archer-v2-review-guide.json')

if __name__ == '__main__':
    print('Generating Archer Attack v2 mobile-first review artifacts...\n')
    create_contact_sheet()
    create_animated_gif()
    create_diagnostic_frames()
    create_review_summary()
    print(f'\n✓ All artifacts saved to: {OUTPUT_DIR}/')
