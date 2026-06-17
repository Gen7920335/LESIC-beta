import React, { useMemo, useState } from "react";
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
  makeGcode,
  PrinterPreset,
} from "./generator/mvsGenerator";
import "./styles.css";

const presets = presetsJson as Record<string, PrinterPreset>;
const presetNames = Object.keys(presets).sort();
const nozzleOptions = [0.8, 0.6, 0.4, 0.25, 0.2, 0.15] as const;
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
    outputDesc: "Generated G-code download file name.",
    printerPresetDesc: "Printer preset from printer_presets.json.",
    firmwareModeDesc: "Auto-inferred from preset, but can be overridden.",
    filamentNameDesc: "Filament name printed in the bottom label.",
    startTempDesc: "Starting nozzle temperature.",
    endTempDesc: "Ending nozzle temperature; bands are computed automatically.",
    tempStepDesc: "Temperature drop per band.",
    layersPerBandDesc: "Layers per temperature band.",
    bedTempDesc: "Standalone bed temperature.",
    layerHeightDesc: "Automatically set to 60% of nozzle diameter.",
    mvsMinDesc: "Starting MVS value, mm3/s.",
    mvsMaxDesc: "Maximum MVS value, mm3/s.",
    arcSegmentsDesc: "Segments per circle.",
    bedXDesc: "Empty uses the preset bed X.",
    bedYDesc: "Empty uses the preset bed Y.",
    placementDesc: "Empty uses automatic placement.",
    labelHeightDesc: "Empty uses auto-fit.",
    motionAccelDesc: "Requested acceleration.",
    motionVelocityDesc: "Requested XY velocity limit.",
    motionJerkDesc: "Marlin classic jerk hint.",
    presetPlaceholder: "preset",
    autoPlaceholder: "auto",
    generate: "Generate G-code",
    preview: "Preview",
    chooseOutput: "Choose output",
    showGcode: "Show G-code",
    hideGcode: "Hide G-code",
    previewTitle: "Preview: parsed from generated G-code",
    firmware: "firmware",
    strokeWidth: (stroke: string) => `label width ${stroke}`,
    boundingWarning: "bounding square exceeds bed",
    language: "Language",
    labelEnabled: "label",
    nozzleSizeDesc: "Choose one supported nozzle size. Circular line width is set automatically.",
  },
  ko: {
    unknownWarning: "가속도/속도 제한이 해제되지 않았을 수 있습니다.",
    readyLog: "준비 완료. Preview 또는 Generate G-code를 누르세요.",
    generatedLog: (name: string) => `G-code 생성: ${name}`,
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
    outputDesc: "생성된 G-code 다운로드 파일명입니다.",
    printerPresetDesc: "printer_presets.json의 프린터 프리셋입니다.",
    firmwareModeDesc: "프리셋에서 자동 추론되지만 수동으로 바꿀 수 있습니다.",
    filamentNameDesc: "하단 라벨에 출력될 필라멘트 이름입니다.",
    startTempDesc: "시작 노즐 온도입니다.",
    endTempDesc: "종료 노즐 온도입니다. 밴드 수는 자동 계산됩니다.",
    tempStepDesc: "밴드당 온도 감소값입니다.",
    layersPerBandDesc: "온도 밴드당 레이어 수입니다.",
    bedTempDesc: "standalone 베드 온도입니다.",
    layerHeightDesc: "레이어 높이입니다.",
    mvsMinDesc: "시작 MVS 값, mm3/s.",
    mvsMaxDesc: "최대 MVS 값, mm3/s.",
    arcSegmentsDesc: "원 한 바퀴당 세그먼트 수입니다.",
    bedXDesc: "비워두면 프리셋 bed X를 사용합니다.",
    bedYDesc: "비워두면 프리셋 bed Y를 사용합니다.",
    placementDesc: "비워두면 자동 배치를 사용합니다.",
    labelHeightDesc: "비워두면 자동 맞춤을 사용합니다.",
    motionAccelDesc: "요청 가속도입니다.",
    motionVelocityDesc: "요청 XY 속도 제한입니다.",
    motionJerkDesc: "Marlin classic jerk 힌트입니다.",
    presetPlaceholder: "preset",
    autoPlaceholder: "auto",
    generate: "G-code 생성",
    preview: "Preview",
    chooseOutput: "출력 선택",
    showGcode: "G-code 보기",
    hideGcode: "G-code 숨기기",
    previewTitle: "Preview: 생성된 G-code 기준",
    firmware: "firmware",
    strokeWidth: (stroke: string) => `label width ${stroke}`,
    boundingWarning: "바운딩 사각형이 베드를 벗어납니다.",
    language: "언어",
    labelEnabled: "라벨 사용",
    nozzleSizeDesc: "지원 노즐 구경 중 하나를 선택합니다. 원형 테스트 선폭은 자동으로 설정됩니다.",
  },
} as const;

