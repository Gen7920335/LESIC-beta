#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

LABEL_ADVANCE_UNITS = 6.8
LABEL_GLYPH_WIDTH_UNITS = 5.0
LABEL_LETTER_GAP_RATIO = 0.4
LABEL_TEXT_WIDTH = 1.0
LABEL_OUTLINE_WIDTH = 0.25
LABEL_INNER_OUTLINE_RADIUS = LABEL_TEXT_WIDTH / 2.0 + LABEL_OUTLINE_WIDTH / 2.0
LABEL_OUTER_RADIUS = LABEL_INNER_OUTLINE_RADIUS + LABEL_OUTLINE_WIDTH


FONT = {
    "0":["01110","10001","10011","10101","11001","10001","01110"],
    "1":["00100","01100","00100","00100","00100","00100","01110"],
    "2":["01110","10001","00001","00010","00100","01000","11111"],
    "3":["11110","00001","00001","01110","00001","00001","11110"],
    "4":["00010","00110","01010","10010","11111","00010","00010"],
    "5":["11111","10000","10000","11110","00001","00001","11110"],
    "6":["00110","01000","10000","11110","10001","10001","01110"],
    "7":["11111","00001","00010","00100","01000","01000","01000"],
    "8":["01110","10001","10001","01110","10001","10001","01110"],
    "9":["01110","10001","10001","01111","00001","00010","11100"],
    "A":["01110","10001","10001","11111","10001","10001","10001"],
    "B":["11110","10001","10001","11110","10001","10001","11110"],
    "C":["01111","10000","10000","10000","10000","10000","01111"],
    "D":["11110","10001","10001","10001","10001","10001","11110"],
    "E":["11111","10000","10000","11110","10000","10000","11111"],
    "F":["11111","10000","10000","11110","10000","10000","10000"],
    "G":["01111","10000","10000","10011","10001","10001","01111"],
    "H":["10001","10001","10001","11111","10001","10001","10001"],
    "I":["11111","00100","00100","00100","00100","00100","11111"],
    "J":["00111","00010","00010","00010","00010","10010","01100"],
    "K":["10001","10010","10100","11000","10100","10010","10001"],
    "L":["10000","10000","10000","10000","10000","10000","11111"],
    "M":["10001","11011","10101","10101","10001","10001","10001"],
    "N":["10001","11001","10101","10011","10001","10001","10001"],
    "O":["01110","10001","10001","10001","10001","10001","01110"],
    "P":["11110","10001","10001","11110","10000","10000","10000"],
    "Q":["01110","10001","10001","10001","10101","10010","01101"],
    "R":["11110","10001","10001","11110","10100","10010","10001"],
    "S":["01111","10000","10000","01110","00001","00001","11110"],
    "T":["11111","00100","00100","00100","00100","00100","00100"],
    "U":["10001","10001","10001","10001","10001","10001","01110"],
    "V":["10001","10001","10001","10001","10001","01010","00100"],
    "W":["10001","10001","10001","10101","10101","10101","01010"],
    "X":["10001","10001","01010","00100","01010","10001","10001"],
    "Y":["10001","10001","01010","00100","00100","00100","00100"],
    "Z":["11111","00001","00010","00100","01000","10000","11111"],
    "/":["00001","00010","00010","00100","01000","01000","10000"],
    "_":["00000","00000","00000","00000","00000","00000","11111"],
    "-":["00000","00000","00000","11111","00000","00000","00000"],
    ":":["00000","00100","00100","00000","00100","00100","00000"],
    ".":["00000","00000","00000","00000","00000","01100","01100"],
    " ":["00000","00000","00000","00000","00000","00000","00000"],
    "^":["00100","01010","10001","00000","00000","00000","00000"],
    "°":["00100","01010","00100","00000","00000","00000","00000"],
}


def fmt(v, ndigits=4):
    if isinstance(v, str):
        return v
    if abs(v - round(v)) < 10 ** (-ndigits):
        return str(int(round(v)))
    return f"{v:.{ndigits}f}".rstrip("0").rstrip(".")


def filament_area(diameter):
    return math.pi * (diameter / 2.0) ** 2


def point_on_circle(cx, cy, r, theta_deg):
    th = math.radians(theta_deg)
    return cx + r * math.cos(th), cy + r * math.sin(th)


def arc_points(cx, cy, r, segments, zero_angle_deg, clockwise):
    sign = -1.0 if clockwise else 1.0
    return [point_on_circle(cx, cy, r, zero_angle_deg + sign * 360.0 * i / segments) for i in range(segments + 1)]


def dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def load_presets(path):
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def choose(args, preset, key, fallback):
    val = getattr(args, key)
    if val is not None:
        return val
    if key in preset:
        return preset[key]
    return fallback

def default_square_placement(bed_x, bed_y):
    """
    User-requested placement rule:
    - If usable XY build volume is >= 220 x 220:
      bounding square origin = X10 Y10, circle diameter = 200 mm.
    - If either usable X or Y is below 220:
      bounding square origin = X5 Y5, circle diameter = min(X, Y) - 10 mm.
    """
    if bed_x >= 220 and bed_y >= 220:
        return 10.0, 10.0, 200.0
    return 5.0, 5.0, max(1.0, min(bed_x, bed_y) - 10.0)


def resolve_square_placement(args, preset, bed_x, bed_y):
    default_x, default_y, default_d = default_square_placement(bed_x, bed_y)
    square_x = args.square_x if args.square_x is not None else preset.get("square_x", default_x)
    square_y = args.square_y if args.square_y is not None else preset.get("square_y", default_y)
    circle_diameter = args.circle_diameter if args.circle_diameter is not None else preset.get("circle_diameter", default_d)
    return float(square_x), float(square_y), float(circle_diameter)



def glyph_width_cells(text):
    if not text:
        return 0
    return max(0, len(text) * 6 - 1)


def make_label_lines(cfg):
    band_h = cfg["layers_per_band"] * cfg["layer_height"]
    if cfg["label_layout"] == "one-line":
        return [
            f'{cfg["printer_name"]}/{cfg["filament_name"]}/ND {fmt(cfg["nozzle_size"],2)}mm '
            f'start:{fmt(cfg["start_temp"])}°C/dec:-{fmt(cfg["temp_step"])}°C x {cfg["layers_per_band"]} x {fmt(band_h)}mm '
            f'MAX MVS:{fmt(cfg["mvs_max"])}mm³/s'
        ]
    return [
        f'{cfg["printer_name"]}/{cfg["filament_name"]}/ND {fmt(cfg["nozzle_size"],2)}mm',
        f'start:{fmt(cfg["start_temp"])}°C/dec:-{fmt(cfg["temp_step"])}°C x {cfg["layers_per_band"]} x {fmt(band_h)}mm',
        f'MAX MVS:{fmt(cfg["mvs_max"])}mm³/s',
    ]


def calc_label_height(cfg, lines):
    target_h = cfg["label_height"] if cfg["label_height"] is not None else (10.0 if cfg["circle_diameter"] >= 200 else 5.0)
    available_w = cfg["circle_diameter"] - 2 * cfg["label_margin"]
    available_h = cfg["circle_diameter"] * 0.42
    max_cells = max(glyph_width_cells(s) for s in lines) if lines else 1
    line_count = max(1, len(lines))

    # width at character height H: width = max_cells * H / 7 * label_x_scale
    x_scale = cfg.get("label_x_scale", 0.45)
    fit_h_by_w = available_w * 7.0 / (max_cells * x_scale) if max_cells > 0 else target_h
    # vertical block height approx line_count*H + gaps
    fit_h_by_h = available_h / (line_count + (line_count - 1) * 0.35)
    actual_h = min(target_h, fit_h_by_w, fit_h_by_h) if cfg["label_auto_fit"] else target_h
    return max(0.5, actual_h), target_h



def _chaikin_smooth_open_path(points, iterations=2, ratio=0.22):
    """
    Smooth an open polyline with Chaikin corner cutting.
    Keeps endpoints fixed. This converts sharp CNC-stick corners into cleaner G1 segment curves.
    """
    if iterations <= 0 or len(points) < 3:
        return points
    ratio = max(0.01, min(0.49, float(ratio)))
    pts = list(points)
    for _ in range(iterations):
        new_pts = [pts[0]]
        for p0, p1 in zip(pts[:-1], pts[1:]):
            q = (p0[0] * (1 - ratio) + p1[0] * ratio, p0[1] * (1 - ratio) + p1[1] * ratio)
            r = (p0[0] * ratio + p1[0] * (1 - ratio), p0[1] * ratio + p1[1] * (1 - ratio))
            new_pts.extend([q, r])
        new_pts.append(pts[-1])
        pts = new_pts
    return pts


def emit_label(lines_out, cfg, label_lines, fa):
    if not cfg["label"]:
        return
    cross_section = cfg["line_width"] * cfg["layer_height"]
    char_h, target_h = calc_label_height(cfg, label_lines)
    cell = char_h / 7.0
    line_gap = char_h * 0.35
    widths = [glyph_width_cells(s) * cell for s in label_lines]
    block_h = len(label_lines) * char_h + max(0, len(label_lines) - 1) * line_gap
    top_y = (cfg["square_y"] + cfg["circle_diameter"] / 2.0) + block_h / 2.0 - char_h

    lines_out += [
        "",
        "; ---------- bottom inner label ----------",
        f"; label_layout={cfg['label_layout']}",
        f"; label_target_height={fmt(target_h)}",
        f"; label_actual_height={fmt(char_h)}",
        f"; label_lines={' | '.join(label_lines)}",
        f"; label_smooth_iterations={cfg.get('label_smooth_iterations', 2)}",
        f"; label_smooth_ratio={fmt(cfg.get('label_smooth_ratio', 0.22))}",
        f"; label_raw_points={raw_point_count}",
        f"; label_smoothed_points={smoothed_point_count}",
    ]
    if char_h < target_h:
        lines_out.append("; WARNING: label auto-fit reduced text height to keep it inside the circle.")

    lines_out.append(f"G0 Z{fmt(cfg['layer_height'])} F{fmt(cfg['z_travel_speed'] * 60,1)}")

    e_total = 0.0
    for li, text in enumerate(label_lines):
        y_base = top_y - li * (char_h + line_gap)
        x_cursor = (cfg["square_x"] + cfg["circle_diameter"] / 2.0) - widths[li] / 2.0
        for ch in text:
            glyph = FONT.get(ch.upper(), FONT[" "])
            for row_idx, row in enumerate(glyph):
                col = 0
                while col < 5:
                    if row[col] != "1":
                        col += 1
                        continue
                    run_start = col
                    while col < 5 and row[col] == "1":
                        col += 1
                    run_end = col - 1
                    x0 = x_cursor + run_start * cell
                    x1 = x_cursor + (run_end + 1) * cell
                    y = y_base + (6 - row_idx) * cell
                    length = abs(x1 - x0)
                    e = length * cross_section / fa * cfg["extrusion_multiplier"]
                    e_total += e
                    lines_out.append(f"G0 X{fmt(x0)} Y{fmt(y)} F{fmt(cfg['travel_speed']*60,1)}")
                    lines_out.append(f"G1 X{fmt(x1)} Y{fmt(y)} E{fmt(e,5)} F{fmt(cfg['label_speed']*60,1)} ; label {ch}")
            x_cursor += 6 * cell
    lines_out.append(f"; label_estimated_E_mm={fmt(e_total,3)}")
    lines_out.append("; ---------- end bottom inner label ----------")


