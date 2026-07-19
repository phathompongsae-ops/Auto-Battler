#!/usr/bin/env python3
"""Build the review-only Archer Attack v1 package from the approved master.

Every frame independently samples the exact approved Neutral Master through a
deterministic draw-and-release displacement field (torso lean + anticipation
crouch + string-arm pull, snapping at the projectileRelease marker). The foot
contact zone is hard-copied so both feet stay planted; frame 009 is
byte-identical to the Neutral Master so the play-once state exits cleanly back
to Idle. There is no AI regeneration, no repaint, and no reuse of the Move
locomotion deformation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png"
IDLE_APPROVAL = ROOT / "data/design/archer-idle-package-exact-file-approval-v1.json"
MOVE_APPROVAL = ROOT / "data/design/archer-move-package-exact-file-approval-v1.json"
FRAME_DIR = ROOT / "assets/units/hero.archer/attack-chibi-v1"
REVIEW_DIR = ROOT / "docs/assets/review/character-production/archer/attack-production-v1"
SIDECAR = ROOT / "assets/units/hero.archer/hero.archer_attack_chibi_v1.json"
SOURCE_MAP = FRAME_DIR / "source-map.json"
METRICS = ROOT / "docs/reviews/archer-attack-production-v1-validation.json"

SOURCE_SHA256 = "4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013"
BOARD_SHA256 = "a37f70609b036b7ce997ec71375e47a73898123795d4ebea21e4da5721e349f8"
FRAME_COUNT = 10
CANVAS = (640, 960)
ANCHOR = (0.5, 0.92)
FPS = 12
RELEASE_FRAME = 5
RELEASE_NORMALIZED_TIME = 0.55
FEET_PIN_Y = 800

# The runtime contract row for hero.archer/attack (src/motion-test-harness.js,
# read-only technical baseline): loop=false, fps=12, frameTarget=10,
# anchor [0.5, 0.92], marker projectileRelease @ normalizedTime 0.55.
#
# Deliberately NOT the Move locomotion field (leg-stride lobes): the Move
# approval overlay forbids reusing that deformation for the Attack state.
LEAN_AMPLITUDE = 9.0        # px, torso/head lean toward viewer-right (bow side)
CROUCH_AMPLITUDE = 7.0      # px, anticipation compression toward the ground
ARM_PULL_AMPLITUDE = 16.0   # px, string-hand pull toward viewer-left
ARM_DROP_RATIO = 0.35       # fraction of the pull applied downward

# Per-frame envelopes, index 0..9. Draw builds through frame 4 (full draw),
# snaps to zero at frame 5 (projectileRelease), overshoots on follow-through,
# and settles to exactly zero at frame 9 (byte-identical neutral exit).
DRAW_ENVELOPE = [0.15, 0.45, 0.75, 0.95, 1.0, 0.0, -0.18, -0.08, 0.03, 0.0]
LEAN_ENVELOPE = [0.10, 0.40, 0.70, 0.90, 1.0, 0.25, -0.30, -0.12, 0.02, 0.0]
CROUCH_ENVELOPE = [0.10, 0.35, 0.60, 0.85, 0.90, 0.35, 0.15, 0.08, 0.03, 0.0]

FRAME_ROLES = [
    "stance-set", "draw-begin", "draw-mid", "draw-deep", "full-draw-hold",
    "release", "follow-through", "recoil-settle", "recovery", "return-to-neutral",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def smoothstep01(value: np.ndarray) -> np.ndarray:
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def displaced_frame(source: np.ndarray, index: int) -> Image.Image:
    draw_amount = DRAW_ENVELOPE[index]
    lean_amount = LEAN_ENVELOPE[index]
    crouch_amount = CROUCH_ENVELOPE[index]
    if draw_amount == 0.0 and lean_amount == 0.0 and crouch_amount == 0.0:
        return Image.fromarray(source.copy(), "RGBA")

    height, width, _ = source.shape
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)

    # Whole-body taper: full effect for the head/torso, zero by the pinned
    # foot zone. The head moves only as a rigid subpixel translation of the
    # lean; no local deformation touches the face, hood, ears, or bow shape.
    taper = 1.0 - smoothstep01((yy - 480.0) / 320.0)

    # String-arm lobe (viewer-left hand beside the quiver). The left partition
    # reaches zero before the bow column, so the bow is never locally deformed.
    left_partition = 1.0 - smoothstep01((xx - 250.0) / 65.0)
    lobe = (
        left_partition
        * np.exp(-0.5 * ((xx - 165.0) / 70.0) ** 2)
        * np.exp(-0.5 * ((yy - 560.0) / 95.0) ** 2)
        * taper
    )

    dx = taper * LEAN_AMPLITUDE * lean_amount - lobe * ARM_PULL_AMPLITUDE * draw_amount
    dy = taper * CROUCH_AMPLITUDE * crouch_amount + lobe * ARM_PULL_AMPLITUDE * ARM_DROP_RATIO * draw_amount
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
    result[FEET_PIN_Y:, :, :] = source[FEET_PIN_Y:, :, :]
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


def arm_region_centroid(image: Image.Image) -> list[float]:
    """Alpha centroid of the string-arm lobe region (draw/release evidence)."""
    alpha = np.asarray(image, dtype=np.float64)[430:690, 60:315, 3]
    yy, xx = np.mgrid[430:690, 60:315]
    total = alpha.sum()
    return [round(float((xx * alpha).sum() / total), 6), round(float((yy * alpha).sum() / total), 6)]


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
    size, margin, label_h = (128, 192), 14, 28
    sheet = checker((5 * (size[0] + margin) + margin, 2 * (size[1] + label_h + margin) + margin))
    draw, font = ImageDraw.Draw(sheet), ImageFont.load_default()
    for index, frame in enumerate(frames):
        x = margin + (index % 5) * (size[0] + margin)
        y = margin + (index // 5) * (size[1] + label_h + margin)
        reduced = frame.resize(size, Image.Resampling.LANCZOS)
        sheet.paste(reduced, (x, y), reduced)
        label = f"frame {index:03d}  {index / FPS:.3f}s"
        if index == 4: label += "  FULL DRAW"
        if index == RELEASE_FRAME: label += "  RELEASE"
        draw.text((x + 3, y + size[1] + 6), label, fill=(245, 245, 245), font=font)
    sheet.save(output, optimize=True)


def build_sequence_preview(frames: list[Image.Image], output: Path) -> None:
    rendered = []
    for frame in frames:
        reduced = frame.resize((240, 360), Image.Resampling.LANCZOS)
        bg = checker(reduced.size, 12).convert("RGBA")
        bg.alpha_composite(reduced)
        rendered.append(bg.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
    durations = [83] * (FRAME_COUNT - 1) + [650]  # hold the neutral exit so the play-once read survives GIF looping
    rendered[0].save(output, save_all=True, append_images=rendered[1:], duration=durations, loop=0, disposal=2, optimize=True)


def build_board_review(frame: Image.Image, background_path: Path, output: Path) -> dict:
    background = Image.open(background_path).convert("RGBA")
    size, position, rect = (98, 147), (128, 240), (129, 338, 98, 67)
    reduced = frame.resize(size, Image.Resampling.LANCZOS)
    background.alpha_composite(reduced, position)
    draw = ImageDraw.Draw(background)
    draw.rectangle((rect[0], rect[1], rect[0] + rect[2] - 1, rect[1] + rect[3] - 1), outline=(67, 173, 255, 255), width=2)
    draw.rectangle((8, 8, 340, 35), fill=(0, 0, 0, 190))
    draw.text((16, 16), "REVIEW ONLY | ATTACK | RELEASE @ 0.55", fill=(255, 255, 255, 255), font=ImageFont.load_default())
    background.convert("RGB").save(output, optimize=True)
    return {"sourceFrame": RELEASE_FRAME, "frameScale": list(size), "position": list(position), "comparisonTileRect": list(rect)}


def build_marker_diagnostic(frames: list[Image.Image], output: Path) -> None:
    scale = 0.5
    frame_size = (320, 480)
    canvas = checker((720, 550), 16).convert("RGBA")
    draw, font = ImageDraw.Draw(canvas), ImageFont.load_default()
    panels = [(4, 24, "FULL DRAW | t=0.45"), (RELEASE_FRAME, 376, "RELEASE | t=0.55")]
    for index, x, label in panels:
        reduced = frames[index].resize(frame_size, Image.Resampling.LANCZOS)
        canvas.alpha_composite(reduced, (x, 42))
        baseline_y = 42 + round(854 * scale)
        draw.line((x + 55, baseline_y, x + 230, baseline_y), fill=(255, 230, 80, 255), width=2)
        arm_box = (x + round(60 * scale), 42 + round(430 * scale), x + round(315 * scale), 42 + round(690 * scale))
        draw.rectangle(arm_box, outline=(80, 235, 130, 255) if index == 4 else (67, 173, 255, 255), width=2)
        draw.text((x + 60, 18), label, fill=(255, 255, 255, 255), font=font)
    draw.text((24, 526), "Green = string-arm pulled (full draw) | Blue = string-arm snapped back (release) | Yellow = pinned y=854 baseline", fill=(255, 255, 255, 255), font=font)
    canvas.convert("RGB").save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--board-context", required=True, type=Path)
    args = parser.parse_args()

    if sha256(SOURCE) != SOURCE_SHA256:
        raise SystemExit("approved Neutral Master SHA-256 mismatch")
    if sha256(args.board_context) != BOARD_SHA256:
        raise SystemExit("board review context SHA-256 mismatch")
    idle = json.loads(IDLE_APPROVAL.read_text(encoding="utf-8"))
    if not idle.get("idlePackageApproved") or idle.get("sourceNeutralMaster", {}).get("sha256") != SOURCE_SHA256:
        raise SystemExit("approved Idle overlay or Neutral Master link mismatch")
    move = json.loads(MOVE_APPROVAL.read_text(encoding="utf-8"))
    if not move.get("movePackageApproved") or move.get("sourceNeutralMaster", {}).get("sha256") != SOURCE_SHA256:
        raise SystemExit("approved Move overlay or Neutral Master link mismatch")

    source_image = Image.open(SOURCE)
    if source_image.size != CANVAS or source_image.mode != "RGBA":
        raise SystemExit("approved source must be 640x960 RGBA")
    source = np.asarray(source_image, dtype=np.uint8)
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)

    frames: list[Image.Image] = []
    records = []
    for index in range(FRAME_COUNT):
        path = FRAME_DIR / f"hero.archer_attack_{index:03d}.png"
        if DRAW_ENVELOPE[index] == 0.0 and LEAN_ENVELOPE[index] == 0.0 and CROUCH_ENVELOPE[index] == 0.0:
            # Neutral exit frame: verbatim byte copy of the approved master file
            # (same convention as approved Idle frame 000), never a re-encode.
            shutil.copyfile(SOURCE, path)
            frame = Image.open(path).convert("RGBA")
        else:
            frame = displaced_frame(source, index)
            frame.save(path, optimize=True)
        frames.append(frame.copy())
        metrics = alpha_bounds(frame)
        contacts = foot_metrics(frame)
        records.append({
            "frameIndex": index,
            "path": path.relative_to(ROOT).as_posix(),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
            "dimensions": list(frame.size),
            "mode": frame.mode,
            "role": FRAME_ROLES[index],
            "marker": "projectileRelease" if index == RELEASE_FRAME else None,
            "sourceOperation": "independent premultiplied-alpha draw-and-release displacement from exact approved Neutral Master"
            if index != FRAME_COUNT - 1 else "byte-identical copy of exact approved Neutral Master (neutral exit)",
            "motionParameters": {
                "drawEnvelope": DRAW_ENVELOPE[index],
                "leanEnvelope": LEAN_ENVELOPE[index],
                "crouchEnvelope": CROUCH_ENVELOPE[index],
                "leanAmplitudePixels": LEAN_AMPLITUDE,
                "crouchAmplitudePixels": CROUCH_AMPLITUDE,
                "armPullAmplitudePixels": ARM_PULL_AMPLITUDE,
                "armDropRatio": ARM_DROP_RATIO,
                "feetPinExclusiveY": FEET_PIN_Y,
            },
            "alphaBounds": {k: metrics[k] for k in ("origin", "x", "y", "width", "height")},
            "overallAlphaMaxY": metrics["footBaselineY"],
            "outerBorderNonTransparentPixels": metrics["outerBorderNonTransparentPixels"],
            "footContact": contacts,
            "alphaCentroid": alpha_centroid(frame),
            "stringArmRegionCentroid": arm_region_centroid(frame),
        })

    contact = REVIEW_DIR / "archer-attack-production-v1-contact-sheet.png"
    preview = REVIEW_DIR / "archer-attack-production-v1-sequence-preview.gif"
    board = REVIEW_DIR / "archer-attack-production-v1-board-scale-sample.png"
    diagnostic = REVIEW_DIR / "archer-attack-production-v1-marker-release-diagnostic.png"
    build_contact_sheet(frames, contact)
    build_sequence_preview(frames, preview)
    board_method = build_board_review(frames[RELEASE_FRAME], args.board_context, board)
    build_marker_diagnostic(frames, diagnostic)

    adjacent = [premultiplied_mae(frames[i], frames[i + 1]) for i in range(FRAME_COUNT - 1)]
    source_delta = [premultiplied_mae(source_image, frame) for frame in frames]
    centroids = [record["alphaCentroid"] for record in records]
    arm_centroids = [record["stringArmRegionCentroid"] for record in records]
    release_snap = round(arm_centroids[RELEASE_FRAME][0] - arm_centroids[4][0], 6)
    validation = {
        "reportVersion": 1,
        "packageId": "hero.archer.attack.chibi-production-candidate.v1",
        "generatedAt": "2026-07-19",
        "generator": "tools/generate-archer-attack-production-v1.py",
        "sourceNeutralMaster": {"candidateId": "hero.archer.production-master.candidate.v1", "path": SOURCE.relative_to(ROOT).as_posix(), "sha256": SOURCE_SHA256, "dimensions": list(CANVAS), "mode": "RGBA"},
        "approvedIdle": {"approvalRecord": IDLE_APPROVAL.relative_to(ROOT).as_posix(), "approvalRecordSha256": sha256(IDLE_APPROVAL), "sourcePR": 63, "idlePackageApproved": True},
        "approvedMove": {"approvalRecord": MOVE_APPROVAL.relative_to(ROOT).as_posix(), "approvalRecordSha256": sha256(MOVE_APPROVAL), "sourcePR": 65, "movePackageApproved": True},
        "motion": {"fps": FPS, "frameCount": FRAME_COUNT, "loop": False, "rootMotion": "in-place", "anchor": list(ANCHOR), "runtimeFlipX": True, "eventMarkers": [{"name": "projectileRelease", "normalizedTime": RELEASE_NORMALIZED_TIME, "frameIndex": RELEASE_FRAME}]},
        "frames": records,
        "sequenceContinuity": {
            "metric": "mean absolute difference of premultiplied RGBA normalized to 0..1",
            "adjacentFramePairs": [{"from": i, "to": i + 1, "value": round(value, 9)} for i, value in enumerate(adjacent)],
            "releaseSnapPair4To5": round(adjacent[4], 9),
            "maximumAdjacent": round(max(adjacent), 9),
            "releaseSnapIsMaximumAdjacent": adjacent[4] >= max(adjacent) - 1e-12,
            "settlePair8To9": round(adjacent[-1], 9),
            "entryDeltaFromNeutral": round(source_delta[0], 9),
            "exitFrameByteIdenticalToNeutral": records[-1]["sha256"] == SOURCE_SHA256,
            "sourceDeltaByFrame": [round(value, 9) for value in source_delta],
        },
        "rootMotion": {
            "alphaCentroids": centroids,
            "horizontalCentroidRangePixels": round(max(c[0] for c in centroids) - min(c[0] for c in centroids), 6),
            "verticalCentroidRangePixels": round(max(c[1] for c in centroids) - min(c[1] for c in centroids), 6),
            "accumulatedTranslationPixels": 0,
            "worldTravelBaked": False,
        },
        "drawReleaseEvidence": {
            "stringArmRegion": [60, 430, 255, 260],
            "stringArmRegionCentroidsByFrame": arm_centroids,
            "fullDrawFrame4CentroidXShiftFromNeutral": round(arm_centroids[4][0] - arm_centroids[FRAME_COUNT - 1][0], 6),
            "releaseSnapCentroidXShiftFrames4To5": release_snap,
            "releaseSnapMovesTowardBow": release_snap > 0,
        },
        "anchorDecision": {
            "value": list(ANCHOR),
            "status": "retained-from-approved-idle-and-move-packages",
            "feetPinExclusiveY": FEET_PIN_Y,
            "reason": "Rows y>=800 are byte-identical to the Neutral Master in every frame, so both feet and the y=854 contact baseline are pinned exactly; the approved anchor remains correct with zero foot slide by construction.",
        },
        "markerAlignment": {
            "projectileRelease": {"normalizedTime": RELEASE_NORMALIZED_TIME, "frameIndex": RELEASE_FRAME, "displayedInterval": [0.5, 0.6], "runtimeContractMatch": True},
            "markersChangedFromBaseline": False,
        },
        "reviewArtifacts": [
            {"id": "contact-sheet", "path": contact.relative_to(ROOT).as_posix(), "sha256": sha256(contact), "reviewOnly": True, "runtimeEligible": False},
            {"id": "sequence-preview", "path": preview.relative_to(ROOT).as_posix(), "sha256": sha256(preview), "reviewOnly": True, "runtimeEligible": False},
            {"id": "board-scale-sample", "path": board.relative_to(ROOT).as_posix(), "sha256": sha256(board), "method": board_method, "reviewOnly": True, "runtimeEligible": False},
            {"id": "marker-release-diagnostic", "path": diagnostic.relative_to(ROOT).as_posix(), "sha256": sha256(diagnostic), "sourceFrames": [4, RELEASE_FRAME], "reviewOnly": True, "runtimeEligible": False},
        ],
        "status": {"neutralMasterApproved": True, "idlePackageApproved": True, "movePackageApproved": True, "attackGenerated": True, "attackPackageApproved": False, "canonicalApproved": False, "runtimeEligible": False, "runtimeIntegrated": False},
    }
    METRICS.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")

    source_map = {
        "schemaVersion": 1,
        "assetId": "hero.archer.attack.chibi-production-candidate.v1",
        "unitId": "hero.archer",
        "state": "attack",
        "sourceNeutralMaster": validation["sourceNeutralMaster"] | {"sourcePR": 61, "approvedNeutralMasterSource": True},
        "approvedIdle": validation["approvedIdle"] | {"approvalBranch": "coco/archer-idle-package-exact-file-approval-v1", "approvalSha": "40b334937f394f54c1d1e97b729e37778644ee1e"},
        "approvedMove": validation["approvedMove"] | {"approvalBranch": "coco/archer-move-package-exact-file-approval-v1", "approvalSha": "5305c84e80a7117c69a2f8048f9f5ca76e051d09"},
        "motionContract": validation["motion"],
        "productionMethod": {
            "type": "identity-preserving deterministic draw-and-release displacement",
            "aiRegeneration": False,
            "description": "Every frame independently samples the exact approved Neutral Master. A whole-body taper leans torso and head rigidly toward the bow with an anticipation crouch, a localized string-arm lobe pulls toward viewer-left through full draw and snaps back at the projectileRelease marker, and rows y>=800 are byte-identical so both feet stay planted. Frame 009 is a byte-identical neutral exit. The Move locomotion deformation is not reused.",
            "filter": "bilinear in premultiplied RGBA",
            "feetPinExclusiveY": FEET_PIN_Y,
            "leanAmplitudePixels": LEAN_AMPLITUDE,
            "crouchAmplitudePixels": CROUCH_AMPLITUDE,
            "armPullAmplitudePixels": ARM_PULL_AMPLITUDE,
            "armDropRatio": ARM_DROP_RATIO,
            "drawEnvelope": DRAW_ENVELOPE,
            "leanEnvelope": LEAN_ENVELOPE,
            "crouchEnvelope": CROUCH_ENVELOPE,
            "worldTravelBaked": False,
        },
        "frames": records,
        "attackPackageApproved": False,
        "canonicalApproved": False,
        "runtimeEligible": False,
        "runtimeIntegrated": False,
    }
    SOURCE_MAP.write_text(json.dumps(source_map, indent=2) + "\n", encoding="utf-8")

    sidecar = {
        "schemaVersion": 1,
        "assetId": "hero.archer.attack.chibi-production-candidate.v1",
        "unitId": "hero.archer",
        "state": "attack",
        "fps": FPS,
        "frameCount": FRAME_COUNT,
        "loop": False,
        "anchor": list(ANCHOR),
        "canvas": list(CANVAS),
        "eventMarkers": [{"name": "projectileRelease", "normalizedTime": RELEASE_NORMALIZED_TIME}],
        "rootMotion": "in-place",
        "runtimeFlipX": True,
        "framePathPattern": "attack-chibi-v1/hero.archer_attack_{frame:03d}.png",
        "sourceMap": "attack-chibi-v1/source-map.json",
        "neutralMasterApproved": True,
        "idlePackageApproved": True,
        "movePackageApproved": True,
        "attackPackageApproved": False,
        "canonicalApproved": False,
        "runtimeEligible": False,
        "runtimeIntegrated": False,
    }
    SIDECAR.write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "frames": len(records),
        "source": SOURCE_SHA256,
        "exitFrameByteIdenticalToNeutral": validation["sequenceContinuity"]["exitFrameByteIdenticalToNeutral"],
        "releaseSnap": validation["drawReleaseEvidence"],
        "entryDelta": validation["sequenceContinuity"]["entryDeltaFromNeutral"],
        "maxAdjacent": validation["sequenceContinuity"]["maximumAdjacent"],
        "centroidRange": validation["rootMotion"],
    }, indent=2))


if __name__ == "__main__":
    main()
