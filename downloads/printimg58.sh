#!/bin/bash
# printimg58.sh [options] <image> [image ...]
#
#   Prepares a photo, scan or screenshot (HEIC, JPEG, PNG, or anything else
#   macOS `sips` can read) for a 58mm thermal head and prints it.
#
#   Each image is turned into 1-bit art exactly the head's width in dots
#   (383 at 203dpi), wrapped as a PDF whose image sits at the head's dpi, and
#   handed to print58.sh.  That prints it dot for dot (see its "native" path)
#   and brings along its resync preamble, queue draining and tear-off pauses.
#   Several images print as several receipts.
#
#   Processing, by mode:
#     text   documents, receipts, photographed pages.  Uneven lighting is
#            flattened (the page is divided by a blurred estimate of its paper
#            colour), then sharpened and cut at an Otsu threshold.  Crisp black
#            on white, no dither speckle.
#     photo  people, scenes.  Auto levels, a little local contrast, sharpening,
#            a lighter tone curve (thermal dots spread, so photos print darker
#            than they look), then Atkinson dithering, which keeps highlights
#            clean and contrast punchy on a coarse dot head.
#     auto   (default) picks one per image.  A handful of flat colours (logo,
#            silhouette, UI screenshot) is thresholded like text but without
#            the lighting step, which would erase large solid shapes; a
#            colourless page that is mostly paper-white is text; the rest is
#            photo.
#
#   Options:
#     -M, --mode M        auto | text | graphic | photo     (default: auto)
#     -n, --dry-run       write <name>-58mm.png previews instead of printing
#     -o, --out FILE      preview path for --dry-run (single image only)
#     -w, --width MM      print narrower than the full 48mm band
#     -R, --rotate        turn landscape images 90deg to use the roll length
#     -t, --threshold N   text mode cutoff 0-255, overrides Otsu
#     -g, --gamma F       photo tone curve, >1 lighter      (default: 1.25)
#     -D, --dither D      photo dither: atkinson | fs | none (default: atkinson)
#         --invert        print light-on-dark as dark-on-light (text mode)
#   Passed through to print58.sh:
#     -p, --printer NAME  -c, --copies N  --cut  -C, --clear  -r, --reset
#     --no-resync  -P, --pause  --no-pause  -v, --verbose
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MODE=auto DRY=0 OUT="" WIDTH_MM="" ROTATE=0 THRESH="" GAMMA=1.25 DITHER=atkinson INVERT=0
PASS=() FILES=()

die() { echo "printimg58: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -M|--mode)      MODE="${2:?--mode needs auto|text|graphic|photo}"; shift ;;
    -n|--dry-run)   DRY=1 ;;
    -o|--out)       OUT="${2:?--out needs a path}"; shift ;;
    -w|--width)     WIDTH_MM="${2:?--width needs millimetres}"; shift ;;
    -R|--rotate)    ROTATE=1 ;;
    -t|--threshold) THRESH="${2:?}"; shift ;;
    -g|--gamma)     GAMMA="${2:?}"; shift ;;
    -D|--dither)    DITHER="${2:?}"; shift ;;
    --invert)       INVERT=1 ;;
    -p|--printer|-c|--copies) PASS+=("$1" "${2:?$1 needs a value}"); shift ;;
    --cut|-C|--clear|-r|--reset|--no-resync|-P|--pause|--no-pause|-v|--verbose) PASS+=("$1") ;;
    -h|--help)      awk 'NR > 1 && !/^#/ { exit } NR > 1 { sub(/^# ?/, ""); print }' "$0"; exit 0 ;;
    -*)             die "unknown option $1 (try --help)" ;;
    *)              FILES+=("$1") ;;
  esac
  shift
done