type Draft = {
  output: string;
  printer_preset: string;
  firmware_mode: FirmwareMode;
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

const initialDraft: Draft = {
  output: "U1_v21_web.gcode",
  printer_preset: defaultPreset,
  firmware_mode: inferFirmwareMode(defaultPreset),
  filament_name: "Unknown_pla",
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
  motion_accel: 8000,
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
  const bedX = draft.bed_x.trim() === "" ? preset.bed_x ?? 220 : numberOr(draft.bed_x, preset.bed_x ?? 220);
  const bedY = draft.bed_y.trim() === "" ? preset.bed_y ?? 220 : numberOr(draft.bed_y, preset.bed_y ?? 220);
  const placement = defaultPlacement(bedX, bedY);
  const squareX = draft.square_x.trim() === "" ? preset.square_x ?? placement.square_x : numberOr(draft.square_x, placement.square_x);
  const squareY = draft.square_y.trim() === "" ? preset.square_y ?? placement.square_y : numberOr(draft.square_y, placement.square_y);
  const circleD = draft.circle_diameter.trim() === "" ? preset.circle_diameter ?? placement.circle_diameter : numberOr(draft.circle_diameter, placement.circle_diameter);
  const bands = computeBands(draft.start_temp, draft.end_temp, draft.temp_step);

  return {
    ...draft,
    output: draft.output || "mvs_calibrator.gcode",
    printer_name: preset.printer_name ?? draft.printer_preset,
    source: preset.source ?? "",
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
  const t = translations[language];
  const [logs, setLogs] = useState<string[]>([translations.ko.readyLog]);
  const { cfg, gcode, error } = useMemo(() => {
    try {
      const built = buildConfig(draft);
      return { cfg: built, gcode: makeGcode(built), error: "" };
    } catch (err) {
      return { cfg: null, gcode: "", error: err instanceof Error ? err.message : String(err) };
    }
  }, [draft]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function selectPreset(name: string) {
    setDraft((prev) => ({ ...prev, printer_preset: name, firmware_mode: inferFirmwareMode(name) }));
  }

  function generate() {
    if (!cfg || error) return;
    const blob = new Blob([gcode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cfg.output.endsWith(".gcode") ? cfg.output : `${cfg.output}.gcode`;
    a.click();
    URL.revokeObjectURL(url);
    setLogs((prev) => [...prev, t.generatedLog(a.download)]);
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

  return (
    <main className="app">
      <header className="appHeader">
        <div className="headerRow">
          <div>
            <h1>LESIC</h1>
            <p>Lowtemp Extrusion Support Interface Calibration</p>
          </div>
          <label className="languageSwitch">
            <span>{t.language}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        {draft.firmware_mode === "unknown" && <div className="warning">{t.unknownWarning}</div>}
      </header>

      <div className="shell">
        <section className="controls">
          <Fieldset title={t.output}>
            <TextField label="output" description={t.outputDesc} value={draft.output} onChange={(v) => update("output", v)} />
          </Fieldset>

          <Fieldset title={t.printer}>
            <Select label="printer_preset" description={t.printerPresetDesc} value={draft.printer_preset} options={presetNames} onChange={selectPreset} />
            <Select label="firmware_mode" description={t.firmwareModeDesc} value={draft.firmware_mode} options={["klipper", "marlin", "bambu", "unknown"]} onChange={(v) => update("firmware_mode", v as FirmwareMode)} />
            <Select
              label="nozzle_size"
              description={t.nozzleSizeDesc}
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
            <TextField label="filament_name" description={t.filamentNameDesc} value={draft.filament_name} onChange={(v) => update("filament_name", v)} />
          </Fieldset>

          <Fieldset title={t.temperature}>
            <NumberField label="start_temp" description={t.startTempDesc} value={draft.start_temp} onChange={(v) => update("start_temp", v)} />
            <NumberField label="end_temp" description={t.endTempDesc} value={draft.end_temp} onChange={(v) => update("end_temp", v)} />
            <NumberField label="temp_step" description={t.tempStepDesc} value={draft.temp_step} onChange={(v) => update("temp_step", v)} />
            <NumberField label="layers_per_band" description={t.layersPerBandDesc} value={draft.layers_per_band} onChange={(v) => update("layers_per_band", Math.max(1, Math.round(v)))} />
            <NumberField label="bed_temp" description={t.bedTempDesc} value={draft.bed_temp} onChange={(v) => update("bed_temp", v)} />
          </Fieldset>

          <Fieldset title={t.geometry}>
            <NumberField label="layer_height" description={t.layerHeightDesc} value={draft.layer_height} onChange={() => {}} readOnly />
            <NumberField label="mvs_min" description={t.mvsMinDesc} value={draft.mvs_min} onChange={(v) => update("mvs_min", v)} />
            <NumberField label="mvs_max" description={t.mvsMaxDesc} value={draft.mvs_max} onChange={(v) => update("mvs_max", v)} />
            <NumberField label="arc_segments" description={t.arcSegmentsDesc} value={draft.arc_segments} onChange={(v) => update("arc_segments", Math.max(12, Math.round(v)))} />
          </Fieldset>

          <Fieldset title={t.buildVolume}>
            <TextField label="bed_x" description={t.bedXDesc} value={draft.bed_x} onChange={(v) => update("bed_x", v)} placeholder={t.presetPlaceholder} />
            <TextField label="bed_y" description={t.bedYDesc} value={draft.bed_y} onChange={(v) => update("bed_y", v)} placeholder={t.presetPlaceholder} />
          </Fieldset>

          <Fieldset title={t.placement}>
            <TextField label="square_x" description={t.placementDesc} value={draft.square_x} onChange={(v) => update("square_x", v)} placeholder={t.autoPlaceholder} />
            <TextField label="square_y" description={t.placementDesc} value={draft.square_y} onChange={(v) => update("square_y", v)} placeholder={t.autoPlaceholder} />
            <TextField label="circle_diameter" description={t.placementDesc} value={draft.circle_diameter} onChange={(v) => update("circle_diameter", v)} placeholder={t.autoPlaceholder} />
          </Fieldset>

          <Fieldset title={t.label}>
            <label className="check"><input type="checkbox" checked={draft.label} onChange={(e) => update("label", e.target.checked)} /> {t.labelEnabled}</label>
            <TextField label="label_height" description={t.labelHeightDesc} value={draft.label_height} onChange={(v) => update("label_height", v)} placeholder={t.autoPlaceholder} />
          </Fieldset>

          <Fieldset title={t.firmwareMotion}>
            <NumberField label="motion_accel" description={t.motionAccelDesc} value={draft.motion_accel} onChange={(v) => update("motion_accel", v)} />
            <NumberField label="motion_velocity" description={t.motionVelocityDesc} value={draft.motion_velocity} onChange={(v) => update("motion_velocity", v)} />
            <NumberField label="motion_jerk" description={t.motionJerkDesc} value={draft.motion_jerk} onChange={(v) => update("motion_jerk", v)} />
          </Fieldset>
        </section>

        <section className="workspace">
          <div className="toolbar">
            <button type="button" className="generate" onClick={generate} disabled={!cfg || !!error}>{t.generate}</button>
            <button type="button" className="previewButton" onClick={preview}>{t.preview}</button>
            <button type="button" onClick={chooseOutput}>{t.chooseOutput}</button>
            <button type="button" onClick={() => setShowGcode((v) => !v)}>{showGcode ? t.hideGcode : t.showGcode}</button>
          </div>

          {error && <div className="error">{error}</div>}
          {cfg && <Preview cfg={cfg} gcode={gcode} language={language} />}
          <pre className="log">{logs.slice(-7).join("\n")}</pre>
          {showGcode && <textarea className="gcode" readOnly value={gcode} />}
        </section>
      </div>
    </main>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset><legend>{title}</legend>{children}</fieldset>;
}

function TextField({ label, description, value, onChange, placeholder }: { label: string; description?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="field"><span>{label}</span>{description && <small>{description}</small>}<input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

function NumberField({ label, description, value, onChange, readOnly = false }: { label: string; description?: string; value: number; onChange: (value: number) => void; readOnly?: boolean }) {
  return <label className="field"><span>{label}</span>{description && <small>{description}</small>}<input type="number" value={value} readOnly={readOnly} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

function Select({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return <label className="field"><span>{label}</span>{description && <small>{description}</small>}<select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function Preview({ cfg, gcode, language }: { cfg: GeneratorConfig; gcode: string; language: Language }) {
  const t = translations[language];
  const data = useMemo(() => getPreviewData(cfg, gcode), [cfg, gcode]);
  const pad = 18;
  const vb = `${-pad} ${-pad} ${data.bed.x + pad * 2} ${data.bed.y + pad * 2}`;
  const mapPoint = ([x, y]: [number, number]) => [x, data.bed.y - y] as const;
  const segmentKey = (a: readonly [number, number], b: readonly [number, number]) => {
    const k1 = `${a[0].toFixed(4)},${a[1].toFixed(4)}|${b[0].toFixed(4)},${b[1].toFixed(4)}`;
    const k2 = `${b[0].toFixed(4)},${b[1].toFixed(4)}|${a[0].toFixed(4)},${a[1].toFixed(4)}`;
    return k1 < k2 ? k1 : k2;
  };
  const circlePaths = data.circleSegments.map(([a, b], i) => {
    const pa = mapPoint(a);
    const pb = mapPoint(b);
    return <line key={i} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} className="circleSegment" />;
  });
  const aggregatedLabelSegments = useMemo(() => {
    const grouped = new Map<string, { a: readonly [number, number]; b: readonly [number, number]; kind: string; count: number }>();
    data.labelSegments.forEach(([a, b, kind]) => {
      const pa = mapPoint(a);
      const pb = mapPoint(b);
      const key = `${kind}:${segmentKey(pa, pb)}`;
      const prev = grouped.get(key);
      if (prev) prev.count += 1;
      else grouped.set(key, { a: pa, b: pb, kind, count: 1 });
    });
    return [...grouped.values()];
  }, [data.labelSegments]);
  const labelPaths = aggregatedLabelSegments.map(({ a, b, kind, count }, i) => (
    <line
      key={i}
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      className={kind}
      style={{ strokeWidth: kind === "connector" ? `${1.1 + (count - 1) * 0.65}px` : `${0.45 + (count - 1) * 0.38}px` }}
    />
  ));
  const tooLarge = data.square.x < 0 || data.square.y < 0 || data.square.x + data.square.d > data.bed.x || data.square.y + data.square.d > data.bed.y;

  return (
    <div className="previewPane">
      <div className="previewTitle">{t.previewTitle}</div>
      <div className="previewStage">
        <svg viewBox={vb} role="img" aria-label="MVS calibration preview">
          <g>{circlePaths}</g>
          <g>{labelPaths}</g>
        </svg>
      </div>
      {cfg.firmware_mode === "unknown" && <div className="warning">{t.unknownWarning}</div>}
      {tooLarge && <div className="warning">{t.boundingWarning}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
