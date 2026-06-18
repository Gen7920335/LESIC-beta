export type FirmwareMode = "klipper" | "marlin" | "bambu" | "unknown";
export type LabelLayout = "three-line" | "one-line";
export type Point = [number, number];
export type SegmentKind = "stroke" | "connector";
export type TypedSegment = [Point, Point, SegmentKind];

export type PrinterPreset = {
  manufacturer?: string;
  printer_name?: string;
  source?: string;
  bed_x?: number;
  bed_y?: number;
  bed_z?: number;
  nozzle_size?: number;
  filament_diameter?: number;
  heater?: string;
  zero_angle_deg?: number;
  square_x?: number;
  square_y?: number;
  circle_diameter?: number;
};

export type GeneratorConfig = {
  output: string;
  printer_preset: string;
  printer_name: string;
  source: string;
  filament_name: string;
  nozzle_size: number;
  bed_x: number;
  bed_y: number;
  bed_z: number;
  square_x: number;
  square_y: number;
  circle_diameter: number;
  heater: string;
  zero_angle_deg: number;
  clockwise: boolean;
  standalone: boolean;
  start_temp: number;
  end_temp: number;
  temp_step: number;
  bands: number;
  layers_per_band: number;
  layer_height: number;
  mvs_min: number;
  mvs_max: number;
  arc_segments: number;
  line_width: number;
  filament_diameter: number;
  label: boolean;
  label_layout: LabelLayout;
  label_height?: number;
  label_margin: number;
  label_speed: number;
  label_x_scale: number;
  label_stroke_width: number;
  label_connector_width: number;
  bed_temp: number;
  temp_wait_tolerance: number;
  travel_speed: number;
  z_travel_speed: number;
  min_xy_speed: number;
  max_xy_speed: number;
  retract: number;
  retract_speed: number;
  extrusion_multiplier: number;
  firmware_mode: FirmwareMode;
  motion_accel: number;
  motion_velocity: number;
  motion_minimum_cruise_ratio: number;
  motion_square_corner_velocity: number;
  motion_jerk: number;
};

export type PreviewData = {
  bed: { x: number; y: number };
  square: { x: number; y: number; d: number };
  circleSegments: TypedSegment[];
  labelSegments: TypedSegment[];
  seam: Point;
  totalLayers: number;
  totalHeight: number;
};

const LABEL_ADVANCE_UNITS = 6.8;
const LABEL_GLYPH_WIDTH_UNITS = 5.0;
const LABEL_LETTER_GAP_RATIO = 0.4;
const LABEL_TEXT_WIDTH = 1.0;
export const LABEL_OUTLINE_WIDTH = 0.25;
const LABEL_INNER_OUTLINE_RADIUS = LABEL_TEXT_WIDTH / 2 + LABEL_OUTLINE_WIDTH / 2;
const LABEL_OUTER_RADIUS = LABEL_INNER_OUTLINE_RADIUS + LABEL_OUTLINE_WIDTH;
const NO_INNER_LOOP_BRIDGE_CHARS = new Set([":", ".", ",", "•"]);

const FONT: Record<string, Point[][]> = {
  "0": [[ [0, 0], [0, 7], [5, 7], [5, 0], [0, 0], [5, 7] ]],
  "1": [[ [2.5, 0], [2.5, 7] ], [[1.2, 5.8], [2.5, 7]], [[1, 0], [4, 0]]],
  "2": [[ [0, 5.5], [1, 7], [5, 7], [5, 4.8], [0, 0], [5, 0] ]],
  "3": [[ [0, 7], [5, 7], [3, 3.5], [5, 3.5], [5, 0], [0, 0] ]],
  "4": [[ [5, 0], [5, 7], [0, 2.5], [5, 2.5] ]],
  "5": [[ [5, 7], [0, 7], [0, 3.5], [5, 3.5], [5, 0], [0, 0] ]],
  "6": [[ [5, 7], [0, 3.5], [0, 0], [5, 0], [5, 3.5], [0, 3.5] ]],
  "7": [[ [0, 7], [5, 7], [1.5, 0] ]],
  "8": [[ [0, 0], [0, 7], [5, 7], [5, 0], [0, 0] ], [[0, 3.5], [5, 3.5]]],
  "9": [[ [5, 3.5], [0, 3.5], [0, 7], [5, 7], [5, 0], [0, 0] ]],
  A: [[[0, 0], [2.5, 7], [5, 0]], [[1.2, 3], [3.8, 3]]],
  B: [[[0, 0], [0, 7], [4, 7], [5, 6], [5, 4.3], [4, 3.5], [0, 3.5]], [[0, 3.5], [4, 3.5], [5, 2.7], [5, 1], [4, 0], [0, 0]]],
  C: [[[5, 7], [0, 7], [0, 0], [5, 0]]],
  D: [[[0, 0], [0, 7], [3.5, 7], [5, 5.5], [5, 1.5], [3.5, 0], [0, 0]]],
  E: [[[5, 7], [0, 7], [0, 0], [5, 0]], [[0, 3.5], [3.8, 3.5]]],
  F: [[[0, 0], [0, 7], [5, 7]], [[0, 3.5], [3.8, 3.5]]],
  G: [[[5, 7], [0, 7], [0, 0], [5, 0], [5, 3], [3, 3]]],
  H: [[[0, 0], [0, 7]], [[5, 0], [5, 7]], [[0, 3.5], [5, 3.5]]],
  I: [[[0, 7], [5, 7]], [[2.5, 7], [2.5, 0]], [[0, 0], [5, 0]]],
  J: [[[5, 7], [5, 0], [2, 0], [0, 2]]],
  K: [[[0, 0], [0, 7]], [[5, 7], [0, 3.5], [5, 0]]],
  L: [[[0, 7], [0, 0], [5, 0]]],
  M: [[[0, 0], [0, 7], [2.5, 3], [5, 7], [5, 0]]],
  N: [[[0, 0], [0, 7], [5, 0], [5, 7]]],
  O: [[[0, 0], [0, 7], [5, 7], [5, 0], [0, 0]]],
  P: [[[0, 0], [0, 7], [5, 7], [5, 3.5], [0, 3.5]]],
  Q: [[[0, 0], [0, 7], [5, 7], [5, 0], [0, 0]], [[3, 1.5], [5, 0]]],
  R: [[[0, 0], [0, 7], [5, 7], [5, 3.5], [0, 3.5]], [[0, 3.5], [5, 0]]],
  S: [[[5, 7], [0, 7], [0, 3.5], [5, 3.5], [5, 0], [0, 0]]],
  T: [[[0, 7], [5, 7]], [[2.5, 7], [2.5, 0]]],
  U: [[[0, 7], [0, 0], [5, 0], [5, 7]]],
  V: [[[0, 7], [2.5, 0], [5, 7]]],
  W: [[[0, 7], [1, 0], [2.5, 4], [4, 0], [5, 7]]],
  X: [[[0, 7], [5, 0], [2.5, 3.5], [5, 7], [0, 0]]],
  Y: [[[0, 7], [2.5, 3.5], [5, 7]], [[2.5, 3.5], [2.5, 0]]],
  Z: [[[0, 7], [5, 7], [0, 0], [5, 0]]],
  "/": [[[0, 0], [5, 7]]],
  "×": [[[0, 7], [5, 0]], [[0, 0], [5, 7]]],
  "_": [[[0, 0], [5, 0]]],
  "-": [[[0, 3.5], [5, 3.5]]],
  ":": [[[2.3, 5.7], [2.7, 5.7], [2.7, 5.3], [2.3, 5.3], [2.3, 5.7]], [[2.3, 1.7], [2.7, 1.7], [2.7, 1.3], [2.3, 1.3], [2.3, 1.7]]],
  ".": [[[2.32, 0.22], [2.68, 0.22], [2.68, 0.58], [2.32, 0.58], [2.32, 0.22]]],
  "°": [[[2, 5], [2, 7], [4, 7], [4, 5], [2, 5]]],
  "³": [[[1.2, 7], [4.2, 7], [3, 5.6], [4.2, 5.6], [4.2, 4.2], [1.2, 4.2]]],
  "^": [[[0, 0], [2.5, 7], [5, 0]]],
  " ": [],
};