# Continuous single-stroke label font.
# This overrides the older bitmap-stroke label emitter.
# It uses exactly one initial G0 move, then only G1 extrusion moves until the label is finished.
STROKE_FONT = {
    "0":[(0,0),(0,7),(5,7),(5,0),(0,0)],
    "1":[(1,5.5),(2.5,7),(2.5,0),(1,0),(4,0)],
    "2":[(0,5.5),(1,7),(5,7),(5,4),(0,0),(5,0)],
    "3":[(0,7),(5,7),(3,3.5),(5,3.5),(5,0),(0,0)],
    "4":[(5,0),(5,7),(0,2.5),(5,2.5)],
    "5":[(5,7),(0,7),(0,3.5),(5,3.5),(5,0),(0,0)],
    "6":[(5,7),(0,3.5),(0,0),(5,0),(5,3.5),(0,3.5)],
    "7":[(0,7),(5,7),(1.5,0)],
    "8":[(0,3.5),(0,7),(5,7),(5,3.5),(0,3.5),(0,0),(5,0),(5,3.5)],
    "9":[(5,3.5),(0,3.5),(0,7),(5,7),(5,0),(0,0)],
    "A":[(0,0),(0,5),(2.5,7),(5,5),(5,0),(5,3.5),(0,3.5)],
    "B":[(0,0),(0,7),(4,7),(5,6),(5,4.5),(4,3.5),(0,3.5),(4,3.5),(5,2.5),(5,1),(4,0),(0,0)],
    "C":[(5,7),(0,7),(0,0),(5,0)],
    "D":[(0,0),(0,7),(3.5,7),(5,5.5),(5,1.5),(3.5,0),(0,0)],
    "E":[(5,7),(0,7),(0,3.5),(3.8,3.5),(0,3.5),(0,0),(5,0)],
    "F":[(5,7),(0,7),(0,3.5),(3.8,3.5),(0,3.5),(0,0)],
    "G":[(5,7),(0,7),(0,0),(5,0),(5,3),(3,3)],
    "H":[(0,0),(0,7),(0,3.5),(5,3.5),(5,7),(5,0)],
    "I":[(0,7),(5,7),(2.5,7),(2.5,0),(0,0),(5,0)],
    "J":[(5,7),(5,0),(2,0),(0,2)],
    "K":[(0,0),(0,7),(0,3.5),(5,7),(0,3.5),(5,0)],
    "L":[(0,7),(0,0),(5,0)],
    "M":[(0,0),(0,7),(2.5,3),(5,7),(5,0)],
    "N":[(0,0),(0,7),(5,0),(5,7)],
    "O":[(0,0),(0,7),(5,7),(5,0),(0,0)],
    "P":[(0,0),(0,7),(5,7),(5,3.5),(0,3.5)],
    "Q":[(0,0),(0,7),(5,7),(5,0),(0,0),(3.2,1.5),(5,0)],
    "R":[(0,0),(0,7),(5,7),(5,3.5),(0,3.5),(5,0)],
    "S":[(5,7),(0,7),(0,3.5),(5,3.5),(5,0),(0,0)],
    "T":[(0,7),(5,7),(2.5,7),(2.5,0)],
    "U":[(0,7),(0,0),(5,0),(5,7)],
    "V":[(0,7),(2.5,0),(5,7)],
    "W":[(0,7),(1,0),(2.5,4),(4,0),(5,7)],
    "X":[(0,7),(5,0),(2.5,3.5),(5,7),(0,0)],
    "Y":[(0,7),(2.5,3.5),(5,7),(2.5,3.5),(2.5,0)],
    "Z":[(0,7),(5,7),(0,0),(5,0)],
    "/":[(0,0),(5,7)],
    "_":[(0,0),(5,0)],
    "-":[(0,3.5),(5,3.5)],
    ":":[(2.5,5.5),(2.5,5.0),(2.5,2.0),(2.5,1.5)],
    ".":[(2.3,0),(2.7,0)],
    "°":[(2,5),(2,7),(4,7),(4,5),(2,5)],
    "^":[(0,0),(2.5,7),(5,0)],
    " ":[(0,0),(5,0)],
}


def emit_label(lines_out, cfg, label_lines, fa):
    """Emit bottom label as a single continuous extruded path."""
    if not cfg["label"]:
        return

    cross_section = cfg["line_width"] * cfg["layer_height"]
    char_h, target_h = calc_label_height(cfg, label_lines)
    cell = char_h / 7.0
    line_gap = char_h * 0.35

    widths = [glyph_width_cells(s) * cell for s in label_lines]
    block_h = len(label_lines) * char_h + max(0, len(label_lines) - 1) * line_gap
    center_x = cfg["square_x"] + cfg["circle_diameter"] / 2.0
    center_y = cfg["square_y"] + cfg["circle_diameter"] / 2.0
    top_y = center_y + block_h / 2.0 - char_h

    lines_out += [
        "",
        "; ---------- bottom inner label ----------",
        "; label_toolpath=continuous_single_stroke",
        "; label_no_internal_travel=1",
        f"; label_layout={cfg['label_layout']}",
        f"; label_target_height={fmt(target_h)}",
        f"; label_actual_height={fmt(char_h)}",
        f"; label_lines={' | '.join(label_lines)}",
        f"; label_smooth_iterations={cfg.get('label_smooth_iterations', 2)}",
        f"; label_smooth_ratio={fmt(cfg.get('label_smooth_ratio', 0.22))}",
        f"; label_raw_points={raw_point_count}",
        f"; label_smoothed_points={smoothed_point_count}",
    ]
    if char_h < target_h:
        lines_out.append("; WARNING: label auto-fit reduced text height to keep it inside the circle.")

    # Build one continuous point list.
    points = []
    for li, text in enumerate(label_lines):
        y_base = top_y - li * (char_h + line_gap)
        x_cursor = center_x - widths[li] / 2.0
        for ch in text:
            glyph = STROKE_FONT.get(ch.upper(), STROKE_FONT[" "])
            for gx, gy in glyph:
                points.append((x_cursor + gx * cell, y_base + gy * cell))
            x_cursor += 6 * cell

    if len(points) < 2:
        lines_out.append("; label skipped: not enough points")
        lines_out.append("; ---------- end bottom inner label ----------")
        return

    lines_out.append(f"G0 Z{fmt(cfg['layer_height'])} F{fmt(cfg['z_travel_speed'] * 60,1)}")
    lines_out.append(f"G0 X{fmt(points[0][0])} Y{fmt(points[0][1])} F{fmt(cfg['travel_speed']*60,1)} ; label start, only travel move")
    e_total = 0.0
    prev = points[0]
    for pt in points[1:]:
        length = ((pt[0] - prev[0]) ** 2 + (pt[1] - prev[1]) ** 2) ** 0.5
        if length > 0:
            e = length * cross_section / fa * cfg["extrusion_multiplier"]
            e_total += e
            lines_out.append(f"G1 X{fmt(pt[0])} Y{fmt(pt[1])} E{fmt(e,5)} F{fmt(cfg['label_speed']*60,1)} ; continuous label")
        prev = pt

    lines_out.append(f"; label_estimated_E_mm={fmt(e_total,3)}")
    lines_out.append("; ---------- end bottom inner label ----------")


# FDM-safe connected label font.
# This intentionally differs from Hershey/normal single-line fonts:
# every glyph has a left-mid entry and right-mid exit, so whole lines can be connected without pen-up.
# Closed-loop glyphs are deliberately opened/simplified to avoid islands and retracing.
SAFE_CONNECTED_FONT = {
    "0":[(0,3.5),(0.6,6.4),(2.5,7),(4.4,6.4),(5,3.5),(4.4,0.6),(2.5,0),(0.6,0.6),(0,3.5),(5,3.5)],
    "1":[(0,3.5),(2.1,6.5),(2.8,7),(2.8,0),(5,3.5)],
    "2":[(0,3.5),(0.8,6.7),(4.6,6.7),(5,5),(0.5,0.3),(5,0.3),(5,3.5)],
    "3":[(0,3.5),(4.6,6.7),(1.6,3.7),(4.8,3.3),(4.6,0.4),(0.5,0.4),(5,3.5)],
    "4":[(0,3.5),(4.2,7),(4.2,0),(4.2,3.5),(0.8,3.5),(5,3.5)],
    "5":[(0,3.5),(0.7,6.8),(4.8,6.8),(0.7,3.6),(4.8,3.2),(4.5,0.4),(0.5,0.4),(5,3.5)],
    "6":[(0,3.5),(1.3,6.8),(4.6,6.8),(1.0,3.5),(0.7,0.8),(4.5,0.8),(4.6,3.2),(1.0,3.5),(5,3.5)],
    "7":[(0,3.5),(0.4,6.8),(5,6.8),(1.7,0.2),(5,3.5)],
    "8":[(0,3.5),(1.0,6.7),(4.3,6.7),(4.5,4.3),(0.8,2.8),(0.8,0.7),(4.4,0.7),(4.6,3.0),(1.0,4.2),(0,3.5),(5,3.5)],
    "9":[(0,3.5),(4.5,3.5),(4.4,6.6),(0.9,6.6),(0.8,3.8),(4.4,3.5),(3.7,0.3),(0.7,0.3),(5,3.5)],

    "A":[(0,3.5),(1.2,0),(2.5,7),(3.8,0),(2.9,3.0),(1.8,3.0),(5,3.5)],
    "B":[(0,3.5),(0.6,6.8),(3.9,6.5),(4.7,5.0),(3.8,3.8),(1.0,3.5),(4.0,3.2),(4.8,1.2),(3.8,0.4),(0.6,0.4),(5,3.5)],
    "C":[(0,3.5),(1.0,6.8),(5,6.5),(1.0,6.8),(0.6,0.8),(5,0.5),(5,3.5)],
    "D":[(0,3.5),(0.6,6.8),(3.6,6.5),(5,4.8),(5,2.0),(3.6,0.5),(0.6,0.4),(5,3.5)],
    "E":[(0,3.5),(0.6,6.8),(5,6.8),(0.6,6.8),(0.6,3.5),(4.0,3.5),(0.6,3.5),(0.6,0.4),(5,0.4),(5,3.5)],
    "F":[(0,3.5),(0.6,6.8),(5,6.8),(0.6,6.8),(0.6,3.5),(4.0,3.5),(0.6,3.5),(0.6,0.4),(5,3.5)],
    "G":[(0,3.5),(1.0,6.8),(5,6.4),(1.0,6.8),(0.7,0.7),(5,0.7),(5,3.2),(3.0,3.2),(5,3.5)],
    "H":[(0,3.5),(0.6,6.8),(0.6,3.5),(4.4,3.5),(4.4,6.8),(4.4,0.4),(5,3.5)],
    "I":[(0,3.5),(0.8,6.8),(4.2,6.8),(2.5,6.8),(2.5,0.4),(0.8,0.4),(4.2,0.4),(5,3.5)],
    "J":[(0,3.5),(4.4,6.8),(4.4,0.8),(2.5,0.2),(0.7,1.3),(5,3.5)],
    "K":[(0,3.5),(0.6,6.8),(0.6,3.5),(4.8,6.8),(0.9,3.5),(4.8,0.3),(5,3.5)],
    "L":[(0,3.5),(0.6,6.8),(0.6,0.4),(5,0.4),(5,3.5)],
    "M":[(0,3.5),(0.5,0.3),(0.7,6.8),(2.5,2.5),(4.3,6.8),(4.5,0.3),(5,3.5)],
    "N":[(0,3.5),(0.6,0.3),(0.6,6.8),(4.4,0.3),(4.4,6.8),(5,3.5)],
    "O":[(0,3.5),(0.6,6.4),(2.5,7),(4.4,6.4),(5,3.5),(4.4,0.6),(2.5,0),(0.6,0.6),(0,3.5),(5,3.5)],
    "P":[(0,3.5),(0.6,0.3),(0.6,6.8),(4.3,6.6),(4.8,4.6),(3.8,3.4),(0.8,3.4),(5,3.5)],
    "Q":[(0,3.5),(0.6,6.4),(2.5,7),(4.4,6.4),(5,3.5),(4.4,0.6),(2.5,0),(0.6,0.6),(0,3.5),(3.2,1.5),(5,0.2),(5,3.5)],
    "R":[(0,3.5),(0.6,0.3),(0.6,6.8),(4.3,6.6),(4.8,4.6),(3.8,3.4),(0.8,3.4),(4.9,0.3),(5,3.5)],
    "S":[(0,3.5),(4.8,6.7),(0.6,6.7),(0.6,3.7),(4.5,3.2),(4.5,0.5),(0.5,0.5),(5,3.5)],
    "T":[(0,3.5),(0.5,6.8),(4.5,6.8),(2.5,6.8),(2.5,0.4),(5,3.5)],
    "U":[(0,3.5),(0.6,6.8),(0.7,0.8),(2.5,0.2),(4.3,0.8),(4.4,6.8),(5,3.5)],
    "V":[(0,3.5),(0.6,6.8),(2.5,0.2),(4.4,6.8),(5,3.5)],
    "W":[(0,3.5),(0.5,6.8),(1.4,0.3),(2.5,3.8),(3.6,0.3),(4.5,6.8),(5,3.5)],
    "X":[(0,3.5),(0.6,6.8),(4.4,0.3),(2.5,3.5),(4.4,6.8),(0.6,0.3),(5,3.5)],
    "Y":[(0,3.5),(0.6,6.8),(2.5,3.5),(4.4,6.8),(2.5,3.5),(2.5,0.3),(5,3.5)],
    "Z":[(0,3.5),(0.5,6.8),(4.8,6.8),(0.5,0.4),(4.8,0.4),(5,3.5)],

    "/":[(0,3.5),(1.0,0.3),(4.0,6.8),(5,3.5)],
    "_":[(0,3.5),(1.0,0.4),(4.0,0.4),(5,3.5)],
    "-":[(0,3.5),(5,3.5)],
    ":":[(0,3.5),(2.4,5.2),(2.6,5.2),(2.5,3.5),(2.4,1.8),(2.6,1.8),(5,3.5)],
    ".":[(0,3.5),(2.4,0.5),(2.6,0.5),(5,3.5)],
    "°":[(0,3.5),(2.0,6.1),(2.0,6.8),(3.0,6.8),(3.0,6.1),(2.0,6.1),(5,3.5)],
    "³":[(0,3.5),(1.2,6.8),(4.2,6.8),(3.0,5.6),(4.2,5.6),(4.2,4.2),(1.2,4.2),(5,3.5)],
    "^":[(0,3.5),(2.5,6.8),(5,3.5)],
    " ":[(0,3.5),(5,3.5)],
}


