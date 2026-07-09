import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import presetsJson from "./data/printer_presets.json";
import {
  computeBands,
  defaultPlacement,
  FirmwareMode,
  fmt,
  GeneratorConfig,
  getPreviewData,
  inferFirmwareMode,
  LABEL_OUTLINE_WIDTH,
  makeGcode,
  PrinterPreset,
  SegmentKind,
  LESIC_METADATA_JSON_PREFIX,
} from "./generator/mvsGenerator";
import { bambu3mfFileName, extractBambuPlateGcode, makeBambu3mfBlob, supportsBuiltInBambu3mf } from "./generator/bambu3mf";
import "./styles.css";

const presets = presetsJson as Record<string, PrinterPreset>;
const presetNames = Object.keys(presets).sort();
const nozzleOptions = [0.8, 0.6, 0.4, 0.25, 0.2, 0.15] as const;
const filamentTypeOptions = ["PLA", "PETG", "ABS", "ASA", "TPU", "PA", "PC", "PVA", "HIPS", "PLA-CF", "PETG-CF", "PA-CF", "PC-CF"] as const;
const optimalLineWidthByNozzle: Record<number, number> = {
  0.8: 0.96,
  0.6: 0.72,
  0.4: 0.48,
  0.25: 0.3,
  0.2: 0.24,
  0.15: 0.18,
};

function optimalLineWidth(nozzleSize: number) {
  return optimalLineWidthByNozzle[nozzleSize] ?? Math.max(0.18, nozzleSize * 1.2);
}

function optimalLayerHeight(nozzleSize: number) {
  return Math.round(nozzleSize * 0.6 * 1000) / 1000;
}

type Language = "ko" | "en";

const translations = {
  en: {
    unknownWarning: "Acceleration/speed limits may not be unlocked.",
    readyLog: "Ready. Press Preview or Generate G-code.",
    generatedLog: (name: string) => `Generated G-code: ${name}`,
    generated3mfLog: (name: string) => `Generated Bambu 3MF: ${name}`,
    previewLogBands: (bands: number) => `Preview: computed bands = ${bands}`,
    previewLogParsed: "Preview parsed from generated G-code.",
    outputPrompt: "Output G-code file name",
    outputSetLog: (name: string) => `Output file name set: ${name}`,
    subtitle: "Left controls, right G-code based bed preview. Always standalone, G28 first.",
    output: "Output",
    printer: "Printer",
    temperature: "Temperature",
    geometry: "MVS / Geometry",
    buildVolume: "Build Volume Override",
    placement: "Placement Override",
    label: "Label",
    firmwareMotion: "Firmware Motion",
    outputDesc: "Saved file name.",
    outputLabel: "Output file",
    printerPresetDesc: "Printer base preset.",
    printerPresetLabel: "Printer preset",
    firmwareModeDesc: "G-code dialect.",
    firmwareModeLabel: "Firmware",
    filamentNameDesc: "Bottom label material name.",
    filamentNameLabel: "Filament name",
    startTempDesc: "Starting nozzle temp.",
    startTempLabel: "Start temp",
    endTempDesc: "Ending nozzle temp.",
    endTempLabel: "End temp",
    tempStepDesc: "Temp drop per band.",
    tempStepLabel: "Temp band step",
    layersPerBandDesc: "Layers in each band.",
    layersPerBandLabel: "Layers per temp band",
    bedTempDesc: "Bed target temp.",
    bedTempLabel: "Bed temp",
    layerHeightDesc: "Auto from nozzle size.",
    layerHeightLabel: "Layer height",
    mvsMinDesc: "Starting flow value.",
    mvsMinLabel: "Min MVS",
    mvsMaxDesc: "Maximum flow value.",
    mvsMaxLabel: "Max MVS",
    arcSegmentsDesc: "Circle resolution.",
    arcSegmentsLabel: "Arc segments",
    bedXDesc: "Bed X size.",
    bedXLabel: "Bed X",
    bedYDesc: "Bed Y size.",
    bedYLabel: "Bed Y",
    placementDesc: "Blank uses auto placement.",
    squareXLabel: "Start X",
    squareYLabel: "Start Y",
    circleDiameterLabel: "Circle diameter",
    labelHeightDesc: "Blank uses auto-fit.",
    labelEnabledDesc: "Enable or disable the bottom label.",
    labelEnabledLabel: "Bottom label",
    labelHeightLabel: "Label height",
    motionAccelDesc: "Default acceleration.",
    motionAccelLabel: "Acceleration",
    motionVelocityDesc: "XY speed limit.",
    motionVelocityLabel: "Velocity limit",
    motionJerkDesc: "Marlin jerk value.",
    motionJerkLabel: "Jerk",
    presetPlaceholder: "preset",
    autoPlaceholder: "auto",
    generate: "Generate G-code",
    generateBambu3mf: "Bambu 3MF",
    preview: "Preview",
    chooseOutput: "Choose output",
    showGcode: "Show G-code",
    hideGcode: "Hide G-code",
    previewTitle: "Preview: parsed from generated G-code",
    firmware: "firmware",
    strokeWidth: (stroke: string) => `label width ${stroke}`,
    boundingWarning: "bounding square exceeds bed",
    language: "Language",
    loadLesicFile: "Load LESIC file",
    loadConfirm: "Loading this file will replace all current input variables. Continue?",
    loadedFileLog: (name: string) => `Loaded LESIC settings: ${name}`,
    loadFileError: "로드한 파일은 LESIC으로 생성한 캘리브레이션 모델이 아니거나 손상되어 읽을수 없습니다!",
    labelEnabled: "label",
    nozzleSizeDesc: "Nozzle choice sets line width.",
    nozzleSizeLabel: "Nozzle size",
  },
  ko: {
    unknownWarning: "가속도/속도 제한이 해제되지 않았을 수 있습니다.",
    readyLog: "준비 완료. Preview 또는 Generate G-code를 누르세요.",
    generatedLog: (name: string) => `G-code 생성: ${name}`,
    generated3mfLog: (name: string) => `Bambu 3MF 생성: ${name}`,
    previewLogBands: (bands: number) => `Preview: 계산된 밴드 수 = ${bands}`,
    previewLogParsed: "Preview가 생성된 G-code 기준으로 갱신되었습니다.",
    outputPrompt: "출력 G-code 파일명",
    outputSetLog: (name: string) => `출력 파일명 설정: ${name}`,
    subtitle: "왼쪽은 설정, 오른쪽은 G-code 기반 베드 프리뷰입니다. 항상 standalone이며 G28을 먼저 실행합니다.",
    output: "출력",
    printer: "프린터",
    temperature: "온도",
    geometry: "MVS / Geometry",
    buildVolume: "빌드 볼륨 오버라이드",
    placement: "배치 오버라이드",
    label: "라벨",
    firmwareMotion: "펌웨어 모션",
    outputDesc: "저장될 파일명",
    printerPresetDesc: "프린터 기본 프리셋",
    firmwareModeDesc: "G-code 문법 방식",
    filamentNameDesc: "바닥 라벨 재질명",
    startTempDesc: "시작 노즐 온도",
    endTempDesc: "끝 노즐 온도",
    tempStepDesc: "온도 구간당 감소폭",
    layersPerBandDesc: "온도 구간당 레이어 수",
    bedTempDesc: "베드 목표 온도",
    layerHeightDesc: "노즐 60% 자동 설정",
    mvsMinDesc: "시작 유량값",
    mvsMaxDesc: "최대 유량값",
    arcSegmentsDesc: "원 해상도",
    bedXDesc: "베드 X 크기",
    bedYDesc: "베드 Y 크기",
    placementDesc: "비우면 자동 배치",
    labelHeightDesc: "비우면 자동 높이",
    motionAccelDesc: "기본 가속도",
    motionVelocityDesc: "XY 속도 제한",
    motionJerkDesc: "Marlin 저크값",
    presetPlaceholder: "preset",
    autoPlaceholder: "auto",
    generate: "G-code 생성",
    generateBambu3mf: "Bambu 3MF",
    preview: "Preview",
    chooseOutput: "출력 선택",
    showGcode: "G-code 보기",
    hideGcode: "G-code 숨기기",
    previewTitle: "Preview: 생성된 G-code 기준",
    firmware: "firmware",
    strokeWidth: (stroke: string) => `label width ${stroke}`,
    boundingWarning: "바운딩 사각형이 베드를 벗어납니다.",
    language: "언어",
    loadLesicFile: "LESIC 파일 불러오기",
    loadConfirm: "파일을 불러오면 현재 입력돼있는 변수가 모두 사라집니다. 정말 실행하겠습니까?",
    loadedFileLog: (name: string) => `LESIC 설정 불러옴: ${name}`,
    loadFileError: "로드한 파일은 LESIC으로 생성한 캘리브레이션 모델이 아니거나 손상되어 읽을수 없습니다!",
    labelEnabled: "라벨 사용",
    nozzleSizeDesc: "선택 시 선폭 자동 설정",
  },
} as const;

