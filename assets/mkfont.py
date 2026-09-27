#!/usr/bin/env python3
"""Turn the console font into a web font for the site, plus the favicon.

Same 8x16 bitmaps as the headings (font.hex), one square per lit pixel, so the
page can use real selectable text that still looks like the Tang Nano's HDMI
console. The font only has ASCII, so the block and box characters the site
needs are drawn here on the same 8x16 grid.

    python3 assets/mkfont.py
"""
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

HERE = Path(__file__).parent
OUT = HERE.parent / "docs"
ROWS = [int(line, 16) for line in (HERE / "font.hex").read_text().split()]

U = 64               # font units per pixel
W, H = 8, 16         # glyph size in pixels
BASE = 12            # pixel rows above the baseline
NAME = "inphex"


def blank():
    return [[0] * W for _ in range(H)]


def from_hex(code):
    return [[1 if ROWS[code * H + r] & (0x80 >> c) else 0 for c in range(W)] for r in range(H)]


def fill(rows, cols):
    g = blank()
    for r in rows:
        for c in cols:
            g[r][c] = 1
    return g


def shade(pattern):
    """A dither: `pattern(r, c)` says which pixels are lit."""
    return [[1 if pattern(r, c) else 0 for c in range(W)] for r in range(H)]


def box(up, down, left, right):
    """Single box-drawing lines through the middle of the cell (2px thick, like | and -)."""
    g = blank()
    mr, mc = (7, 8), (3, 4)
    if up:
        for r in range(0, 9):
            for c in mc: g[r][c] = 1
    if down:
        for r in range(7, H):
            for c in mc: g[r][c] = 1
    if left:
        for c in range(0, 5):
            for r in mr: g[r][c] = 1
    if right:
        for c in range(3, W):
            for r in mr: g[r][c] = 1
    return g


def overlay(base, mark):
    return [[a | b for a, b in zip(ra, rb)] for ra, rb in zip(base, mark)]


def turkish():
    """The letters Arda's name and a Turkish page need, built from the ASCII ones."""
    out = {}
    cedilla = fill([12], [3, 4]); cedilla[13][4] = 1; cedilla[13][5] = 1; cedilla[14][2] = cedilla[14][3] = cedilla[14][4] = 1
    out["ç"] = overlay(from_hex(ord("c")), cedilla)
    out["Ç"] = overlay(from_hex(ord("C")), [row[:] for row in cedilla])
    out["ş"] = overlay(from_hex(ord("s")), cedilla)
    out["Ş"] = overlay(from_hex(ord("S")), cedilla)
    dotless = from_hex(ord("i"))
    for r in range(0, 4):
        dotless[r] = [0] * W
    out["ı"] = dotless
    dots = fill([2], [1, 2, 4, 5])
    for src, dst in (("o", "ö"), ("u", "ü")):
        out[dst] = overlay(from_hex(ord(src)), dots)
    breve = blank(); breve[1][1] = breve[1][5] = 1; breve[2][2] = breve[2][3] = breve[2][4] = 1
    out["ğ"] = overlay(from_hex(ord("g")), breve)
    return out