[ ${#FILES[@]} -gt 0 ] || die "usage: printimg58.sh [options] <image> ... (try --help)"
case "$MODE" in auto|text|graphic|photo) ;; *) die "--mode must be auto, text, graphic or photo" ;; esac
case "$DITHER" in atkinson|fs|none) ;; *) die "--dither must be atkinson, fs or none" ;; esac
[ -z "$OUT" ] || [ ${#FILES[@]} -eq 1 ] || die "--out takes a single image"
python3 -c "import PIL, numpy" 2>/dev/null || die "python3 with Pillow and numpy not found (python3 -m pip install --user Pillow numpy)"
[ "$DRY" = "1" ] || [ -f "$HERE/print58.sh" ] || die "print58.sh not found next to $0"

# Head geometry: the same band print58.sh derives from the PPD, so the art is
# never wider than what its dot-for-dot path accepts.
PRINTER="${PRINT58_PRINTER:-SRS583}"
for ((i = 0; i < ${#PASS[@]}; i++)); do
  case "${PASS[$i]}" in -p|--printer) PRINTER="${PASS[$((i + 1))]}" ;; esac
done
PPD="/etc/cups/ppd/${PRINTER}.ppd"
PAPER_W=164 MARGIN_L=14 MARGIN_R=14 DPI=203
if [ -r "$PPD" ]; then
  v=$(sed -n 's/^\*MaxMediaWidth: *"\([0-9.]*\)".*/\1/p' "$PPD" | head -1); [ -n "$v" ] && PAPER_W=$v
  v=$(sed -n 's/^\*DefaultResolution: *\([0-9]*\)x.*/\1/p' "$PPD" | head -1); [ -n "$v" ] && DPI=$v
  read -r a _ b _ < <(sed -n 's/^\*HWMargins: *//p' "$PPD" | head -1) || true
  [ -n "${a:-}" ] && MARGIN_L=$a && MARGIN_R=${b:-$a}
fi

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

# Anything Pillow cannot open natively (HEIC above all) goes through sips.
SRCS=()
for SRC in "${FILES[@]}"; do
  [ -f "$SRC" ] || die "no such file: $SRC"
  if python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).load()" "$SRC" 2>/dev/null; then
    SRCS+=("$SRC")
  else
    command -v sips >/dev/null || die "cannot read $SRC (not an image Pillow knows, and no sips to convert it)"
    CONV="$T/conv-${#SRCS[@]}.png"
    sips -s format png "$SRC" --out "$CONV" >/dev/null 2>&1 || die "cannot read $SRC as an image"
    SRCS+=("$CONV")
  fi
done

PREVIEWS=()
for ((i = 0; i < ${#FILES[@]}; i++)); do
  if [ "$DRY" = "1" ]; then
    PREVIEWS+=("${OUT:-${FILES[$i]%.*}-58mm.png}")
  else
    PREVIEWS+=("$T/art-$(printf '%04d' "$i").png")
  fi
done

PI_DPI="$DPI" PI_PAPER="$PAPER_W" PI_ML="$MARGIN_L" PI_MR="$MARGIN_R" \
PI_MODE="$MODE" PI_WIDTH_MM="$WIDTH_MM" PI_ROTATE="$ROTATE" PI_THRESH="$THRESH" \
PI_GAMMA="$GAMMA" PI_DITHER="$DITHER" PI_INVERT="$INVERT" PI_PDF="$T/art.pdf" \
python3 - "${#SRCS[@]}" "${SRCS[@]}" "${FILES[@]}" "${PREVIEWS[@]}" <<'PY'
import os, sys, zlib
import numpy as np
from PIL import Image, ImageFilter, ImageOps

env = os.environ
n = int(sys.argv[1])
srcs, names, outs = sys.argv[2:2 + n], sys.argv[2 + n:2 + 2 * n], sys.argv[2 + 2 * n:2 + 3 * n]
dpi = float(env["PI_DPI"])
band_pt = float(env["PI_PAPER"]) - float(env["PI_ML"]) - float(env["PI_MR"])
W = int(round(band_pt / 72.0 * dpi))                     # 383 on the SRS583
if env["PI_WIDTH_MM"]:
    W = max(16, min(W, int(round(float(env["PI_WIDTH_MM"]) / 25.4 * dpi))))
mode, rotate = env["PI_MODE"], env["PI_ROTATE"] == "1"
thresh = int(env["PI_THRESH"]) if env["PI_THRESH"] else None
gamma, dither, invert = float(env["PI_GAMMA"]), env["PI_DITHER"], env["PI_INVERT"] == "1"

def load(path):
    im = ImageOps.exif_transpose(Image.open(path))       # phone photos lie about "up"
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    im = im.convert("RGB")
    if rotate and im.width > im.height * 1.15:
        im = im.rotate(90, expand=True)
    return im

def resize(g, width):
    h = max(1, int(round(g.height * width / g.width)))
    return g.resize((width, h), Image.LANCZOS)

def flatten_light(g):
    """Divide out the paper colour so shadows and gradients go white.

    The background is estimated with a max filter (erases text strokes) then a
    wide blur; ink is what is darker than its local paper.
    """
    k = max(3, (g.width // 40) | 1)
    bg = g.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.GaussianBlur(g.width / 20))
    a, b = np.asarray(g, np.float32), np.maximum(np.asarray(bg, np.float32), 1)
    return Image.fromarray(np.clip(a / b * 255, 0, 255).astype(np.uint8))

def classify(rgb):
    """graphic: a handful of flat colours (logos, silhouettes, UI).  text:
    colourless pages (receipts, scans).  photo: real colour or continuous tone."""
    t = rgb.copy(); t.thumbnail((400, 400))
    q = np.asarray(t, np.uint8) // 16
    keys = (q[..., 0].astype(np.int32) << 8) | (q[..., 1].astype(np.int32) << 4) | q[..., 2]
    counts = np.sort(np.bincount(keys.ravel()))[::-1]
    if counts[:8].sum() > 0.85 * keys.size:            # a handful of flat colours
        return "graphic"
    hsv = np.asarray(t.convert("HSV"), np.float32)
    if (hsv[..., 1] * hsv[..., 2] / 255 > 40).mean() > 0.05:   # real colour
        return "photo"
    a = np.asarray(flatten_light(t.convert("L")))
    return "text" if (a > 200).mean() > 0.6 and ((a > 60) & (a <= 200)).mean() < 0.2 else "photo"

def otsu(a):
    hist = np.bincount(a.ravel(), minlength=256).astype(np.float64)
    p = hist / hist.sum()
    w0 = np.cumsum(p); mu = np.cumsum(p * np.arange(256)); mt = mu[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        s = (mt * w0 - mu) ** 2 / (w0 * (1 - w0))
    return int(np.nanargmax(s))

def atkinson(a):
    """Atkinson error diffusion: spreads only 6/8 of the error, which keeps
    highlights and shadows clean instead of peppering them with dots."""
    a = a.astype(np.float32).copy()
    h, w = a.shape
    a = np.pad(a, ((0, 2), (1, 2)), constant_values=255)
    out = np.zeros((h, w), np.uint8)
    for y in range(h):
        row, r1, r2 = a[y], a[y + 1], a[y + 2]
        for x in range(1, w + 1):
            old = row[x]
            new = 255.0 if old > 127 else 0.0
            out[y, x - 1] = new
            e = (old - new) / 8.0
            row[x + 1] += e; row[x + 2] += e
            r1[x - 1] += e; r1[x] += e; r1[x + 1] += e
            r2[x] += e
    return out

def text_art(g, flatten=True):
    # Work at 2x the dot width so stems survive the lighting flattening.  Flat
    # graphics skip it: a big solid shape would be divided out as "shadow".
    flat = resize(g, W * 2)
    if flatten:
        flat = flatten_light(flat)
    if invert:
        flat = ImageOps.invert(flat)
    small = resize(flat, W).filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=0))
    a = np.asarray(small)
    t = thresh if thresh is not None else min(220, otsu(a) + 10)   # +10: keep thin strokes
    return Image.fromarray(np.where(a > t, 255, 0).astype(np.uint8))

def photo_art(g):
    g = resize(g, W)
    g = ImageOps.autocontrast(g, cutoff=0.5)
    g = g.filter(ImageFilter.UnsharpMask(radius=max(4, W // 20), percent=35, threshold=0))  # local contrast
    g = g.filter(ImageFilter.UnsharpMask(radius=1, percent=90, threshold=2))                # edges
    lut = [int(round(255 * (p / 255.0) ** (1.0 / gamma))) for p in range(256)]
    g = g.point(lut)
    if dither == "fs":
        return g.convert("1").convert("L")
    a = np.asarray(g)
    if dither == "none":
        return Image.fromarray(np.where(a > (thresh or 128), 255, 0).astype(np.uint8))
    return Image.fromarray(atkinson(a))

pages = []
for src, name, out in zip(srcs, names, outs):
    rgb = load(src)
    g = rgb.convert("L")
    m = mode
    if m == "auto":
        m = classify(rgb)
    bw = (photo_art(g) if m == "photo" else text_art(g, flatten=(m == "text"))).convert("1")
    bw.save(out)
    print("  %s: %s mode, %dx%d dots (%.0fx%.0fmm)"
          % (os.path.basename(name), m, bw.width, bw.height,
             bw.width / dpi * 25.4, bw.height / dpi * 25.4))
    pages.append(bw)

# One 1-bit image per page, placed at exactly the head's dpi, so print58.sh
# recognises it as native art and prints it dot for dot.
objs = []
def add(body):
    objs.append(body); return len(objs)
root, pages_id = add(None), add(None)
kids = []
for bw in pages:
    wpt, hpt = bw.width * 72.0 / dpi, bw.height * 72.0 / dpi
    data = zlib.compress(bw.tobytes(), 9)
    img = add(b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceGray "
              b"/BitsPerComponent 1 /Filter /FlateDecode /Length %d >>\nstream\n"
              % (bw.width, bw.height, len(data)) + data + b"\nendstream")
    cs = b"q %.4f 0 0 %.4f 0 0 cm /Im0 Do Q" % (wpt, hpt)
    cont = add(b"<< /Length %d >>\nstream\n" % len(cs) + cs + b"\nendstream")
    kids.append(add(b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.4f %.4f] "
                    b"/Resources << /XObject << /Im0 %d 0 R >> >> /Contents %d 0 R >>"
                    % (pages_id, wpt, hpt, img, cont)))
objs[root - 1] = b"<< /Type /Catalog /Pages %d 0 R >>" % pages_id
objs[pages_id - 1] = b"<< /Type /Pages /Count %d /Kids [%s] >>" % (
    len(kids), b" ".join(b"%d 0 R" % k for k in kids))
out = bytearray(b"%PDF-1.4\n"); offs = []
for i, body in enumerate(objs, 1):
    offs.append(len(out)); out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
xref = len(out)
out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
out += b"".join(b"%010d 00000 n \n" % o for o in offs)
out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, root, xref)
open(env["PI_PDF"], "wb").write(out)
PY

if [ "$DRY" = "1" ]; then
  printf 'dry run -> %s\n' "${PREVIEWS[@]}"
  exit 0
fi

# print58.sh's own processing options stay at their defaults: the art is
# already bilevel at the head's dpi, so it takes the dot-for-dot path.  Run
# from $T under the image's name, so its "<file>: printed" line (the Print58
# app's notification) names the image rather than a temp path.
NAME=$(basename "${FILES[0]}")
[ ${#FILES[@]} -gt 1 ] && NAME="$NAME + $(( ${#FILES[@]} - 1 )) more"
mv "$T/art.pdf" "$T/$NAME"
cd "$T" && /bin/bash "$HERE/print58.sh" ${PASS[@]+"${PASS[@]}"} "$NAME"