def _line_width_cells(text):
    return max(0, len(text) * 6 - 1)


def _glyph_points_for_char(ch, x0, y0, cell, x_scale=0.45, reverse=False):
    pts = SAFE_CONNECTED_FONT.get(ch.upper(), SAFE_CONNECTED_FONT[" "])
    if reverse:
        pts = list(reversed(pts))
    return [(x0 + gx * cell * x_scale, y0 + gy * cell) for gx, gy in pts]


def _build_boustrophedon_label_points(cfg, label_lines, char_h):
    """
    Build one continuous non-lift label path:
    - line 0 left->right
    - line 1 right->left
    - line 2 left->right
    - connectors between lines are routed outside the text block.
    """
    cell = char_h / 7.0
    x_scale = cfg.get("label_x_scale", 0.45)
    line_gap = char_h * 0.65
    center_x = cfg["square_x"] + cfg["circle_diameter"] / 2.0
    center_y = cfg["square_y"] + cfg["circle_diameter"] / 2.0

    widths = [_line_width_cells(s) * cell * x_scale for s in label_lines]
    max_w = max(widths) if widths else 0
    block_h = len(label_lines) * char_h + max(0, len(label_lines)-1) * line_gap
    top_y = center_y + block_h / 2.0 - char_h

    # Router margins outside text block, still inside the circle.
    route_margin = max(2.0 * cell, 1.2)
    left_route_x = center_x - max_w / 2.0 - route_margin
    right_route_x = center_x + max_w / 2.0 + route_margin

    all_points = []
    line_start_end = []
    for li, text in enumerate(label_lines):
        y0 = top_y - li * (char_h + line_gap)
        line_w = widths[li]
        x_left = center_x - line_w / 2.0
        direction_ltr = (li % 2 == 0)

        line_points = []
        if direction_ltr:
            chars = list(enumerate(text))
            for ci, ch in chars:
                x0 = x_left + ci * 6 * cell * x_scale
                pts = _glyph_points_for_char(ch, x0, y0, cell, x_scale=x_scale, reverse=False)
                line_points.extend(pts)
        else:
            # Visual text remains normal left-to-right; traversal is right-to-left.
            chars = list(enumerate(text))
            for ci, ch in reversed(chars):
                x0 = x_left + ci * 6 * cell * x_scale
                pts = _glyph_points_for_char(ch, x0, y0, cell, x_scale=x_scale, reverse=True)
                line_points.extend(pts)

        if not all_points:
            all_points.extend(line_points)
        else:
            prev = all_points[-1]
            first = line_points[0]
            # Route down the outside of the text block on the side where the previous line ended.
            if li % 2 == 1:
                # previous ended right; next starts right
                all_points.extend([(right_route_x, prev[1]), (right_route_x, first[1]), first])
            else:
                # previous ended left; next starts left
                all_points.extend([(left_route_x, prev[1]), (left_route_x, first[1]), first])
            all_points.extend(line_points[1:])

    return all_points, {
        "cell": cell,
        "char_h": char_h,
        "max_width": max_w,
        "left_route_x": left_route_x,
        "right_route_x": right_route_x,
    }


def emit_label(lines_out, cfg, label_lines, fa):
    """
    Emit bottom label as FDM-safe connected single-stroke path.
    The 3-line visual layout is preserved, but traversal alternates direction per line.
    """
    if not cfg["label"]:
        return

    cross_section = cfg["line_width"] * cfg["layer_height"]
    char_h, target_h = calc_label_height(cfg, label_lines)

    # Safety shrink: leave room for outside route rails.
    max_allowed_h = 10.0 if cfg["circle_diameter"] >= 200 else 5.0
    if char_h > max_allowed_h:
        char_h = max_allowed_h

    points, info = _build_boustrophedon_label_points(cfg, label_lines, char_h)
    raw_point_count = len(points)
    points = _chaikin_smooth_open_path(
        points,
        iterations=cfg.get("label_smooth_iterations", 2),
        ratio=cfg.get("label_smooth_ratio", 0.22),
    )
    smoothed_point_count = len(points)

    lines_out += [
        "",
        "; ---------- bottom inner label ----------",
        "; label_toolpath=fdm_safe_smoothed_condensed_connected_single_stroke",
        "; label_visual_layout=three_line_default",
        "; label_path_rule=boustrophedon_lines_with_outer_rail_connectors_condensed_font",
        "; label_no_internal_travel=1",
        "; label_no_retract=1",
        "; label_no_z_hop=1",
        f"; label_layout={cfg['label_layout']}",
        f"; label_target_height={fmt(target_h)}",
        f"; label_actual_height={fmt(char_h)}",
        f"; label_lines={' | '.join(label_lines)}",
        f"; label_smooth_iterations={cfg.get('label_smooth_iterations', 2)}",
        f"; label_smooth_ratio={fmt(cfg.get('label_smooth_ratio', 0.22))}",
        f"; label_raw_points={raw_point_count}",
        f"; label_smoothed_points={smoothed_point_count}",
        f"; label_route_left_x={fmt(info['left_route_x'])}",
        f"; label_route_right_x={fmt(info['right_route_x'])}",
    ]
    if char_h < target_h:
        lines_out.append("; WARNING: label auto-fit reduced text height to keep it inside the circle and route rails.")

    if len(points) < 2:
        lines_out.append("; label skipped: not enough points")
        lines_out.append("; ---------- end bottom inner label ----------")
        return

    lines_out.append(f"G0 Z{fmt(cfg['layer_height'])} F{fmt(cfg['z_travel_speed'] * 60,1)}")
    lines_out.append(f"G0 X{fmt(points[0][0])} Y{fmt(points[0][1])} F{fmt(cfg['travel_speed']*60,1)} ; label start, only travel move")
    e_total = 0.0
    prev = points[0]
    for pt in points[1:]:
        length = ((pt[0] - prev[0]) ** 2 + (pt[1] - prev[1]) ** 2) ** 0.5
        if length > 0:
            e = length * cross_section / fa * cfg["extrusion_multiplier"]
            e_total += e
            lines_out.append(f"G1 X{fmt(pt[0])} Y{fmt(pt[1])} E{fmt(e,5)} F{fmt(cfg['label_speed']*60,1)} ; fdm-safe connected label")
        prev = pt

    lines_out.append(f"; label_estimated_E_mm={fmt(e_total,3)}")
    lines_out.append("; ---------- end bottom inner label ----------")


# txt.shx-like connected stroke font.
# Design goal:
# - Straight engineering-style line glyphs similar in spirit to AutoCAD txt.shx.
# - Each glyph is one open polyline.
# - Characters are connected by drawing directly from previous glyph end point to next glyph start point.
# - Visual text remains 3 lines. Line-to-line moves are routed outside text block, not diagonally across text.
TXT_SHX_LIKE_FONT = {
    "0":[(0,0),(0,7),(5,7),(5,0),(0,0),(5,7)],
    "1":[(1,5.5),(2.5,7),(2.5,0),(1,0),(4,0)],
    "2":[(0,5.5),(1,7),(5,7),(5,4.5),(0,0),(5,0)],
    "3":[(0,7),(5,7),(3,3.5),(5,3.5),(5,0),(0,0)],
    "4":[(5,0),(5,7),(0,2.5),(5,2.5)],
    "5":[(5,7),(0,7),(0,3.5),(5,3.5),(5,0),(0,0)],
    "6":[(5,7),(0,3.5),(0,0),(5,0),(5,3.5),(0,3.5)],
    "7":[(0,7),(5,7),(1.5,0)],
    "8":[(0,3.5),(0,7),(5,7),(5,3.5),(0,3.5),(0,0),(5,0),(5,3.5)],
    "9":[(5,3.5),(0,3.5),(0,7),(5,7),(5,0),(0,0)],
    "A":[(0,0),(2.5,7),(5,0),(3.8,3),(1.2,3)],
    "B":[(0,0),(0,7),(4,7),(5,6),(5,4.2),(4,3.5),(0,3.5),(4,3.5),(5,2.8),(5,1),(4,0),(0,0)],
    "C":[(5,7),(0,7),(0,0),(5,0)],
    "D":[(0,0),(0,7),(3.5,7),(5,5.5),(5,1.5),(3.5,0),(0,0)],
    "E":[(5,7),(0,7),(0,3.5),(3.8,3.5),(0,3.5),(0,0),(5,0)],
    "F":[(5,7),(0,7),(0,3.5),(3.8,3.5),(0,3.5),(0,0)],
    "G":[(5,7),(0,7),(0,0),(5,0),(5,3),(3,3)],
    "H":[(0,0),(0,7),(0,3.5),(5,3.5),(5,7),(5,0)],
    "I":[(0,7),(5,7),(2.5,7),(2.5,0),(0,0),(5,0)],
    "J":[(5,7),(5,0),(2,0),(0,2)],
    "K":[(0,0),(0,7),(0,3.5),(5,7),(0,3.5),(5,0)],
    "L":[(0,7),(0,0),(5,0)],
    "M":[(0,0),(0,7),(2.5,3),(5,7),(5,0)],
    "N":[(0,0),(0,7),(5,0),(5,7)],
    "O":[(0,0),(0,7),(5,7),(5,0),(0,0)],
    "P":[(0,0),(0,7),(5,7),(5,3.5),(0,3.5)],
    "Q":[(0,0),(0,7),(5,7),(5,0),(0,0),(3.2,1.5),(5,0)],
    "R":[(0,0),(0,7),(5,7),(5,3.5),(0,3.5),(5,0)],
    "S":[(5,7),(0,7),(0,3.5),(5,3.5),(5,0),(0,0)],
    "T":[(0,7),(5,7),(2.5,7),(2.5,0)],
    "U":[(0,7),(0,0),(5,0),(5,7)],
    "V":[(0,7),(2.5,0),(5,7)],
    "W":[(0,7),(1,0),(2.5,4),(4,0),(5,7)],
    "X":[(0,7),(5,0),(2.5,3.5),(5,7),(0,0)],
    "Y":[(0,7),(2.5,3.5),(5,7),(2.5,3.5),(2.5,0)],
    "Z":[(0,7),(5,7),(0,0),(5,0)],
    "/":[(0,0),(5,7)],
    "_":[(0,0),(5,0)],
    "-":[(0,3.5),(5,3.5)],
    ":":[(2.5,5.4),(2.5,5.0),(2.5,2.0),(2.5,1.6)],
    ".":[(2.4,0),(2.7,0)],
    "°":[(2,5),(2,7),(4,7),(4,5),(2,5)],
    "^":[(0,0),(2.5,7),(5,0)],
    " ":[(0,3.5),(5,3.5)],
}


def _txt_line_width_units(text):
    return max(0, len(text) * 6 - 1)


def _txt_glyph_points(ch, x0, y0, cell, x_scale):
    pts = TXT_SHX_LIKE_FONT.get(ch.upper(), TXT_SHX_LIKE_FONT[" "])
    return [(x0 + gx * cell * x_scale, y0 + gy * cell) for gx, gy in pts]