export function fmt(v: number | string, digits = 4): string {
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v - Math.round(v)) < 10 ** -digits) return String(Math.round(v));
  return v.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

export function computeBands(start: number, end: number, step: number) {
  if (step <= 0) throw new Error("temp_step must be greater than 0.");
  if (start < end) throw new Error("start_temp must be greater than or equal to end_temp.");
  const exact = (start - end) / step;
  const nearest = Math.round(exact);
  return Math.max(1, (Math.abs(exact - nearest) < 1e-9 ? nearest : Math.ceil(exact)) + 1);
}

export function inferFirmwareMode(presetName: string): FirmwareMode {
  const key = presetName.toUpperCase();
  if (key.includes("BAMBU")) return "bambu";
  if (["SNAPMAKER_U1", "VORON", "CREALITY_K1", "CREALITY_K2", "SOVOL_SV08", "QIDI_Q1", "QIDI_PLUS4", "QIDI_X_PLUS_3", "QIDI_X_MAX_3"].some((t) => key.includes(t))) return "klipper";
  if (["PRUSA", "ENDER", "SOVOL_SV06", "ANYCUBIC", "ELEGOO", "FLASHFORGE", "ANKER", "SNAPMAKER_J1"].some((t) => key.includes(t))) return "marlin";
  return "unknown";
}

export function defaultPlacement(bedX: number, bedY: number) {
  if (bedX >= 220 && bedY >= 220) return { square_x: 10, square_y: 10, circle_diameter: 200 };
  return { square_x: 5, square_y: 5, circle_diameter: Math.max(1, Math.min(bedX, bedY) - 10) };
}

export function pointOnCircle(cx: number, cy: number, r: number, deg: number): Point {
  const th = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(th), cy + r * Math.sin(th)];
}

export function arcPoints(cx: number, cy: number, r: number, segments: number, zeroDeg: number, clockwise: boolean): Point[] {
  const sign = clockwise ? -1 : 1;
  return Array.from({ length: segments + 1 }, (_, i) => pointOnCircle(cx, cy, r, zeroDeg + sign * 360 * i / segments));
}

function dist(a: Point, b: Point) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function filamentArea(diameter: number) {
  return Math.PI * (diameter / 2) ** 2;
}

function labelAdvanceUnits(cell: number, xScale: number, lineWidth: number) {
  const targetAdvance = LABEL_GLYPH_WIDTH_UNITS * (1 + LABEL_LETTER_GAP_RATIO);
  return Math.max(LABEL_ADVANCE_UNITS, targetAdvance);
}

function lineWidthUnits(text: string, advanceUnits: number) {
  return Math.max(0, text.length * advanceUnits - (advanceUnits - 1));
}

function transform(p: Point, x0: number, y0: number, cell: number, xScale: number): Point {
  return [x0 + p[0] * cell * xScale, y0 + p[1] * cell];
}

function appendSegment(out: TypedSegment[], p0: Point | undefined, p1: Point | undefined, kind: SegmentKind) {
  if (!p0 || !p1 || dist(p0, p1) <= 0) return;
  out.push([p0, p1, kind]);
}

function pointToSegmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 <= 1e-12) return dist(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj: Point = [a[0] + t * dx, a[1] + t * dy];
  return dist(p, proj);
}

function buildGlyphCenterlines(ch: string, x0: number, y0: number, cell: number, xScale: number) {
  const strokes = FONT[ch.toUpperCase()] ?? FONT[" "];
  const segs: TypedSegment[] = [];
  for (const stroke of strokes) {
    const pts = stroke.map((p) => transform(p, x0, y0, cell, xScale));
    if (!pts.length) continue;
    for (let i = 0; i < pts.length - 1; i++) appendSegment(segs, pts[i], pts[i + 1], "stroke");
  }
  return segs;
}

function glyphSourcePoints(ch: string, x0: number, y0: number, cell: number, xScale: number) {
  const strokes = FONT[ch.toUpperCase()] ?? FONT[" "];
  return strokes.flatMap((stroke) => stroke.map((p) => transform(p, x0, y0, cell, xScale)));
}

function edgeKey(a: Point, b: Point) {
  return `${fmt(a[0], 5)},${fmt(a[1], 5)}>${fmt(b[0], 5)},${fmt(b[1], 5)}`;
}

function pointKey(p: Point) {
  return `${fmt(p[0], 5)},${fmt(p[1], 5)}`;
}