def extras():
    g = {
        "█": fill(range(H), range(W)),
        "▀": fill(range(0, 8), range(W)),
        "▄": fill(range(8, H), range(W)),
        "▌": fill(range(H), range(0, 4)),
        "▐": fill(range(H), range(4, W)),
        "░": shade(lambda r, c: (r % 2 == 0 and c % 4 == 0) or (r % 2 == 1 and c % 4 == 2)),
        "▒": shade(lambda r, c: (r + c) % 2 == 0),
        "▓": shade(lambda r, c: not ((r % 2 == 0 and c % 4 == 0) or (r % 2 == 1 and c % 4 == 2))),
        "─": box(0, 0, 1, 1), "│": box(1, 1, 0, 0),
        "┌": box(0, 1, 0, 1), "┐": box(0, 1, 1, 0),
        "└": box(1, 0, 0, 1), "┘": box(1, 0, 1, 0),
        "├": box(1, 1, 0, 1), "┤": box(1, 1, 1, 0),
        "┬": box(0, 1, 1, 1), "┴": box(1, 0, 1, 1), "┼": box(1, 1, 1, 1),
        "·": fill([7, 8], [3, 4]),
        "•": fill(range(6, 10), range(2, 6)),
        "●": fill(range(4, 12), range(1, 7)),
        "■": fill(range(4, 11), range(1, 7)),
    }
    arrow = lambda rows: [[1 if c in rows.get(r, ()) else 0 for c in range(W)] for r in range(H)]
    g["→"] = arrow({4: (4,), 5: (4, 5), 6: (0, 1, 2, 3, 4, 5, 6), 7: (0, 1, 2, 3, 4, 5, 6, 7), 8: (0, 1, 2, 3, 4, 5, 6), 9: (4, 5), 10: (4,)})
    g["←"] = [row[::-1] for row in g["→"]]
    g["▸"] = arrow({5: (2,), 6: (2, 3), 7: (2, 3, 4), 8: (2, 3, 4, 5), 9: (2, 3, 4), 10: (2, 3), 11: (2,)})
    g.update(turkish())
    return g


def glyph(bitmap):
    """Pixel runs as rectangles; runs on one row never overlap, so the outline is clean."""
    pen = TTGlyphPen(None)
    for r, row in enumerate(bitmap):
        top, bottom = (BASE - r) * U, (BASE - r - 1) * U
        c = 0
        while c < W:
            if row[c]:
                s = c
                while c < W and row[c]:
                    c += 1
                pen.moveTo((s * U, bottom)); pen.lineTo((s * U, top))
                pen.lineTo((c * U, top)); pen.lineTo((c * U, bottom)); pen.closePath()
            else:
                c += 1
    return pen.glyph()


def build():
    bitmaps = {chr(code): from_hex(code) for code in range(32, 127)}
    bitmaps.update(extras())
    names = {ch: f"u{ord(ch):04X}" for ch in bitmaps}
    order = [".notdef"] + list(names.values())
    glyphs = {".notdef": glyph(fill(range(1, 12), range(1, 7)))}
    glyphs.update({names[ch]: glyph(bm) for ch, bm in bitmaps.items()})

    fb = FontBuilder(W * U * 2, isTTF=True)  # em = 16px tall
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({ord(ch): n for ch, n in names.items()})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (W * U, 0) for n in order})
    fb.setupHorizontalHeader(ascent=BASE * U, descent=-(H - BASE) * U)
    fb.setupOS2(version=4, sTypoAscender=BASE * U, sTypoDescender=-(H - BASE) * U, sTypoLineGap=0,
                usWinAscent=BASE * U, usWinDescent=(H - BASE) * U, fsSelection=0x80)
    fb.setupNameTable({"familyName": NAME, "styleName": "Regular"})
    fb.setupPost(isFixedPitch=1)
    return fb.font


def favicon():
    """A prompt and a cursor, in the same pixels."""
    px = []
    for r, row in enumerate(from_hex(ord(">"))):
        for c, on in enumerate(row):
            if on:
                px.append(f"M{c + 1} {r}h1v1h-1z")
    cur = "M10 3h6v10h-6z"
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 16" shape-rendering="crispEdges">'
            '<rect width="18" height="16" rx="2" fill="#0D1117"/>'
            f'<path fill="#3FB950" d="{"".join(px)}"/><path fill="#58A6FF" d="{cur}"/></svg>\n')


(OUT / "fonts").mkdir(parents=True, exist_ok=True)
font = build()
font.flavor = "woff"
font.save(OUT / "fonts" / f"{NAME}.woff")
print(f"docs/fonts/{NAME}.woff")
(OUT / "favicon.svg").write_text(favicon())
print("docs/favicon.svg")