def _build_txt_shx_connected_points(cfg, label_lines, char_h):
    """
    Build a connected txt.shx-like path:
    - Glyphs are drawn left-to-right on each visual line.
    - Within a line, the end point of one glyph is connected directly to the start point of the next glyph.
    - Between lines, route around the outside rail to avoid long diagonal crossings through the text block.
    """
    cell = char_h / 7.0
    x_scale = cfg.get("label_x_scale", 0.55)
    line_gap = char_h * 0.65
    center_x = cfg["square_x"] + cfg["circle_diameter"] / 2.0
    center_y = cfg["square_y"] + cfg["circle_diameter"] / 2.0

    widths = [_txt_line_width_units(s) * cell * x_scale for s in label_lines]
    max_w = max(widths) if widths else 0
    block_h = len(label_lines) * char_h + max(0, len(label_lines)-1) * line_gap
    top_y = center_y + block_h / 2.0 - char_h

    route_margin = max(2.0 * cell * x_scale, 1.2)
    right_route_x = center_x + max_w / 2.0 + route_margin

    all_points = []
    for li, text in enumerate(label_lines):
        y0 = top_y - li * (char_h + line_gap)
        line_w = widths[li]
        x_left = center_x - line_w / 2.0

        line_points = []
        for ci, ch in enumerate(text):
            x0 = x_left + ci * 6 * cell * x_scale
            glyph = _txt_glyph_points(ch, x0, y0, cell, x_scale)
            if line_points and glyph:
                # direct connector: previous glyph endpoint -> current glyph startpoint
                # no extra routing inside the line; the G1 to glyph[0] itself is the connector.
                line_points.append(glyph[0])
                line_points.extend(glyph[1:])
            else:
                line_points.extend(glyph)

        if not all_points:
            all_points.extend(line_points)
        else:
            prev = all_points[-1]
            first = line_points[0]
            # Route between lines outside the right side of the text block.
            all_points.extend([(right_route_x, prev[1]), (right_route_x, first[1]), first])
            all_points.extend(line_points[1:])

    return all_points, {
        "cell": cell,
        "char_h": char_h,
        "max_width": max_w,
        "right_route_x": right_route_x,
        "x_scale": x_scale,
    }


def emit_label(lines_out, cfg, label_lines, fa):
    """
    Emit bottom label with txt.shx-like connected single-line font.
    Text is 3 visual lines; glyph-to-glyph links are direct endpoint-to-startpoint G1 moves.
    """
    if not cfg["label"]:
        return

    cross_section = cfg["line_width"] * cfg["layer_height"]
    char_h, target_h = calc_label_height(cfg, label_lines)

    max_allowed_h = 10.0 if cfg["circle_diameter"] >= 200 else 5.0
    if char_h > max_allowed_h:
        char_h = max_allowed_h

    points, info = _build_txt_shx_connected_points(cfg, label_lines, char_h)
    raw_point_count = len(points)

    # Optional smoothing remains available, default is 0 for txt.shx look.
    points = _chaikin_smooth_open_path(
        points,
        iterations=cfg.get("label_smooth_iterations", 0),
        ratio=cfg.get("label_smooth_ratio", 0.22),
    )
    smoothed_point_count = len(points)

    lines_out += [
        "",
        "; ---------- bottom inner label ----------",
        "; label_toolpath=txt_shx_like_endpoint_connected_single_stroke",
        "; label_visual_layout=three_line_default",
        "; label_path_rule=glyph_endpoint_to_next_glyph_startpoint",
        "; line_to_line_rule=right_outer_rail_connector",
        "; label_no_internal_travel=1",
        "; label_no_retract=1",
        "; label_no_z_hop=1",
        f"; label_layout={cfg['label_layout']}",
        f"; label_target_height={fmt(target_h)}",
        f"; label_actual_height={fmt(char_h)}",
        f"; label_x_scale={fmt(cfg.get('label_x_scale', 0.55))}",
        f"; label_lines={' | '.join(label_lines)}",
        f"; label_smooth_iterations={cfg.get('label_smooth_iterations', 0)}",
        f"; label_smooth_ratio={fmt(cfg.get('label_smooth_ratio', 0.22))}",
        f"; label_raw_points={raw_point_count}",
        f"; label_smoothed_points={smoothed_point_count}",
        f"; label_route_right_x={fmt(info['right_route_x'])}",
    ]

    if len(points) < 2:
        lines_out.append("; label skipped: not enough points")
        lines_out.append("; ---------- end bottom inner label ----------")
        return

    lines_out.append(f"G0 Z{fmt(cfg['layer_height'])} F{fmt(cfg['z_travel_speed'] * 60,1)}")
    lines_out.append(f"G0 X{fmt(points[0][0])} Y{fmt(points[0][1])} F{fmt(cfg['travel_speed']*60,1)} ; label start, only travel move")

    e_total = 0.0
    prev = points[0]
    for pt in points[1:]:
        length = ((pt[0] - prev[0]) ** 2 + (pt[1] - prev[1]) ** 2) ** 0.5
        if length > 0:
            e = length * cross_section / fa * cfg["extrusion_multiplier"]
            e_total += e
            lines_out.append(f"G1 X{fmt(pt[0])} Y{fmt(pt[1])} E{fmt(e,5)} F{fmt(cfg['label_speed']*60,1)} ; txt.shx-like connected label")
        prev = pt

    lines_out.append(f"; label_estimated_E_mm={fmt(e_total,3)}")
    lines_out.append("; ---------- end bottom inner label ----------")


# v10: txt.shx-like multi-stroke glyphs.
# This version is closer to the SHX/TXT concept:
# each glyph contains one or more strokes.
# Original SHX would pen-up between strokes; here every pen-up is converted to a printed G1 connector:
# previous stroke end -> next stroke start, and glyph end -> next glyph start.
TXT_SHX_STROKE_FONT = {
    "0":[[(0,0),(0,7),(5,7),(5,0),(0,0),(5,7)]],
    "1":[[(2.5,0),(2.5,7)],[(1.2,5.8),(2.5,7)],[(1.0,0),(4.0,0)]],
    "2":[[(0,5.5),(1,7),(5,7),(5,4.8),(0,0),(5,0)]],
    "3":[[(0,7),(5,7),(3.0,3.5),(5,3.5),(5,0),(0,0)]],
    "4":[[(5,0),(5,7),(0,2.5),(5,2.5)]],
    "5":[[(5,7),(0,7),(0,3.5),(5,3.5),(5,0),(0,0)]],
    "6":[[(5,7),(0,3.5),(0,0),(5,0),(5,3.5),(0,3.5)]],
    "7":[[(0,7),(5,7),(1.5,0)]],
    "8":[[(0,0),(0,7),(5,7),(5,0),(0,0)],[(0,3.5),(5,3.5)]],
    "9":[[(5,3.5),(0,3.5),(0,7),(5,7),(5,0),(0,0)]],

    "A":[[(0,0),(2.5,7),(5,0)],[(1.2,3),(3.8,3)]],
    "B":[[(0,0),(0,7),(4,7),(5,6),(5,4.3),(4,3.5),(0,3.5)],[(0,3.5),(4,3.5),(5,2.7),(5,1),(4,0),(0,0)]],
    "C":[[(5,7),(0,7),(0,0),(5,0)]],
    "D":[[(0,0),(0,7),(3.5,7),(5,5.5),(5,1.5),(3.5,0),(0,0)]],
    "E":[[(5,7),(0,7),(0,0),(5,0)],[(0,3.5),(3.8,3.5)]],
    "F":[[(0,0),(0,7),(5,7)],[(0,3.5),(3.8,3.5)]],
    "G":[[(5,7),(0,7),(0,0),(5,0),(5,3),(3,3)]],
    "H":[[(0,0),(0,7)],[(5,0),(5,7)],[(0,3.5),(5,3.5)]],
    "I":[[(0,7),(5,7)],[(2.5,7),(2.5,0)],[(0,0),(5,0)]],
    "J":[[(5,7),(5,0),(2,0),(0,2)]],
    "K":[[(0,0),(0,7)],[(5,7),(0,3.5),(5,0)]],
    "L":[[(0,7),(0,0),(5,0)]],
    "M":[[(0,0),(0,7),(2.5,3),(5,7),(5,0)]],
    "N":[[(0,0),(0,7),(5,0),(5,7)]],
    "O":[[(0,0),(0,7),(5,7),(5,0),(0,0)]],
    "P":[[(0,0),(0,7),(5,7),(5,3.5),(0,3.5)]],
    "Q":[[(0,0),(0,7),(5,7),(5,0),(0,0)],[(3.0,1.5),(5,0)]],
    "R":[[(0,0),(0,7),(5,7),(5,3.5),(0,3.5)],[(0,3.5),(5,0)]],
    "S":[[(5,7),(0,7),(0,3.5),(5,3.5),(5,0),(0,0)]],
    "T":[[(0,7),(5,7)],[(2.5,7),(2.5,0)]],
    "U":[[(0,7),(0,0),(5,0),(5,7)]],
    "V":[[(0,7),(2.5,0),(5,7)]],
    "W":[[(0,7),(1,0),(2.5,4),(4,0),(5,7)]],
    "X":[[(0,7),(5,0),(2.5,3.5),(5,7),(0,0)]],
    "Y":[[(0,7),(2.5,3.5),(5,7)],[(2.5,3.5),(2.5,0)]],
    "Z":[[(0,7),(5,7),(0,0),(5,0)]],

    "/":[[(0,0),(5,7)]],
    "_":[[(0,0),(5,0)]],
    "-":[[(0,3.5),(5,3.5)]],
    ":":[[(2.3,5.7),(2.7,5.7),(2.7,5.3),(2.3,5.3),(2.3,5.7)],[(2.3,1.7),(2.7,1.7),(2.7,1.3),(2.3,1.3),(2.3,1.7)]],
    ".":[[(2.32,0.22),(2.68,0.22),(2.68,0.58),(2.32,0.58),(2.32,0.22)]],
    "°":[[(2,5),(2,7),(4,7),(4,5),(2,5)]],
    "³":[[(1.2,7),(4.2,7),(3.0,5.6),(4.2,5.6),(4.2,4.2),(1.2,4.2)]],
    "^":[[(0,0),(2.5,7),(5,0)]],
    " ":[]
}


def _txt_stroke_line_width_units(text):
    return max(0, len(text) * LABEL_ADVANCE_UNITS - (LABEL_ADVANCE_UNITS - 1))


def _label_advance_units(cell, x_scale, line_width):
    target_advance = LABEL_GLYPH_WIDTH_UNITS * (1.0 + LABEL_LETTER_GAP_RATIO)
    return max(LABEL_ADVANCE_UNITS, target_advance)


def _transform_stroke_point(pt, x0, y0, cell, x_scale):
    gx, gy = pt
    return (x0 + gx * cell * x_scale, y0 + gy * cell)


def _txt_shx_glyph_connected_points(ch, x0, y0, cell, x_scale):
    """
    Convert multi-stroke SHX-like glyph to one connected printed path:
    stroke end -> next stroke start is intentionally emitted as a connector.
    """
    strokes = TXT_SHX_STROKE_FONT.get(ch.upper(), TXT_SHX_STROKE_FONT[" "])
    pts_out = []
    for stroke in strokes:
        if not stroke:
            continue
        stroke_pts = [_transform_stroke_point(p, x0, y0, cell, x_scale) for p in stroke]
        if pts_out:
            # connector from previous stroke end to next stroke start
            pts_out.append(stroke_pts[0])
            pts_out.extend(stroke_pts[1:])
        else:
            pts_out.extend(stroke_pts)
    return pts_out


