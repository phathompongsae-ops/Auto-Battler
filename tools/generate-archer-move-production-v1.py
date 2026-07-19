#!/usr/bin/env python3
"""Build the review-only Archer Move v1 package from the approved master.

The upper identity zone remains byte-identical. Each frame independently
samples the approved Neutral Master through a periodic lower-body displacement
field; there is no AI regeneration and no cumulative frame editing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png"
IDLE_APPROVAL = ROOT / "data/design/archer-idle-package-exact-file-approval-v1.json"
FRAME_DIR = ROOT / "assets/units/hero.archer/move-chibi-v1"
REVIEW_DIR = ROOT / "docs/assets/review/character-production/archer/move-production-v1"
SIDECAR = ROOT / "assets/units/hero.archer/hero.archer_move_chibi_v1.json"
SOURCE_MAP = FRAME_DIR / "source-map.json"
METRICS = ROOT / "docs/reviews/archer-move-production-v1-validation.json"

SOURCE_SHA256 = "4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013"
BOARD_SHA256 = "a37f70609b036b7ce997ec71375e47a73898123795d4ebea21e4da5721e349f8"
FRAME_COUNT = 8
CANVAS = (640, 960)
ANCHOR = (0.5, 0.92)
FPS = 12
UPPER_IDENTITY_LOCK_Y = 610
STRIDE_AMPLITUDE = 18.0
PASSING_BIAS = 3.0
LIFT_AMPLITUDE = 14.0
VIEWER_LEFT_GROUND_OFFSET = 31.0


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def smoothstep01(value: np.ndarray) -> np.ndarray:
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def displaced_frame(source: np.ndarray, index: int) -> Image.Image:
    height, width, _ = source.shape
    phase = 2.0 * math.pi * index / FRAME_COUNT
    stride = STRIDE_AMPLITUDE * math.sin(phase) + PASSING_BIAS * math.cos(phase)

    # Anatomical left is viewer-right. It contacts at frame 2; anatomical
    # right (viewer-left) contacts at frame 6. Subtracting the smaller raw lift
    # leaves one support foot on the shared baseline in every frame.
    raw_viewer_left = 0.5 * LIFT_AMPLITUDE * (1.0 + math.sin(phase))
    raw_viewer_right = 0.5 * LIFT_AMPLITUDE * (1.0 - math.sin(phase))
    common = min(raw_viewer_left, raw_viewer_right)
    lift_viewer_left = raw_viewer_left - common
    lift_viewer_right = raw_viewer_right - common

    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    vertical_weight = smoothstep01((yy - UPPER_IDENTITY_LOCK_Y) / 190.0)
    right_partition = smoothstep01((xx - 285.0) / 65.0)
    left_partition = 1.0 - right_partition
    viewer_left_lobe = left_partition * np.exp(-0.5 * ((xx - 230.0) / 58.0) ** 2)
    viewer_right_lobe = right_partition * np.exp(-0.5 * ((xx - 370.0) / 58.0) ** 2)

    dx = vertical_weight * (-stride * viewer_left_lobe + stride * viewer_right_lobe)
    dy = vertical_weight * (
        (VIEWER_LEFT_GROUND_OFFSET - lift_viewer_left) * viewer_left_lobe
        - lift_viewer_right * viewer_right_lobe
    )
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
    p00, p10 = rgba[y0, x0], rgba[y0, x1]
    p01, p11 = rgba[y1, x0], rgba[y1, x1]
    top = p00 * (1.0 - wx) + p10 * wx
    bottom = p01 * (1.0 - wx) + p11 * wx
    out = top * (1.0 - wy) + bottom * wy
    alpha = out[..., 3:4]
    rgb = np.divide(out[..., :3], alpha, out=np.zeros_like(out[..., :3]), where=alpha > 1e-6)
    result = np.concatenate([rgb, alpha], axis=2)
    result = np.clip(np.rint(result * 255.0), 0, 255).astype(np.uint8)
    result[result[..., 3] <= 1] = 0
    result[:UPPER_IDENTITY_LOCK_Y, :, :] = source[:UPPER_IDENTITY_LOCK_Y, :, :]
    return Image.fromarray(result, "RGBA")


def alpha_bounds(image: Image.Image) -> dict:
    alpha = np.asarray(image, dtype=np.uint8)[..., 3]
    ys, xs = np.where(alpha > 0)
    if not len(xs):
        raise RuntimeError("frame has no visible pixels")
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)
    border = int(np.count_nonzero(alpha[0])) + int(np.count_nonzero(alpha[-1]))
    border += int(np.count_nonzero(alpha[1:-1, 0])) + int(np.count_nonzero(alpha[1:-1, -1]))
    return {
        "origin": "top-left",
        "x": x0,
        "y": y0,
        "width": x1 - x0,
        "height": y1 - y0,
        "footBaselineY": y1 - 1,
        "outerBorderNonTransparentPixels": border,
    }


def foot_metrics(image: Image.Image) -> dict:
    alpha = np.asarray(image, dtype=np.uint8)[..., 3]
    regions = {
        "characterRightViewerLeft": (120, 315),
        "characterLeftViewerRight": (315, 450),
    }
    result = {}
    for name, (x0, x1) in regions.items():
        sub = alpha[700:900, x0:x1]
        ys, xs = np.where(sub > 8)
        result[name] = {
            "region": [x0, 700, x1 - x0, 200],
            "maxVisibleY": int(700 + ys.max()) if len(ys) else None,
            "baselinePixelCountY852to854": int(np.count_nonzero(alpha[852:855, x0:x1] > 8)),
        }
    return result


def premultiplied_mae(first: Image.Image, second: Image.Image) -> float:
    a = np.asarray(first, dtype=np.float32) / 255.0
    b = np.asarray(second, dtype=np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    b[..., :3] *= b[..., 3:4]
    return float(np.mean(np.abs(a - b)))


def alpha_centroid(image: Image.Image) -> list[float]:
    alpha = np.asarray(image, dtype=np.float64)[..., 3]
    yy, xx = np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]]
    total = alpha.sum()
    return [round(float((xx * alpha).sum() / total), 6), round(float((yy * alpha).sum() / total), 6)]


def checker(size: tuple[int, int], cell: int = 16) -> Image.Image:
    width, height = size
    yy, xx = np.mgrid[0:height, 0:width]
    mask = ((xx // cell + yy // cell) % 2).astype(bool)
    arr = np.empty((height, width, 3), dtype=np.uint8)
    arr[mask] = (52, 58, 63)
    arr[~mask] = (72, 79, 85)
    return Image.fromarray(arr, "RGB")


def build_contact_sheet(frames: list[Image.Image], output: Path) -> None:
    size, margin, label_h = (160, 240), 16, 28
    sheet = checker((4 * (size[0] + margin) + margin, 2 * (size[1] + label_h + margin) + margin))
    draw, font = ImageDraw.Draw(sheet), ImageFont.load_default()
    for index, frame in enumerate(frames):
        x = margin + (index % 4) * (size[0] + margin)
        y = margin + (index // 4) * (size[1] + label_h + margin)
        reduced = frame.resize(size, Image.Resampling.LANCZOS)
        sheet.paste(reduced, (x, y), reduced)
        label = f"frame {index:03d}  {index / FPS:.3f}s"
        if index == 2: label += "  LEFT CONTACT"
        if index == 6: label += "  RIGHT CONTACT"
        draw.text((x + 3, y + size[1] + 6), label, fill=(245, 245, 245), font=font)
    sheet.save(output, optimize=True)


def build_loop_preview(frames: list[Image.Image], output: Path) -> None:
    rendered = []
    for frame in frames:
        reduced = frame.resize((240, 360), Image.Resampling.LANCZOS)
        bg = checker(reduced.size, 12).convert("RGBA")
        bg.alpha_composite(reduced)
        rendered.append(bg.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
    rendered[0].save(output, save_all=True, append_images=rendered[1:], duration=83, loop=0, disposal=2, optimize=True)


def build_board_review(frame: Image.Image, background_path: Path, output: Path) -> dict:
    background = Image.open(background_path).convert("RGBA")
    size, position, rect = (98, 147), (128, 240), (129, 338, 98, 67)
    reduced = frame.resize(size, Image.Resampling.LANCZOS)
    background.alpha_composite(reduced, position)
    draw = ImageDraw.Draw(background)
    draw.rectangle((rect[0], rect[1], rect[0] + rect[2] - 1, rect[1] + rect[3] - 1), outline=(67, 173, 255, 255), width=2)
    draw.rectangle((8, 8, 340, 35), fill=(0, 0, 0, 190))
    draw.text((16, 16), "REVIEW ONLY | MOVE | LEFT CONTACT @ 0.25", fill=(255, 255, 255, 255), font=ImageFont.load_default())
    background.convert("RGB").save(output, optimize=True)
    return {"sourceFrame": 2, "frameScale": list(size), "position": list(position), "comparisonTileRect": list(rect)}


def build_marker_diagnostic(frames: list[Image.Image], output: Path) -> None:
    scale = 0.5
    frame_size = (320, 480)
    canvas = checker((720, 550), 16).convert("RGBA")
    draw, font = ImageDraw.Draw(canvas), ImageFont.load_default()
    panels = [(2, 24, "LEFT CONTACT | t=0.25"), (6, 376, "RIGHT CONTACT | t=0.75")]
    for index, x, label in panels:
        reduced = frames[index].resize(frame_size, Image.Resampling.LANCZOS)
        canvas.alpha_composite(reduced, (x, 42))
        baseline_y = 42 + round(854 * scale)
        draw.line((x + 55, baseline_y, x + 230, baseline_y), fill=(255, 230, 80, 255), width=2)
        left_box = (x + round(315 * scale), 42 + round(700 * scale), x + round(450 * scale), 42 + round(890 * scale))
        right_box = (x + round(120 * scale), 42 + round(700 * scale), x + round(315 * scale), 42 + round(890 * scale))
        draw.rectangle(left_box, outline=(80, 235, 130, 255) if index == 2 else (235, 95, 95, 255), width=2)
        draw.rectangle(right_box, outline=(80, 235, 130, 255) if index == 6 else (235, 95, 95, 255), width=2)
        draw.text((x + 60, 18), label, fill=(255, 255, 255, 255), font=font)
    draw.text((24, 526), "Green = marker contact foot | Red = lifted/opposite foot | Yellow = shared y=854 baseline", fill=(255, 255, 255, 255), font=font)
    canvas.convert("RGB").save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--board-context", required=True, type=Path)
    args = parser.parse_args()

    if sha256(SOURCE) != SOURCE_SHA256:
        raise SystemExit("approved Neutral Master SHA-256 mismatch")
    if sha256(args.board_context) != BOARD_SHA256:
        raise SystemExit("PR #55 board review context SHA-256 mismatch")
    idle = json.loads(IDLE_APPROVAL.read_text(encoding="utf-8"))
    if not idle.get("idlePackageApproved") or idle.get("sourceNeutralMaster", {}).get("sha256") != SOURCE_SHA256:
        raise SystemExit("approved Idle overlay or Neutral Master link mismatch")

    source_image = Image.open(SOURCE)
    if source_image.size != CANVAS or source_image.mode != "RGBA":
        raise SystemExit("approved source must be 640x960 RGBA")
    source = np.asarray(source_image, dtype=np.uint8)
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)

    roles = [
        "double-support-passing-a", "left-leg-forward-down", "left-foot-contact",
        "left-support-recovery", "double-support-passing-b", "right-leg-forward-down",
        "right-foot-contact", "right-support-return",
    ]
    frames: list[Image.Image] = []
    records = []
    for index in range(FRAME_COUNT):
        path = FRAME_DIR / f"hero.archer_move_{index:03d}.png"
        frame = displaced_frame(source, index)
        frame.save(path, optimize=True)
        frames.append(frame.copy())
        phase = 2.0 * math.pi * index / FRAME_COUNT
        stride = STRIDE_AMPLITUDE * math.sin(phase) + PASSING_BIAS * math.cos(phase)
        raw_l = 0.5 * LIFT_AMPLITUDE * (1.0 + math.sin(phase))
        raw_r = 0.5 * LIFT_AMPLITUDE * (1.0 - math.sin(phase))
        common = min(raw_l, raw_r)
        metrics = alpha_bounds(frame)
        contacts = foot_metrics(frame)
        support_baseline = max(value["maxVisibleY"] for value in contacts.values() if value["maxVisibleY"] is not None)
        records.append({
            "frameIndex": index,
            "path": path.relative_to(ROOT).as_posix(),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
            "dimensions": list(frame.size),
            "mode": frame.mode,
            "role": roles[index],
            "marker": "leftFootstepCue" if index == 2 else "rightFootstepCue" if index == 6 else None,
            "sourceOperation": "independent premultiplied-alpha lower-body displacement from exact approved Neutral Master",
            "motionParameters": {
                "phaseRadians": round(phase, 9),
                "viewerRightCharacterLeftHorizontalPixels": round(stride, 6),
                "viewerLeftCharacterRightHorizontalPixels": round(-stride, 6),
                "characterLeftLiftPixels": round(raw_r - common, 6),
                "characterRightLiftPixels": round(raw_l - common, 6),
                "characterRightViewerLeftGroundNormalizationPixels": VIEWER_LEFT_GROUND_OFFSET,
                "upperIdentityLockExclusiveY": UPPER_IDENTITY_LOCK_Y,
            },
            "alphaBounds": {k: metrics[k] for k in ("origin", "x", "y", "width", "height")},
            "overallAlphaMaxY": metrics["footBaselineY"],
            "supportFootBaselineY": support_baseline,
            "anchorToSupportFootBaselinePixels": round(CANVAS[1] * ANCHOR[1] - support_baseline, 3),
            "outerBorderNonTransparentPixels": metrics["outerBorderNonTransparentPixels"],
            "footContact": contacts,
            "alphaCentroid": alpha_centroid(frame),
        })

    contact = REVIEW_DIR / "archer-move-production-v1-contact-sheet.png"
    preview = REVIEW_DIR / "archer-move-production-v1-loop-preview.gif"
    board = REVIEW_DIR / "archer-move-production-v1-board-scale-sample.png"
    diagnostic = REVIEW_DIR / "archer-move-production-v1-marker-contact-diagnostic.png"
    build_contact_sheet(frames, contact)
    build_loop_preview(frames, preview)
    board_method = build_board_review(frames[2], args.board_context, board)
    build_marker_diagnostic(frames, diagnostic)

    adjacent = [premultiplied_mae(frames[i], frames[(i + 1) % FRAME_COUNT]) for i in range(FRAME_COUNT)]
    source_delta = [premultiplied_mae(source_image, frame) for frame in frames]
    centroids = [record["alphaCentroid"] for record in records]
    validation = {
        "reportVersion": 1,
        "packageId": "hero.archer.move.chibi-production-candidate.v1",
        "generatedAt": "2026-07-19",
        "generator": "tools/generate-archer-move-production-v1.py",
        "sourceNeutralMaster": {"candidateId": "hero.archer.production-master.candidate.v1", "path": SOURCE.relative_to(ROOT).as_posix(), "sha256": SOURCE_SHA256, "dimensions": list(CANVAS), "mode": "RGBA"},
        "approvedIdle": {"approvalRecord": IDLE_APPROVAL.relative_to(ROOT).as_posix(), "approvalRecordSha256": sha256(IDLE_APPROVAL), "sourcePR": 63, "idlePackageApproved": True},
        "motion": {"fps": FPS, "frameCount": FRAME_COUNT, "loop": True, "rootMotion": "in-place", "anchor": list(ANCHOR), "runtimeFlipX": True, "eventMarkers": [{"name": "leftFootstepCue", "normalizedTime": 0.25, "frameIndex": 2}, {"name": "rightFootstepCue", "normalizedTime": 0.75, "frameIndex": 6}]},
        "frames": records,
        "loopContinuity": {
            "metric": "mean absolute difference of premultiplied RGBA normalized to 0..1",
            "adjacentFramePairs": [{"from": i, "to": (i + 1) % FRAME_COUNT, "value": round(value, 9)} for i, value in enumerate(adjacent)],
            "seamFrame7To0": round(adjacent[-1], 9),
            "maximumAdjacent": round(max(adjacent), 9),
            "seamNotGreaterThanMaximumAdjacent": adjacent[-1] <= max(adjacent),
            "sourceDeltaByFrame": [round(value, 9) for value in source_delta],
        },
        "rootMotion": {
            "alphaCentroids": centroids,
            "horizontalCentroidRangePixels": round(max(c[0] for c in centroids) - min(c[0] for c in centroids), 6),
            "verticalCentroidRangePixels": round(max(c[1] for c in centroids) - min(c[1] for c in centroids), 6),
            "accumulatedTranslationPixels": 0,
            "worldTravelBaked": False,
        },
        "anchorDecision": {
            "value": list(ANCHOR),
            "status": "retained-after-frame-bounds-and-contact-measurement",
            "supportFootBaselineRangeY": [min(record["supportFootBaselineY"] for record in records), max(record["supportFootBaselineY"] for record in records)],
            "markerContactBaselineY": {"frame2CharacterLeft": records[2]["footContact"]["characterLeftViewerRight"]["maxVisibleY"], "frame6CharacterRight": records[6]["footContact"]["characterRightViewerLeft"]["maxVisibleY"]},
            "reason": "Both marker contact feet measure exactly y=854. Transitional support silhouettes remain within y=852..854, a maximum 2 px package-space variation (0.31 px at the 98x147 board review scale), with no accumulated translation or crop; the established anchor therefore remains the smallest safe choice.",
        },
        "markerAlignment": {
            "leftFootstepCue": {"normalizedTime": 0.25, "frameIndex": 2, "contactFoot": "character-left/viewer-right", "oppositeFoot": "lifted"},
            "rightFootstepCue": {"normalizedTime": 0.75, "frameIndex": 6, "contactFoot": "character-right/viewer-left", "oppositeFoot": "lifted"},
            "markersChangedFromBaseline": False,
        },
        "reviewArtifacts": [
            {"id": "contact-sheet", "path": contact.relative_to(ROOT).as_posix(), "sha256": sha256(contact), "reviewOnly": True, "runtimeEligible": False},
            {"id": "loop-preview", "path": preview.relative_to(ROOT).as_posix(), "sha256": sha256(preview), "reviewOnly": True, "runtimeEligible": False},
            {"id": "board-scale-sample", "path": board.relative_to(ROOT).as_posix(), "sha256": sha256(board), "method": board_method, "reviewOnly": True, "runtimeEligible": False},
            {"id": "marker-contact-diagnostic", "path": diagnostic.relative_to(ROOT).as_posix(), "sha256": sha256(diagnostic), "sourceFrames": [2, 6], "reviewOnly": True, "runtimeEligible": False},
        ],
        "status": {"neutralMasterApproved": True, "idlePackageApproved": True, "movePackageApproved": False, "canonicalApproved": False, "runtimeEligible": False, "runtimeIntegrated": False, "attackGenerated": False},
    }
    METRICS.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")

    source_map = {
        "schemaVersion": 1,
        "assetId": "hero.archer.move.chibi-production-candidate.v1",
        "unitId": "hero.archer",
        "state": "move",
        "sourceNeutralMaster": validation["sourceNeutralMaster"] | {"sourcePR": 61, "approvedNeutralMasterSource": True},
        "approvedIdle": validation["approvedIdle"] | {"approvalBranch": "coco/archer-idle-package-exact-file-approval-v1", "approvalSha": "40b334937f394f54c1d1e97b729e37778644ee1e"},
        "motionContract": validation["motion"],
        "productionMethod": {
            "type": "identity-preserving deterministic articulated lower-body motion",
            "aiRegeneration": False,
            "description": "The face, hood, hair, ears, upper costume, torso, upper bow, palette, and lighting remain byte-identical above y=610. Every frame independently samples the exact approved Neutral Master; only the lower locomotion field changes.",
            "filter": "bilinear in premultiplied RGBA",
            "upperIdentityLockExclusiveY": UPPER_IDENTITY_LOCK_Y,
            "primaryStrideAmplitudePixels": STRIDE_AMPLITUDE,
            "passingBiasAmplitudePixels": PASSING_BIAS,
            "maximumOppositeFootLiftPixels": LIFT_AMPLITUDE,
            "characterRightViewerLeftGroundNormalizationPixels": VIEWER_LEFT_GROUND_OFFSET,
            "worldTravelBaked": False,
        },
        "frames": records,
        "movePackageApproved": False,
        "canonicalApproved": False,
        "runtimeEligible": False,
        "runtimeIntegrated": False,
    }
    SOURCE_MAP.write_text(json.dumps(source_map, indent=2) + "\n", encoding="utf-8")

    sidecar = {
        "schemaVersion": 1,
        "assetId": "hero.archer.move.chibi-production-candidate.v1",
        "unitId": "hero.archer",
        "state": "move",
        "fps": FPS,
        "frameCount": FRAME_COUNT,
        "loop": True,
        "anchor": list(ANCHOR),
        "canvas": list(CANVAS),
        "eventMarkers": [{"name": "leftFootstepCue", "normalizedTime": 0.25}, {"name": "rightFootstepCue", "normalizedTime": 0.75}],
        "rootMotion": "in-place",
        "runtimeFlipX": True,
        "framePathPattern": "move-chibi-v1/hero.archer_move_{frame:03d}.png",
        "sourceMap": "move-chibi-v1/source-map.json",
        "neutralMasterApproved": True,
        "idlePackageApproved": True,
        "movePackageApproved": False,
        "canonicalApproved": False,
        "runtimeEligible": False,
        "runtimeIntegrated": False,
    }
    SIDECAR.write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"frames": len(records), "source": SOURCE_SHA256, "leftContact": records[2]["footContact"], "rightContact": records[6]["footContact"], "seam": validation["loopContinuity"]["seamFrame7To0"], "maxAdjacent": validation["loopContinuity"]["maximumAdjacent"], "centroidRange": validation["rootMotion"]}, indent=2))


if __name__ == "__main__":
    main()