function cross(o: Point, a: Point, b: Point) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points: Point[]) {
  const unique = Array.from(new Map(points.map((p) => [pointKey(p), p] as const)).values());
  if (unique.length <= 1) return unique;
  unique.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
  const lower: Point[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function polygonArea(loop: Point[]) {
  let area = 0;
  for (let i = 0; i < loop.length - 1; i++) area += loop[i][0] * loop[i + 1][1] - loop[i + 1][0] * loop[i][1];
  return area;
}

function loopBounds(loop: Point[]) {
  return {
    minX: Math.min(...loop.map((p) => p[0])),
    maxX: Math.max(...loop.map((p) => p[0])),
    minY: Math.min(...loop.map((p) => p[1])),
    maxY: Math.max(...loop.map((p) => p[1])),
  };
}

function loopCenter(loop: Point[]): Point {
  const b = loopBounds(loop);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
}

function pointInLoop(p: Point, loop: Point[]) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const pi = loop[i];
    const pj = loop[j];
    const intersects = pi[1] > p[1] !== pj[1] > p[1] && p[0] < ((pj[0] - pi[0]) * (p[1] - pi[1])) / (pj[1] - pi[1] || 1e-12) + pi[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function innerLoopsForOuter(outerLoop: Point[], loops: Point[][]) {
  if (!outerLoop.length) return [];
  return loops.slice(1).filter((loop) => pointInLoop(loopCenter(loop), outerLoop));
}

function shouldBridgeInnerLoops(ch: string) {
  return !NO_INNER_LOOP_BRIDGE_CHARS.has(ch);
}

function extractAllLoops(segs: TypedSegment[]) {
  const outgoing = new Map<string, Array<{ start: Point; end: Point }>>();
  segs.forEach(([a, b]) => {
    const key = pointKey(a);
    const arr = outgoing.get(key) ?? [];
    arr.push({ start: a, end: b });
    outgoing.set(key, arr);
  });

  const visited = new Set<string>();
  const loops: Point[][] = [];

  segs.forEach(([a, b]) => {
    const startEdge = edgeKey(a, b);
    if (visited.has(startEdge)) return;
    const loop: Point[] = [a];
    let curA = a;
    let curB = b;
    visited.add(startEdge);
    loop.push(b);

    for (let guard = 0; guard < 20000; guard++) {
      const nextOptions = outgoing.get(pointKey(curB)) ?? [];
      const next = nextOptions.find(({ start, end }) => !visited.has(edgeKey(start, end)));
      if (!next) break;
      visited.add(edgeKey(next.start, next.end));
      curA = next.start;
      curB = next.end;
      if (pointKey(curB) === pointKey(loop[0])) {
        loop.push(loop[0]);
        break;
      }
      loop.push(curB);
    }

    if (loop.length >= 4) {
      loops.push(loop);
    }
  });

  return loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
}

function pickHorizontalLoopPoint(loop: Point[], targetY: number, side: "left" | "right") {
  const sorted = [...loop].sort((a, b) => {
    const dy = Math.abs(a[1] - targetY) - Math.abs(b[1] - targetY);
    if (Math.abs(dy) > 1e-9) return dy;
    return side === "left" ? a[0] - b[0] : b[0] - a[0];
  });
  return sorted[0];
}

function horizontalLoopBridgePoints(loop: Point[], targetY: number): [Point, Point] | undefined {
  const xs: number[] = [];
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i];
    const b = loop[i + 1];
    const y0 = a[1];
    const y1 = b[1];
    if (Math.abs(y0 - y1) <= 1e-9) {
      if (Math.abs(y0 - targetY) <= 1e-9) xs.push(a[0], b[0]);
      continue;
    }
    if (targetY < Math.min(y0, y1) - 1e-9 || targetY > Math.max(y0, y1) + 1e-9) continue;
    const t = (targetY - y0) / (y1 - y0);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    xs.push(a[0] + (b[0] - a[0]) * t);
  }
  if (xs.length < 2) return undefined;
  return [[Math.min(...xs), targetY], [Math.max(...xs), targetY]];
}

function pickVerticalLoopPoint(loop: Point[], targetX: number, side: "top" | "bottom") {
  const sorted = [...loop].sort((a, b) => {
    const dx = Math.abs(a[0] - targetX) - Math.abs(b[0] - targetX);
    if (Math.abs(dx) > 1e-9) return dx;
    return side === "top" ? b[1] - a[1] : a[1] - b[1];
  });
  return sorted[0];
}

function pickPunctuationRailAnchor(g: GlyphBuild, side: "top" | "bottom") {
  const loops = g.outlineLoops.length ? g.outlineLoops : g.outerLoop.length ? [g.outerLoop] : [];
  if (!loops.length) return undefined;
  const selected = loops.reduce((best, loop) => {
    const bestBounds = loopBounds(best);
    const loopBoundsValue = loopBounds(loop);
    return side === "top"
      ? loopBoundsValue.maxY > bestBounds.maxY ? loop : best
      : loopBoundsValue.minY < bestBounds.minY ? loop : best;
  }, loops[0]);
  return pickVerticalLoopPoint(selected, loopCenter(selected)[0], side);
}

function offsetPointTowardRail(start: Point, railY: number, clearance: number): Point {
  const dy = railY - start[1];
  const distance = Math.abs(dy);
  if (distance <= 1e-9) return start;
  if (distance <= clearance) return [start[0], railY];
  return [start[0], start[1] + Math.sign(dy) * clearance];
}

function buildInnerLoopBridges(outerLoop: Point[], innerLoops: Point[][]): TypedSegment[] {
  const bridges: TypedSegment[] = [];
  if (!outerLoop.length || !innerLoops.length) return bridges;
  innerLoops.forEach((loop) => {
    const ys = loop.map((p) => p[1]);
    const targetY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const innerLeft = pickHorizontalLoopPoint(loop, targetY, "left");
    const innerRight = pickHorizontalLoopPoint(loop, targetY, "right");
    const leftCandidates = outerLoop.filter((p) => p[0] <= innerLeft[0] + 1e-9);
    const rightCandidates = outerLoop.filter((p) => p[0] >= innerRight[0] - 1e-9);
    const outerLeft = pickHorizontalLoopPoint(leftCandidates.length ? leftCandidates : outerLoop, targetY, "right");
    const outerRight = pickHorizontalLoopPoint(rightCandidates.length ? rightCandidates : outerLoop, targetY, "left");
    appendSegment(bridges, outerLeft, innerLeft, "stroke");
    appendSegment(bridges, innerRight, outerRight, "stroke");
  });
  return bridges;
}

function buildForcedLoopBridge(ch: string, loops: Point[][]): TypedSegment[] {
  if (ch !== "°" || !loops.length) return [];
  const loop = loops[0];
  const targetY = loopCenter(loop)[1];
  const bridge = horizontalLoopBridgePoints(loop, targetY);
  const left = bridge?.[0] ?? pickHorizontalLoopPoint(loop, targetY, "left");
  const right = bridge?.[1] ?? pickHorizontalLoopPoint(loop, targetY, "right");
  return [[left, right, "stroke"]];
}

function buildDetachedGlyphSpine(ch: string, loops: Point[][]): TypedSegment[] {
  if (![",", "•"].includes(ch)) return [];
  const points = loops.flatMap((loop) => loop);
  if (!points.length) return [];
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const xCenter = (minX + maxX) / 2;
  return [[[xCenter, minY], [xCenter, maxY], "stroke"]];
}

function buildGlyphOutline(ch: string, x0: number, y0: number, cell: number, xScale: number, lineWidth: number) {
  const centerlines = buildGlyphCenterlines(ch, x0, y0, cell, xScale);
  if (!centerlines.length) return [];

  const points = centerlines.flatMap(([a, b]) => [a, b]);
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const radii = [LABEL_INNER_OUTLINE_RADIUS, LABEL_OUTER_RADIUS];
  const sample = Math.max(0.12, lineWidth / 3);
  const all: TypedSegment[] = [];

  radii.forEach((radius) => {
    const pad = radius + sample * 2;
    const originX = minX - pad;
    const originY = minY - pad;
    const cols = Math.max(1, Math.ceil((maxX - minX + pad * 2) / sample));
    const rows = Math.max(1, Math.ceil((maxY - minY + pad * 2) / sample));
    const filled: boolean[][] = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const p: Point = [originX + (gx + 0.5) * sample, originY + (gy + 0.5) * sample];
        filled[gy][gx] = centerlines.some(([a, b]) => pointToSegmentDistance(p, a, b) <= radius);
      }
    }

    const contour: TypedSegment[] = [];
    const xAt = (gx: number) => originX + gx * sample;
    const yAt = (gy: number) => originY + gy * sample;

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (!filled[gy][gx]) continue;
        const leftEmpty = gx === 0 || !filled[gy][gx - 1];
        const rightEmpty = gx === cols - 1 || !filled[gy][gx + 1];
        const bottomEmpty = gy === 0 || !filled[gy - 1][gx];
        const topEmpty = gy === rows - 1 || !filled[gy + 1][gx];

        if (bottomEmpty) contour.push([[xAt(gx), yAt(gy)], [xAt(gx + 1), yAt(gy)], "stroke"]);
        if (rightEmpty) contour.push([[xAt(gx + 1), yAt(gy)], [xAt(gx + 1), yAt(gy + 1)], "stroke"]);
        if (topEmpty) contour.push([[xAt(gx + 1), yAt(gy + 1)], [xAt(gx), yAt(gy + 1)], "stroke"]);
        if (leftEmpty) contour.push([[xAt(gx), yAt(gy + 1)], [xAt(gx), yAt(gy)], "stroke"]);
      }
    }

    const loops = extractAllLoops(contour);
    const outerLoop = loops[0] ?? [];
    const innerLoops = shouldBridgeInnerLoops(ch) ? innerLoopsForOuter(outerLoop, loops) : [];
    loops.forEach((loop) => {
      for (let i = 0; i < loop.length - 1; i++) appendSegment(all, loop[i], loop[i + 1], "stroke");
    });
    buildInnerLoopBridges(outerLoop, innerLoops).forEach((seg) => all.push(seg));
    buildForcedLoopBridge(ch, loops).forEach((seg) => all.push(seg));
    buildDetachedGlyphSpine(ch, loops).forEach((seg) => all.push(seg));
  });

  return all;
}