def _build_txt_shx_exact_connect_points(cfg, label_lines, char_h):
    """
    Visual text is left-to-right in each line.
    Connections:
    - stroke end -> next stroke start
    - glyph end -> next glyph start
    - line end -> next line start directly
    This is the literal 'end of writing to start of next writing' strategy.
    """
    cell = char_h / 7.0
    x_scale = cfg.get("label_x_scale", 0.55)
    line_width = cfg.get("line_width", 0.45)
    line_gap = char_h * 0.65
    center_x = cfg["square_x"] + cfg["circle_diameter"] / 2.0
    center_y = cfg["square_y"] + cfg["circle_diameter"] / 2.0

    advance_units = _label_advance_units(cell, x_scale, line_width)
    widths = [max(0, len(s) * advance_units - (advance_units - 1)) * cell * x_scale for s in label_lines]
    block_h = len(label_lines) * char_h + max(0, len(label_lines)-1) * line_gap
    top_y = center_y + block_h / 2.0 - char_h

    all_points = []
    for li, text in enumerate(label_lines):
        y0 = top_y - li * (char_h + line_gap)
        line_w = widths[li]
        x_left = center_x - line_w / 2.0

        for ci, ch in enumerate(text):
            x0 = x_left + ci * 6 * cell * x_scale
            glyph = _txt_shx_glyph_connected_points(ch, x0, y0, cell, x_scale)
            if not glyph:
                continue
            if all_points:
                # literal connector: previous writing endpoint -> next glyph startpoint
                all_points.append(glyph[0])
                all_points.extend(glyph[1:])
            else:
                all_points.extend(glyph)

    return all_points, {
        "cell": cell,
        "char_h": char_h,
        "x_scale": x_scale,
        "widths": widths,
    }


def emit_label(lines_out, cfg, label_lines, fa):
    """
    Emit txt.shx-like multi-stroke label converted to continuous printed path.
    """
    if not cfg["label"]:
        return

    cross_section = cfg["line_width"] * cfg["layer_height"]
    char_h, target_h = calc_label_height(cfg, label_lines)
    max_allowed_h = 10.0 if cfg["circle_diameter"] >= 200 else 5.0
    if char_h > max_allowed_h:
        char_h = max_allowed_h

    points, info = _build_txt_shx_exact_connect_points(cfg, label_lines, char_h)
    raw_point_count = len(points)

    # optional only; default 0
    points = _chaikin_smooth_open_path(
        points,
        iterations=cfg.get("label_smooth_iterations", 0),
        ratio=cfg.get("label_smooth_ratio", 0.22),
    )
    smoothed_point_count = len(points)

    lines_out += [
        "",
        "; ---------- bottom inner label ----------",
        "; label_toolpath=txt_shx_multistroke_endpoint_to_start_connected",
        "; label_visual_layout=three_line_default",
        "; label_path_rule=stroke_end_to_next_stroke_start_and_glyph_end_to_next_glyph_start",
        "; line_to_line_rule=direct_previous_endpoint_to_next_line_startpoint",
        "; label_no_internal_travel=1",
        "; label_no_retract=1",
        "; label_no_z_hop=1",
        f"; label_layout={cfg['label_layout']}",
        f"; label_target_height={fmt(target_h)}",
        f"; label_actual_height={fmt(char_h)}",
        f"; label_x_scale={fmt(cfg.get('label_x_scale', 0.55))}",
        f"; label_lines={' | '.join(label_lines)}",
        f"; label_smooth_iterations={cfg.get('label_smooth_iterations', 0)}",
        f"; label_smooth_ratio={fmt(cfg.get('label_smooth_ratio', 0.22))}",
        f"; label_raw_points={raw_point_count}",
        f"; label_smoothed_points={smoothed_point_count}",
    ]

    if len(points) < 2:
        lines_out.append("; label skipped: not enough points")
        lines_out.append("; ---------- end bottom inner label ----------")
        return

    lines_out.append(f"G0 Z{fmt(cfg['layer_height'])} F{fmt(cfg['z_travel_speed'] * 60,1)}")
    lines_out.append(f"G0 X{fmt(points[0][0])} Y{fmt(points[0][1])} F{fmt(cfg['travel_speed']*60,1)} ; label start, only travel move")

    e_total = 0.0
    prev = points[0]
    for pt in points[1:]:
        length = ((pt[0] - prev[0]) ** 2 + (pt[1] - prev[1]) ** 2) ** 0.5
        if length > 0:
            e = length * cross_section / fa * cfg["extrusion_multiplier"]
            e_total += e
            lines_out.append(f"G1 X{fmt(pt[0])} Y{fmt(pt[1])} E{fmt(e,5)} F{fmt(cfg['label_speed']*60,1)} ; txt.shx multistroke endpoint-connected label")
        prev = pt

    lines_out.append(f"; label_estimated_E_mm={fmt(e_total,3)}")
    lines_out.append("; ---------- end bottom inner label ----------")


def _append_segment(seg_out, p0, p1, kind):
    if p0 is None or p1 is None:
        return
    if p0 == p1:
        return
    seg_out.append((p0, p1, kind))


def _txt_shx_glyph_typed_segments(ch, x0, y0, cell, x_scale, current_pos=None):
    """
    Convert one SHX-like glyph into typed segments.
    - original glyph strokes => kind='stroke'
    - connections from previous position/stroke to next stroke start => kind='connector'
    """
    strokes = TXT_SHX_STROKE_FONT.get(ch.upper(), TXT_SHX_STROKE_FONT[" "])
    segs = []
    pos = current_pos

    if not strokes:
        return segs, pos

    first = True
    for stroke in strokes:
        if not stroke:
            continue
        stroke_pts = [_transform_stroke_point(p, x0, y0, cell, x_scale) for p in stroke]
        if not stroke_pts:
            continue

        if pos is not None:
            # connector from previous endpoint to this stroke start
            _append_segment(segs, pos, stroke_pts[0], "connector")

        # actual letter stroke
        for a, b in zip(stroke_pts[:-1], stroke_pts[1:]):
            _append_segment(segs, a, b, "stroke")
        pos = stroke_pts[-1]
        first = False

    return segs, pos


def _build_txt_shx_width_typed_segments(cfg, label_lines, char_h):
    """
    Build all label segments with typed widths:
    - stroke: actual txt.shx-like glyph stroke, printed wide
    - connector: stroke/glyph/line connector, printed thin
    """
    cell = char_h / 7.0
    x_scale = cfg.get("label_x_scale", 0.55)
    line_gap = char_h * 0.65
    center_x = cfg["square_x"] + cfg["circle_diameter"] / 2.0
    center_y = cfg["square_y"] + cfg["circle_diameter"] / 2.0

    widths = [_txt_stroke_line_width_units(s) * cell * x_scale for s in label_lines]
    block_h = len(label_lines) * char_h + max(0, len(label_lines)-1) * line_gap
    top_y = center_y + block_h / 2.0 - char_h

    all_segments = []
    pos = None
    for li, text in enumerate(label_lines):
        y0 = top_y - li * (char_h + line_gap)
        line_w = widths[li]
        x_left = center_x - line_w / 2.0

        for ci, ch in enumerate(text):
            x0 = x_left + ci * 6 * cell * x_scale
            segs, pos = _txt_shx_glyph_typed_segments(ch, x0, y0, cell, x_scale, current_pos=pos)
            all_segments.extend(segs)

    return all_segments, {
        "cell": cell,
        "char_h": char_h,
        "x_scale": x_scale,
        "widths": widths,
    }


def emit_label(lines_out, cfg, label_lines, fa):
    """
    v11 label:
    - txt.shx-like multistroke glyphs
    - original glyph strokes printed with label_stroke_width
    - all connector lines printed with label_connector_width
    """
    if not cfg["label"]:
        return

    char_h, target_h = calc_label_height(cfg, label_lines)
    max_allowed_h = 10.0 if cfg["circle_diameter"] >= 200 else 5.0
    if char_h > max_allowed_h:
        char_h = max_allowed_h

    typed_segments, info = _build_txt_shx_width_typed_segments(cfg, label_lines, char_h)

    stroke_width = cfg.get("label_stroke_width", 0.8)
    connector_width = cfg.get("label_connector_width", 0.4)
    layer_h = cfg["layer_height"]

    stroke_count = sum(1 for _, _, k in typed_segments if k == "stroke")
    connector_count = sum(1 for _, _, k in typed_segments if k == "connector")

    lines_out += [
        "",
        "; ---------- bottom inner label ----------",
        "; label_toolpath=txt_shx_multistroke_width_split_connected",
        "; label_visual_layout=three_line_default",
        "; label_path_rule=stroke_end_to_next_stroke_start_and_glyph_end_to_next_glyph_start",
        "; label_width_mode=stroke_vs_connector",
        f"; label_stroke_width={fmt(stroke_width)}",
        f"; label_connector_width={fmt(connector_width)}",
        "; label_no_internal_travel=1",
        "; label_no_retract=1",
        "; label_no_z_hop=1",
        f"; label_layout={cfg['label_layout']}",
        f"; label_target_height={fmt(target_h)}",
        f"; label_actual_height={fmt(char_h)}",
        f"; label_x_scale={fmt(cfg.get('label_x_scale', 0.55))}",
        f"; label_lines={' | '.join(label_lines)}",
        f"; label_segments_total={len(typed_segments)}",
        f"; label_segments_stroke={stroke_count}",
        f"; label_segments_connector={connector_count}",
    ]

    if not typed_segments:
        lines_out.append("; label skipped: no typed segments")
        lines_out.append("; ---------- end bottom inner label ----------")
        return

    start = typed_segments[0][0]
    lines_out.append(f"G0 Z{fmt(cfg['layer_height'])} F{fmt(cfg['z_travel_speed'] * 60,1)}")
    lines_out.append(f"G0 X{fmt(start[0])} Y{fmt(start[1])} F{fmt(cfg['travel_speed']*60,1)} ; label start, only travel move")

    e_total = 0.0
    for p0, p1, kind in typed_segments:
        width = stroke_width if kind == "stroke" else connector_width
        cross_section = width * layer_h
        length = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5
        if length <= 0:
            continue
        e = length * cross_section / fa * cfg["extrusion_multiplier"]
        e_total += e
        lines_out.append(
            f"G1 X{fmt(p1[0])} Y{fmt(p1[1])} E{fmt(e,5)} F{fmt(cfg['label_speed']*60,1)} ; label_{kind} width={fmt(width)}"
        )

    lines_out.append(f"; label_estimated_E_mm={fmt(e_total,3)}")
    lines_out.append("; ---------- end bottom inner label ----------")


def _build_glyph_segments_only(ch, x0, y0, cell, x_scale, current_pos=None):
    """
    Build one glyph centerline segments.
    """
    strokes = TXT_SHX_STROKE_FONT.get(ch.upper(), TXT_SHX_STROKE_FONT[" "])
    segs = []
    for stroke in strokes:
        if not stroke:
            continue
        stroke_pts = [_transform_stroke_point(p, x0, y0, cell, x_scale) for p in stroke]
        if not stroke_pts:
            continue
        for a, b in zip(stroke_pts[:-1], stroke_pts[1:]):
            _append_segment(segs, a, b, "stroke")
    return segs


def _glyph_source_points(ch, x0, y0, cell, x_scale):
    strokes = TXT_SHX_STROKE_FONT.get(ch.upper(), TXT_SHX_STROKE_FONT[" "])
    return [_transform_stroke_point(p, x0, y0, cell, x_scale) for stroke in strokes for p in stroke]


def _point_segment_distance(p, a, b):
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    l2 = dx*dx + dy*dy
    if l2 <= 1e-12:
        return dist(p, a)
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2
    t = max(0.0, min(1.0, t))
    proj = (a[0] + t * dx, a[1] + t * dy)
    return dist(p, proj)


def _point_key(p):
    return (round(p[0], 5), round(p[1], 5))


def _cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _convex_hull(points):
    unique = list({ _point_key(p): p for p in points }.values())
    if len(unique) <= 1:
        return unique
    unique.sort(key=lambda p: (p[0], p[1]))

    lower = []
    for p in unique:
        while len(lower) >= 2 and _cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper = []
    for p in reversed(unique):
        while len(upper) >= 2 and _cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def _extract_largest_loop(segs):
    outgoing = {}
    for a, b, _ in segs:
        outgoing.setdefault(_point_key(a), []).append((a, b))

    visited = set()
    best_loop = []
    best_area = 0.0

    for a, b, _ in segs:
        edge_id = (_point_key(a), _point_key(b))
        if edge_id in visited:
            continue
        loop = [a, b]
        visited.add(edge_id)
        cur = b

        for _ in range(20000):
            options = outgoing.get(_point_key(cur), [])
            nxt = None
            for candidate in options:
                cid = (_point_key(candidate[0]), _point_key(candidate[1]))
                if cid not in visited:
                    nxt = candidate
                    break
            if nxt is None:
                break
            visited.add((_point_key(nxt[0]), _point_key(nxt[1])))
            cur = nxt[1]
            if _point_key(cur) == _point_key(loop[0]):
                loop.append(loop[0])
                break
            loop.append(cur)

        if len(loop) >= 4:
            area = 0.0
            for p0, p1 in zip(loop[:-1], loop[1:]):
                area += p0[0] * p1[1] - p1[0] * p0[1]
            if abs(area) > abs(best_area):
                best_area = area
                best_loop = loop

    return best_loop


