#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Melt/MVS Calibrator UI v17
- Larger UI fonts
- Default 16:9 window, about 3/4 of screen
- Left 1/3: variables
- Right 2/3: preview
- Always standalone generator, G28 first
"""

import json
import math
import os
import re
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import ttk, filedialog, messagebox

APP_DIR = Path(__file__).resolve().parent
GENERATOR = APP_DIR / "melt_mvs_calibrator_v11.py"
PRESET_FILE = APP_DIR / "printer_presets.json"

BG = "#3a3a3a"
PANEL = "#474747"
PANEL2 = "#404040"
FG = "#f1f1f1"
DESC = "#cfcfcf"
ENTRY_BG = "#eeeeee"
ENTRY_FG = "#111111"
ACCENT = "#d6d6d6"
CANVAS_BG = "#2b2b2b"
BED_LINE = "#a8a8a8"
GUIDE_LINE = "#6f8fb8"
CIRCLE_LINE = "#d0d0d0"
STROKE_LINE = "#eeeeee"
CONNECTOR_LINE = "#6fa8dc"
SEAM_LINE = "#ffcc66"

# Larger font set
FONT_TITLE = ("Segoe UI", 22, "bold")
FONT_SUB = ("Segoe UI", 12)
FONT_SECTION = ("Segoe UI", 16, "bold")
FONT_NAME = ("Consolas", 15, "bold")
FONT_DESC = ("Segoe UI", 11)
FONT_ENTRY = ("Consolas", 15)
FONT_BUTTON = ("Segoe UI", 14, "bold")
FONT_STATUS = ("Consolas", 11)
FONT_PREVIEW = ("Segoe UI", 12)


VAR_DEFS = [
    ("Output", "output", "U1_v21_ui.gcode", "생성할 G-code 파일 이름. 상대경로면 이 폴더에 저장됨.", "entry"),

    ("Printer", "printer_preset", "SNAPMAKER_U1", "printer_presets.json에 있는 프린터 프리셋 이름.", "preset"),
    ("Printer", "firmware_mode", "klipper", "펌웨어 종류. 프리셋 선택 시 자동 추정됨.", "choice:klipper,marlin,bambu,unknown"),
    ("Printer", "filament_name", "Unknown_pla", "바닥 라벨에 들어갈 필라멘트 이름.", "entry"),

    ("Firmware Motion", "motion_accel", "8000", "요청 가속도. 펌웨어 모드에 맞는 명령으로 변환됨.", "entry"),
    ("Firmware Motion", "motion_velocity", "300", "요청 XY 최대속도. Klipper/Marlin에서 사용. Bambu는 제한적.", "entry"),
    ("Firmware Motion", "motion_minimum_cruise_ratio", "0", "Klipper 전용. 0이면 minimum cruise 강제 완화.", "entry"),
    ("Firmware Motion", "motion_square_corner_velocity", "10", "Klipper 전용 square corner velocity.", "entry"),
    ("Firmware Motion", "motion_jerk", "10", "Marlin/Bambu classic jerk 힌트.", "entry"),

    ("Temperature", "start_temp", "230", "시작 온도. 기본 230°C.", "entry"),
    ("Temperature", "end_temp", "176", "끝 온도. bands는 시작/끝/step으로 자동 계산.", "entry"),
    ("Temperature", "temp_step", "1", "밴드마다 낮출 온도. 1이면 -1°C씩 감소.", "entry"),
    ("Temperature", "layers_per_band", "10", "온도 하나당 레이어 수.", "entry"),
    ("Temperature", "temp_wait_tolerance", "0.5", "온도 대기 허용 오차.", "entry"),
    ("Temperature", "bed_temp", "60", "standalone 출력 시 베드 온도.", "entry"),

    ("MVS / Geometry", "layer_height", "0.24", "레이어 높이.", "entry"),
    ("MVS / Geometry", "line_width", "0.45", "캘리브레이션 원형벽 선폭. 라벨 글자폭과 별개.", "entry"),
    ("MVS / Geometry", "mvs_min", "0.1", "시작 MVS 값 mm³/s.", "entry"),
    ("MVS / Geometry", "mvs_max", "20", "최대 MVS 값 mm³/s.", "entry"),
    ("MVS / Geometry", "arc_segments", "360", "원 1바퀴를 나누는 세그먼트 수. 클수록 원이 부드러움.", "entry"),

    ("Build Volume Override", "bed_x", "", "비우면 프리셋값 사용. 빌드볼륨 X 수동입력.", "entry"),
    ("Build Volume Override", "bed_y", "", "비우면 프리셋값 사용. 빌드볼륨 Y 수동입력.", "entry"),

    ("Placement Override", "square_x", "", "비우면 빌드볼륨 기준 자동값 사용. 바운딩 사각형 좌하단 X.", "entry"),
    ("Placement Override", "square_y", "", "비우면 빌드볼륨 기준 자동값 사용. 바운딩 사각형 좌하단 Y.", "entry"),
    ("Placement Override", "circle_diameter", "", "비우면 빌드볼륨 기준 자동값 사용. 원 지름.", "entry"),

    ("Label", "label", True, "바닥 라벨 출력 여부.", "check"),
    ("Label", "label_layout", "three-line", "라벨 줄 구성. 기본 3줄.", "choice:three-line,one-line"),
    ("Label", "label_height", "", "비우면 자동. 목표 글자 높이.", "entry"),
    ("Label", "label_x_scale", "0.55", "txt.shx식 글자 가로 압축률.", "entry"),
    ("Label", "label_stroke_width", "0.6", "실제 글씨 stroke 압출폭. 기본 0.6mm.", "entry"),
    ("Label", "label_connector_width", "0.2", "글자/획/줄 연결선 압출폭. 기본 0.2mm.", "entry"),
    ("Label", "label_smooth_iterations", "0", "txt.shx 느낌 유지하려면 0. 1 이상이면 둥글어짐.", "entry"),
    ("Label", "label_speed", "20", "라벨 출력 속도 mm/s.", "entry"),

    ("Advanced", "travel_speed", "180", "비압출 이동 속도 mm/s.", "entry"),
    ("Advanced", "z_travel_speed", "10", "Z 이동 속도 mm/s.", "entry"),
    ("Advanced", "min_xy_speed", "0.2", "최소 XY 속도 mm/s.", "entry"),
    ("Advanced", "max_xy_speed", "0", "0이면 MVS 기준으로 자동 계산.", "entry"),
    ("Advanced", "retract", "0", "라벨/캘리브레이션 기본 리트랙트. 0 권장.", "entry"),
    ("Advanced", "extrusion_multiplier", "1.0", "전체 압출 배율.", "entry"),
]


class ScrollFrame(tk.Frame):
    def __init__(self, master):
        super().__init__(master, bg=BG)
        self.canvas = tk.Canvas(self, bg=BG, highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.inner = tk.Frame(self.canvas, bg=BG)
        self.inner.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.window_id = self.canvas.create_window((0, 0), window=self.inner, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.canvas.bind("<Configure>", self._on_canvas_configure)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")

        def _wheel(event):
            self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        self.canvas.bind_all("<MouseWheel>", _wheel)

    def _on_canvas_configure(self, event):
        self.canvas.itemconfigure(self.window_id, width=event.width)


class App:
    def __init__(self, root):
        self.root = root
        self.root.title("Melt/MVS Calibrator UI v21")
        self.root.configure(bg=BG)
        self.set_initial_geometry()

        self.vars = {}
        self.preview_data = None
        self.preset_data = self.load_preset_data()
        self.preset_names = sorted(self.preset_data.keys()) if self.preset_data else ["SNAPMAKER_U1", "CREALITY_K1", "GENERIC_220"]

        self.build_header()
        self.build_main()
        self.on_printer_preset_changed()

    def set_initial_geometry(self):
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()

        # 16:9 and about 3/4 screen, not full screen.
        ww = int(sw * 0.75)
        wh = int(ww * 9 / 16)
        max_h = int(sh * 0.78)
        if wh > max_h:
            wh = max_h
            ww = int(wh * 16 / 9)

        ww = max(1200, ww)
        wh = max(675, wh)
        x = max(0, (sw - ww) // 2)
        y = max(0, (sh - wh) // 2)
        self.root.geometry(f"{ww}x{wh}+{x}+{y}")

    def load_preset_data(self):
        try:
            return json.loads(PRESET_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def build_header(self):
        header = tk.Frame(self.root, bg=BG)
        header.pack(fill="x", padx=18, pady=(12, 6))
        tk.Label(header, text="Melt / MVS Calibrator UI v21", bg=BG, fg=FG, font=FONT_TITLE).pack(anchor="w")
        tk.Label(
            header,
            text="왼쪽: 변수 입력 · 오른쪽: 베드/출력물/바닥글씨 프리뷰 · always standalone · G28 first · firmware auto/unknown + bed override",
            bg=BG,
            fg=DESC,
            font=FONT_SUB,
        ).pack(anchor="w", pady=(2, 0))
        self.firmware_warning = tk.Label(
            header,
            text="",
            bg=BG,
            fg="#ffcc66",
            font=("Segoe UI", 12, "bold"),
        )
        self.firmware_warning.pack(anchor="w", pady=(4, 0))

    def build_main(self):
        main = tk.Frame(self.root, bg=BG)
        main.pack(fill="both", expand=True, padx=18, pady=(4, 14))
        main.grid_columnconfigure(0, weight=1, uniform="main")
        main.grid_columnconfigure(1, weight=2, uniform="main")
        main.grid_rowconfigure(0, weight=1)

        self.left = tk.Frame(main, bg=BG)
        self.left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        self.right = tk.Frame(main, bg=BG)
        self.right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        self.right.grid_rowconfigure(1, weight=1)
        self.right.grid_columnconfigure(0, weight=1)

        self.build_form(self.left)
        self.build_right_panel(self.right)

    def build_form(self, parent):
        self.scroll = ScrollFrame(parent)
        self.scroll.pack(fill="both", expand=True)

        current_section = None
        for section, name, default, desc, kind in VAR_DEFS:
            if section != current_section:
                current_section = section
                section_frame = tk.Frame(self.scroll.inner, bg=PANEL, bd=0)
                section_frame.pack(fill="x", padx=0, pady=(9, 0))
                tk.Label(
                    section_frame,
                    text=section,
                    bg=PANEL,
                    fg=FG,
                    font=FONT_SECTION,
                    padx=12,
                    pady=7,
                ).pack(anchor="w")

            field = tk.Frame(self.scroll.inner, bg=PANEL2)
            field.pack(fill="x", padx=0, pady=(1, 0))
            field.grid_columnconfigure(0, weight=1)

            tk.Label(field, text=name, bg=PANEL2, fg=FG, font=FONT_NAME).grid(row=0, column=0, sticky="w", padx=12, pady=(8, 0))
            tk.Label(field, text=desc, bg=PANEL2, fg=DESC, font=FONT_DESC, wraplength=430, justify="left").grid(row=1, column=0, sticky="w", padx=12, pady=(1, 5))

            right = tk.Frame(field, bg=PANEL2)
            right.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 10))
            right.grid_columnconfigure(0, weight=1)

            self.add_widget(right, name, default, kind)

    def add_widget(self, parent, name, default, kind):
        if kind == "check":
            var = tk.BooleanVar(value=bool(default))
            cb = tk.Checkbutton(parent, variable=var, bg=PANEL2, fg=FG, selectcolor=BG, activebackground=PANEL2, activeforeground=FG, font=FONT_ENTRY)
            cb.pack(anchor="w")
            self.vars[name] = var
            return

        if kind == "preset":
            value = default if default in self.preset_names else (self.preset_names[0] if self.preset_names else default)
            var = tk.StringVar(value=value)
            combo = ttk.Combobox(parent, textvariable=var, values=self.preset_names, state="readonly", font=FONT_ENTRY)
            combo.pack(fill="x", ipady=4)
            self.vars[name] = var
            if name == "printer_preset":
                combo.bind("<<ComboboxSelected>>", self.on_printer_preset_changed)
            return

        if kind.startswith("choice:"):
            choices = kind.split(":", 1)[1].split(",")
            var = tk.StringVar(value=str(default))
            combo = ttk.Combobox(parent, textvariable=var, values=choices, state="readonly", font=FONT_ENTRY)
            combo.pack(fill="x", ipady=4)
            self.vars[name] = var
            if name == "firmware_mode":
                combo.bind("<<ComboboxSelected>>", lambda e: (self.update_firmware_warning(), self.redraw_preview()))
            return

        var = tk.StringVar(value=str(default))
        ent = tk.Entry(parent, textvariable=var, bg=ENTRY_BG, fg=ENTRY_FG, insertbackground=ENTRY_FG, font=FONT_ENTRY, relief="flat")
        ent.pack(fill="x", ipady=6)
        self.vars[name] = var

    def build_right_panel(self, parent):
        btns = tk.Frame(parent, bg=BG)
        btns.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        btns.grid_columnconfigure(10, weight=1)

        self.generate_btn = tk.Button(btns, text="Generate G-code", font=FONT_BUTTON, command=self.generate, bg=ACCENT, fg="#111111", relief="flat", padx=18, pady=10)
        self.generate_btn.grid(row=0, column=0, sticky="w")

        self.preview_btn = tk.Button(btns, text="Preview", font=FONT_BUTTON, command=self.preview, bg="#6b7f99", fg="#ffffff", relief="flat", padx=18, pady=10)
        self.preview_btn.grid(row=0, column=1, sticky="w", padx=(10, 0))

        tk.Button(btns, text="Choose output", command=self.choose_output, font=FONT_BUTTON, bg="#5a5a5a", fg=FG, relief="flat", padx=14, pady=10).grid(row=0, column=2, sticky="w", padx=(10, 0))
        tk.Button(btns, text="Open folder", command=self.open_folder, font=FONT_BUTTON, bg="#5a5a5a", fg=FG, relief="flat", padx=14, pady=10).grid(row=0, column=3, sticky="w", padx=(10, 0))

        preview_box = tk.Frame(parent, bg=PANEL)
        preview_box.grid(row=1, column=0, sticky="nsew")
        preview_box.grid_rowconfigure(1, weight=1)
        preview_box.grid_columnconfigure(0, weight=1)

        tk.Label(preview_box, text="Preview: bed / circle / bottom label path", bg=PANEL, fg=FG, font=FONT_SECTION, padx=10, pady=7).grid(row=0, column=0, sticky="w")

        self.preview_canvas = tk.Canvas(preview_box, bg=CANVAS_BG, highlightthickness=0)
        self.preview_canvas.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.preview_canvas.bind("<Configure>", lambda e: self.redraw_preview())

        self.status = tk.Text(parent, height=7, bg="#222222", fg="#dddddd", insertbackground="#dddddd", font=FONT_STATUS, relief="flat")
        self.status.grid(row=2, column=0, sticky="ew", pady=(8, 0))
        self.log("Ready. Press Preview or Generate G-code.")

    def log(self, msg):
        self.status.insert("end", msg + "\n")
        self.status.see("end")

    def choose_output(self):
        file = filedialog.asksaveasfilename(
            title="Save G-code",
            defaultextension=".gcode",
            filetypes=[("G-code", "*.gcode"), ("All files", "*.*")]
        )
        if file:
            self.vars["output"].set(file)

    def open_folder(self):
        out = Path(self.vars["output"].get().strip() or ".")
        folder = out.parent if out.is_absolute() else APP_DIR
        try:
            os.startfile(str(folder))
        except Exception as e:
            messagebox.showerror("Open folder failed", str(e))


    def infer_firmware_from_preset(self, preset_name):
        key = str(preset_name).upper()

        if "BAMBU" in key:
            return "bambu"

        klipper_tokens = [
            "SNAPMAKER_U1",
            "VORON",
            "CREALITY_K1",
            "CREALITY_K1C",
            "CREALITY_K1_MAX",
            "CREALITY_K2",
            "SOVOL_SV08",
            "QIDI_Q1",
            "QIDI_PLUS4",
            "QIDI_X_PLUS_3",
            "QIDI_X_MAX_3",
        ]
        if any(t in key for t in klipper_tokens):
            return "klipper"

        marlin_tokens = [
            "PRUSA",
            "ENDER",
            "SOVOL_SV06",
            "ANYCUBIC",
            "ELEGOO",
            "FLASHFORGE",
            "ANKER",
            "SNAPMAKER_J1",
        ]
        if any(t in key for t in marlin_tokens):
            return "marlin"

        return "unknown"

    def on_printer_preset_changed(self, event=None):
        preset = self.value("printer_preset")
        inferred = self.infer_firmware_from_preset(preset)
        if "firmware_mode" in self.vars:
            self.vars["firmware_mode"].set(inferred)
        self.update_firmware_warning()
        self.redraw_preview()

    def update_firmware_warning(self, *args):
        if not hasattr(self, "firmware_warning"):
            return
        mode = self.value("firmware_mode") if "firmware_mode" in self.vars else "unknown"
        if mode == "unknown":
            self.firmware_warning.configure(text="가속/속도제한이 해제되지 않았을 수 있습니다")
        else:
            self.firmware_warning.configure(text="")

    def compute_bands_from_temps(self):
        try:
            start = float(self.vars["start_temp"].get().strip())
            end = float(self.vars["end_temp"].get().strip())
            step = float(self.vars["temp_step"].get().strip())
        except Exception:
            raise ValueError("start_temp, end_temp, temp_step은 숫자여야 함.")

        if step <= 0:
            raise ValueError("temp_step은 0보다 커야 함.")
        if start < end:
            raise ValueError("현재 생성기는 온도를 내려가는 구조라 start_temp가 end_temp보다 커야 함.")

        diff = start - end
        exact = diff / step
        nearest = round(exact)
        if abs(exact - nearest) < 1e-9:
            bands = int(nearest) + 1
        else:
            bands = int(math.ceil(exact)) + 1
        return max(1, bands)

    def value(self, name):
        v = self.vars[name].get()
        return str(v).strip() if not isinstance(v, bool) else v

    def build_command(self, output_override=None):
        cmd = [sys.executable, str(GENERATOR)]

        output = output_override if output_override is not None else (self.vars["output"].get().strip() or "output.gcode")
        cmd += ["-o", str(output)]

        cmd += ["--printer-preset", self.value("printer_preset")]
        cmd += ["--filament-name", self.value("filament_name")]

        computed_bands = self.compute_bands_from_temps()
        cmd += ["--bands", str(computed_bands)]

        # v17 is always standalone.
        cmd += ["--standalone"]

        if not self.vars["label"].get():
            cmd += ["--no-label"]
        else:
            cmd += ["--label"]

        arg_names = [
            "firmware_mode", "motion_accel", "motion_velocity", "motion_minimum_cruise_ratio", "motion_square_corner_velocity", "motion_jerk",
            "start_temp", "end_temp", "temp_step", "layers_per_band", "temp_wait_tolerance", "bed_temp",
            "bed_x", "bed_y",
            "layer_height", "line_width", "mvs_min", "mvs_max", "arc_segments",
            "square_x", "square_y", "circle_diameter",
            "label_layout", "label_height", "label_x_scale", "label_stroke_width", "label_connector_width",
            "label_smooth_iterations", "label_speed",
            "travel_speed", "z_travel_speed", "min_xy_speed", "max_xy_speed",
            "retract", "extrusion_multiplier",
        ]

        for name in arg_names:
            v = self.value(name)
            if v == "":
                continue
            cmd += ["--" + name.replace("_", "-"), v]

        return cmd

    def get_preview_placement(self):
        preset_name = self.value("printer_preset")
        p = self.preset_data.get(preset_name, {})
        bed_x = float(p.get("bed_x", 220))
        bed_y = float(p.get("bed_y", 220))

        def f_or_none(name):
            v = self.value(name)
            if v == "":
                return None
            return float(v)

        bx_override = f_or_none("bed_x")
        by_override = f_or_none("bed_y")
        if bx_override is not None:
            bed_x = bx_override
        if by_override is not None:
            bed_y = by_override

        sx = f_or_none("square_x")
        sy = f_or_none("square_y")
        d = f_or_none("circle_diameter")

        if sx is None or sy is None or d is None:
            if bed_x >= 220 and bed_y >= 220:
                default_sx, default_sy, default_d = 10.0, 10.0, 200.0
            else:
                default_sx, default_sy = 5.0, 5.0
                default_d = min(bed_x, bed_y) - 10.0
            sx = default_sx if sx is None else sx
            sy = default_sy if sy is None else sy
            d = default_d if d is None else d

        return bed_x, bed_y, sx, sy, d

    def parse_label_segments_from_gcode(self, path):
        text = Path(path).read_text(encoding="utf-8", errors="ignore").splitlines()
        inside = False
        cur = {"X": None, "Y": None}
        segments = []

        for line in text:
            s = line.strip()
            if "---------- bottom inner label ----------" in s and "end" not in s:
                inside = True
                continue
            if "---------- end bottom inner label ----------" in s:
                inside = False
                continue

            if not s.startswith(("G0", "G1")):
                continue

            cmd = s.split()[0]
            vals = dict(re.findall(r"([XYZE])([-+]?\d*\.?\d+)", s))
            old = (cur["X"], cur["Y"])
            if "X" in vals:
                cur["X"] = float(vals["X"])
            if "Y" in vals:
                cur["Y"] = float(vals["Y"])
            new = (cur["X"], cur["Y"])
            if new[0] is None or new[1] is None:
                continue

            draw_this = inside or ("label_connector_to_seam" in s)
            if draw_this and cmd == "G1" and old[0] is not None and old[1] is not None:
                kind = "connector" if "label_connector" in s else "stroke" if "label_stroke" in s else "other"
                segments.append((old, new, kind))

        return segments

    def set_preview_data_from_gcode(self, gcode_path):
        bed_x, bed_y, sx, sy, d = self.get_preview_placement()
        segs = self.parse_label_segments_from_gcode(gcode_path)
        self.preview_data = {
            "bed_x": bed_x,
            "bed_y": bed_y,
            "square_x": sx,
            "square_y": sy,
            "diameter": d,
            "segments": segs,
            "firmware_mode": self.value("firmware_mode"),
        }
        self.redraw_preview()

    def redraw_preview(self):
        c = self.preview_canvas
        c.delete("all")
        w = max(c.winfo_width(), 100)
        h = max(c.winfo_height(), 100)

        if not self.preview_data:
            c.create_text(w / 2, h / 2, text="Preview not generated yet", fill=DESC, font=("Segoe UI", 18))
            return

        bed_x = self.preview_data["bed_x"]
        bed_y = self.preview_data["bed_y"]
        sx = self.preview_data["square_x"]
        sy = self.preview_data["square_y"]
        d = self.preview_data["diameter"]
        segs = self.preview_data["segments"]
        firmware_mode = self.preview_data.get("firmware_mode", self.value("firmware_mode"))

        margin = 34
        scale = min((w - 2 * margin) / bed_x, (h - 2 * margin) / bed_y)

        def tx(x):
            return margin + x * scale

        def ty(y):
            return h - margin - y * scale

        def rect(x0, y0, x1, y1, **kw):
            c.create_rectangle(tx(x0), ty(y1), tx(x1), ty(y0), **kw)

        rect(0, 0, bed_x, bed_y, outline=BED_LINE, width=2)
        rect(sx, sy, sx + d, sy + d, outline=GUIDE_LINE, width=1.5, dash=(5, 4))

        cx = sx + d / 2
        cy = sy + d / 2
        c.create_oval(tx(cx - d / 2), ty(cy + d / 2), tx(cx + d / 2), ty(cy - d / 2), outline=CIRCLE_LINE, width=2)

        seam_x, seam_y = cx, sy
        r = 4
        c.create_oval(tx(seam_x) - r, ty(seam_y) - r, tx(seam_x) + r, ty(seam_y) + r, outline=SEAM_LINE, width=2)

        for (p0, p1, kind) in segs:
            color = CONNECTOR_LINE if kind == "connector" else STROKE_LINE
            width_px = 1.5 if kind == "connector" else 3.2
            c.create_line(tx(p0[0]), ty(p0[1]), tx(p1[0]), ty(p1[1]), fill=color, width=width_px, capstyle="round", joinstyle="round")

        c.create_text(tx(4), ty(bed_y - 4), text=f"Bed {bed_x:g}×{bed_y:g}", fill=DESC, anchor="nw", font=FONT_PREVIEW)
        c.create_text(tx(sx), ty(sy - 4), text=f"X{sx:g} Y{sy:g}", fill=GUIDE_LINE, anchor="sw", font=FONT_PREVIEW)
        c.create_text(tx(cx), ty(sy + d + 4), text=f"Ø{d:g}", fill=DESC, anchor="s", font=FONT_PREVIEW)
        c.create_text(w - 12, 12, text=f"firmware: {firmware_mode}", fill=DESC, anchor="ne", font=FONT_PREVIEW)
        c.create_text(w - 12, 32, text="stroke 0.6 / connector 0.2 / label→seam", fill=DESC, anchor="ne", font=FONT_PREVIEW)
        if firmware_mode == "unknown":
            c.create_text(w - 12, 54, text="가속/속도제한이 해제되지 않았을 수 있습니다", fill="#ffcc66", anchor="ne", font=FONT_PREVIEW)

    def preview(self):
        try:
            bands = self.compute_bands_from_temps()
            tmp = APP_DIR / "__preview_tmp.gcode"
            cmd = self.build_command(output_override=tmp)
        except Exception as e:
            messagebox.showerror("Input error", str(e))
            self.log(f"Input error: {e}")
            return

        self.preview_btn.configure(state="disabled")
        self.log("")
        self.log(f"Preview: computed bands = {bands}")

        def worker():
            try:
                p = subprocess.run(cmd, cwd=APP_DIR, capture_output=True, text=True)
                self.root.after(0, lambda: self.on_preview_done(p, tmp))
            except Exception as e:
                self.root.after(0, lambda: self.on_preview_error(e))

        threading.Thread(target=worker, daemon=True).start()

    def on_preview_done(self, p, tmp):
        if p.returncode != 0:
            if p.stdout:
                self.log(p.stdout.strip())
            if p.stderr:
                self.log(p.stderr.strip())
            messagebox.showerror("Preview failed", f"Generator failed. returncode={p.returncode}")
        else:
            self.set_preview_data_from_gcode(tmp)
            self.log(f"Preview updated: {tmp.name}")
        self.preview_btn.configure(state="normal")

    def on_preview_error(self, e):
        self.log(f"Preview error: {e}")
        messagebox.showerror("Preview error", str(e))
        self.preview_btn.configure(state="normal")

    def generate(self):
        if not GENERATOR.exists():
            messagebox.showerror("Missing generator", f"Cannot find {GENERATOR}")
            return

        try:
            cmd = self.build_command()
            bands = self.compute_bands_from_temps()
        except Exception as e:
            messagebox.showerror("Input error", str(e))
            self.log(f"Input error: {e}")
            return

        self.generate_btn.configure(state="disabled")
        self.log("")
        self.log(f"computed bands = {bands}  (start_temp/end_temp/temp_step)")
        self.log("Running:")
        self.log(" ".join(f'"{c}"' if " " in c else c for c in cmd))

        def worker():
            try:
                p = subprocess.run(cmd, cwd=APP_DIR, capture_output=True, text=True)
                self.root.after(0, lambda: self.on_generate_done(p, cmd))
            except Exception as e:
                self.root.after(0, lambda: self.on_generate_error(e))

        threading.Thread(target=worker, daemon=True).start()

    def on_generate_done(self, p, cmd):
        if p.stdout:
            self.log("--- stdout ---")
            self.log(p.stdout.strip())
        if p.stderr:
            self.log("--- stderr ---")
            self.log(p.stderr.strip())

        if p.returncode == 0:
            self.log("Done.")
            try:
                out_arg = cmd[cmd.index("-o") + 1]
                out_path = Path(out_arg)
                if not out_path.is_absolute():
                    out_path = APP_DIR / out_path
                self.set_preview_data_from_gcode(out_path)
            except Exception as e:
                self.log(f"Preview update skipped: {e}")
            messagebox.showinfo("Done", "G-code generated.")
        else:
            self.log(f"Failed. returncode={p.returncode}")
            messagebox.showerror("Failed", f"Generator failed. returncode={p.returncode}")

        self.generate_btn.configure(state="normal")

    def on_generate_error(self, e):
        self.log(f"Error: {e}")
        messagebox.showerror("Error", str(e))
        self.generate_btn.configure(state="normal")


def main():
    root = tk.Tk()
    try:
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TCombobox", fieldbackground=ENTRY_BG, background=ENTRY_BG, foreground=ENTRY_FG, font=FONT_ENTRY)
        style.configure("Vertical.TScrollbar", background=PANEL, troughcolor=BG)
    except Exception:
        pass
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
