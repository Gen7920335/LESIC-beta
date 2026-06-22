import { fmt, GeneratorConfig, LABEL_OUTLINE_WIDTH } from "./mvsGenerator";

type BambuTemplate = {
  file: string;
};

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const BAMBU_TEMPLATES: Record<string, BambuTemplate> = {
  BAMBU_A1: { file: "A1.gcode.3mf" },
  BAMBU_A1_MINI: { file: "A1M.gcode.3mf" },
  BAMBU_A2L: { file: "A2L.gcode.3mf" },
  BAMBU_H2C: { file: "H2C.gcode.3mf" },
  BAMBU_H2D_SINGLE: { file: "H2D.gcode.3mf" },
  BAMBU_H2D_DUAL: { file: "H2D.gcode.3mf" },
  BAMBU_H2D_PRO: { file: "H2DP.gcode.3mf" },
  BAMBU_H2S: { file: "H2S.gcode.3mf" },
  BAMBU_P1P: { file: "P1P.gcode.3mf" },
  BAMBU_P1S: { file: "P1S.gcode.3mf" },
  BAMBU_P2S: { file: "P2S.gcode.3mf" },
  BAMBU_X1: { file: "X1.gcode.3mf" },
  BAMBU_X1C: { file: "X1C.gcode.3mf" },
  BAMBU_X1E: { file: "X1E.gcode.3mf" },
  BAMBU_X2D: { file: "X2D.gcode.3mf" },
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function supportsBuiltInBambu3mf(cfg: Pick<GeneratorConfig, "printer_preset">) {
  return Boolean(BAMBU_TEMPLATES[cfg.printer_preset]);
}

export function bambu3mfFileName(output: string) {
  const base = output
    .replace(/\.gcode\.3mf$/i, "")
    .replace(/\.3mf$/i, "")
    .replace(/\.gcode$/i, "");
  return `${base || "lesic_bambu"}.gcode.3mf`;
}

export async function makeBambu3mfBlob(cfg: GeneratorConfig, gcode: string) {
  const template = BAMBU_TEMPLATES[cfg.printer_preset];
  if (!template) {
    throw new Error(`Built-in Bambu 3MF template is not available for ${cfg.printer_preset}`);
  }

  const templateBytes = await fetchTemplate(template.file);
  const entries = await readZipEntries(templateBytes);
  const templateGcodeEntry = entries.find((entry) => entry.name === "Metadata/plate_1.gcode");
  if (!templateGcodeEntry) {
    throw new Error("Bambu template is missing Metadata/plate_1.gcode");
  }

  const templateGcode = textDecoder.decode(templateGcodeEntry.data);
  const plateGcode = makeBambuPlateGcode(cfg, gcode, templateGcode);
  const plateBytes = textEncoder.encode(plateGcode);
  const md5 = textEncoder.encode(md5Hex(plateBytes));
  const nozzleCount = nozzleCountFromTemplate(entries, cfg);

  const patchedEntries = entries.map((entry): ZipEntry => {
    if (entry.name === "Metadata/plate_1.gcode") return { name: entry.name, data: plateBytes };
    if (entry.name === "Metadata/plate_1.gcode.md5") return { name: entry.name, data: md5 };
    if (entry.name === "Metadata/plate_1.json") {
      return { name: entry.name, data: textEncoder.encode(patchPlateJson(textDecoder.decode(entry.data), cfg)) };
    }
    if (entry.name === "Metadata/slice_info.config") {
      return { name: entry.name, data: textEncoder.encode(patchSliceInfo(textDecoder.decode(entry.data), cfg, nozzleCount)) };
    }
    if (entry.name === "Metadata/project_settings.config") {
      return { name: entry.name, data: textEncoder.encode(patchProjectSettings(textDecoder.decode(entry.data), cfg, nozzleCount)) };
    }
    return entry;
  });

  return new Blob([makeZip(patchedEntries, new Date())], { type: "model/3mf" });
}

async function fetchTemplate(file: string) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const response = await fetch(`${base}bambu_templates/${file}`);
  if (!response.ok) {
    throw new Error(`Failed to load Bambu template ${file}: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function makeBambuPlateGcode(cfg: GeneratorConfig, gcode: string, templateGcode: string) {
  const templateLines = normalizeLf(templateGcode).split("\n");
  const firstLayerIndex = templateLines.findIndex((line) => line.trim() === "; CHANGE_LAYER");
  if (firstLayerIndex < 0) {
    throw new Error("Bambu template gcode has no CHANGE_LAYER marker");
  }

  let suffixStart = templateLines.findIndex((line, index) => index > firstLayerIndex && line.includes("close powerlost recovery"));
  if (suffixStart < 0) {
    const machineEnd = templateLines.findIndex((line, index) => index > firstLayerIndex && line.includes("MACHINE_END_GCODE_START"));
    suffixStart = machineEnd >= 0 ? machineEnd : templateLines.length;
    for (let index = suffixStart; index >= firstLayerIndex; index--) {
      if (templateLines[index]?.trim() === "; FEATURE: Custom") {
        suffixStart = index;
        break;
      }
    }
  }

  const totalLayers = totalCalibrationLayers(cfg);
  const totalHeight = totalLayers * cfg.layer_height;
  const prefix = patchTemplatePrefix(templateLines.slice(0, firstLayerIndex).join("\n"), cfg, totalLayers, totalHeight);
  const body = makeDecoratedLesicBody(cfg, gcode, totalLayers, totalHeight);
  const suffix = patchTemplateSuffix(templateLines.slice(suffixStart).join("\n"), totalHeight);

  return `${prefix}\n${body}\n${suffix}\n`;
}

function patchTemplatePrefix(prefix: string, cfg: GeneratorConfig, totalLayers: number, totalHeight: number) {
  return patchG29Footprint(prefix, cfg)
    .replace(/(; total layer number:\s*)\d+/i, `$1${totalLayers}`)
    .replace(/(; max_z_height:\s*)[-+]?\d*\.?\d+/i, `$1${fmt(totalHeight)}`)
    .replace(/(; layer_height =\s*)[-+]?\d*\.?\d+/gi, `$1${fmt(cfg.layer_height)}`)
    .replace(/(; initial_layer_print_height =\s*)[-+]?\d*\.?\d+/gi, `$1${fmt(cfg.layer_height)}`)
    .replace(/(; nozzle_diameter =\s*)[-+]?\d*\.?\d+(?:,[-+]?\d*\.?\d+)*/gi, `$1${fmt(cfg.nozzle_size)}`);
}

function patchTemplateSuffix(suffix: string, totalHeight: number) {
  const safeZ = totalHeight + 10;
  return suffix
    .split("\n")
    .map((line) => {
      if (!/^\s*G[0123]\b/i.test(line) || !/\sZ[-+]?\d/i.test(line)) return line;
      return line.replace(/(\sZ)([-+]?\d*\.?\d+)/i, (_match, prefix: string, value: string) => {
        return `${prefix}${fmt(Math.max(Number(value), safeZ))}`;
      });
    })
    .join("\n");
}

function makeDecoratedLesicBody(cfg: GeneratorConfig, gcode: string, totalLayers: number, totalHeight: number) {
  const source = extractLesicBody(gcode);
  const out: string[] = [
    "; LESIC_BODY_START",
    "G90 ; absolute XYZ",
    "M83 ; relative extrusion",
    "M220 S100 ; speed factor",
    "M221 S100 ; flow factor",
    `M140 S${fmt(cfg.bed_temp)}`,
    `M104 S${fmt(cfg.start_temp)}`,
    `M190 S${fmt(cfg.bed_temp)}`,
    `M109 S${fmt(cfg.start_temp)}`,
    "G92 E0",
    `G1 Z${fmt(cfg.layer_height)} F600`,
    `G1 X${fmt(Math.max(0, cfg.square_x - 8))} Y${fmt(cfg.square_y)} F6000`,
    `G1 X${fmt(Math.max(0, cfg.square_x - 8))} Y${fmt(cfg.square_y + cfg.circle_diameter)} E6 F600`,
    "G92 E0",
  ];

  let firstLayerStarted = false;
  for (const line of source) {
    if (line === "; ---------- bottom inner label ----------") {
      if (!firstLayerStarted) {
        out.push(...bambuLayerMarkers(1, totalLayers, cfg.layer_height, cfg.layer_height), "; FEATURE: Internal solid infill", `; LINE_WIDTH: ${fmt(LABEL_OUTLINE_WIDTH)}`);
        firstLayerStarted = true;
      }
      out.push(line);
      continue;
    }

    if (line.startsWith(";LAYER:")) {
      const layer = Math.max(1, Number(line.slice(";LAYER:".length)) || 1);
      if (!firstLayerStarted) {
        out.push(...bambuLayerMarkers(layer, totalLayers, layer * cfg.layer_height, cfg.layer_height));
        firstLayerStarted = true;
      } else if (layer > 1) {
        out.push(...bambuLayerMarkers(layer, totalLayers, layer * cfg.layer_height, cfg.layer_height));
      }
      out.push(line, "; FEATURE: Outer wall", `; LINE_WIDTH: ${fmt(cfg.line_width)}`);
      continue;
    }

    out.push(line);
  }

  const safeZ = totalHeight + 10;
  out.push(
    "; LESIC_BODY_END",
    "G92 E0",
    "G1 E-2 F1800",
    `G0 Z${fmt(safeZ)} F1200`,
  );
  return out.join("\n");
}

function bambuLayerMarkers(layer: number, totalLayers: number, z: number, layerHeight: number) {
  return [
    "; CHANGE_LAYER",
    `; Z_HEIGHT: ${fmt(z)}`,
    `; LAYER_HEIGHT: ${fmt(layerHeight)}`,
    `; layer num/total_layer_count: ${layer}/${totalLayers}`,
    `M73 L${layer}`,
  ];
}

function extractLesicBody(gcode: string) {
  const lines = normalizeLf(gcode).split("\n");
  const startMarker = lines.findIndex((line) => line === "; ---------- end minimal standalone start ----------");
  const endMarker = lines.findIndex((line) => line === "; ---------- minimal standalone end ----------");
  const start = startMarker >= 0 ? startMarker + 1 : 0;
  const end = endMarker >= 0 ? endMarker : lines.length;
  return lines.slice(start, end).filter((line) => !line.startsWith("; estimated_total_filament_E_mm="));
}

function totalCalibrationLayers(cfg: GeneratorConfig) {
  return Math.max(1, cfg.bands * cfg.layers_per_band);
}

function patchG29Footprint(text: string, cfg: GeneratorConfig) {
  const x = fmt(cfg.square_x);
  const y = fmt(cfg.square_y);
  const d = fmt(cfg.circle_diameter);
  return text
    .split("\n")
    .map((line) => {
      if (!/^\s*G29(?:\b|\.)/i.test(line)) return line;
      return line
        .replace(/(\sX)([-+]?\d*\.?\d+)/i, `$1${x}`)
        .replace(/(\sY)([-+]?\d*\.?\d+)/i, `$1${y}`)
        .replace(/(\sI)([-+]?\d*\.?\d+)/i, `$1${d}`)
        .replace(/(\sJ)([-+]?\d*\.?\d+)/i, `$1${d}`)
        .replace(/(\sW)([-+]?\d*\.?\d+)/i, `$1${d}`)
        .replace(/(\sH)([-+]?\d*\.?\d+)/i, `$1${d}`);
    })
    .join("\n");
}

function patchPlateJson(text: string, cfg: GeneratorConfig) {
  try {
    const data = JSON.parse(text);
    const bbox = [round(cfg.square_x), round(cfg.square_y), round(cfg.square_x + cfg.circle_diameter), round(cfg.square_y + cfg.circle_diameter)];
    data.bbox_all = bbox;
    data.nozzle_diameter = cfg.nozzle_size;
    if (Array.isArray(data.bbox_objects) && data.bbox_objects.length > 0) {
      data.bbox_objects = data.bbox_objects.map((object: Record<string, unknown>, index: number) => ({
        ...object,
        area: round(cfg.circle_diameter * cfg.circle_diameter),
        bbox,
        id: object.id ?? index + 1,
        layer_height: cfg.layer_height,
        name: "LESIC",
      }));
    }
    return JSON.stringify(data);
  } catch {
    return text;
  }
}

function patchSliceInfo(text: string, cfg: GeneratorConfig, nozzleCount: number) {
  const totalLayers = totalCalibrationLayers(cfg);
  const estimateSeconds = Math.max(60, Math.round(totalLayers * 12));
  const nozzleDiameters = Array.from({ length: nozzleCount }, () => fmt(cfg.nozzle_size)).join(",");
  return text
    .replace(/(<metadata\s+key="nozzle_diameters"\s+value=")[^"]*(")/g, (_match, a: string, b: string) => `${a}${nozzleDiameters}${b}`)
    .replace(/(<metadata\s+key="prediction"\s+value=")[^"]*(")/g, (_match, a: string, b: string) => `${a}${estimateSeconds}${b}`)
    .replace(/(<metadata\s+key="weight"\s+value=")[^"]*(")/g, (_match, a: string, b: string) => `${a}0.00${b}`)
    .replace(/(<metadata\s+key="first_layer_time"\s+value=")[^"]*(")/g, (_match, a: string, b: string) => `${a}12.0${b}`)
    .replace(/(<object\b[^>]*\sname=")[^"]*(")/g, (_match, a: string, b: string) => `${a}LESIC${b}`)
    .replace(/(\slayer_ranges=")[^"]*(")/g, (_match, a: string, b: string) => `${a}0 ${totalLayers - 1}${b}`)
    .replace(/(\snozzle_diameter=")[^"]*(")/g, (_match, a: string, b: string) => `${a}${fmt(cfg.nozzle_size)}${b}`)
    .replace(/(\sused_m=")[^"]*(")/g, (_match, a: string, b: string) => `${a}0.00${b}`)
    .replace(/(\sused_g=")[^"]*(")/g, (_match, a: string, b: string) => `${a}0.00${b}`);
}

function patchProjectSettings(text: string, cfg: GeneratorConfig, nozzleCount: number) {
  try {
    const data = JSON.parse(text);
    const min = [fmt(cfg.square_x), fmt(cfg.square_y)];
    const max = [fmt(cfg.square_x + cfg.circle_diameter), fmt(cfg.square_y + cfg.circle_diameter)];
    const nozzle = Array.from({ length: nozzleCount }, () => fmt(cfg.nozzle_size));
    data.layer_height = assignLike(data.layer_height, fmt(cfg.layer_height), cfg.layer_height);
    data.initial_layer_print_height = assignLike(data.initial_layer_print_height, fmt(cfg.layer_height), cfg.layer_height);
    data.nozzle_diameter = Array.isArray(data.nozzle_diameter) ? data.nozzle_diameter.map((value: unknown) => assignLike(value, fmt(cfg.nozzle_size), cfg.nozzle_size)) : nozzle;
    data.first_layer_print_min = min;
    data.first_layer_print_max = max;
    data.name = "LESIC";
    return JSON.stringify(data);
  } catch {
    return text;
  }
}

function nozzleCountFromTemplate(entries: ZipEntry[], cfg: GeneratorConfig) {
  const sliceInfo = entries.find((entry) => entry.name === "Metadata/slice_info.config");
  if (!sliceInfo) return cfg.printer_preset.includes("H2C") || cfg.printer_preset.includes("H2D") || cfg.printer_preset.includes("X2D") ? 2 : 1;
  const text = textDecoder.decode(sliceInfo.data);
  const match = text.match(/<metadata\s+key="nozzle_diameters"\s+value="([^"]*)"/);
  if (!match) return 1;
  return Math.max(1, match[1].split(",").filter(Boolean).length);
}

function assignLike(existing: unknown, stringValue: string, numberValue: number) {
  return typeof existing === "number" ? numberValue : stringValue;
}

function round(value: number) {
  return Number(fmt(value));
}

function normalizeLf(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

async function readZipEntries(zip: Uint8Array) {
  const eocd = findEndOfCentralDirectory(zip);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = textDecoder.decode(zip.subarray(offset + 46, offset + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressedData = zip.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? new Uint8Array(compressedData) : await inflateRaw(compressedData, method);
    entries.push({ name, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(zip: Uint8Array) {
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 0x10000 - 22); offset--) {
    if (
      zip[offset] === 0x50 &&
      zip[offset + 1] === 0x4b &&
      zip[offset + 2] === 0x05 &&
      zip[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  throw new Error("ZIP end of central directory not found");
}

async function inflateRaw(data: Uint8Array, method: number) {
  if (method !== 8) throw new Error(`Unsupported ZIP compression method ${method}`);
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("This browser does not support ZIP deflate decompression");
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function makeZip(entries: ZipEntry[], date: Date) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime(date);

  entries.forEach((entry) => {
    const name = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localChunks.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centralChunks.push(central);
    offset += local.length;
  });

  const centralOffset = offset;
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);

  return concat([...localChunks, ...centralChunks, end]);
}

function concat(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function md5Hex(bytes: Uint8Array) {
  const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  const words = new Int32Array(16);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getInt32(offset + i * 4, true);
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = ff(a, b, c, d, words[0], 7, -680876936);
    d = ff(d, a, b, c, words[1], 12, -389564586);
    c = ff(c, d, a, b, words[2], 17, 606105819);
    b = ff(b, c, d, a, words[3], 22, -1044525330);
    a = ff(a, b, c, d, words[4], 7, -176418897);
    d = ff(d, a, b, c, words[5], 12, 1200080426);
    c = ff(c, d, a, b, words[6], 17, -1473231341);
    b = ff(b, c, d, a, words[7], 22, -45705983);
    a = ff(a, b, c, d, words[8], 7, 1770035416);
    d = ff(d, a, b, c, words[9], 12, -1958414417);
    c = ff(c, d, a, b, words[10], 17, -42063);
    b = ff(b, c, d, a, words[11], 22, -1990404162);
    a = ff(a, b, c, d, words[12], 7, 1804603682);
    d = ff(d, a, b, c, words[13], 12, -40341101);
    c = ff(c, d, a, b, words[14], 17, -1502002290);
    b = ff(b, c, d, a, words[15], 22, 1236535329);

    a = gg(a, b, c, d, words[1], 5, -165796510);
    d = gg(d, a, b, c, words[6], 9, -1069501632);
    c = gg(c, d, a, b, words[11], 14, 643717713);
    b = gg(b, c, d, a, words[0], 20, -373897302);
    a = gg(a, b, c, d, words[5], 5, -701558691);
    d = gg(d, a, b, c, words[10], 9, 38016083);
    c = gg(c, d, a, b, words[15], 14, -660478335);
    b = gg(b, c, d, a, words[4], 20, -405537848);
    a = gg(a, b, c, d, words[9], 5, 568446438);
    d = gg(d, a, b, c, words[14], 9, -1019803690);
    c = gg(c, d, a, b, words[3], 14, -187363961);
    b = gg(b, c, d, a, words[8], 20, 1163531501);
    a = gg(a, b, c, d, words[13], 5, -1444681467);
    d = gg(d, a, b, c, words[2], 9, -51403784);
    c = gg(c, d, a, b, words[7], 14, 1735328473);
    b = gg(b, c, d, a, words[12], 20, -1926607734);

    a = hh(a, b, c, d, words[5], 4, -378558);
    d = hh(d, a, b, c, words[8], 11, -2022574463);
    c = hh(c, d, a, b, words[11], 16, 1839030562);
    b = hh(b, c, d, a, words[14], 23, -35309556);
    a = hh(a, b, c, d, words[1], 4, -1530992060);
    d = hh(d, a, b, c, words[4], 11, 1272893353);
    c = hh(c, d, a, b, words[7], 16, -155497632);
    b = hh(b, c, d, a, words[10], 23, -1094730640);
    a = hh(a, b, c, d, words[13], 4, 681279174);
    d = hh(d, a, b, c, words[0], 11, -358537222);
    c = hh(c, d, a, b, words[3], 16, -722521979);
    b = hh(b, c, d, a, words[6], 23, 76029189);
    a = hh(a, b, c, d, words[9], 4, -640364487);
    d = hh(d, a, b, c, words[12], 11, -421815835);
    c = hh(c, d, a, b, words[15], 16, 530742520);
    b = hh(b, c, d, a, words[2], 23, -995338651);

    a = ii(a, b, c, d, words[0], 6, -198630844);
    d = ii(d, a, b, c, words[7], 10, 1126891415);
    c = ii(c, d, a, b, words[14], 15, -1416354905);
    b = ii(b, c, d, a, words[5], 21, -57434055);
    a = ii(a, b, c, d, words[12], 6, 1700485571);
    d = ii(d, a, b, c, words[3], 10, -1894986606);
    c = ii(c, d, a, b, words[10], 15, -1051523);
    b = ii(b, c, d, a, words[1], 21, -2054922799);
    a = ii(a, b, c, d, words[8], 6, 1873313359);
    d = ii(d, a, b, c, words[15], 10, -30611744);
    c = ii(c, d, a, b, words[6], 15, -1560198380);
    b = ii(b, c, d, a, words[13], 21, 1309151649);
    a = ii(a, b, c, d, words[4], 6, -145523070);
    d = ii(d, a, b, c, words[11], 10, -1120210379);
    c = ii(c, d, a, b, words[2], 15, 718787259);
    b = ii(b, c, d, a, words[9], 21, -343485551);

    a = add32(a, olda);
    b = add32(b, oldb);
    c = add32(c, oldc);
    d = add32(d, oldd);
  }
  return [a, b, c, d].map(hexLe).join("").toUpperCase();
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
  return add32(rol(add32(add32(a, q), add32(x, t)), s), b);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function rol(num: number, cnt: number) {
  return (num << cnt) | (num >>> (32 - cnt));
}

function add32(a: number, b: number) {
  return (a + b) | 0;
}

function hexLe(n: number) {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
  }
  return out;
}