def _build_glyph_outer_contours(ch, x0, y0, cell, x_scale, line_width):
    centerlines = _build_glyph_segments_only(ch, x0, y0, cell, x_scale)
    if not centerlines:
        return []

    pts = [p for seg in centerlines for p in seg[:2]]
    min_x = min(p[0] for p in pts)
    max_x = max(p[0] for p in pts)
    min_y = min(p[1] for p in pts)
    max_y = max(p[1] for p in pts)
    radii = [LABEL_INNER_OUTLINE_RADIUS, LABEL_OUTER_RADIUS]
    sample = max(0.12, line_width / 3.0)
    all_segments = []

    for radius in radii:
        pad = radius + sample * 2.0
        origin_x = min_x - pad
        origin_y = min_y - pad
        cols = max(1, int(math.ceil((max_x - min_x + pad * 2.0) / sample)))
        rows = max(1, int(math.ceil((max_y - min_y + pad * 2.0) / sample)))
        filled = [[False for _ in range(cols)] for _ in range(rows)]

        for gy in range(rows):
            for gx in range(cols):
                p = (origin_x + (gx + 0.5) * sample, origin_y + (gy + 0.5) * sample)
                filled[gy][gx] = any(_point_segment_distance(p, a, b) <= radius for a, b, _ in centerlines)

        contour = []

        def x_at(gx):
            return origin_x + gx * sample

        def y_at(gy):
            return origin_y + gy * sample

        for gy in range(rows):
            for gx in range(cols):
                if not filled[gy][gx]:
                    continue
                left_empty = gx == 0 or not filled[gy][gx - 1]
                right_empty = gx == cols - 1 or not filled[gy][gx + 1]
                bottom_empty = gy == 0 or not filled[gy - 1][gx]
                top_empty = gy == rows - 1 or not filled[gy + 1][gx]

                if bottom_empty:
                    contour.append(((x_at(gx), y_at(gy)), (x_at(gx + 1), y_at(gy)), "stroke"))
                if right_empty:
                    contour.append(((x_at(gx + 1), y_at(gy)), (x_at(gx + 1), y_at(gy + 1)), "stroke"))
                if top_empty:
                    contour.append(((x_at(gx + 1), y_at(gy + 1)), (x_at(gx), y_at(gy + 1)), "stroke"))
                if left_empty:
                    contour.append(((x_at(gx), y_at(gy + 1)), (x_at(gx), y_at(gy)), "stroke"))

        loop = _extract_largest_loop(contour)
        for a, b in zip(loop[:-1], loop[1:]):
            _append_segment(all_segments, a, b, "stroke")

    return all_segments


def _build_glyph_geometry(ch, x0, y0, cell, x_scale, line_width):
    centerlines = _build_glyph_segments_only(ch, x0, y0, cell, x_scale)
    source_points = _glyph_source_points(ch, x0, y0, cell, x_scale)
    if not centerlines or not source_points:
        return {
            "segments": [],
            "outer_loop": [],
            "source_points": source_points,
            "bbox": {"min_x": x0, "max_x": x0, "min_y": y0, "max_y": y0},
        }

    pts = [p for seg in centerlines for p in seg[:2]]
    min_x = min(p[0] for p in pts)
    max_x = max(p[0] for p in pts)
    min_y = min(p[1] for p in pts)
    max_y = max(p[1] for p in pts)
    radii = [LABEL_INNER_OUTLINE_RADIUS, LABEL_OUTER_RADIUS]
    sample = max(0.12, line_width / 3.0)
    all_segments = []
    outer_loop = []

    for idx, radius in enumerate(radii):
        pad = radius + sample * 2.0
        origin_x = min_x - pad
        origin_y = min_y - pad
        cols = max(1, int(math.ceil((max_x - min_x + pad * 2.0) / sample)))
        rows = max(1, int(math.ceil((max_y - min_y + pad * 2.0) / sample)))
        filled = [[False for _ in range(cols)] for _ in range(rows)]

        for gy in range(rows):
            for gx in range(cols):
                p = (origin_x + (gx + 0.5) * sample, origin_y + (gy + 0.5) * sample)
                filled[gy][gx] = any(_point_segment_distance(p, a, b) <= radius for a, b, _ in centerlines)

        contour = []

        def x_at(gx):
            return origin_x + gx * sample

        def y_at(gy):
            return origin_y + gy * sample

        for gy in range(rows):
            for gx in range(cols):
                if not filled[gy][gx]:
                    continue
                left_empty = gx == 0 or not filled[gy][gx - 1]
                right_empty = gx == cols - 1 or not filled[gy][gx + 1]
                bottom_empty = gy == 0 or not filled[gy - 1][gx]
                top_empty = gy == rows - 1 or not filled[gy + 1][gx]
                if bottom_empty:
                    contour.append(((x_at(gx), y_at(gy)), (x_at(gx + 1), y_at(gy)), "stroke"))
                if right_empty:
                    contour.append(((x_at(gx + 1), y_at(gy)), (x_at(gx + 1), y_at(gy + 1)), "stroke"))
                if top_empty:
                    contour.append(((x_at(gx + 1), y_at(gy + 1)), (x_at(gx), y_at(gy + 1)), "stroke"))
                if left_empty:
                    contour.append(((x_at(gx), y_at(gy + 1)), (x_at(gx), y_at(gy)), "stroke"))

        loop = _extract_largest_loop(contour)
        if idx == len(radii) - 1:
            outer_loop = loop
        for a, b in zip(loop[:-1], loop[1:]):
            _append_segment(all_segments, a, b, "stroke")

    return {
        "segments": all_segments,
        "outer_loop": outer_loop,
        "source_points": source_points,
        "bbox": {"min_x": min_x, "max_x": max_x, "min_y": min_y, "max_y": max_y},
    }


def _build_hull_loops(segs):
    points = [p for seg in segs for p in seg[:2]]
    hull = _convex_hull(points)
    if len(hull) < 3:
        return []
    closed = hull + [hull[0]]
    loop = []
    for a, b in zip(closed[:-1], closed[1:]):
        _append_segment(loop, a, b, "stroke")
    return loop + loop


def _nearest_loop_point(loop, target):
    return min(loop, key=lambda p: dist(p, target))


def _has_corner_near(points, target, tol):
    return any(dist(p, target) <= tol for p in points)


def _same_point(a, b, tol=1e-6):
    return dist(a, b) <= tol


def _orientation(a, b, c):
    v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1])
    if abs(v) < 1e-9:
        return 0
    return 1 if v > 0 else 2


def _on_segment(a, b, c):
    return (
        b[0] <= max(a[0], c[0]) + 1e-9 and b[0] + 1e-9 >= min(a[0], c[0]) and
        b[1] <= max(a[1], c[1]) + 1e-9 and b[1] + 1e-9 >= min(a[1], c[1])
    )


def _segments_intersect(a1, a2, b1, b2):
    o1 = _orientation(a1, a2, b1)
    o2 = _orientation(a1, a2, b2)
    o3 = _orientation(b1, b2, a1)
    o4 = _orientation(b1, b2, a2)
    if o1 != o2 and o3 != o4:
        return True
    if o1 == 0 and _on_segment(a1, b1, a2):
        return True
    if o2 == 0 and _on_segment(a1, b2, a2):
        return True
    if o3 == 0 and _on_segment(b1, a1, b2):
        return True
    if o4 == 0 and _on_segment(b1, a2, b2):
        return True
    return False


def _candidate_allowed(a, b, obstacles):
    for p0, p1, _ in obstacles:
        touches_at_end = (
            _same_point(a, p0) or _same_point(a, p1) or _same_point(b, p0) or _same_point(b, p1) or
            _on_segment(p0, a, p1) or _on_segment(p0, b, p1)
        )
        if not _segments_intersect(a, b, p0, p1):
            continue
        if not touches_at_end:
            return False
    return True


def _shortest_loop_connector(left_geom, right_geom, obstacles):
    best = None
    best_dist = float("inf")
    for a in left_geom["outer_loop"]:
        for b in right_geom["outer_loop"]:
            d = dist(a, b)
            if d >= best_dist:
                continue
            if not _candidate_allowed(a, b, obstacles):
                continue
            best = (a, b)
            best_dist = d
    return best


def _connect_adjacent_glyphs(left_geom, right_geom, cell):
    if not left_geom["outer_loop"] or not right_geom["outer_loop"]:
        return []
    tol = cell * 0.7
    left_tr = (left_geom["bbox"]["max_x"], left_geom["bbox"]["max_y"])
    left_br = (left_geom["bbox"]["max_x"], left_geom["bbox"]["min_y"])
    right_tl = (right_geom["bbox"]["min_x"], right_geom["bbox"]["max_y"])
    right_bl = (right_geom["bbox"]["min_x"], right_geom["bbox"]["min_y"])

    left_top = _nearest_loop_point(left_geom["outer_loop"], left_tr)
    left_bottom = _nearest_loop_point(left_geom["outer_loop"], left_br)
    right_top = _nearest_loop_point(right_geom["outer_loop"], right_tl)
    right_bottom = _nearest_loop_point(right_geom["outer_loop"], right_bl)

    segs = []
    obstacles = left_geom["segments"] + right_geom["segments"]

    left_has_top = _has_corner_near(left_geom["source_points"], left_tr, tol)
    left_has_bottom = _has_corner_near(left_geom["source_points"], left_br, tol)
    right_has_top = _has_corner_near(right_geom["source_points"], right_tl, tol)
    right_has_bottom = _has_corner_near(right_geom["source_points"], right_bl, tol)
    if left_has_top and left_has_bottom and right_has_top and right_has_bottom:
        if _candidate_allowed(left_top, right_bottom, obstacles):
            _append_segment(segs, left_top, right_bottom, "connector")
        if _candidate_allowed(left_bottom, right_top, obstacles):
            _append_segment(segs, left_bottom, right_top, "connector")
    else:
        best = _shortest_loop_connector(left_geom, right_geom, obstacles)
        if best:
            _append_segment(segs, best[0], best[1], "connector")
    return segs


def _build_interline_rails(lines_glyphs, cell):
    segs = []
    for upper_line, lower_line in zip(lines_glyphs[:-1], lines_glyphs[1:]):
        upper = [g for g in upper_line if g["outer_loop"]]
        lower = [g for g in lower_line if g["outer_loop"]]
        if not upper or not lower:
            continue
        upper_pts = [p for g in upper for p in g["outer_loop"]]
        lower_pts = [p for g in lower for p in g["outer_loop"]]
        upper_min_x = min(p[0] for p in upper_pts)
        upper_max_x = max(p[0] for p in upper_pts)
        upper_bottom_y = min(p[1] for p in upper_pts)
        lower_min_x = min(p[0] for p in lower_pts)
        lower_max_x = max(p[0] for p in lower_pts)
        lower_top_y = max(p[1] for p in lower_pts)
        eps = max(0.02, cell * 0.03)
        _append_segment(segs, (upper_min_x, upper_bottom_y - eps), (upper_max_x, upper_bottom_y - eps), "connector")
        _append_segment(segs, (lower_min_x, lower_top_y + eps), (lower_max_x, lower_top_y + eps), "connector")
    return segs


def _txt_shx_glyph_typed_segments(ch, x0, y0, cell, x_scale, line_width):
    """
    Glyph builder:
    - outer double contour only
    """
    segs = _build_glyph_outer_contours(ch, x0, y0, cell, x_scale, line_width)
    end = segs[-1][1] if segs else None
    return segs, end