type Draft = {
  output: string;
  printer_preset: string;
  firmware_mode: FirmwareMode;
  filament_brand: string;
  filament_type: string;
  filament_name: string;
  nozzle_size: number;
  start_temp: number;
  end_temp: number;
  temp_step: number;
  layers_per_band: number;
  bed_temp: number;
  temp_wait_tolerance: number;
  bed_x: string;
  bed_y: string;
  layer_height: number;
  mvs_min: number;
  mvs_max: number;
  arc_segments: number;
  square_x: string;
  square_y: string;
  circle_diameter: string;
  label: boolean;
  label_height: string;
  label_x_scale: number;
  label_stroke_width: number;
  label_connector_width: number;
  label_speed: number;
  travel_speed: number;
  z_travel_speed: number;
  min_xy_speed: number;
  max_xy_speed: number;
  retract: number;
  extrusion_multiplier: number;
  motion_accel: number;
  motion_velocity: number;
  motion_minimum_cruise_ratio: number;
  motion_square_corner_velocity: number;
  motion_jerk: number;
};

const defaultPreset = presetNames.includes("SNAPMAKER_U1") ? "SNAPMAKER_U1" : presetNames[0];
const autoOutputFields: Array<keyof Draft> = ["printer_preset", "start_temp", "end_temp", "mvs_min", "mvs_max"];

function normalizeFilamentType(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "-");
  return filamentTypeOptions.includes(normalized as (typeof filamentTypeOptions)[number]) ? normalized : "PLA";
}

function filamentNameFromParts(brand: string, type: string) {
  const safeBrand = brand.trim();
  const safeType = normalizeFilamentType(type);
  return safeBrand ? `${safeBrand}_${safeType}` : safeType;
}

function brandFromLegacyFilamentName(value: string, type: string) {
  const safeType = normalizeFilamentType(type);
  const pattern = new RegExp(`[_\\s-]*${safeType}$`, "i");
  const brand = value.trim().replace(pattern, "").replace(/[_\s-]+$/g, "");
  return brand || value.trim() || initialDraft.filament_brand;
}

function fileTextToken(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "LESIC";
}

function fileNumberToken(value: number, minIntegerDigits = 0) {
  const sign = value < 0 ? "m" : "";
  const text = fmt(Math.abs(value));
  const [whole, fraction] = text.split(".");
  const paddedWhole = whole.padStart(minIntegerDigits, "0");
  return `${sign}${paddedWhole}${fraction ? `p${fraction}` : ""}`;
}

function calibrationBaseNameFromValues(printerName: string, startTemp: number, endTemp: number, mvsMin: number, mvsMax: number) {
  return `${fileTextToken(printerName)}_${fileNumberToken(startTemp)}_${fileNumberToken(endTemp)}__${fileNumberToken(mvsMin, 2)}_${fileNumberToken(mvsMax, 2)}`;
}

function autoOutputName(draft: Draft) {
  const preset = presets[draft.printer_preset] ?? {};
  const printerName = preset.printer_name ?? draft.printer_preset;
  return `${calibrationBaseNameFromValues(printerName, draft.start_temp, draft.end_temp, draft.mvs_min, draft.mvs_max)}.gcode`;
}