type GlyphBuild = {
  char: string;
  segments: TypedSegment[];
  outerLoop: Point[];
  innerLoops: Point[][];
  outlineLoops: Point[][];
  sourcePoints: Point[];
  bbox: { minX: number; maxX: number; minY: number; maxY: number };
};

function buildGlyphGeometry(ch: string, x0: number, y0: number, cell: number, xScale: number, lineWidth: number): GlyphBuild {
  const centerlines = buildGlyphCenterlines(ch, x0, y0, cell, xScale);
  const sourcePoints = glyphSourcePoints(ch, x0, y0, cell, xScale);
  if (!centerlines.length || !sourcePoints.length) {
    return { char: ch, segments: [], outerLoop: [], innerLoops: [], outlineLoops: [], sourcePoints: [], bbox: { minX: x0, maxX: x0, minY: y0, maxY: y0 } };
  }

  const points = centerlines.flatMap(([a, b]) => [a, b]);
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const radii = [LABEL_INNER_OUTLINE_RADIUS, LABEL_OUTER_RADIUS];
  const sample = Math.max(0.12, lineWidth / 3);
  const all: TypedSegment[] = [];
  let outerLoop: Point[] = [];
  let innerLoops: Point[][] = [];
  let outlineLoops: Point[][] = [];

  radii.forEach((radius, idx) => {
    const pad = radius + sample * 2;
    const originX = minX - pad;
    const originY = minY - pad;
    const cols = Math.max(1, Math.ceil((maxX - minX + pad * 2) / sample));
    const rows = Math.max(1, Math.ceil((maxY - minY + pad * 2) / sample));
    const filled: boolean[][] = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));

    for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
      const p: Point = [originX + (gx + 0.5) * sample, originY + (gy + 0.5) * sample];
      filled[gy][gx] = centerlines.some(([a, b]) => pointToSegmentDistance(p, a, b) <= radius);
    }

    const contour: TypedSegment[] = [];
    const xAt = (gx: number) => originX + gx * sample;
    const yAt = (gy: number) => originY + gy * sample;
    for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
      if (!filled[gy][gx]) continue;
      const leftEmpty = gx === 0 || !filled[gy][gx - 1];
      const rightEmpty = gx === cols - 1 || !filled[gy][gx + 1];
      const bottomEmpty = gy === 0 || !filled[gy - 1][gx];
      const topEmpty = gy === rows - 1 || !filled[gy + 1][gx];
      if (bottomEmpty) contour.push([[xAt(gx), yAt(gy)], [xAt(gx + 1), yAt(gy)], "stroke"]);
      if (rightEmpty) contour.push([[xAt(gx + 1), yAt(gy)], [xAt(gx + 1), yAt(gy + 1)], "stroke"]);
      if (topEmpty) contour.push([[xAt(gx + 1), yAt(gy + 1)], [xAt(gx), yAt(gy + 1)], "stroke"]);
      if (leftEmpty) contour.push([[xAt(gx), yAt(gy + 1)], [xAt(gx), yAt(gy)], "stroke"]);
    }
        const loops = extractAllLoops(contour);
        if (idx === radii.length - 1) {
          outerLoop = loops[0] ?? [];
          innerLoops = shouldBridgeInnerLoops(ch) ? innerLoopsForOuter(outerLoop, loops) : [];
          outlineLoops = loops;
        }
        loops.forEach((loop) => {
          for (let i = 0; i < loop.length - 1; i++) appendSegment(all, loop[i], loop[i + 1], "stroke");
        });
        if (idx === radii.length - 1) buildInnerLoopBridges(outerLoop, innerLoops).forEach((seg) => all.push(seg));
        if (idx === radii.length - 1) buildForcedLoopBridge(ch, loops).forEach((seg) => all.push(seg));
        if (idx === radii.length - 1) buildDetachedGlyphSpine(ch, loops).forEach((seg) => all.push(seg));
    });

  return { char: ch, segments: all, outerLoop, innerLoops, outlineLoops, sourcePoints, bbox: { minX, maxX, minY, maxY } };
}

function nearestLoopPoint(loop: Point[], target: Point) {
  return loop.reduce((best, p) => dist(p, target) < dist(best, target) ? p : best, loop[0]);
}

function hasCornerNear(points: Point[], target: Point, tol: number) {
  return points.some((p) => dist(p, target) <= tol);
}

function samePoint(a: Point, b: Point, tol = 1e-6) {
  return dist(a, b) <= tol;
}

function orientation(a: Point, b: Point, c: Point) {
  const v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point) {
  return b[0] <= Math.max(a[0], c[0]) + 1e-9 && b[0] + 1e-9 >= Math.min(a[0], c[0]) && b[1] <= Math.max(a[1], c[1]) + 1e-9 && b[1] + 1e-9 >= Math.min(a[1], c[1]);
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function candidateAllowed(a: Point, b: Point, obstacles: TypedSegment[]) {
  return obstacles.every(([p0, p1]) => {
    const touchesAtEnd = samePoint(a, p0) || samePoint(a, p1) || samePoint(b, p0) || samePoint(b, p1) || onSegment(p0, a, p1) || onSegment(p0, b, p1);
    if (!segmentsIntersect(a, b, p0, p1)) return true;
    return touchesAtEnd;
  });
}

function shortestLoopConnector(left: GlyphBuild, right: GlyphBuild, obstacles: TypedSegment[]) {
  let best: [Point, Point] | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const a of left.outerLoop) {
    for (const b of right.outerLoop) {
      const d = dist(a, b);
      if (d >= bestDist) continue;
      if (!candidateAllowed(a, b, obstacles)) continue;
      best = [a, b];
      bestDist = d;
    }
  }
  return best;
}