def _build_txt_shx_width_typed_segments(cfg, label_lines, char_h):
    """
    Label path:
    - all visual lines traverse left -> right
    - disconnected stroke-only glyph rendering
    """
    cell = char_h / 7.0
    x_scale = cfg.get("label_x_scale", 0.55)
    line_width = cfg["line_width"]
    advance_units = _label_advance_units(cell, x_scale, line_width)
    line_gap = char_h * 0.65
    center_x = cfg["square_x"] + cfg["circle_diameter"] / 2.0
    center_y = cfg["square_y"] + cfg["circle_diameter"] / 2.0

    widths = [_txt_stroke_line_width_units(s) * cell * x_scale for s in label_lines]
    block_h = len(label_lines) * char_h + max(0, len(label_lines)-1) * line_gap
    top_y = center_y + block_h / 2.0 - char_h

    all_segments = []
    lines_glyphs = []
    for li, text in enumerate(label_lines):
        y0 = top_y - li * (char_h + line_gap)
        line_w = widths[li]
        x_left = center_x - line_w / 2.0

        glyphs = []
        for ci, ch in enumerate(text):
            x0 = x_left + ci * advance_units * cell * x_scale
            geom = _build_glyph_geometry(ch, x0, y0, cell, x_scale, line_width)
            glyphs.append(geom)
            all_segments.extend(geom["segments"])
        lines_glyphs.append(glyphs)

    all_segments.extend(_build_interline_rails(lines_glyphs, cell))
    all_segments.extend(_build_hull_loops(all_segments))

    return all_segments, {
        "cell": cell,
        "char_h": char_h,
        "x_scale": x_scale,
        "widths": widths,
        "path_order": "LTR_LTR_LTR",
    }


def emit_label(lines_out, cfg, label_lines, fa):
    """
    v19 label:
    - disconnected stroke-only glyphs
    - no glyph connectors
    - label lines use cfg['line_width']
    - returns the final XY point so the body can continue from label end to seam by travel
    """
    if not cfg["label"]:
        return None

    char_h, target_h = calc_label_height(cfg, label_lines)
    max_allowed_h = 10.0 if cfg["circle_diameter"] >= 200 else 5.0
    if char_h > max_allowed_h:
        char_h = max_allowed_h

    typed_segments, info = _build_txt_shx_width_typed_segments(cfg, label_lines, char_h)

    stroke_width = 0.25
    layer_h = cfg["layer_height"]
    stroke_count = sum(1 for _, _, k in typed_segments if k == "stroke")
    connector_count = sum(1 for _, _, k in typed_segments if k == "connector")

    lines_out += [
        "",
        "; ---------- bottom inner label ----------",
        "; label_toolpath=glyph_outer_double_contour_plus_convex_hull",
        "; label_visual_layout=three_line_default",
        "; label_path_order=line1_LTR_line2_LTR_line3_LTR",
        "; label_path_rule=stroke_only_no_connectors",
        "; label_width_mode=fixed_label_width",
        f"; label_line_width={fmt(stroke_width)}",
        "; label_inner_contours_per_glyph=2",
        "; label_outer_hull_passes=2",
        "; label_inner_contour_gap_mm=0",
        f"; label_layout={cfg['label_layout']}",
        f"; label_target_height={fmt(target_h)}",
        f"; label_actual_height={fmt(char_h)}",
        f"; label_x_scale={fmt(cfg.get('label_x_scale', 0.55))}",
        f"; label_lines={' | '.join(label_lines)}",
        f"; label_segments_total={len(typed_segments)}",
        f"; label_segments_stroke={stroke_count}",
        f"; label_segments_connector={connector_count}",
    ]

    if not typed_segments:
        lines_out.append("; label skipped: no typed segments")
        lines_out.append("; ---------- end bottom inner label ----------")
        return None

    start = typed_segments[0][0]
    lines_out.append(f"G0 Z{fmt(cfg['layer_height'])} F{fmt(cfg['z_travel_speed'] * 60,1)}")
    lines_out.append(f"G0 X{fmt(start[0])} Y{fmt(start[1])} F{fmt(cfg['travel_speed']*60,1)} ; label start, only travel move")

    e_total = 0.0
    end_point = start
    cursor = start
    for p0, p1, kind in typed_segments:
        if dist(cursor, p0) > 1e-9:
            lines_out.append(f"G0 X{fmt(p0[0])} Y{fmt(p0[1])} F{fmt(cfg['travel_speed']*60,1)} ; label stroke jump")
        cross_section = stroke_width * layer_h
        length = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5
        if length <= 0:
            continue
        e = length * cross_section / fa * cfg["extrusion_multiplier"]
        e_total += e
        end_point = p1
        cursor = p1
        lines_out.append(
            f"G1 X{fmt(p1[0])} Y{fmt(p1[1])} E{fmt(e,5)} F{fmt(cfg['label_speed']*60,1)} ; label_{kind} width={fmt(stroke_width)}"
        )

    lines_out.append(f"; label_estimated_E_mm={fmt(e_total,3)}")
    lines_out.append("; ---------- end bottom inner label ----------")
    return end_point


def emit_firmware_motion_block(lines, cfg):
    """
    Emit firmware-specific runtime motion hints.
    This does not permanently save anything to EEPROM/config.
    """
    mode = str(cfg.get("firmware_mode", "klipper")).lower()
    accel = cfg.get("motion_accel", 8000.0)
    vel = cfg.get("motion_velocity", 300.0)
    min_cruise = cfg.get("motion_minimum_cruise_ratio", 0.0)
    scv = cfg.get("motion_square_corner_velocity", 10.0)
    jerk = cfg.get("motion_jerk", 10.0)

    lines.append("")
    lines.append("; ---------- firmware motion hint ----------")
    lines.append(f"; firmware_mode={mode}")

    if mode == "klipper":
        lines.append(
            f"SET_VELOCITY_LIMIT VELOCITY={fmt(vel)} ACCEL={fmt(accel)} "
            f"MINIMUM_CRUISE_RATIO={fmt(min_cruise)} SQUARE_CORNER_VELOCITY={fmt(scv)}"
        )
        lines.append(f"M204 S{fmt(accel)}")
        lines.append("M220 S100")
    elif mode == "marlin":
        lines.append(f"M203 X{fmt(vel)} Y{fmt(vel)} Z20 E80")
        lines.append(f"M201 X{fmt(accel)} Y{fmt(accel)} Z300 E5000")
        lines.append(f"M204 S{fmt(accel)}")
        lines.append(f"M204 P{fmt(accel)} T{fmt(accel)}")
        lines.append(f"M205 X{fmt(jerk)} Y{fmt(jerk)} Z0.4 E5")
        lines.append("M220 S100")
    elif mode == "bambu":
        lines.append("; Bambu stock firmware is not Klipper. Keep this conservative.")
        lines.append(f"M204 S{fmt(accel)}")
        lines.append(f"M204 P{fmt(accel)} T{fmt(accel)}")
        lines.append("M220 S100")
    else:
        lines.append("; firmware_mode=unknown: no acceleration/speed unlock code inserted")
        lines.append("; WARNING: acceleration/speed limits may not be unlocked")

    lines.append("; ---------- end firmware motion hint ----------")


def emit_temperature_set(lines, cfg, target_temp, wait_mode=None):
    mode = str(cfg.get("firmware_mode", "unknown")).lower()
    temp = fmt(target_temp)
    tolerance = cfg.get("temp_wait_tolerance", 0.5)

    if mode == "klipper":
        lines.append(f"SET_HEATER_TEMPERATURE HEATER={cfg['heater']} TARGET={temp}")
        if wait_mode == "min":
            lines.append(f"TEMPERATURE_WAIT SENSOR={cfg['heater']} MINIMUM={fmt(target_temp - tolerance)}")
        elif wait_mode == "max":
            lines.append(f"TEMPERATURE_WAIT SENSOR={cfg['heater']} MAXIMUM={fmt(target_temp + tolerance)}")
        return

    lines.append(f"M104 S{temp}")
    if wait_mode is not None:
        lines.append(f"M109 S{temp}")


def make_gcode(cfg):
    fa = filament_area(cfg["filament_diameter"])
    cross_section = cfg["line_width"] * cfg["layer_height"]
    radius = cfg["circle_diameter"] / 2.0
    center_x = cfg["square_x"] + radius
    center_y = cfg["square_y"] + radius
    total_layers = cfg["bands"] * cfg["layers_per_band"]
    total_height = total_layers * cfg["layer_height"]
    pts = arc_points(center_x, center_y, radius, cfg["arc_segments"], cfg["zero_angle_deg"], cfg["clockwise"])
    label_lines = make_label_lines(cfg)

    lines = [
        "; generated by melt_mvs_calibrator_v11.py",
        "; purpose: melt-limit + in-layer continuous MVS ramp + printer presets + bounding-square placement + centered bottom label",
        f"; printer_preset={cfg['printer_preset']}",
        f"; printer_name={cfg['printer_name']}",
        f"; preset_source={cfg.get('source', '')}",
        f"; filament_name={cfg['filament_name']}",
        f"; nozzle_size={fmt(cfg['nozzle_size'])}",
        f"; bed_x={fmt(cfg['bed_x'])}",
        f"; bed_y={fmt(cfg['bed_y'])}",
        f"; bed_z={fmt(cfg.get('bed_z', 0))}",
        f"; circle_diameter={fmt(cfg['circle_diameter'])}",
        f"; square_x={fmt(cfg['square_x'])}",
        f"; square_y={fmt(cfg['square_y'])}",
        f"; computed_center_x={fmt(center_x)}",
        f"; computed_center_y={fmt(center_y)}",
        f"; layer_height={fmt(cfg['layer_height'])}",
        f"; line_width={fmt(cfg['line_width'])}",
        f"; filament_diameter={fmt(cfg['filament_diameter'])}",
        f"; bands={cfg['bands']}",
        f"; layers_per_band={cfg['layers_per_band']}",
        f"; band_height={fmt(cfg['layers_per_band'] * cfg['layer_height'])}",
        f"; start_temp={fmt(cfg['start_temp'])}",
        f"; end_temp={fmt(cfg['end_temp'])}",
        f"; temp_step={fmt(cfg['temp_step'])}",
        f"; final_temp={fmt(cfg['start_temp'] - cfg['temp_step'] * (cfg['bands'] - 1))}",
        f"; mvs_min={fmt(cfg['mvs_min'])}",
        f"; mvs_max={fmt(cfg['mvs_max'])}",
        f"; arc_segments={cfg['arc_segments']}",
        f"; total_height={fmt(total_height)}",
        f"; zero_angle_deg={fmt(cfg['zero_angle_deg'])}",
        f"; clockwise={int(cfg['clockwise'])}",
        "; mvs_angle_map:",
        ";   0%=start/seam, 25%=quarter circle, 50%=half circle, 75%=three-quarter circle, 100%=end",
    ]

    for pct in [0, 25, 50, 75, 100]:
        mvs = cfg["mvs_min"] + (cfg["mvs_max"] - cfg["mvs_min"]) * pct / 100.0
        speed = mvs / cross_section if mvs > 0 else 0
        angle = cfg["zero_angle_deg"] + (-1 if cfg["clockwise"] else 1) * 360.0 * pct / 100.0
        lines.append(f";   {pct:3d}% angle={fmt(angle,2)}deg MVS={fmt(mvs,3)}mm3/s XY_speed={fmt(speed,3)}mm/s F={fmt(speed*60,1)}")

    lines += [
        "",
        "; ---------- USER SAFETY CHECK ----------",
        "; MVS=0 exactly means no movement/no extrusion. Use mvs-min 0.1 or higher for real measurement.",
        "; This build always generates standalone output.",
        "; Standalone start runs G28 before heating/waiting, then heat/prime/end G-code.",
        "; ---------------------------------------",
        "",
        "G90 ; absolute XYZ",
        "M83 ; relative extrusion",
        "M220 S100 ; speed factor",
        "M221 S100 ; flow factor",
    ]

    if cfg["standalone"]:
        lines += [
            "",
            "; ---------- minimal standalone start ----------",
            "G28 ; home all axes first",
        ]
        emit_firmware_motion_block(lines, cfg)
        lines += [
            f"M140 S{fmt(cfg['bed_temp'])}",
            f"M104 S{fmt(cfg['start_temp'])}",
            f"M190 S{fmt(cfg['bed_temp'])}",
            f"M109 S{fmt(cfg['start_temp'])}",
            "G92 E0",
            f"G1 Z{fmt(cfg['layer_height'])} F600",
            f"G1 X{fmt(max(0, cfg['square_x'] - 8))} Y{fmt(cfg['square_y'])} F6000",
            f"G1 X{fmt(max(0, cfg['square_x'] - 8))} Y{fmt(cfg['square_y'] + cfg['circle_diameter'])} E6 F600",
            "G92 E0",
            "; ---------- end minimal standalone start ----------",
        ]

    label_end_point = None
    if cfg["label"]:
        emit_temperature_set(lines, cfg, cfg["start_temp"], wait_mode="min")
        label_end_point = emit_label(lines, cfg, label_lines, fa)

    current_temp = None
    e_total_est = 0.0

    for layer in range(1, total_layers + 1):
        z = layer * cfg["layer_height"]
        band = (layer - 1) // cfg["layers_per_band"]
        layer_in_band = (layer - 1) % cfg["layers_per_band"] + 1
        target_temp = cfg["start_temp"] - cfg["temp_step"] * band

        lines += [
            "",
            f";LAYER:{layer}",
            f";Z:{fmt(z)}",
            f";TEMP_BAND:{band + 1}",
            f";LAYER_IN_TEMP_BAND:{layer_in_band}/{cfg['layers_per_band']}",
            f";TARGET_TEMP:{fmt(target_temp)}",
        ]

        if current_temp != target_temp:
            old = "initial" if current_temp is None else fmt(current_temp)
            lines.append(f"; temp change: {old} -> {fmt(target_temp)}")
            if current_temp is None or target_temp > current_temp:
                emit_temperature_set(lines, cfg, target_temp, wait_mode="min")
            else:
                emit_temperature_set(lines, cfg, target_temp, wait_mode="max")
            current_temp = target_temp

        start = pts[0]
        if layer == 1 and label_end_point is not None:
            lines.append(f"G0 Z{fmt(z)} F{fmt(cfg['z_travel_speed'] * 60, 1)}")
            lines.append("; label end -> seam: travel only")
            lines.append(
                f"G0 X{fmt(start[0])} Y{fmt(start[1])} F{fmt(cfg['travel_speed'] * 60, 1)} "
                "; label_end_to_seam_travel"
            )
        else:
            lines.append(f"G0 Z{fmt(z)} F{fmt(cfg['z_travel_speed'] * 60, 1)}")
            lines.append(f"G0 X{fmt(start[0])} Y{fmt(start[1])} F{fmt(cfg['travel_speed'] * 60, 1)} ; seam / 0% MVS point on bounding square edge")

        if cfg["retract"] > 0:
            lines.append(f"G1 E-{fmt(cfg['retract'])} F{fmt(cfg['retract_speed'] * 60,1)} ; retract")
            lines.append(f"G1 E{fmt(cfg['retract'])} F{fmt(cfg['retract_speed'] * 60,1)} ; unretract")

        for i in range(cfg["arc_segments"]):
            progress_mid = (i + 0.5) / cfg["arc_segments"]
            requested_mvs = cfg["mvs_min"] + (cfg["mvs_max"] - cfg["mvs_min"]) * progress_mid
            xy_speed = 60 if layer == 1 else (requested_mvs / cross_section if requested_mvs > 0 else cfg["min_xy_speed"])
            actual_mvs = xy_speed * cross_section
            if layer != 1 and cfg["max_xy_speed"] > 0 and xy_speed > cfg["max_xy_speed"]:
                xy_speed = cfg["max_xy_speed"]
                actual_mvs = xy_speed * cross_section
            b = pts[i + 1]
            length = dist(pts[i], b)
            e = length * cross_section / fa * cfg["extrusion_multiplier"]
            e_total_est += e
            lines.append(
                f"G1 X{fmt(b[0])} Y{fmt(b[1])} E{fmt(e,5)} F{fmt(xy_speed*60,1)} "
                f"; pct={fmt(progress_mid*100,2)} req_MVS={fmt(requested_mvs,3)} actual_MVS={fmt(actual_mvs,3)}"
            )

    lines += ["", "; ---------- end of calibration body ----------", f"; estimated_total_filament_E_mm={fmt(e_total_est,3)}"]

    if cfg["standalone"]:
        lines += [
            "",
            "; ---------- minimal standalone end ----------",
            "G92 E0",
            "G1 E-2 F1800",
            f"G0 Z{fmt(total_height + 10)} F1200",
            "M104 S0",
            "M140 S0",
            "M106 S0",
            "G90",
            "; ---------- end minimal standalone end ----------",
        ]

    return "\n".join(lines) + "\n"


