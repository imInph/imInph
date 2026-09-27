#!/usr/bin/env python3
"""Draw the README section headings as little terminal windows.

The text is the 8x16 font from inphex-monolyth's HDMI console
(console/font.hex), so the headings use the same letters the Tang Nano prints.

    python3 assets/mkheadings.py
"""
from pathlib import Path

HERE = Path(__file__).parent
ROWS = [int(line, 16) for line in (HERE / "font.hex").read_text().split()]

BG, EDGE = "#0D1117", "#30363D"
PROMPT, PATH, CMD, NOTE, CURSOR = "#3FB950", "#58A6FF", "#E6EDF3", "#6E7681", "#58A6FF"

MAC = [("inph@Ardas-MacBook-Air ~ % ", CMD), ("ssh inph@192.168.1.111", CMD)]
LOGIN = [("Last login: Sat Sep 27 14:02:11 2026 from 192.168.1.20", NOTE)]

# (file, lines before the prompt, command, comment)
HEADINGS = [
    ("building", [MAC, LOGIN], "ls projects/", "what I'm building"),
    ("languages", [], "cat languages.txt", "what I write"),
    ("tools", [], "which tools", "what I use"),
    ("snake", [], "./snake --eat contributions", "my GitHub year"),
]

PAD, DOTS, GLYPH_W, GLYPH_H = 10, 34, 8, 16


def text_path(text, x0, y0):
    """One path of 1-pixel-tall runs for every lit pixel of `text`."""
    d = []
    for i, ch in enumerate(text):
        code = ord(ch)
        for r in range(GLYPH_H):
            bits = ROWS[code * GLYPH_H + r] if code < 128 else 0
            c = 0
            while c < 8:
                if bits & (0x80 >> c):
                    start = c
                    while c < 8 and bits & (0x80 >> c):
                        c += 1
                    d.append(f"M{x0 + i * GLYPH_W + start} {y0 + r}h{c - start}v1h{start - c}z")
                else:
                    c += 1
    return "".join(d)


def heading(before, command, note):
    prompt = [
        ("inph@inphserver", PROMPT),
        (":", CMD),
        ("~", PATH),
        ("$ ", CMD),
        (command, CMD),
        ("  # " + note, NOTE),
    ]
    lines = before + [prompt]
    cols = max(sum(len(t) for t, _ in line) for line in lines)
    cursor_col = sum(len(t) for t, _ in prompt) - len(prompt[-1][0])
    w = PAD + DOTS + (cols + 1) * GLYPH_W + PAD
    h = PAD + GLYPH_H * len(lines) + PAD
    tx = PAD + DOTS

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w * 2}" height="{h * 2}" '
        f'viewBox="0 0 {w} {h}" shape-rendering="crispEdges" role="img" '
        f'aria-label="{command} # {note}"><title>{command} # {note}</title>',
        '<defs><pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse">'
        '<rect width="3" height="1" fill="#000" opacity=".22"/></pattern>'
        '<filter id="glow" x="-5%" y="-40%" width="110%" height="180%">'
        '<feGaussianBlur stdDeviation=".9" result="b"/>'
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>',
        f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="5" fill="{BG}" stroke="{EDGE}"/>',
    ]
    # window buttons drawn as pixel squares, like the text
    for i, color in enumerate(("#F85149", "#D29922", "#3FB950")):
        out.append(f'<rect x="{PAD + i * 8}" y="{PAD + GLYPH_H / 2 - 2.5}" width="5" height="5" fill="{color}"/>')
    out.append('<g filter="url(#glow)">')
    for row, line in enumerate(lines):
        col = 0
        for text, color in line:
            d = text_path(text, tx + col * GLYPH_W, PAD + row * GLYPH_H)
            if d:
                out.append(f'<path fill="{color}" d="{d}"/>')
            col += len(text)
    ty = PAD + (len(lines) - 1) * GLYPH_H
    out.append(
        f'<rect x="{tx + cursor_col * GLYPH_W}" y="{ty + 2}" width="{GLYPH_W}" height="{GLYPH_H - 3}" fill="{CURSOR}">'
        '<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.06s" repeatCount="indefinite"/></rect>'
    )
    out.append("</g>")
    out.append(f'<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="4" fill="url(#scan)"/>')
    out.append("</svg>")
    return "".join(out)


for name, before, command, note in HEADINGS:
    (HERE / "headings").mkdir(exist_ok=True)
    (HERE / "headings" / f"{name}.svg").write_text(heading(before, command, note) + "\n")
    print(f"assets/headings/{name}.svg")