function connectAdjacentGlyphs(left: GlyphBuild, right: GlyphBuild, cell: number): TypedSegment[] {
  if (!left.outerLoop.length || !right.outerLoop.length) return [];
  const tol = cell * 0.7;
  const leftTR: Point = [left.bbox.maxX, left.bbox.maxY];
  const leftBR: Point = [left.bbox.maxX, left.bbox.minY];
  const rightTL: Point = [right.bbox.minX, right.bbox.maxY];
  const rightBL: Point = [right.bbox.minX, right.bbox.minY];

  const leftTop = nearestLoopPoint(left.outerLoop, leftTR);
  const leftBottom = nearestLoopPoint(left.outerLoop, leftBR);
  const rightTop = nearestLoopPoint(right.outerLoop, rightTL);
  const rightBottom = nearestLoopPoint(right.outerLoop, rightBL);

  const segs: TypedSegment[] = [];
  const obstacles = [...left.segments, ...right.segments];

  const leftHasTop = hasCornerNear(left.sourcePoints, leftTR, tol);
  const leftHasBottom = hasCornerNear(left.sourcePoints, leftBR, tol);
  const rightHasTop = hasCornerNear(right.sourcePoints, rightTL, tol);
  const rightHasBottom = hasCornerNear(right.sourcePoints, rightBL, tol);
  if (leftHasTop && leftHasBottom && rightHasTop && rightHasBottom) {
    if (candidateAllowed(leftTop, rightBottom, obstacles)) appendSegment(segs, leftTop, rightBottom, "connector");
    if (candidateAllowed(leftBottom, rightTop, obstacles)) appendSegment(segs, leftBottom, rightTop, "connector");
  } else {
    const best = shortestLoopConnector(left, right, obstacles);
    if (best) appendSegment(segs, best[0], best[1], "connector");
  }
  return segs;
}

function buildInterlineRails(linesGlyphs: GlyphBuild[][], cell: number, connectorClearance: number) {
  const segs: TypedSegment[] = [];
  const punctuationChars = new Set([":", ".", "°"]);
  for (let i = 0; i < linesGlyphs.length - 1; i++) {
    const upper = linesGlyphs[i].filter((g) => g.outerLoop.length);
    const lower = linesGlyphs[i + 1].filter((g) => g.outerLoop.length);
    if (!upper.length || !lower.length) continue;
    const upperPts = upper.flatMap((g) => g.outerLoop);
    const lowerPts = lower.flatMap((g) => g.outerLoop);
    const upperMinX = Math.min(...upperPts.map((p) => p[0]));
    const upperMaxX = Math.max(...upperPts.map((p) => p[0]));
    const upperBottomY = Math.min(...upperPts.map((p) => p[1]));
    const lowerMinX = Math.min(...lowerPts.map((p) => p[0]));
    const lowerMaxX = Math.max(...lowerPts.map((p) => p[0]));
    const lowerTopY = Math.max(...lowerPts.map((p) => p[1]));
    const eps = Math.max(0.02, cell * 0.03);
    const upperRailY = upperBottomY - eps;
    const lowerRailY = lowerTopY + eps;
    appendSegment(segs, [upperMinX, upperRailY], [upperMaxX, upperRailY], "connector");
    appendSegment(segs, [lowerMinX, lowerRailY], [lowerMaxX, lowerRailY], "connector");
    lower.forEach((g) => {
      if (!punctuationChars.has(g.char)) return;
      const start = pickPunctuationRailAnchor(g, "top");
      if (!start) return;
      appendSegment(segs, offsetPointTowardRail(start, lowerRailY, connectorClearance), [start[0], lowerRailY], "connector");
    });
    upper.forEach((g) => {
      if (!punctuationChars.has(g.char)) return;
      const start = pickPunctuationRailAnchor(g, "bottom");
      if (!start) return;
      appendSegment(segs, offsetPointTowardRail(start, upperRailY, connectorClearance), [start[0], upperRailY], "connector");
    });
  }
  const lastLine = linesGlyphs[linesGlyphs.length - 1]?.filter((g) => g.outerLoop.length) ?? [];
  if (lastLine.length) {
    const lastPts = lastLine.flatMap((g) => g.outerLoop);
    const lastMinX = Math.min(...lastPts.map((p) => p[0]));
    const lastMaxX = Math.max(...lastPts.map((p) => p[0]));
    const lastBottomY = Math.min(...lastPts.map((p) => p[1]));
    const eps = Math.max(0.02, cell * 0.03);
    const bottomRailY = lastBottomY - eps;
    appendSegment(segs, [lastMinX, bottomRailY], [lastMaxX, bottomRailY], "connector");
    lastLine.forEach((g) => {
      if (!punctuationChars.has(g.char)) return;
      const start = pickPunctuationRailAnchor(g, "bottom");
      if (!start) return;
      appendSegment(segs, offsetPointTowardRail(start, bottomRailY, connectorClearance), [start[0], bottomRailY], "connector");
    });
  }
  return segs;
}

function buildHullLoops(segs: TypedSegment[]) {
  const points = segs.flatMap(([a, b]) => [a, b]);
  const hull = convexHull(points);
  if (hull.length < 3) return [];
  const closed = [...hull, hull[0]];
  const loop: TypedSegment[] = [];
  for (let i = 0; i < closed.length - 1; i++) appendSegment(loop, closed[i], closed[i + 1], "stroke");
  return [...loop, ...loop];
}

function labelHeight(cfg: GeneratorConfig, lines: string[]) {
  if (cfg.label_height && cfg.label_height > 0) return cfg.label_height;
  const cellScale = cfg.label_x_scale;
  const maxUnits = Math.max(...lines.map(lineWidthUnits), 1);
  const maxWidth = cfg.circle_diameter - 2 * cfg.label_margin;
  const hByWidth = (maxWidth * 7) / (maxUnits * cellScale);
  const hByHeight = (cfg.circle_diameter * 0.38) / (lines.length + Math.max(0, lines.length - 1) * 0.65);
  return Math.max(1, Math.min(hByWidth, hByHeight));
}

function baseBottomLabelHeight(cfg: GeneratorConfig) {
  const lines = makeLabelLines(cfg);
  const computed = labelHeight(cfg, lines);
  return Math.min(computed, cfg.circle_diameter >= 200 ? 10 : 5);
}

