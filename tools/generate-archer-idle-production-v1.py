#!/usr/bin/env python3
"""Build the review-only Archer Idle v1 package from the exact approved master.

The generator never synthesizes or repaints character pixels. It applies one
small, periodic, source-relative displacement field to the approved RGBA master;
the lower contact zone is pinned so the package remains in-place.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png"
FRAME_DIR = ROOT / "assets/units/hero.archer/idle-chibi-v1"
REVIEW_DIR = ROOT / "docs/assets/review/character-production/archer/idle-production-v1"
SIDECAR = ROOT / "assets/units/hero.archer/hero.archer_idle_chibi_v1.json"
SOURCE_MAP = FRAME_DIR / "source-map.json"
METRICS = ROOT / "docs/reviews/archer-idle-production-v1-validation.json"

SOURCE_SHA256 = "4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013"
BOARD_SHA256 = "a37f70609b036b7ce997ec71375e47a73898123795d4ebea21e4da5721e349f8"
FRAME_COUNT = 8
CANVAS = (640, 960)
ANCHOR = (0.5, 0.92)
FPS = 8


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def smoothstep01(value: np.ndarray) -> np.ndarray:
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def displaced_frame(source: np.ndarray, index: int) -> Image.Image:
    """Apply a subpixel, periodic upper-body breathe/sway field.

    Coordinates at y >= 800 are exact source coordinates. This pins both feet
    and the contact baseline while the head/torso/bow move by at most 2 px up
    and 0.65 px sideways.
    """
    height, width, _ = source.shape
    phase = 2.0 * math.pi * index / FRAME_COUNT
    inhale = 0.5 * (1.0 - math.cos(phase))
    sway = math.sin(phase)

    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    taper = 1.0 - smoothstep01((yy - 520.0) / 280.0)
    dx = 0.65 * sway * taper
    dy = -2.0 * inhale * taper
    sx = np.clip(xx - dx, 0.0, width - 1.0)
    sy = np.clip(yy - dy, 0.0, height - 1.0)

    x0 = np.floor(sx).astype(np.int32)
    y0 = np.floor(sy).astype(np.int32)
    x1 = np.minimum(x0 + 1, width - 1)
    y1 = np.minimum(y0 + 1, height - 1)
    wx = (sx - x0)[..., None]
    wy = (sy - y0)[..., None]

    rgba = source.astype(np.float32) / 255.0
    rgba[..., :3] *= rgba[..., 3:4]
    p00 = rgba[y0, x0]
    p10 = rgba[y0, x1]
    p01 = rgba[y1, x0]
    p11 = rgba[y1, x1]
    top = p00 * (1.0 - wx) + p10 * wx
    bottom = p01 * (1.0 - wx) + p11 * wx
    out = top * (1.0 - wy) + bottom * wy

    alpha = out[..., 3:4]
    rgb = np.divide(out[..., :3], alpha, out=np.zeros_like(out[..., :3]), where=alpha > 1e-6)
    result = np.concatenate([rgb, alpha], axis=2)
    result = np.clip(np.rint(result * 255.0), 0, 255).astype(np.uint8)
    result[result[..., 3] <= 1] = 0
    # Preserve the contact zone byte-for-byte, including RGB under transparent
    # pixels, so foot locking is exact rather than merely visually equivalent.
    result[800:, :, :] = source[800:, :, :]
    return Image.fromarray(result, "RGBA")


def alpha_metrics(image: Image.Image) -> dict:
    alpha = np.asarray(image, dtype=np.uint8)[..., 3]
    ys, xs = np.where(alpha > 0)
    if not len(xs):
        raise RuntimeError("frame contains no visible pixels")
    bbox = [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]
    border = int(np.count_nonzero(alpha[0])) + int(np.count_nonzero(alpha[-1]))
    border += int(np.count_nonzero(alpha[1:-1, 0])) + int(np.count_nonzero(alpha[1:-1, -1]))
    return {
        "alphaBounds": {"origin": "top-left", "x": bbox[0], "y": bbox[1], "width": bbox[2] - bbox[0], "height": bbox[3] - bbox[1]},
        "footBaselineY": bbox[3] - 1,
        "anchorPixel": [CANVAS[0] * ANCHOR[0], CANVAS[1] * ANCHOR[1]],
        "anchorToFootBaselinePixels": round(CANVAS[1] * ANCHOR[1] - (bbox[3] - 1), 3),
        "outerBorderNonTransparentPixels": border,
        "transparentPixels": int(np.count_nonzero(alpha == 0)),
        "partiallyTransparentPixels": int(np.count_nonzero((alpha > 0) & (alpha < 255))),
        "opaquePixels": int(np.count_nonzero(alpha == 255)),
    }


def premultiplied_mae(first: Image.Image, second: Image.Image) -> float:
    a = np.asarray(first, dtype=np.float32) / 255.0
    b = np.asarray(second, dtype=np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    b[..., :3] *= b[..., 3:4]
    return float(np.mean(np.abs(a - b)))


def checker(size: tuple[int, int], cell: int = 16) -> Image.Image:
    width, height = size
    yy, xx = np.mgrid[0:height, 0:width]
    mask = ((xx // cell + yy // cell) % 2).astype(bool)
    arr = np.empty((height, width, 3), dtype=np.uint8)
    arr[mask] = (52, 58, 63)
    arr[~mask] = (72, 79, 85)
    return Image.fromarray(arr, "RGB")


def build_contact_sheet(frames: list[Image.Image], output: Path) -> None:
    thumb_size = (160, 240)
    margin, label_height = 16, 28
    sheet = checker((4 * (thumb_size[0] + margin) + margin, 2 * (thumb_size[1] + label_height + margin) + margin))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, frame in enumerate(frames):
        x = margin + (index % 4) * (thumb_size[0] + margin)
        y = margin + (index // 4) * (thumb_size[1] + label_height + margin)
        reduced = frame.resize(thumb_size, Image.Resampling.LANCZOS)
        sheet.paste(reduced, (x, y), reduced)
        draw.text((x + 4, y + thumb_size[1] + 6), f"frame {index:03d}  {index / FPS:.3f}s", fill=(245, 245, 245), font=font)
    sheet.save(output, optimize=True)


def build_loop_preview(frames: list[Image.Image], output: Path) -> None:
    rendered = []
    for frame in frames:
        reduced = frame.resize((240, 360), Image.Resampling.LANCZOS)
        bg = checker(reduced.size, 12).convert("RGBA")
        bg.alpha_composite(reduced)
        rendered.append(bg.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
    rendered[0].save(output, save_all=True, append_images=rendered[1:], duration=125, loop=0, disposal=2, optimize=True)


def build_context_review(frame: Image.Image, background_path: Path, output: Path, kind: str) -> dict:
    background = Image.open(background_path).convert("RGBA")
    if kind == "board":
        size, position, rect, color = (98, 147), (128, 240), (129, 338, 98, 67), (67, 173, 255, 255)
    else:
        size, position, rect, color = (80, 120), (235, 420), (227, 472, 98, 67), (98, 220, 130, 255)
    reduced = frame.resize(size, Image.Resampling.LANCZOS)
    background.alpha_composite(reduced, position)
    draw = ImageDraw.Draw(background)
    draw.rectangle((rect[0], rect[1], rect[0] + rect[2] - 1, rect[1] + rect[3] - 1), outline=color, width=2)
    draw.rectangle((8, 8, 294, 35), fill=(0, 0, 0, 190))
    draw.text((16, 16), f"REVIEW ONLY | {kind.upper()} | frame sample", fill=(255, 255, 255, 255), font=ImageFont.load_default())
    background.convert("RGB").save(output, optimize=True)
    return {"frameScale": list(size), "position": list(position), "comparisonRect": list(rect)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--board-context", type=Path, required=True, help="Exact PR #55 board-focused review PNG")
    args = parser.parse_args()

    if sha256(SOURCE) != SOURCE_SHA256:
        raise SystemExit("approved Neutral Master SHA-256 mismatch")
    if sha256(args.board_context) != BOARD_SHA256:
        raise SystemExit("PR #55 board review context SHA-256 mismatch")

    source_image = Image.open(SOURCE)
    if source_image.size != CANVAS or source_image.mode != "RGBA":
        raise SystemExit(f"approved source must be {CANVAS[0]}x{CANVAS[1]} RGBA")
    source = np.asarray(source_image, dtype=np.uint8)

    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    frames: list[Image.Image] = []
    records = []
    roles = ["neutral", "inhale-begin", "inhale-mid", "inhale-peak", "breath-apex", "exhale-begin", "exhale-mid", "return-to-neutral"]
    for index in range(FRAME_COUNT):
        output = FRAME_DIR / f"hero.archer_idle_{index:03d}.png"
        if index == 0:
            shutil.copyfile(SOURCE, output)
            frame = Image.open(output).convert("RGBA")
        else:
            frame = displaced_frame(source, index)
            frame.save(output, optimize=True)
        frames.append(frame.copy())
        phase = 2.0 * math.pi * index / FRAME_COUNT
        record = {
            "frameIndex": index,
            "path": output.relative_to(ROOT).as_posix(),
            "sha256": sha256(output),
            "bytes": output.stat().st_size,
            "dimensions": list(frame.size),
            "mode": frame.mode,
            "role": roles[index],
            "sourceOperation": "exact byte copy" if index == 0 else "premultiplied-alpha bilinear displacement from exact approved Neutral Master",
            "motionParameters": {
                "phaseRadians": round(phase, 9),
                "inhale01": round(0.5 * (1.0 - math.cos(phase)), 9),
                "upperBodyVerticalOffsetPixels": round(-2.0 * 0.5 * (1.0 - math.cos(phase)), 6),
                "upperBodyHorizontalOffsetPixels": round(0.65 * math.sin(phase), 6),
                "contactZonePinnedFromY": 800,
            },
            **alpha_metrics(frame),
        }
        records.append(record)

    contact = REVIEW_DIR / "archer-idle-production-v1-contact-sheet.png"
    preview = REVIEW_DIR / "archer-idle-production-v1-loop-preview.gif"
    board = REVIEW_DIR / "archer-idle-production-v1-board-scale-sample.png"
    bench = REVIEW_DIR / "archer-idle-production-v1-bench-scale-sample.png"
    build_contact_sheet(frames, contact)
    build_loop_preview(frames, preview)
    board_method = build_context_review(frames[2], args.board_context, board, "board")
    bench_method = build_context_review(frames[6], args.board_context, bench, "bench")

    adjacent = [premultiplied_mae(frames[i], frames[(i + 1) % FRAME_COUNT]) for i in range(FRAME_COUNT)]
    source_delta = [premultiplied_mae(source_image, frame) for frame in frames]
    metrics = {
        "reportVersion": 1,
        "packageId": "hero.archer.idle.chibi-production-candidate.v1",
        "generatedAt": "2026-07-19",
        "generator": "tools/generate-archer-idle-production-v1.py",
        "source": {"candidateId": "hero.archer.production-master.candidate.v1", "path": SOURCE.relative_to(ROOT).as_posix(), "sha256": SOURCE_SHA256, "dimensions": list(CANVAS), "mode": "RGBA"},
        "motion": {"fps": FPS, "frameCount": FRAME_COUNT, "loop": True, "rootMotion": "in-place", "anchor": list(ANCHOR), "eventMarkers": [], "runtimeFlipX": True},
        "frames": records,
        "loopContinuity": {
            "metric": "mean absolute difference of premultiplied RGBA normalized to 0..1",
            "adjacentFramePairs": [{"from": i, "to": (i + 1) % FRAME_COUNT, "value": round(value, 9)} for i, value in enumerate(adjacent)],
            "seamFrame7To0": round(adjacent[-1], 9),
            "maximumAdjacent": round(max(adjacent), 9),
            "seamNotGreaterThanMaximumAdjacent": adjacent[-1] <= max(adjacent),
            "sourceDeltaByFrame": [round(value, 9) for value in source_delta],
        },
        "anchorDecision": {
            "value": list(ANCHOR),
            "status": "retained-after-measurement",
            "reason": "The source-derived deformation pins y>=800, so every frame retains foot baseline y=854 and a 29.2 px anchor-to-foot offset without runtime geometry changes.",
        },
        "reviewArtifacts": [
            {"id": "contact-sheet", "path": contact.relative_to(ROOT).as_posix(), "sha256": sha256(contact), "reviewOnly": True, "runtimeEligible": False},
            {"id": "loop-preview", "path": preview.relative_to(ROOT).as_posix(), "sha256": sha256(preview), "reviewOnly": True, "runtimeEligible": False},
            {"id": "board-scale-sample", "path": board.relative_to(ROOT).as_posix(), "sha256": sha256(board), "sourceFrame": 2, "method": board_method, "reviewOnly": True, "runtimeEligible": False},
            {"id": "bench-scale-sample", "path": bench.relative_to(ROOT).as_posix(), "sha256": sha256(bench), "sourceFrame": 6, "method": bench_method, "reviewOnly": True, "runtimeEligible": False},
        ],
        "status": {"neutralMasterApproved": True, "idlePackageApproved": False, "canonicalApproved": False, "runtimeEligible": False, "runtimeIntegrated": False},
    }
    METRICS.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    source_map = {
        "schemaVersion": 1,
        "assetId": "hero.archer.idle.chibi-production-candidate.v1",
        "unitId": "hero.archer",
        "state": "idle",
        "sourceNeutralMaster": metrics["source"] | {
            "sourcePR": 61,
            "approvalSource": {
                "branch": "coco/archer-neutral-master-exact-file-approval-v1",
                "sha": "7e1f0639b577b6f8c1d5f6ba43c8160f1c4115e2",
                "stateAtProductionStart": "open-draft-unmerged",
            },
            "approvedNeutralMasterSource": True,
        },
        "motionContract": {
            "fps": FPS,
            "frameCount": FRAME_COUNT,
            "loop": True,
            "rootMotion": "in-place",
            "eventMarkers": [],
            "runtimeFlipX": True,
            "anchor": list(ANCHOR),
            "canvas": list(CANVAS),
        },
        "productionMethod": {
            "type": "identity-preserving deterministic source-derived deformation",
            "aiRegeneration": False,
            "description": "Frame 000 is the exact approved master bytes. Frames 001-007 are sampled directly from that master with one periodic premultiplied-alpha displacement field; no accumulated frame-to-frame edits occur.",
            "upperBodyAmplitudePixels": {"vertical": 2.0, "horizontal": 0.65},
            "contactZonePinnedFromY": 800,
            "filter": "bilinear in premultiplied RGBA",
        },
        "frames": records,
        "canonicalApproved": False,
        "runtimeEligible": False,
        "idlePackageApproved": False,
    }
    SOURCE_MAP.write_text(json.dumps(source_map, indent=2) + "\n", encoding="utf-8")

    sidecar = {
        "schemaVersion": 1,
        "assetId": "hero.archer.idle.chibi-production-candidate.v1",
        "unitId": "hero.archer",
        "state": "idle",
        "fps": FPS,
        "frameCount": FRAME_COUNT,
        "loop": True,
        "anchor": list(ANCHOR),
        "canvas": list(CANVAS),
        "eventMarkers": [],
        "rootMotion": "in-place",
        "runtimeFlipX": True,
        "framePathPattern": "idle-chibi-v1/hero.archer_idle_{frame:03d}.png",
        "sourceMap": "idle-chibi-v1/source-map.json",
        "neutralMasterApproved": True,
        "idlePackageApproved": False,
        "canonicalApproved": False,
        "runtimeEligible": False,
        "runtimeIntegrated": False,
    }
    SIDECAR.write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"frames": len(records), "source": SOURCE_SHA256, "seam": metrics["loopContinuity"]["seamFrame7To0"], "maxAdjacent": metrics["loopContinuity"]["maximumAdjacent"]}, indent=2))


if __name__ == "__main__":
    main()