function isFirmwareMode(value: unknown): value is FirmwareMode {
  return value === "klipper" || value === "marlin" || value === "bambu" || value === "unknown";
}

function numberFromMetadata(data: Record<string, unknown>, key: string, fallback: number) {
  const value = data[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringFromMetadata(data: Record<string, unknown>, key: string, fallback = "") {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
}

function booleanFromMetadata(data: Record<string, unknown>, key: string, fallback: boolean) {
  const value = data[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
}

const REQUIRED_STRING_METADATA_KEYS = ["output", "printer_preset", "printer_name", "firmware_mode", "filament_name"] as const;
const REQUIRED_NUMBER_METADATA_KEYS = [
  "nozzle_size",
  "start_temp",
  "end_temp",
  "temp_step",
  "layers_per_band",
  "bed_temp",
  "temp_wait_tolerance",
  "layer_height",
  "mvs_min",
  "mvs_max",
  "arc_segments",
  "bed_x",
  "bed_y",
  "square_x",
  "square_y",
  "circle_diameter",
  "label_x_scale",
  "label_stroke_width",
  "label_connector_width",
  "label_speed",
  "travel_speed",
  "z_travel_speed",
  "min_xy_speed",
  "max_xy_speed",
  "retract",
  "extrusion_multiplier",
  "motion_accel",
  "motion_velocity",
  "motion_minimum_cruise_ratio",
  "motion_square_corner_velocity",
  "motion_jerk",
] as const;

function isFiniteMetadataNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") return Number.isFinite(Number(value));
  return false;
}

function validateLesicMetadata(data: Record<string, unknown>) {
  if (data.app !== "LESIC" || data.metadata_version !== 1) throw new Error("Invalid LESIC metadata.");
  for (const key of REQUIRED_STRING_METADATA_KEYS) {
    if (typeof data[key] !== "string" || data[key].trim() === "") throw new Error(`Missing LESIC metadata: ${key}`);
  }
  for (const key of REQUIRED_NUMBER_METADATA_KEYS) {
    if (!isFiniteMetadataNumber(data[key])) throw new Error(`Missing LESIC metadata: ${key}`);
  }
  if (!presets[stringFromMetadata(data, "printer_preset")]) throw new Error("Unknown LESIC printer preset.");
  if (!isFirmwareMode(data.firmware_mode)) throw new Error("Invalid LESIC firmware mode.");
  if (typeof data.label !== "boolean") throw new Error("Missing LESIC metadata: label");
  if (data.label_height != null && !isFiniteMetadataNumber(data.label_height)) throw new Error("Invalid LESIC label height.");
}

function parseLesicMetadata(gcode: string) {
  const line = gcode.split(/\r?\n/).find((item) => item.startsWith(LESIC_METADATA_JSON_PREFIX));
  if (!line) throw new Error("LESIC metadata block was not found.");
  let data: unknown;
  try {
    data = JSON.parse(line.slice(LESIC_METADATA_JSON_PREFIX.length));
  } catch {
    throw new Error("Invalid LESIC metadata.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("Invalid LESIC metadata.");
  }
  const metadata = data as Record<string, unknown>;
  if (metadata.app !== "LESIC") throw new Error("Invalid LESIC metadata.");
  validateLesicMetadata(metadata);
  return metadata;
}

function draftFromMetadata(data: Record<string, unknown>) {
  const presetName = stringFromMetadata(data, "printer_preset", defaultPreset);
  const printerPreset = presets[presetName] ? presetName : defaultPreset;
  const nozzleSize = numberFromMetadata(data, "nozzle_size", initialDraft.nozzle_size);
  const legacyFilamentName = stringFromMetadata(data, "filament_name", initialDraft.filament_name);
  const filamentType = normalizeFilamentType(stringFromMetadata(data, "filament_type", legacyFilamentName));
  const filamentBrand = stringFromMetadata(data, "filament_brand", "").trim() || brandFromLegacyFilamentName(legacyFilamentName, filamentType);
  const next: Draft = {
    ...initialDraft,
    output: stringFromMetadata(data, "output"),
    printer_preset: printerPreset,
    firmware_mode: isFirmwareMode(data.firmware_mode) ? data.firmware_mode : inferFirmwareMode(printerPreset),
    filament_brand: filamentBrand,
    filament_type: filamentType,
    filament_name: filamentNameFromParts(filamentBrand, filamentType),
    nozzle_size: nozzleSize,
    start_temp: numberFromMetadata(data, "start_temp", initialDraft.start_temp),
    end_temp: numberFromMetadata(data, "end_temp", initialDraft.end_temp),
    temp_step: numberFromMetadata(data, "temp_step", initialDraft.temp_step),
    layers_per_band: Math.max(1, Math.round(numberFromMetadata(data, "layers_per_band", initialDraft.layers_per_band))),
    bed_temp: numberFromMetadata(data, "bed_temp", initialDraft.bed_temp),
    temp_wait_tolerance: numberFromMetadata(data, "temp_wait_tolerance", initialDraft.temp_wait_tolerance),
    bed_x: String(numberFromMetadata(data, "bed_x", presets[printerPreset]?.bed_x ?? 0) || ""),
    bed_y: String(numberFromMetadata(data, "bed_y", presets[printerPreset]?.bed_y ?? 0) || ""),
    layer_height: numberFromMetadata(data, "layer_height", optimalLayerHeight(nozzleSize)),
    mvs_min: numberFromMetadata(data, "mvs_min", initialDraft.mvs_min),
    mvs_max: numberFromMetadata(data, "mvs_max", initialDraft.mvs_max),
    arc_segments: Math.max(12, Math.round(numberFromMetadata(data, "arc_segments", initialDraft.arc_segments))),
    square_x: String(numberFromMetadata(data, "square_x", presets[printerPreset]?.square_x ?? 0) || ""),
    square_y: String(numberFromMetadata(data, "square_y", presets[printerPreset]?.square_y ?? 0) || ""),
    circle_diameter: String(numberFromMetadata(data, "circle_diameter", presets[printerPreset]?.circle_diameter ?? 0) || ""),
    label: booleanFromMetadata(data, "label", initialDraft.label),
    label_height: data.label_height == null ? "" : String(numberFromMetadata(data, "label_height", 0)),
    label_x_scale: numberFromMetadata(data, "label_x_scale", initialDraft.label_x_scale),
    label_stroke_width: numberFromMetadata(data, "label_stroke_width", initialDraft.label_stroke_width),
    label_connector_width: numberFromMetadata(data, "label_connector_width", initialDraft.label_connector_width),
    label_speed: numberFromMetadata(data, "label_speed", initialDraft.label_speed),
    travel_speed: numberFromMetadata(data, "travel_speed", initialDraft.travel_speed),
    z_travel_speed: numberFromMetadata(data, "z_travel_speed", initialDraft.z_travel_speed),
    min_xy_speed: numberFromMetadata(data, "min_xy_speed", initialDraft.min_xy_speed),
    max_xy_speed: numberFromMetadata(data, "max_xy_speed", initialDraft.max_xy_speed),
    retract: numberFromMetadata(data, "retract", initialDraft.retract),
    extrusion_multiplier: numberFromMetadata(data, "extrusion_multiplier", initialDraft.extrusion_multiplier),
    motion_accel: numberFromMetadata(data, "motion_accel", initialDraft.motion_accel),
    motion_velocity: numberFromMetadata(data, "motion_velocity", initialDraft.motion_velocity),
    motion_minimum_cruise_ratio: numberFromMetadata(data, "motion_minimum_cruise_ratio", initialDraft.motion_minimum_cruise_ratio),
    motion_square_corner_velocity: numberFromMetadata(data, "motion_square_corner_velocity", initialDraft.motion_square_corner_velocity),
    motion_jerk: numberFromMetadata(data, "motion_jerk", initialDraft.motion_jerk),
  };
  return { ...next, output: next.output || autoOutputName(next) };
}

const initialDraft: Draft = {
  output: "U1_210_165__08_24.gcode",
  printer_preset: defaultPreset,
  firmware_mode: inferFirmwareMode(defaultPreset),
  filament_brand: "Unknown",
  filament_type: "PLA",
  filament_name: "Unknown_PLA",
  nozzle_size: 0.4,
  start_temp: 210,
  end_temp: 165,
  temp_step: 1,
  layers_per_band: 10,
  bed_temp: 60,
  temp_wait_tolerance: 0.5,
  bed_x: "",
  bed_y: "",
  layer_height: optimalLayerHeight(0.4),
  mvs_min: 8,
  mvs_max: 24,
  arc_segments: 360,
  square_x: "",
  square_y: "",
  circle_diameter: "",
  label: true,
  label_height: "",
  label_x_scale: 0.55,
  label_stroke_width: 0.6,
  label_connector_width: 0.2,
  label_speed: 20,
  travel_speed: 180,
  z_travel_speed: 10,
  min_xy_speed: 0.2,
  max_xy_speed: 0,
  retract: 0,
  extrusion_multiplier: 1,
  motion_accel: 3000,
  motion_velocity: 300,
  motion_minimum_cruise_ratio: 0,
  motion_square_corner_velocity: 10,
  motion_jerk: 10,
};

function numberOr(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildConfig(draft: Draft): GeneratorConfig {
  const preset = presets[draft.printer_preset] ?? {};
  const printerName = preset.printer_name ?? draft.printer_preset;
  const bedX = draft.bed_x.trim() === "" ? preset.bed_x ?? 220 : numberOr(draft.bed_x, preset.bed_x ?? 220);
  const bedY = draft.bed_y.trim() === "" ? preset.bed_y ?? 220 : numberOr(draft.bed_y, preset.bed_y ?? 220);
  const placement = defaultPlacement(bedX, bedY);
  const squareX = draft.square_x.trim() === "" ? preset.square_x ?? placement.square_x : numberOr(draft.square_x, placement.square_x);
  const squareY = draft.square_y.trim() === "" ? preset.square_y ?? placement.square_y : numberOr(draft.square_y, placement.square_y);
  const circleD = draft.circle_diameter.trim() === "" ? preset.circle_diameter ?? placement.circle_diameter : numberOr(draft.circle_diameter, placement.circle_diameter);
  const bands = computeBands(draft.start_temp, draft.end_temp, draft.temp_step);

  return {
    ...draft,
    output: draft.output || autoOutputName(draft),
    printer_name: printerName,
    source: preset.source ?? "",
    filament_type: normalizeFilamentType(draft.filament_type),
    filament_name: filamentNameFromParts(draft.filament_brand, draft.filament_type),
    nozzle_size: draft.nozzle_size,
    line_width: optimalLineWidth(draft.nozzle_size),
    bed_x: bedX,
    bed_y: bedY,
    bed_z: preset.bed_z ?? 0,
    square_x: squareX,
    square_y: squareY,
    circle_diameter: circleD,
    heater: preset.heater ?? "extruder",
    zero_angle_deg: preset.zero_angle_deg ?? -90,
    clockwise: true,
    standalone: true,
    bands,
    filament_diameter: preset.filament_diameter ?? 1.75,
    label_layout: "three-line",
    label_height: draft.label_height.trim() === "" ? undefined : numberOr(draft.label_height, 0),
    label_margin: 6,
    retract_speed: 30,
  };
}

function App() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [language, setLanguage] = useState<Language>("ko");
  const [showGcode, setShowGcode] = useState(false);
  const [generatedGcode, setGeneratedGcode] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];
  const uiLabels = language === "ko"
    ? {
        output: "생성 파일명",
        printerPreset: "기종 프리셋",
        firmwareMode: "펌웨어",
        nozzleSize: "노즐 구경",
        filamentBrand: "필라멘트 브랜드",
        filamentType: "필라멘트 재질",
        filamentName: "필라멘트 이름",
        startTemp: "시작 온도",
        endTemp: "종료 온도",
        tempStep: "온도 구간 간격",
        layersPerBand: "온도 구간별 레이어 수",
        bedTemp: "베드 온도",
        layerHeight: "적층 높이",
        mvsMin: "최소 MVS",
        mvsMax: "최대 MVS",
        arcSegments: "원 분할 수",
        bedX: "베드 X",
        bedY: "베드 Y",
        squareX: "시작 X 위치",
        squareY: "시작 Y 위치",
        circleDiameter: "원 지름",
        labelEnabled: "바닥 라벨",
        labelHeight: "라벨 높이",
        motionAccel: "가속도",
        motionVelocity: "속도 제한",
        motionJerk: "저크",
      }
    : {
        output: "Output file",
        printerPreset: "Printer preset",
        firmwareMode: "Firmware",
        nozzleSize: "Nozzle size",
        filamentBrand: "Filament brand",
        filamentType: "Filament material",
        filamentName: "Filament name",
        startTemp: "Start temp",
        endTemp: "End temp",
        tempStep: "Temp band step",
        layersPerBand: "Layers per temp band",
        bedTemp: "Bed temp",
        layerHeight: "Layer height",
        mvsMin: "Min MVS",
        mvsMax: "Max MVS",
        arcSegments: "Arc segments",
        bedX: "Bed X",
        bedY: "Bed Y",
        squareX: "Start X",
        squareY: "Start Y",
        circleDiameter: "Circle diameter",
        labelEnabled: "Bottom label",
        labelHeight: "Label height",
        motionAccel: "Acceleration",
        motionVelocity: "Velocity limit",
        motionJerk: "Jerk",
      };
  const uiHelp = language === "ko"
    ? {
        output: "생성된 파일의 저장 이름입니다. 확장자는 출력 형식에 맞춰 붙습니다.",
        printerPreset: "프린터별 베드 크기, 기본 이동 방식, 출력 조건의 기준값을 불러옵니다.",
        firmwareMode: "생성할 G-code가 따를 펌웨어 문법입니다. 보통 프리셋에 맞춰 자동으로 정해집니다.",
        nozzleSize: "노즐 구경을 고르면 적층 높이와 원형 테스트 선폭이 그 구경에 맞게 자동 적용됩니다.",
        filamentBrand: "라벨에 들어갈 브랜드/프로파일 이름입니다. 기기 필라멘트 타입 판정에는 쓰지 않습니다.",
        filamentType: "Bambu 3MF 내부 filament_type에 들어갈 재질입니다. 기기의 필라멘트 불일치 판정에 직접 영향이 있습니다.",
        filamentName: "바닥 라벨 첫 줄에 들어갈 재질 또는 프로파일 이름입니다.",
        startTemp: "테스트 시작 지점의 노즐 온도입니다.",
        endTemp: "테스트가 끝나는 지점의 노즐 온도입니다. 실제 밴드 수는 간격과 높이로 계산됩니다.",
        tempStep: "각 온도 구간이 바뀔 때마다 몇 도씩 낮출지 정합니다.",
        layersPerBand: "같은 온도를 몇 개 레이어 동안 유지할지 정합니다.",
        bedTemp: "독립 출력물로 생성할 때 사용할 베드 목표 온도입니다.",
        layerHeight: "노즐 구경의 60%로 자동 계산됩니다.",
        mvsMin: "테스트 시작 구간의 MVS 값입니다.",
        mvsMax: "테스트 끝 구간의 최대 MVS 값입니다.",
        arcSegments: "원을 몇 개 직선으로 나눠 그릴지 정합니다. 높을수록 더 둥글게 보입니다.",
        bedX: "프리셋 대신 직접 베드 X 크기를 덮어쓸 때 사용합니다.",
        bedY: "프리셋 대신 직접 베드 Y 크기를 덮어쓸 때 사용합니다.",
        squareX: "테스트 모델 시작 X 위치입니다. 비우면 자동 배치합니다.",
        squareY: "테스트 모델 시작 Y 위치입니다. 비우면 자동 배치합니다.",
        circleDiameter: "원형 테스트 본체의 지름입니다. 비우면 자동값을 사용합니다.",
        labelEnabled: "바닥 라벨 생성 여부를 켜거나 끕니다.",
        labelHeight: "바닥 라벨 전체 높이입니다. 비우면 자동으로 맞춥니다.",
        motionAccel: "생성된 G-code에 넣을 기본 가속도 요청값입니다.",
        motionVelocity: "생성된 G-code에 넣을 XY 최대 속도 제한값입니다.",
        motionJerk: "Marlin 계열에서 쓰는 classic jerk 값입니다.",
      }
    : {
        output: "Saved file name for the generated calibration file. The extension follows the chosen export format.",
        printerPreset: "Loads printer-specific defaults such as bed size, motion style, and base output assumptions.",
        firmwareMode: "Selects the G-code dialect to emit. This is usually inferred from the printer preset.",
        nozzleSize: "Choosing a nozzle updates layer height and the circular test line width automatically.",
        filamentBrand: "Brand/profile text for the label. This is not used for the printer filament-type check.",
        filamentType: "Material written into Bambu 3MF filament_type. This is what the printer compares against the loaded filament type.",
        filamentName: "Material or profile name printed in the first line of the bottom label.",
        startTemp: "Nozzle temperature at the start of the test.",
        endTemp: "Nozzle temperature at the end of the test. Actual band count is computed from step and height.",
        tempStep: "How many degrees to drop each time the test moves to the next temperature band.",
        layersPerBand: "How many layers each temperature band keeps the same temperature.",
        bedTemp: "Bed target temperature used for standalone output.",
        layerHeight: "Automatically calculated as 60% of nozzle diameter.",
        mvsMin: "Starting MVS value for the test.",
        mvsMax: "Maximum MVS value at the end of the test.",
        arcSegments: "How many straight segments are used to approximate the circle.",
        bedX: "Overrides the preset bed X dimension when you want to set it manually.",
        bedY: "Overrides the preset bed Y dimension when you want to set it manually.",
        squareX: "Starting X position of the test model. Blank uses automatic placement.",
        squareY: "Starting Y position of the test model. Blank uses automatic placement.",
        circleDiameter: "Diameter of the circular test body. Blank uses the automatic value.",
        labelEnabled: "Enables or disables generation of the bottom label.",
        labelHeight: "Overall height of the bottom label. Blank uses automatic fitting.",
        motionAccel: "Default acceleration request written into the generated G-code.",
        motionVelocity: "Maximum XY speed limit written into the generated G-code.",
        motionJerk: "Classic jerk value used by Marlin-style firmware.",
      };
  const helpCloseLabel = language === "ko" ? "닫기" : "Close";
  const [logs, setLogs] = useState<string[]>([translations.ko.readyLog]);
  const { cfg, error } = useMemo(() => {
    try {
      const built = buildConfig(draft);
      return { cfg: built, error: "" };
    } catch (err) {
      return { cfg: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [draft]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      return autoOutputFields.includes(key) ? { ...next, output: autoOutputName(next) } : next;
    });
  }

  function selectPreset(name: string) {
    setDraft((prev) => {
      const next = { ...prev, printer_preset: name, firmware_mode: inferFirmwareMode(name) };
      return { ...next, output: autoOutputName(next) };
    });
  }

  function generate() {
    if (!cfg || error) return;
    const gcode = makeGcode(cfg);
    const blob = new Blob([gcode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cfg.output.endsWith(".gcode") ? cfg.output : `${cfg.output}.gcode`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratedGcode(gcode);
    setLogs((prev) => [...prev, t.generatedLog(a.download)]);
  }

  async function generateBambu3mf() {
    if (!cfg || error || !supportsBuiltInBambu3mf(cfg)) return;
    try {
      const gcode = makeGcode(cfg);
      const blob = await makeBambu3mfBlob(cfg, gcode);
      const filename = bambu3mfFileName(cfg.output);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setGeneratedGcode(gcode);
      setLogs((prev) => [...prev, t.generated3mfLog(filename)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `Bambu 3MF export failed: ${message}`]);
    }
  }

  function preview() {
    if (!cfg || error) return;
    setShowGcode(false);
    setLogs((prev) => [...prev, t.previewLogBands(cfg.bands), t.previewLogParsed]);
  }

  function chooseOutput() {
    const next = window.prompt(t.outputPrompt, draft.output);
    if (!next?.trim()) return;
    update("output", next.trim());
    setLogs((prev) => [...prev, t.outputSetLog(next.trim())]);
  }

  async function loadLesicFile(file: File) {
    try {
      const gcode = file.name.toLowerCase().endsWith(".3mf") ? await extractBambuPlateGcode(file) : await file.text();
      const metadata = parseLesicMetadata(gcode);
      const next = draftFromMetadata(metadata);
      setDraft(next);
      setGeneratedGcode(gcode);
      setShowGcode(false);
      setLogs((prev) => [...prev, t.loadedFileLog(file.name)]);
    } catch (err) {
      setLogs((prev) => [...prev, t.loadFileError]);
    }
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && !window.confirm(t.loadConfirm)) return;
    if (file) void loadLesicFile(file);
  }

  return (
    <main className="app">
      <header className="appHeader">
        <div className="headerRow">
          <div>
            <h1>LESIC</h1>
            <p>Lowtemp Extrusion Support Interface Calibration</p>
          </div>
          <div className="headerActions">
            <button type="button" className="headerButton" onClick={() => fileInputRef.current?.click()}>{t.loadLesicFile}</button>
            <input ref={fileInputRef} className="hiddenFileInput" type="file" accept=".gcode,.3mf,.gcode.3mf,text/plain,model/3mf" onChange={handleFileInput} />
            <label className="languageSwitch">
              <span>{t.language}</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </div>
        {draft.firmware_mode === "unknown" && <div className="warning">{t.unknownWarning}</div>}
      </header>

      <div className="shell">
        <section className="controls">
          <Fieldset title={t.output}>
            <TextField label={uiLabels.output} description={t.outputDesc} detail={uiHelp.output} closeLabel={helpCloseLabel} value={draft.output} onChange={(v) => update("output", v)} />
          </Fieldset>

          <Fieldset title={t.printer}>
            <Select label={uiLabels.printerPreset} description={t.printerPresetDesc} detail={uiHelp.printerPreset} closeLabel={helpCloseLabel} value={draft.printer_preset} options={presetNames} onChange={selectPreset} />
            <Select label={uiLabels.firmwareMode} description={t.firmwareModeDesc} detail={uiHelp.firmwareMode} closeLabel={helpCloseLabel} value={draft.firmware_mode} options={["klipper", "marlin", "bambu", "unknown"]} onChange={(v) => update("firmware_mode", v as FirmwareMode)} />
            <Select
              label={uiLabels.nozzleSize}
              description={t.nozzleSizeDesc}
              detail={uiHelp.nozzleSize}
              closeLabel={helpCloseLabel}
              value={String(draft.nozzle_size)}
              options={nozzleOptions.map((v) => ({ value: String(v), label: `${fmt(v, 2)} mm` }))}
              onChange={(v) => {
                const nozzleSize = Number(v);
                setDraft((prev) => ({
                  ...prev,
                  nozzle_size: nozzleSize,
                  layer_height: optimalLayerHeight(nozzleSize),
                }));
              }}
            />
            <TextField label={uiLabels.filamentBrand} description={language === "ko" ? "라벨/프로파일용 브랜드명" : "Brand/profile name for the label"} detail={uiHelp.filamentBrand} closeLabel={helpCloseLabel} value={draft.filament_brand} onChange={(v) => update("filament_brand", v)} />
            <Select label={uiLabels.filamentType} description={language === "ko" ? "기기가 비교하는 실제 재질 타입" : "Material type checked by the printer"} detail={uiHelp.filamentType} closeLabel={helpCloseLabel} value={draft.filament_type} options={filamentTypeOptions.map((v) => ({ value: v, label: v }))} onChange={(v) => update("filament_type", v)} />
          </Fieldset>

          <Fieldset title={t.temperature}>
            <NumberField label={uiLabels.startTemp} description={t.startTempDesc} detail={uiHelp.startTemp} closeLabel={helpCloseLabel} value={draft.start_temp} onChange={(v) => update("start_temp", v)} />
            <NumberField label={uiLabels.endTemp} description={t.endTempDesc} detail={uiHelp.endTemp} closeLabel={helpCloseLabel} value={draft.end_temp} onChange={(v) => update("end_temp", v)} />
            <NumberField label={uiLabels.tempStep} description={t.tempStepDesc} detail={uiHelp.tempStep} closeLabel={helpCloseLabel} value={draft.temp_step} onChange={(v) => update("temp_step", v)} />
            <NumberField label={uiLabels.layersPerBand} description={t.layersPerBandDesc} detail={uiHelp.layersPerBand} closeLabel={helpCloseLabel} value={draft.layers_per_band} onChange={(v) => update("layers_per_band", Math.max(1, Math.round(v)))} />
            <NumberField label={uiLabels.bedTemp} description={t.bedTempDesc} detail={uiHelp.bedTemp} closeLabel={helpCloseLabel} value={draft.bed_temp} onChange={(v) => update("bed_temp", v)} />
          </Fieldset>

          <Fieldset title={t.geometry}>
            <NumberField label={uiLabels.layerHeight} description={t.layerHeightDesc} detail={uiHelp.layerHeight} closeLabel={helpCloseLabel} value={draft.layer_height} onChange={() => {}} readOnly />
            <NumberField label={uiLabels.mvsMin} description={t.mvsMinDesc} detail={uiHelp.mvsMin} closeLabel={helpCloseLabel} value={draft.mvs_min} onChange={(v) => update("mvs_min", v)} />
            <NumberField label={uiLabels.mvsMax} description={t.mvsMaxDesc} detail={uiHelp.mvsMax} closeLabel={helpCloseLabel} value={draft.mvs_max} onChange={(v) => update("mvs_max", v)} />
            <NumberField label={uiLabels.arcSegments} description={t.arcSegmentsDesc} detail={uiHelp.arcSegments} closeLabel={helpCloseLabel} value={draft.arc_segments} onChange={(v) => update("arc_segments", Math.max(12, Math.round(v)))} />
          </Fieldset>

          <Fieldset title={t.buildVolume}>
            <TextField label={uiLabels.bedX} description={t.bedXDesc} detail={uiHelp.bedX} closeLabel={helpCloseLabel} value={draft.bed_x} onChange={(v) => update("bed_x", v)} placeholder={t.presetPlaceholder} />
            <TextField label={uiLabels.bedY} description={t.bedYDesc} detail={uiHelp.bedY} closeLabel={helpCloseLabel} value={draft.bed_y} onChange={(v) => update("bed_y", v)} placeholder={t.presetPlaceholder} />
          </Fieldset>

          <Fieldset title={t.placement}>
            <TextField label={uiLabels.squareX} description={t.placementDesc} detail={uiHelp.squareX} closeLabel={helpCloseLabel} value={draft.square_x} onChange={(v) => update("square_x", v)} placeholder={t.autoPlaceholder} />
            <TextField label={uiLabels.squareY} description={t.placementDesc} detail={uiHelp.squareY} closeLabel={helpCloseLabel} value={draft.square_y} onChange={(v) => update("square_y", v)} placeholder={t.autoPlaceholder} />
            <TextField label={uiLabels.circleDiameter} description={t.placementDesc} detail={uiHelp.circleDiameter} closeLabel={helpCloseLabel} value={draft.circle_diameter} onChange={(v) => update("circle_diameter", v)} placeholder={t.autoPlaceholder} />
          </Fieldset>

          <Fieldset title={t.label}>
            <CheckField label={uiLabels.labelEnabled} description={language === "ko" ? "바닥 라벨 on/off" : "Bottom label on/off"} detail={uiHelp.labelEnabled} closeLabel={helpCloseLabel} checked={draft.label} onChange={(value) => update("label", value)} />
            <TextField label={uiLabels.labelHeight} description={t.labelHeightDesc} detail={uiHelp.labelHeight} closeLabel={helpCloseLabel} value={draft.label_height} onChange={(v) => update("label_height", v)} placeholder={t.autoPlaceholder} />
          </Fieldset>

          <Fieldset title={t.firmwareMotion}>
            <NumberField label={uiLabels.motionAccel} description={t.motionAccelDesc} detail={uiHelp.motionAccel} closeLabel={helpCloseLabel} value={draft.motion_accel} onChange={(v) => update("motion_accel", v)} />
            <NumberField label={uiLabels.motionVelocity} description={t.motionVelocityDesc} detail={uiHelp.motionVelocity} closeLabel={helpCloseLabel} value={draft.motion_velocity} onChange={(v) => update("motion_velocity", v)} />
            <NumberField label={uiLabels.motionJerk} description={t.motionJerkDesc} detail={uiHelp.motionJerk} closeLabel={helpCloseLabel} value={draft.motion_jerk} onChange={(v) => update("motion_jerk", v)} />
          </Fieldset>
        </section>

        <section className="workspace">
          <div className="toolbar">
            <button type="button" className="generate" onClick={generate} disabled={!cfg || !!error}>{t.generate}</button>
            <button type="button" className="previewButton" onClick={generateBambu3mf} disabled={!cfg || !!error || !supportsBuiltInBambu3mf(cfg)}>{t.generateBambu3mf}</button>
            <button type="button" className="previewButton" onClick={preview}>{t.preview}</button>
            <button type="button" onClick={chooseOutput}>{t.chooseOutput}</button>
            <button type="button" onClick={() => setShowGcode((v) => !v)}>{showGcode ? t.hideGcode : t.showGcode}</button>
          </div>

          {error && <div className="error">{error}</div>}
          {cfg && <Preview cfg={cfg} language={language} />}
          <pre className="log">{logs.slice(-7).join("\n")}</pre>
          {showGcode && <textarea className="gcode" readOnly value={generatedGcode} />}
        </section>
      </div>
    </main>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset><legend>{title}</legend>{children}</fieldset>;
}

function FieldLabel({ label, detail, closeLabel }: { label: string; detail?: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fieldLabelRow">
      <span>{label}</span>
      {detail && (
        <div className="fieldInfoWrap">
          <button type="button" className="infoButton" onClick={() => setOpen((prev) => !prev)} aria-label={`${label} info`} aria-expanded={open}>
            i
          </button>
          {open && (
            <div className="infoPopover" role="dialog" aria-label={label}>
              <div className="infoPopoverTitle">{label}</div>
              <div className="infoPopoverBody">{detail}</div>
              <button type="button" className="infoPopoverClose" onClick={() => setOpen(false)}>
                {closeLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TextField({ label, description, detail, closeLabel, value, onChange, placeholder }: { label: string; description?: string; detail?: string; closeLabel: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [draftValue, setDraftValue] = useState(value);
  useEffect(() => setDraftValue(value), [value]);
  function commit() {
    if (draftValue !== value) onChange(draftValue);
  }
  return (
    <label className="field">
      <FieldLabel label={label} detail={detail} closeLabel={closeLabel} />
      {description && <small>{description}</small>}
      <input
        value={draftValue}
        placeholder={placeholder}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}

function NumberField({ label, description, detail, closeLabel, value, onChange, readOnly = false }: { label: string; description?: string; detail?: string; closeLabel: string; value: number; onChange: (value: number) => void; readOnly?: boolean }) {
  const [draftValue, setDraftValue] = useState(String(value));
  useEffect(() => setDraftValue(String(value)), [value]);
  function commit() {
    if (readOnly) return;
    const parsed = Number(draftValue);
    if (Number.isFinite(parsed) && parsed !== value) onChange(parsed);
    else if (!Number.isFinite(parsed)) setDraftValue(String(value));
  }
  return (
    <label className="field">
      <FieldLabel label={label} detail={detail} closeLabel={closeLabel} />
      {description && <small>{description}</small>}
      <input
        type="number"
        value={draftValue}
        readOnly={readOnly}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}

function CheckField({ label, description, detail, closeLabel, checked, onChange }: { label: string; description?: string; detail?: string; closeLabel: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="checkField">
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <FieldLabel label={label} detail={detail} closeLabel={closeLabel} />
      </label>
      {description && <small>{description}</small>}
    </div>
  );
}

function Select({
  label,
  description,
  detail,
  closeLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  detail?: string;
  closeLabel: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return <label className="field"><FieldLabel label={label} detail={detail} closeLabel={closeLabel} />{description && <small>{description}</small>}<select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function Preview({ cfg, language }: { cfg: GeneratorConfig; language: Language }) {
  const t = translations[language];
  const data = useMemo(() => getPreviewData(cfg), [cfg]);
  const pad = 18;
  const vb = `${-pad} ${-pad} ${data.bed.x + pad * 2} ${data.bed.y + pad * 2}`;
  const mapPoint = ([x, y]: [number, number]) => [x, data.bed.y - y] as const;
  const segmentCommand = (a: readonly [number, number], b: readonly [number, number]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
  const segmentKey = (a: readonly [number, number], b: readonly [number, number]) => {
    const k1 = `${a[0].toFixed(4)},${a[1].toFixed(4)}|${b[0].toFixed(4)},${b[1].toFixed(4)}`;
    const k2 = `${b[0].toFixed(4)},${b[1].toFixed(4)}|${a[0].toFixed(4)},${a[1].toFixed(4)}`;
    return k1 < k2 ? k1 : k2;
  };
  const circlePath = useMemo(() => data.circleSegments.map(([a, b]) => segmentCommand(mapPoint(a), mapPoint(b))).join(" "), [data.circleSegments, data.bed.y]);
  const labelPathGroups = useMemo(() => {
    const grouped = new Map<string, { a: readonly [number, number]; b: readonly [number, number]; kind: SegmentKind; count: number }>();
    data.labelSegments.forEach(([a, b, kind]) => {
      const pa = mapPoint(a);
      const pb = mapPoint(b);
      const key = `${kind}:${segmentKey(pa, pb)}`;
      const prev = grouped.get(key);
      if (prev) prev.count += 1;
      else grouped.set(key, { a: pa, b: pb, kind, count: 1 });
    });
    const paths = new Map<string, { kind: SegmentKind; count: number; d: string[] }>();
    grouped.forEach(({ a, b, kind, count }) => {
      const key = `${kind}:${count}`;
      const path = paths.get(key);
      if (path) path.d.push(segmentCommand(a, b));
      else paths.set(key, { kind, count, d: [segmentCommand(a, b)] });
    });
    return [...paths.values()].map((path) => ({ ...path, d: path.d.join(" ") }));
  }, [data.labelSegments, data.bed.y]);
  const labelStrokeWidth = (kind: SegmentKind, count: number) => {
    const baseWidth = kind === "connector" ? cfg.label_connector_width : LABEL_OUTLINE_WIDTH;
    return Math.max(0.01, baseWidth) * Math.max(1, count);
  };
  const labelPaths = labelPathGroups.map(({ d, kind, count }, i) => (
    <path
      key={i}
      d={d}
      className={kind}
      fill="none"
      style={{ strokeWidth: labelStrokeWidth(kind, count) }}
    />
  ));
  const tooLarge = data.square.x < 0 || data.square.y < 0 || data.square.x + data.square.d > data.bed.x || data.square.y + data.square.d > data.bed.y;

  return (
    <div className="previewPane">
      <div className="previewTitle">{t.previewTitle}</div>
      <div className="previewStage">
        <svg viewBox={vb} role="img" aria-label="MVS calibration preview">
          <path d={circlePath} className="circleSegment" fill="none" style={{ strokeWidth: cfg.line_width }} />
          <g>{labelPaths}</g>
        </svg>
      </div>
      {cfg.firmware_mode === "unknown" && <div className="warning">{t.unknownWarning}</div>}
      {tooLarge && <div className="warning">{t.boundingWarning}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