function rotatePoint(p: Point, deg: number): Point {
  const th = (deg * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

function transformSegments(segs: TypedSegment[], deg: number, tx: number, ty: number): TypedSegment[] {
  return segs.map(([a, b, kind]) => {
    const ra = rotatePoint(a, deg);
    const rb = rotatePoint(b, deg);
    return [[ra[0] + tx, ra[1] + ty], [rb[0] + tx, rb[1] + ty], kind];
  });
}

function buildSingleLineTextSegments(text: string, charH: number, xScale: number, lineWidth: number): TypedSegment[] {
  if (!text.trim()) return [];
  const cell = charH / 7;
  const advanceUnits = labelAdvanceUnits(cell, xScale, lineWidth);
  const width = lineWidthUnits(text, advanceUnits) * cell * xScale;
  const xLeft = -width / 2;
  const y0 = -charH / 2;
  const all: TypedSegment[] = [];
  [...text].forEach((ch, ci) => {
    const x0 = xLeft + ci * advanceUnits * cell * xScale;
    all.push(...buildGlyphCenterlines(ch, x0, y0, cell, xScale));
  });
  return all;
}

function ringMvsLabelValues(cfg: GeneratorConfig) {
  const values: number[] = [cfg.mvs_min];
  const startMultiple = Math.ceil(cfg.mvs_min / 5) * 5;
  for (let v = startMultiple; v <= cfg.mvs_max + 1e-9; v += 5) {
    if (Math.abs(v - cfg.mvs_min) < 1e-9) continue;
    values.push(v);
  }
  return values;
}

function buildRingMvsTickSegments(cfg: GeneratorConfig): TypedSegment[] {
  const values: number[] = [];
  const start = Math.ceil(cfg.mvs_min);
  const end = Math.floor(cfg.mvs_max);
  for (let v = start; v <= end; v += 1) values.push(v);
  const radius = cfg.circle_diameter / 2;
  const cx = cfg.square_x + radius;
  const cy = cfg.square_y + radius;
  const sign = cfg.clockwise ? -1 : 1;
  const all: TypedSegment[] = [];

  values.forEach((value) => {
    const t = cfg.mvs_max > cfg.mvs_min ? (value - cfg.mvs_min) / (cfg.mvs_max - cfg.mvs_min) : 0;
    const angle = cfg.zero_angle_deg + sign * 360 * t;
    const outer = pointOnCircle(cx, cy, radius - 1.1, angle);
    const inner = pointOnCircle(cx, cy, radius - (value % 5 === 0 ? 3.2 : 2.1), angle);
    appendSegment(all, outer, inner, "stroke");
  });

  return all;
}

function buildRingMvsLabels(cfg: GeneratorConfig): TypedSegment[] {
  if (!cfg.label) return [];
  const values = ringMvsLabelValues(cfg);
  const charH = baseBottomLabelHeight(cfg) * 0.5;
  const radius = cfg.circle_diameter / 2;
  const cx = cfg.square_x + radius;
  const cy = cfg.square_y + radius;
  const sign = cfg.clockwise ? -1 : 1;
  const textRadius = radius - charH * 0.75 - 1.0;
  const all: TypedSegment[] = [];

  values.forEach((value) => {
    const t = cfg.mvs_max > cfg.mvs_min ? (value - cfg.mvs_min) / (cfg.mvs_max - cfg.mvs_min) : 0;
    const angle = cfg.zero_angle_deg + sign * 360 * t;
    const anchor = pointOnCircle(cx, cy, textRadius, angle);
    const tangentDeg = angle + (cfg.clockwise ? -90 : 90);
    const text = Number.isInteger(value) ? String(Math.round(value)) : fmt(value);
    const segs = buildSingleLineTextSegments(text, charH, cfg.label_x_scale, cfg.line_width);
    all.push(...transformSegments(segs, tangentDeg, anchor[0], anchor[1]));
  });

  return all;
}

export function makeLabelLines(cfg: GeneratorConfig) {
  const layerHeightText = fmt(cfg.layer_height);
  if (cfg.label_layout === "one-line") {
    return [
      `${cfg.printer_name}/${cfg.filament_name}/ND ${fmt(cfg.nozzle_size, 2)}mm start:${fmt(cfg.start_temp)}°C/dec:-${fmt(cfg.temp_step)}°C×${cfg.layers_per_band}×${layerHeightText}mm MAX MVS:${fmt(cfg.mvs_max)}mm³/s`,
    ];
  }
  return [
    `${cfg.printer_name}/${cfg.filament_name}/ND ${fmt(cfg.nozzle_size, 2)}mm`,
    `start:${fmt(cfg.start_temp)}°C/dec:-${fmt(cfg.temp_step)}°C×${cfg.layers_per_band}×${layerHeightText}mm`,
    `MAX MVS:${fmt(cfg.mvs_max)}mm³/s`,
  ];
}

export function buildLabelSegments(cfg: GeneratorConfig): TypedSegment[] {
  if (!cfg.label) return [];
  const lines = makeLabelLines(cfg);
  let charH = baseBottomLabelHeight(cfg);
  const cell = charH / 7;
  const lineGap = charH * 0.65;
  const centerX = cfg.square_x + cfg.circle_diameter / 2;
  const centerY = cfg.square_y + cfg.circle_diameter / 2;
  const advanceUnits = labelAdvanceUnits(cell, cfg.label_x_scale, cfg.line_width);
  const widths = lines.map((s) => lineWidthUnits(s, advanceUnits) * cell * cfg.label_x_scale);
  const blockH = lines.length * charH + Math.max(0, lines.length - 1) * lineGap;
  const topY = centerY + blockH / 2 - charH;
  const all: TypedSegment[] = [];
  const linesGlyphs: GlyphBuild[][] = [];

  lines.forEach((text, li) => {
    const y0 = topY - li * (charH + lineGap);
    const xLeft = centerX - widths[li] / 2;
    const glyphs = [...text].map((ch, ci) => buildGlyphGeometry(ch, xLeft + ci * advanceUnits * cell * cfg.label_x_scale, y0, cell, cfg.label_x_scale, cfg.line_width));
    linesGlyphs.push(glyphs);
    glyphs.forEach((g) => all.push(...g.segments));
  });
  return [
    ...all,
    ...buildInterlineRails(linesGlyphs, cell, Math.max(0, cfg.label_connector_width / 2)),
    ...buildHullLoops(all),
    ...buildRingMvsTickSegments(cfg),
    ...buildRingMvsLabels(cfg),
  ];
}

function emitFirmwareMotionBlock(lines: string[], cfg: GeneratorConfig) {
  lines.push("", "; ---------- firmware motion hint ----------", `; firmware_mode=${cfg.firmware_mode}`);
  if (cfg.firmware_mode === "klipper") {
    lines.push(`SET_VELOCITY_LIMIT VELOCITY=${fmt(cfg.motion_velocity)} ACCEL=${fmt(cfg.motion_accel)} MINIMUM_CRUISE_RATIO=${fmt(cfg.motion_minimum_cruise_ratio)} SQUARE_CORNER_VELOCITY=${fmt(cfg.motion_square_corner_velocity)}`);
    lines.push(`M204 S${fmt(cfg.motion_accel)}`, "M220 S100");
  } else if (cfg.firmware_mode === "marlin") {
    lines.push(`M203 X${fmt(cfg.motion_velocity)} Y${fmt(cfg.motion_velocity)} Z20 E80`);
    lines.push(`M201 X${fmt(cfg.motion_accel)} Y${fmt(cfg.motion_accel)} Z300 E5000`);
    lines.push(`M204 S${fmt(cfg.motion_accel)}`, `M204 P${fmt(cfg.motion_accel)} T${fmt(cfg.motion_accel)}`);
    lines.push(`M205 X${fmt(cfg.motion_jerk)} Y${fmt(cfg.motion_jerk)} Z0.4 E5`, "M220 S100");
  } else if (cfg.firmware_mode === "bambu") {
    lines.push("; Bambu stock firmware is not Klipper. Keep this conservative.");
    lines.push(`M204 S${fmt(cfg.motion_accel)}`, `M204 P${fmt(cfg.motion_accel)} T${fmt(cfg.motion_accel)}`, "M220 S100");
  } else {
    lines.push("; firmware_mode=unknown: no acceleration/speed unlock code inserted", "; WARNING: acceleration/speed limits may not be unlocked");
  }
  lines.push("; ---------- end firmware motion hint ----------");
}

function emitTemperatureSet(lines: string[], cfg: GeneratorConfig, targetTemp: number, waitMode?: "min" | "max") {
  const temp = fmt(targetTemp);
  if (cfg.firmware_mode === "klipper") {
    lines.push(`SET_HEATER_TEMPERATURE HEATER=${cfg.heater} TARGET=${temp}`);
    if (waitMode === "min") lines.push(`TEMPERATURE_WAIT SENSOR=${cfg.heater} MINIMUM=${fmt(targetTemp - cfg.temp_wait_tolerance)}`);
    if (waitMode === "max") lines.push(`TEMPERATURE_WAIT SENSOR=${cfg.heater} MAXIMUM=${fmt(targetTemp + cfg.temp_wait_tolerance)}`);
    return;
  }
  lines.push(`M104 S${temp}`);
  if (waitMode) lines.push(`M109 S${temp}`);
}

function parseMove(line: string) {
  const cmd = line.trim().split(/\s+/)[0];
  if (cmd !== "G0" && cmd !== "G1") return null;
  const vals = Object.fromEntries([...line.matchAll(/([XYZE])([-+]?\d*\.?\d+)/g)].map((m) => [m[1], Number(m[2])]));
  return { cmd, vals };
}

export function getPreviewData(cfg: GeneratorConfig): PreviewData {
  const radius = cfg.circle_diameter / 2;
  const cx = cfg.square_x + radius;
  const cy = cfg.square_y + radius;
  const fallbackCircle = arcPoints(cx, cy, radius, Math.max(12, cfg.arc_segments), cfg.zero_angle_deg, cfg.clockwise);
  const labelSegments = cfg.label ? buildLabelSegments(cfg) : [];
  return {
    bed: { x: cfg.bed_x, y: cfg.bed_y },
    square: { x: cfg.square_x, y: cfg.square_y, d: cfg.circle_diameter },
    circleSegments: fallbackCircle.slice(1).map((p, i) => [fallbackCircle[i], p, "stroke"]),
    labelSegments,
    seam: fallbackCircle[0],
    totalLayers: cfg.bands * cfg.layers_per_band,
    totalHeight: cfg.bands * cfg.layers_per_band * cfg.layer_height,
  };
}

export function makeGcode(cfg: GeneratorConfig) {
  const fa = filamentArea(cfg.filament_diameter);
  const crossSection = cfg.line_width * cfg.layer_height;
  const radius = cfg.circle_diameter / 2;
  const centerX = cfg.square_x + radius;
  const centerY = cfg.square_y + radius;
  const totalLayers = cfg.bands * cfg.layers_per_band;
  const totalHeight = totalLayers * cfg.layer_height;
  const pts = arcPoints(centerX, centerY, radius, cfg.arc_segments, cfg.zero_angle_deg, cfg.clockwise);
  const labelLines = makeLabelLines(cfg);
  const lines: string[] = [
    "; generated by mvs_calibrator web",
    "; purpose: melt-limit + in-layer continuous MVS ramp + printer presets + bounding-square placement + centered bottom label",
    `; printer_preset=${cfg.printer_preset}`,
    `; printer_name=${cfg.printer_name}`,
    `; preset_source=${cfg.source}`,
    `; filament_name=${cfg.filament_name}`,
    `; nozzle_size=${fmt(cfg.nozzle_size)}`,
    `; bed_x=${fmt(cfg.bed_x)}`,
    `; bed_y=${fmt(cfg.bed_y)}`,
    `; bed_z=${fmt(cfg.bed_z)}`,
    `; circle_diameter=${fmt(cfg.circle_diameter)}`,
    `; square_x=${fmt(cfg.square_x)}`,
    `; square_y=${fmt(cfg.square_y)}`,
    `; computed_center_x=${fmt(centerX)}`,
    `; computed_center_y=${fmt(centerY)}`,
    `; layer_height=${fmt(cfg.layer_height)}`,
    `; line_width=${fmt(cfg.line_width)}`,
    `; filament_diameter=${fmt(cfg.filament_diameter)}`,
    `; bands=${cfg.bands}`,
    `; layers_per_band=${cfg.layers_per_band}`,
    `; band_height=${fmt(cfg.layers_per_band * cfg.layer_height)}`,
    `; start_temp=${fmt(cfg.start_temp)}`,
    `; end_temp=${fmt(cfg.end_temp)}`,
    `; temp_step=${fmt(cfg.temp_step)}`,
    `; final_temp=${fmt(cfg.start_temp - cfg.temp_step * (cfg.bands - 1))}`,
    `; mvs_min=${fmt(cfg.mvs_min)}`,
    `; mvs_max=${fmt(cfg.mvs_max)}`,
    `; arc_segments=${cfg.arc_segments}`,
    `; total_height=${fmt(totalHeight)}`,
    `; zero_angle_deg=${fmt(cfg.zero_angle_deg)}`,
    `; clockwise=${cfg.clockwise ? 1 : 0}`,
    "; mvs_angle_map:",
    ";   0%=start/seam, 25%=quarter circle, 50%=half circle, 75%=three-quarter circle, 100%=end",
  ];

  [0, 25, 50, 75, 100].forEach((pct) => {
    const mvs = cfg.mvs_min + ((cfg.mvs_max - cfg.mvs_min) * pct) / 100;
    const speed = mvs > 0 ? mvs / crossSection : 0;
    const angle = cfg.zero_angle_deg + (cfg.clockwise ? -1 : 1) * 360 * pct / 100;
    lines.push(`;   ${String(pct).padStart(3)}% angle=${fmt(angle, 2)}deg MVS=${fmt(mvs, 3)}mm3/s XY_speed=${fmt(speed, 3)}mm/s F=${fmt(speed * 60, 1)}`);
  });

  lines.push("", "; ---------- USER SAFETY CHECK ----------", "; MVS=0 exactly means no movement/no extrusion. Use mvs-min 0.1 or higher for real measurement.", "; This build always generates standalone output.", "; Standalone start runs G28 before heating/waiting, then heat/prime/end G-code.", "; ---------------------------------------", "", "G90 ; absolute XYZ", "M83 ; relative extrusion", "M220 S100 ; speed factor", "M221 S100 ; flow factor");
  lines.push("", "; ---------- minimal standalone start ----------", "G28 ; home all axes first");
  emitFirmwareMotionBlock(lines, cfg);
  lines.push(`M140 S${fmt(cfg.bed_temp)}`, `M104 S${fmt(cfg.start_temp)}`, `M190 S${fmt(cfg.bed_temp)}`, `M109 S${fmt(cfg.start_temp)}`, "G92 E0", `G1 Z${fmt(cfg.layer_height)} F600`, `G1 X${fmt(Math.max(0, cfg.square_x - 8))} Y${fmt(cfg.square_y)} F6000`, `G1 X${fmt(Math.max(0, cfg.square_x - 8))} Y${fmt(cfg.square_y + cfg.circle_diameter)} E6 F600`, "G92 E0", "; ---------- end minimal standalone start ----------");

  let labelEnd: Point | undefined;
  if (cfg.label) {
    emitTemperatureSet(lines, cfg, cfg.start_temp, "min");
    const typed = buildLabelSegments(cfg);
    const labelStrokeWidth = LABEL_OUTLINE_WIDTH;
    const labelConnectorWidth = Math.max(0, cfg.label_connector_width);
    lines.push("", "; ---------- bottom inner label ----------", "; label_toolpath=glyph_outer_double_contour_plus_convex_hull", "; label_visual_layout=three_line_default", "; label_path_order=line1_LTR_line2_LTR_line3_LTR", "; label_width_mode=stroke_vs_connector", `; label_stroke_width=${fmt(labelStrokeWidth)}`, `; label_connector_width=${fmt(labelConnectorWidth)}`, "; label_inner_contours_per_glyph=2", "; label_outer_hull_passes=2", "; label_inner_contour_gap_mm=0", `; label_layout=${cfg.label_layout}`, `; label_lines=${labelLines.join(" | ")}`, `; ring_mvs_values=${ringMvsLabelValues(cfg).map((v) => fmt(v)).join(",")}`, `; label_segments_total=${typed.length}`, `; label_segments_stroke=${typed.filter((s) => s[2] === "stroke").length}`, `; label_segments_connector=${typed.filter((s) => s[2] === "connector").length}`);
    if (typed.length) {
      const start = typed[0][0];
      lines.push(`G0 Z${fmt(cfg.layer_height)} F${fmt(cfg.z_travel_speed * 60, 1)}`);
      lines.push(`G0 X${fmt(start[0])} Y${fmt(start[1])} F${fmt(cfg.travel_speed * 60, 1)} ; label start, only travel move`);
      let eTotal = 0;
      let cursor = start;
      typed.forEach(([p0, p1, kind]) => {
        if (dist(cursor, p0) > 1e-9) {
          lines.push(`G0 X${fmt(p0[0])} Y${fmt(p0[1])} F${fmt(cfg.travel_speed * 60, 1)} ; label stroke jump`);
        }
        const width = kind === "connector" ? labelConnectorWidth : labelStrokeWidth;
        const e = (dist(p0, p1) * width * cfg.layer_height / fa) * cfg.extrusion_multiplier;
        eTotal += e;
        labelEnd = p1;
        cursor = p1;
        lines.push(`G1 X${fmt(p1[0])} Y${fmt(p1[1])} E${fmt(e, 5)} F${fmt(cfg.label_speed * 60, 1)} ; label_${kind} width=${fmt(width)}`);
      });
      lines.push(`; label_estimated_E_mm=${fmt(eTotal, 3)}`);
    } else {
      lines.push("; label skipped: no typed segments");
    }
    lines.push("; ---------- end bottom inner label ----------");
  }

  let currentTemp: number | undefined;
  let estimatedE = 0;
  for (let layer = 1; layer <= totalLayers; layer++) {
    const z = layer * cfg.layer_height;
    const band = Math.floor((layer - 1) / cfg.layers_per_band);
    const layerInBand = ((layer - 1) % cfg.layers_per_band) + 1;
    const targetTemp = cfg.start_temp - cfg.temp_step * band;
    lines.push("", `;LAYER:${layer}`, `;Z:${fmt(z)}`, `;TEMP_BAND:${band + 1}`, `;LAYER_IN_TEMP_BAND:${layerInBand}/${cfg.layers_per_band}`, `;TARGET_TEMP:${fmt(targetTemp)}`);
    if (currentTemp !== targetTemp) {
      lines.push(`; temp change: ${currentTemp === undefined ? "initial" : fmt(currentTemp)} -> ${fmt(targetTemp)}`);
      emitTemperatureSet(lines, cfg, targetTemp, currentTemp === undefined || targetTemp > currentTemp ? "min" : "max");
      currentTemp = targetTemp;
    }

    const start = pts[0];
    if (layer === 1 && labelEnd) {
      lines.push("; label end -> seam: travel only");
      lines.push(`G0 X${fmt(start[0])} Y${fmt(start[1])} F${fmt(cfg.travel_speed * 60, 1)} ; label_end_to_seam_travel`);
    } else {
      lines.push(`G0 Z${fmt(z)} F${fmt(cfg.z_travel_speed * 60, 1)}`);
      lines.push(`G0 X${fmt(start[0])} Y${fmt(start[1])} F${fmt(cfg.travel_speed * 60, 1)} ; seam / 0% MVS point on bounding square edge`);
    }
    if (cfg.retract > 0) {
      lines.push(`G1 E-${fmt(cfg.retract)} F${fmt(cfg.retract_speed * 60, 1)} ; retract`, `G1 E${fmt(cfg.retract)} F${fmt(cfg.retract_speed * 60, 1)} ; unretract`);
    }
    for (let i = 0; i < cfg.arc_segments; i++) {
      const progressMid = (i + 0.5) / cfg.arc_segments;
      const requestedMvs = cfg.mvs_min + (cfg.mvs_max - cfg.mvs_min) * progressMid;
      let xySpeed = layer === 1 ? 60 : (requestedMvs > 0 ? requestedMvs / crossSection : cfg.min_xy_speed);
      let actualMvs = xySpeed * crossSection;
      if (layer !== 1 && cfg.max_xy_speed > 0 && xySpeed > cfg.max_xy_speed) {
        xySpeed = cfg.max_xy_speed;
        actualMvs = xySpeed * crossSection;
      }
      const b = pts[i + 1];
      const e = dist(pts[i], b) * crossSection / fa * cfg.extrusion_multiplier;
      estimatedE += e;
      lines.push(`G1 X${fmt(b[0])} Y${fmt(b[1])} E${fmt(e, 5)} F${fmt(xySpeed * 60, 1)} ; pct=${fmt(progressMid * 100, 2)} req_MVS=${fmt(requestedMvs, 3)} actual_MVS=${fmt(actualMvs, 3)}`);
    }
  }

  lines.push("", "; ---------- end of calibration body ----------", `; estimated_total_filament_E_mm=${fmt(estimatedE, 3)}`, "", "; ---------- minimal standalone end ----------", "G92 E0", "G1 E-2 F1800", `G0 Z${fmt(totalHeight + 10)} F1200`, "M104 S0", "M140 S0", "M106 S0", "G90", "; ---------- end minimal standalone end ----------");
  return `${lines.join("\n")}\n`;
}