def make_parser():
    p = argparse.ArgumentParser()
    p.add_argument("-o", "--output", default="melt_mvs_calibrator_v4.gcode")
    p.add_argument("--preset-file", default="printer_presets.json")
    p.add_argument("--printer-preset", default="GENERIC_220")
    p.add_argument("--list-presets", action="store_true")
    p.add_argument("--standalone", action="store_true", default=True, help="Always enabled in this build.")

    p.add_argument("--printer-name")
    p.add_argument("--filament-name", default="Unknown_pla")
    p.add_argument("--nozzle-size", type=float)

    p.add_argument("--bed-x", type=float)
    p.add_argument("--bed-y", type=float)
    p.add_argument("--square-x", type=float, help="Bounding square lower-left X. Defaults by preset/placement rule.")
    p.add_argument("--square-y", type=float, help="Bounding square lower-left Y. Defaults by preset/placement rule.")
    p.add_argument("--circle-diameter", type=float, help="Circle diameter and bounding square side length. Defaults by preset/placement rule.")

    p.add_argument("--heater")
    p.add_argument("--zero-angle-deg", type=float)
    p.add_argument("--counterclockwise", dest="clockwise", action="store_false")
    p.set_defaults(clockwise=True)

    p.add_argument("--start-temp", type=float, default=230.0)
    p.add_argument("--end-temp", type=float, default=176.0)
    p.add_argument("--temp-step", type=float, default=1.0)
    p.add_argument("--bands", type=int)
    p.add_argument("--layers-per-band", type=int, default=10)
    p.add_argument("--layer-height", type=float, default=0.24)

    p.add_argument("--mvs-min", type=float, default=0.1)
    p.add_argument("--mvs-max", type=float, default=20.0)
    p.add_argument("--arc-segments", type=int, default=360)

    p.add_argument("--line-width", type=float, default=0.45)
    p.add_argument("--filament-diameter", type=float)

    p.add_argument("--label", dest="label", action="store_true", default=True)
    p.add_argument("--no-label", dest="label", action="store_false")
    p.add_argument("--label-layout", choices=["three-line", "one-line"], default="three-line")
    p.add_argument("--label-height", type=float)
    p.add_argument("--label-auto-fit", action="store_true", default=True)
    p.add_argument("--no-label-auto-fit", dest="label_auto_fit", action="store_false")
    p.add_argument("--label-margin", type=float, default=6.0)
    p.add_argument("--label-speed", type=float, default=20.0)
    p.add_argument("--label-x-scale", type=float, default=0.55, help="Horizontal scale for txt.shx-like connected label font.")
    p.add_argument("--label-smooth-iterations", type=int, default=0, help="Smoothing iterations for label path. Default 0 for txt.shx-like straight font.")
    p.add_argument("--label-smooth-ratio", type=float, default=0.22, help="Corner cutting ratio for label smoothing. 0.20-0.25 is usually safe.")
    p.add_argument("--label-stroke-width", type=float, default=0.6, help="Extrusion width for actual label glyph strokes. v18 default 0.6mm.")
    p.add_argument("--label-connector-width", type=float, default=0.2, help="Extrusion width for connector lines between strokes/glyphs/lines. v18 default 0.2mm.")

    p.add_argument("--bed-temp", type=float, default=60.0)
    p.add_argument("--temp-wait-tolerance", type=float, default=0.5)
    p.add_argument("--travel-speed", type=float, default=180.0)
    p.add_argument("--z-travel-speed", type=float, default=10.0)
    p.add_argument("--min-xy-speed", type=float, default=0.2)
    p.add_argument("--max-xy-speed", type=float, default=0.0)
    p.add_argument("--retract", type=float, default=0.0)
    p.add_argument("--retract-speed", type=float, default=30.0)
    p.add_argument("--extrusion-multiplier", type=float, default=1.0)
    p.add_argument("--firmware-mode", choices=["klipper", "marlin", "bambu", "unknown"], default="unknown",
                   help="Firmware motion-limit mode: klipper, marlin, or bambu.")
    p.add_argument("--motion-accel", type=float, default=8000.0,
                   help="Requested acceleration for firmware motion hint.")
    p.add_argument("--motion-velocity", type=float, default=300.0,
                   help="Requested XY velocity/feedrate limit for firmware motion hint.")
    p.add_argument("--motion-minimum-cruise-ratio", type=float, default=0.0,
                   help="Klipper MINIMUM_CRUISE_RATIO. 0 disables minimum cruise enforcement.")
    p.add_argument("--motion-square-corner-velocity", type=float, default=10.0,
                   help="Klipper square corner velocity.")
    p.add_argument("--motion-jerk", type=float, default=10.0,
                   help="Marlin/Bambu classic jerk hint.")
    return p


def main():
    args = make_parser().parse_args()
    presets = load_presets(args.preset_file)
    if args.list_presets:
        print("\n".join(sorted(presets.keys())))
        return
    preset = presets.get(args.printer_preset, {})
    if args.temp_step <= 0:
        raise SystemExit("ERROR: --temp-step must be greater than 0.")
    if args.start_temp < args.end_temp:
        raise SystemExit("ERROR: --start-temp must be greater than or equal to --end-temp.")
    cfg = {
        "printer_preset": args.printer_preset,
        "printer_name": choose(args, preset, "printer_name", args.printer_preset),
        "source": preset.get("source", ""),
        "filament_name": args.filament_name,
        "nozzle_size": choose(args, preset, "nozzle_size", 0.4),
        "bed_x": args.bed_x if args.bed_x is not None else choose(args, preset, "bed_x", 220.0),
        "bed_y": args.bed_y if args.bed_y is not None else choose(args, preset, "bed_y", 220.0),
        "bed_z": preset.get("bed_z", 0),
        "circle_diameter": None,
        "heater": choose(args, preset, "heater", "extruder"),
        "zero_angle_deg": choose(args, preset, "zero_angle_deg", -90.0),
        "standalone": True,
        "clockwise": args.clockwise,
        "start_temp": args.start_temp,
        "end_temp": args.end_temp,
        "temp_step": args.temp_step,
        "bands": args.bands if args.bands is not None else max(1, math.ceil((args.start_temp - args.end_temp) / args.temp_step) + 1),
        "layers_per_band": args.layers_per_band,
        "layer_height": args.layer_height,
        "mvs_min": args.mvs_min,
        "mvs_max": args.mvs_max,
        "arc_segments": args.arc_segments,
        "line_width": args.line_width,
        "filament_diameter": choose(args, preset, "filament_diameter", 1.75),
        "label": args.label,
        "label_layout": args.label_layout,
        "label_height": args.label_height,
        "label_auto_fit": args.label_auto_fit,
        "label_margin": args.label_margin,
        "label_speed": args.label_speed,
        "label_x_scale": args.label_x_scale,
        "label_smooth_iterations": args.label_smooth_iterations,
        "label_smooth_ratio": args.label_smooth_ratio,
        "label_stroke_width": args.label_stroke_width,
        "label_connector_width": args.label_connector_width,
        "bed_temp": args.bed_temp,
        "temp_wait_tolerance": args.temp_wait_tolerance,
        "travel_speed": args.travel_speed,
        "z_travel_speed": args.z_travel_speed,
        "min_xy_speed": args.min_xy_speed,
        "max_xy_speed": args.max_xy_speed,
        "retract": args.retract,
        "retract_speed": args.retract_speed,
        "extrusion_multiplier": args.extrusion_multiplier,
        "firmware_mode": args.firmware_mode,
        "motion_accel": args.motion_accel,
        "motion_velocity": args.motion_velocity,
        "motion_minimum_cruise_ratio": args.motion_minimum_cruise_ratio,
        "motion_square_corner_velocity": args.motion_square_corner_velocity,
        "motion_jerk": args.motion_jerk,
    }
    cfg["square_x"], cfg["square_y"], cfg["circle_diameter"] = resolve_square_placement(args, preset, cfg["bed_x"], cfg["bed_y"])
    if cfg["square_x"] < 0 or cfg["square_y"] < 0 or cfg["square_x"] + cfg["circle_diameter"] > cfg["bed_x"] or cfg["square_y"] + cfg["circle_diameter"] > cfg["bed_y"]:
        print("WARNING: bounding square exceeds declared XY build volume. Check preset or override --square-x/--square-y/--circle-diameter.", file=__import__("sys").stderr)
    Path(args.output).write_text(make_gcode(cfg), encoding="utf-8", newline="\n")
    print(f"Wrote {Path(args.output).resolve()}")


if __name__ == "__main__":
    main()
