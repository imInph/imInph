#!/usr/bin/env python3
"""Draw the README's terminal windows: the typing header and the section headings.

The text is the 8x16 font from inphex-monolyth's HDMI console
(console/font.hex), so the windows use the same letters the Tang Nano prints.

    python3 assets/mkheadings.py
"""
from pathlib import Path

HERE = Path(__file__).parent
ROWS = [int(line, 16) for line in (HERE / "font.hex").read_text().split()]

BG, EDGE = "#0D1117", "#30363D"
PROMPT, PATH, CMD, NOTE, CURSOR = "#3FB950", "#58A6FF", "#E6EDF3", "#6E7681", "#58A6FF"
PAD, DOTS, GLYPH_W, GLYPH_H = 10, 34, 8, 16

MAC = "inph@Ardas-MacBook-Air ~ % "
LOGIN = [("Last login: Sat Sep 27 14:02:11 2026 from 192.168.1.20", NOTE)]

# the header: commands typed at the Mac prompt, each with the lines it prints
SESSION = [
    ("whoami", [[("inph", CMD)]]),
    ("cat about.txt", [[("Arda. Student from Turkey.", PATH)], [("I build my own tools.", PATH)]]),
]
TITLE = "whoami: inph. cat about.txt: Arda. Student from Turkey. I build my own tools."

# (file, lines before the prompt, command, comment)
HEADINGS = [
    ("building", [[(MAC, CMD), ("ssh inph@192.168.1.111", CMD)], LOGIN], "ls projects/", "what I'm building"),
    ("languages", [], "cat languages.txt", "what I write"),
    ("tools", [], "which tools", "what I use"),
    ("snake", [], "./snake --eat contributions", "my GitHub year"),
]

BLINK = '<animate attributeName="opacity" values="1;0" dur="1.06s" calcMode="discrete" repeatCount="indefinite"/>'


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


def width(line):
    return sum(len(t) for t, _ in line)


def window(lines, title, extra=""):
    """A terminal window holding `lines` (lists of (text, colour) runs)."""
    cols = max(width(line) for line in lines)
    w = PAD + DOTS + (cols + 1) * GLYPH_W + PAD
    h = PAD + GLYPH_H * len(lines) + PAD
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
        f'shape-rendering="crispEdges" role="img" aria-label="{title}"><title>{title}</title>',
        f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="5" fill="{BG}" stroke="{EDGE}"/>',
    ]
    # window buttons drawn as pixel squares, like the text
    for i, color in enumerate(("#F85149", "#D29922", "#3FB950")):
        out.append(f'<rect x="{PAD + i * 8}" y="{PAD + GLYPH_H // 2 - 3}" width="6" height="6" fill="{color}"/>')
    for row, line in enumerate(lines):
        col = 0
        for text, color in line:
            d = text_path(text, PAD + DOTS + col * GLYPH_W, PAD + row * GLYPH_H)
            if d:
                out.append(f'<path fill="{color}" d="{d}"/>')
            col += len(text)
    out.append(extra)
    # scanlines: a dark band one screen pixel tall through every font row (the README shows
    # these at 1.5x, so a third of a font pixel is one pixel on a 2x display)
    scan = "".join(f"M1 {y + 2 / 3:.4f}h{w - 2}v.3333h{2 - w}z" for y in range(1, h - 1))
    out.append(f'<path fill="#000" opacity=".45" d="{scan}"/>')
    out.append("</svg>")
    return "".join(out)


def cursor(col, row, anim=BLINK):
    x, y = PAD + DOTS + col * GLYPH_W, PAD + row * GLYPH_H
    return f'<rect x="{x}" y="{y + 2}" width="{GLYPH_W}" height="{GLYPH_H - 3}" fill="{CURSOR}">{anim}</rect>'


def heading(before, command, note):
    prompt = [("inph@inphserver", PROMPT), (":", CMD), ("~", PATH), ("$ ", CMD), (command, CMD), ("  # " + note, NOTE)]
    lines = before + [prompt]
    return window(lines, f"{command} # {note}", cursor(width(prompt) - len(prompt[-1][0]), len(lines) - 1))


def header():
    """The Mac prompt types each command, prints its answer, waits, and starts over."""
    step, think, pause, hold = 0.09, 0.8, 0.4, 6.0
    x0, y0 = PAD + DOTS, PAD
    t, row = 0.0, 0
    chars, blocks, stops = [], [], [(0.0, len(MAC), 0)]
    for command, output in SESSION:
        t += think
        for i, ch in enumerate(command):
            chars.append((t, ch, len(MAC) + i, row))
            t += step
            stops.append((t - step, len(MAC) + i + 1, row))
        t += pause
        blocks.append((t, output + [[(MAC, CMD)]], row + 1))
        row += len(output) + 1
        stops.append((t, len(MAC), row))
    total = round(t + hold, 2)
    end = (total - 0.25) / total  # blank for a moment before the loop restarts
    stops.append((total - 0.25, len(MAC), 0))

    def appear(at):
        return (f'<animate attributeName="opacity" values="0;1;0" keyTimes="0;{at / total:.4f};{end:.4f}" '
                f'dur="{total}s" calcMode="discrete" repeatCount="indefinite"/>')

    extra = []
    for at, ch, col, r in chars:
        d = text_path(ch, x0 + col * GLYPH_W, y0 + r * GLYPH_H)
        if d:
            extra.append(f'<path fill="{CMD}" d="{d}" opacity="0">{appear(at)}</path>')
    for at, lines, first in blocks:
        group = []
        for r, line in enumerate(lines, start=first):
            col = 0
            for text, color in line:
                d = text_path(text, x0 + col * GLYPH_W, y0 + r * GLYPH_H)
                if d:
                    group.append(f'<path fill="{color}" d="{d}"/>')
                col += len(text)
        extra.append(f'<g opacity="0">{appear(at)}{"".join(group)}</g>')

    # the cursor follows the typing and each new prompt, then goes back up for the next loop
    keys = ";".join(f"{at / total:.4f}" for at, _, _ in stops)
    xs = ";".join(str(x0 + col * GLYPH_W) for _, col, _ in stops)
    ys = ";".join(str(y0 + r * GLYPH_H + 2) for _, _, r in stops)
    move = "".join(
        f'<animate attributeName="{attr}" values="{vals}" keyTimes="{keys}" '
        f'dur="{total}s" calcMode="discrete" repeatCount="indefinite"/>'
        for attr, vals in (("x", xs), ("y", ys))
    )
    extra.append(cursor(len(MAC), 0, BLINK + move))
    cols = max(len(MAC) + len(c) for c, _ in SESSION)
    lines = [[(MAC, CMD)]] + [[(" " * cols, CMD)]] * row
    return window(lines, TITLE, "".join(extra))


(HERE / "headings").mkdir(exist_ok=True)
(HERE / "headings" / "session.svg").write_text(header() + "\n")
print("assets/headings/session.svg")
for name, before, command, note in HEADINGS:
    (HERE / "headings" / f"{name}.svg").write_text(heading(before, command, note) + "\n")
    print(f"assets/headings/{name}.svg")
