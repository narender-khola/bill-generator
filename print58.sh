#!/bin/bash
# print58.sh [options] <file.pdf> [file.pdf ...]
#
#   Prepares a PDF for a 58mm thermal roll and prints it on a CUPS thermal
#   printer, mapping the artwork 1:1 onto the printer's dot grid.
#
#   The page is built at the roll's true paper width (164pt) with the artwork
#   placed inside the hardware imageable band (136pt starting at x=14pt), so
#   CUPS never rescales it.  Requesting a narrower custom page -- as an obvious
#   58mm/48mm calculation suggests -- is silently clamped to the paper width by
#   the PPD (ParamCustomPageSize Width: 164 164) and rescales the artwork.
#
#   Options:
#     -n, --dry-run       write <name>-58mm.pdf instead of printing
#     -o, --out FILE      output path for --dry-run
#     -p, --printer NAME  CUPS printer      (default: $PRINT58_PRINTER, else SRS583)
#     -t, --threshold N   0-255 ink cutoff  (default: 160)
#     -d, --dither        Floyd-Steinberg instead of a hard cutoff (photos)
#     -g, --gamma F       tone curve before cutoff, <1 bolder (default: 1.0)
#     -s, --sharpen F     unsharp amount, 0 disables (default: 0.8)
#     -m, --margin PT     extra padding beyond the roll's hardware margin (default: 0)
#     -c, --copies N      copies                          (default: 1)
#         --no-crop       keep the source page box, don't crop to the ink
#         --exact         size each page to the ink (Custom page size).  Saves
#                         roll; a fitting preset is used by default because the
#                         PPD clamps Custom width to the paper width anyway.
#         --cut           cut the roll after every page
#     -C, --clear         cancel a job already queued instead of waiting on it
#     -r, --reset         also feed a little paper after the resync
#         --no-resync     skip the resync preamble (see below)
#         --fit           always scale the ink to the full printable width.
#                         By default a page that is already 1-bit at the head's
#                         dpi (what the bill generator's thermal PDF export
#                         makes) and fits the head is printed dot for dot:
#                         rescaling it 362->383 dots re-thresholds every stroke
#                         and bloats bold text into blobs.
#     -P, --pause         (default) stop after each receipt so it can be torn
#                         off; Enter prints the next, q stops.  Distance fed
#                         past the tear bar: PRINT58_TEAR_DOTS (default 120, 8/mm)
#         --no-pause      print the whole run back to back as one job
#         --cups          old path: one CUPS job per page through rastertozj
#                         (default sends the whole run as ONE raw ESC/POS job;
#                         blank gap between receipts: PRINT58_GAP_DOTS, 8/mm)
#     -v, --verbose       report per-page geometry
#
#   A job that dies mid-stream -- cancelled, unplugged, or a big PDF printed
#   from another app -- leaves the head waiting on the rest of a GS v 0 raster
#   chunk.  It then eats the front of the NEXT job as pixel data and prints the
#   leftovers as text: the CJK garbage above a receipt.  That job in turn ends
#   mid-chunk, so the desync carries over from job to job.  A bare ESC @ cannot
#   fix it, because the head swallows it as pixel data too.
#
#   So before printing, this script sends a resync preamble: a run of NUL bytes
#   longer than any raster chunk, then ESC @.  A desynced head takes the NULs
#   as the rest of its pending chunk (at most ~2cm of blank feed) and a
#   synced head ignores them, so either way the ESC @ lands on a command
#   boundary and the receipt starts clean.  Size the run with
#   PRINT58_RESYNC_BYTES (default 65536; rastertozj chunks top out near 8 KB).
#   The queue is also drained between pages rather than piling jobs up.
#
#   -C/--clear cancels a job already queued instead of waiting on it.  That
#   clears the HOST queue only, but whatever partial chunk it left in the head
#   is then flushed by the resync preamble.  If garbage still survives, power
#   cycle as a last resort -- unplug power AND USB for ~10s.
set -euo pipefail

DRY=0 OUT="" PRINTER="${PRINT58_PRINTER:-SRS583}" THRESH=160 DITHER=0
GAMMA=1.0 SHARPEN=0.8 MARGIN=0 COPIES=1 CROP=1 CUT=0 VERBOSE=0 EXACT=0 RESET=0 CLEAR=0 RESYNC=1 VIA_CUPS=0 FIT=0 PAUSE=1
FILES=()

die() { echo "print58: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--dry-run)   DRY=1 ;;
    -o|--out)       OUT="${2:?--out needs a path}"; shift ;;
    -p|--printer)   PRINTER="${2:?--printer needs a name}"; shift ;;
    -t|--threshold) THRESH="${2:?}"; shift ;;
    -d|--dither)    DITHER=1 ;;
    -g|--gamma)     GAMMA="${2:?}"; shift ;;
    -s|--sharpen)   SHARPEN="${2:?}"; shift ;;
    -m|--margin)    MARGIN="${2:?}"; shift ;;
    -c|--copies)    COPIES="${2:?}"; shift ;;
    --no-crop)      CROP=0 ;;
    --exact)        EXACT=1 ;;
    --cut)          CUT=1 ;;
    -C|--clear)     CLEAR=1 ;;
    -r|--reset)     RESET=1 ;;
    --no-resync)    RESYNC=0 ;;
    --cups)         VIA_CUPS=1 ;;
    --fit)          FIT=1 ;;
    -P|--pause)     PAUSE=1 ;;
    --no-pause)     PAUSE=0 ;;
    -v|--verbose)   VERBOSE=1 ;;
    -h|--help)      awk 'NR > 1 && !/^#/ { exit } NR > 1 { sub(/^# ?/, ""); print }' "$0"; exit 0 ;;
    -*)             die "unknown option $1 (try --help)" ;;
    *)              FILES+=("$1") ;;
  esac
  shift
done

[ ${#FILES[@]} -gt 0 ] || die "usage: print58.sh [options] <file.pdf> ... (try --help)"
command -v gs >/dev/null || die "ghostscript (gs) not found"
python3 -c "import PIL" 2>/dev/null || die "python3 with Pillow not found"

# Roll geometry, read from the printer's PPD so this works on other 58mm units.
PPD="/etc/cups/ppd/${PRINTER}.ppd"
PAPER_W=164; MARGIN_L=14; MARGIN_R=14; DPI=203; MIN_H=56; MAX_H=9286
# Only adopt a PPD value once it parses as a number, so an unexpected PPD
# layout falls back to the defaults above instead of emitting an empty field.
setnum() { case "$2" in ''|*[!0-9.]*) return 1 ;; esac; eval "$1=\$2"; }
if [ -r "$PPD" ]; then
  setnum PAPER_W "$(sed -n 's/^\*MaxMediaWidth: *"\([0-9.]*\)".*/\1/p' "$PPD" | head -1)" || true
  setnum DPI "$(sed -n 's/^\*DefaultResolution: *\([0-9]*\)x.*/\1/p' "$PPD" | head -1)" || true
  read -r a _ b _ < <(sed -n 's/^\*HWMargins: *//p' "$PPD" | head -1) || true
  if setnum MARGIN_L "${a:-}"; then setnum MARGIN_R "${b:-}" || MARGIN_R=$MARGIN_L; fi
  # "*ParamCustomPageSize Height: 2 points 56 9286" -> order, units, min, max
  read -r _ _ lo hi < <(sed -n 's/^\*ParamCustomPageSize Height: *//p' "$PPD" | head -1) || true
  if setnum MIN_H "${lo:-}"; then setnum MAX_H "${hi:-}" || MAX_H=9286; fi
fi

# Predefined page sizes, as "NAME:heightPt,..." -- preferred over Custom.
PRESETS=$(sed -n 's/^\*PaperDimension \([A-Za-z0-9]*\)\/[^:]*: *"[0-9.]* \([0-9.]*\)".*/\1:\2/p' "$PPD" 2>/dev/null | paste -sd, -)

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

for SRC in "${FILES[@]}"; do
  [ -f "$SRC" ] || die "no such file: $SRC"
  rm -f "$T"/p-*.png "$T"/rcpt-*.prn "$T"/out-*.pdf "$T"/combined.pdf "$T"/heights.txt

  # Rasterise at exactly 3x the dot pitch; Pillow does the final resample,
  # which keeps thin strokes intact far better than letting the PDF be scaled
  # twice.  No image interpolation: a 1-bit image already at the head's dpi
  # must come out as clean 3x3 blocks for the native path below to see it.
  RENDER_DPI=$(( DPI * 3 ))
  gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pnggray -r"$RENDER_DPI" \
     -dTextAlphaBits=4 -dGraphicsAlphaBits=4 \
     -o "$T/p-%04d.png" "$SRC"

  # A page that is just one image already at the head's dpi (the generator's
  # thermal export) is taken straight from the PDF: even a 3x render lands a
  # fraction of a dot off-grid, which shifts a row or column every few hundred.
  rm -f "$T"/img-* "$T/images.txt"
  if [ "$FIT" = "0" ] && command -v pdfimages >/dev/null; then
    pdfimages -list "$SRC" 2>/dev/null | awk 'NR > 2 { print $1, $4, $5, $13, $14 }' > "$T/images.txt" || true
    pdfimages -png "$SRC" "$T/img" 2>/dev/null || true
  fi

  PRINT58_DIR="$T" PRINT58_DPI="$DPI" PRINT58_PAPER_W="$PAPER_W" \
  PRINT58_ML="$MARGIN_L" PRINT58_MR="$MARGIN_R" PRINT58_MIN_H="$MIN_H" \
  PRINT58_MAX_H="$MAX_H" PRINT58_THRESH="$THRESH" PRINT58_DITHER="$DITHER" \
  PRINT58_GAMMA="$GAMMA" PRINT58_SHARPEN="$SHARPEN" PRINT58_MARGIN="$MARGIN" \
  PRINT58_CROP="$CROP" PRINT58_VERBOSE="$VERBOSE" \
  PRINT58_PRESETS="$PRESETS" PRINT58_EXACT="$EXACT" \
  PRINT58_FIT="$FIT" PRINT58_CUT="$CUT" PRINT58_RESET="$RESET" PRINT58_RESYNC="$RESYNC" \
  python3 - <<'PY'
import glob, os, zlib
from PIL import Image, ImageFilter

env   = os.environ
D     = env["PRINT58_DIR"]
dpi   = float(env["PRINT58_DPI"])
paper = float(env["PRINT58_PAPER_W"])
ml    = float(env["PRINT58_ML"]);  mr = float(env["PRINT58_MR"])
min_h = float(env["PRINT58_MIN_H"]); max_h = float(env["PRINT58_MAX_H"])
thr   = int(env["PRINT58_THRESH"])
dith  = env["PRINT58_DITHER"] == "1"
gamma = float(env["PRINT58_GAMMA"])
sharp = float(env["PRINT58_SHARPEN"])
pad_pt= float(env["PRINT58_MARGIN"])
crop  = env["PRINT58_CROP"] == "1"
verb  = env["PRINT58_VERBOSE"] == "1"
exact = env.get("PRINT58_EXACT", "0") == "1"
presets = []
for item in filter(None, env.get("PRINT58_PRESETS", "").split(",")):
    name, _, h = item.partition(":")
    try:
        presets.append((float(h), name))
    except ValueError:
        pass
presets.sort()

def choose_page(art_h):
    """Page height to print on, plus the PageSize option naming it.

    Prefers a predefined size; Custom buys nothing here because the PPD pins
    its width to the paper width (ParamCustomPageSize Width: 164 164).
    """
    if not exact:
        for h, name in presets:
            if h >= art_h - 0.5:
                return h, name
    h = min(max_h, max(min_h, art_h))
    return h, "Custom.%d x%.0f".replace(" ", "") % (paper, h)

# The roll's hardware margins (ml/mr) already inset the artwork from the
# paper edge, so the band is used edge to edge unless --margin asks otherwise.
band_pt = paper - ml - mr              # printable width in points
band_px = int(round(band_pt / 72.0 * dpi))   # ...and in printer dots
pad_px  = max(0, int(round(pad_pt / 72.0 * dpi)))
art_px  = max(8, band_px - 2 * pad_px)

fit = env.get("PRINT58_FIT", "0") == "1"
K = 3                                   # render dpi / head dpi (RENDER_DPI above)

# page -> its only embedded image, when that image is at the head's dpi.
page_img = {}
try:
    rows = [l.split() for l in open(os.path.join(D, "images.txt"))]
    count = {}
    for r in rows:
        count[r[0]] = count.get(r[0], 0) + 1
    for idx, (pg, w, h, xp, yp) in enumerate(rows):
        if count[pg] == 1 and abs(float(xp) - dpi) <= 2 and abs(float(yp) - dpi) <= 2:
            page_img[int(pg)] = os.path.join(D, "img-%03d.png" % idx)
except (OSError, ValueError):
    pass

def native_image(path):
    """Embedded 1-bit image at head dpi -> exact dots centred in the band."""
    try:
        im = Image.open(path).convert("L")
    except OSError:
        return None
    if sum(im.histogram()[16:240]) > 0.002 * im.width * im.height:
        return None
    bb = im.point(lambda p: 0 if p > 127 else 255).getbbox()
    if bb is None or bb[2] - bb[0] > band_px - 2 * pad_px:
        return None
    bw = im.crop(bb).point(lambda p: 255 if p > 127 else 0).convert("1")
    canvas = Image.new("1", (band_px, bw.height), 1)
    canvas.paste(bw, ((band_px - bw.width) // 2, 0))
    return canvas

def native(im):
    """1-bit art already on the head's dot grid -> 1:1 dots, else None.

    The page must be bilevel (bar a sliver of antialiased vector edges) and
    its ink must fit the band.  Each dot is then a KxK block of the render;
    box-averaging a block and cutting at the midpoint recovers it exactly,
    and still lands right if the image sits a fraction of a dot off-grid.
    """
    hist = im.histogram()
    if sum(hist[16:240]) > 0.002 * im.width * im.height:
        return None
    bb = im.point(lambda p: 0 if p > 235 else 255).getbbox()
    if bb is None:
        return None
    x0, y0, x1, y1 = bb
    w, h = -(-(x1 - x0) // K), -(-(y1 - y0) // K)
    if w > band_px - 2 * pad_px:
        return None
    im = im.crop((x0, y0, x0 + w * K, y0 + h * K)).reduce(K)
    bw = im.point(lambda p: 255 if p > 127 else 0).convert("1")
    canvas = Image.new("1", (band_px, bw.height), 1)
    canvas.paste(bw, ((band_px - bw.width) // 2, 0))
    return canvas

def to_bilevel(im, page=None):
    """Grayscale page -> 1-bit image exactly band_px dots wide."""
    if not fit and crop and page in page_img:
        bw = native_image(page_img[page])
        if bw is not None:
            return bw
    if not fit and crop:
        bw = native(im)
        if bw is not None:
            return bw
    if crop:
        # Ink is anything not near-white; getbbox() finds its extent.
        mask = im.point(lambda p: 0 if p > 235 else 255)
        bb = mask.getbbox()
        if bb is None:
            return None
        im = im.crop(bb)
    if im.width != art_px:
        h = max(1, int(round(im.height * art_px / im.width)))
        # LANCZOS down to the dot grid, then restore the edge energy the
        # resample averages away, so the cutoff below lands on crisp stems.
        im = im.resize((art_px, h), Image.LANCZOS)
        if sharp > 0:
            im = im.filter(ImageFilter.UnsharpMask(radius=1, percent=int(sharp * 100), threshold=0))
    if abs(gamma - 1.0) > 1e-6:
        im = im.point(lambda p: min(255, max(0, int(255 * ((p / 255.0) ** gamma)))))
    bw = im.convert("1") if dith else im.point(lambda p: 255 if p > thr else 0).convert("1")
    if pad_px:
        canvas = Image.new("1", (band_px, bw.height), 1)
        canvas.paste(bw, (pad_px, 0))
        bw = canvas
    return bw

def pdf(pages):
    """Minimal PDF: one 1-bit /DeviceGray image per page, placed in the band."""
    objs, out = [], bytearray(b"%PDF-1.4\n")
    def add(body):
        objs.append(body)
        return len(objs)
    root, pages_id = add(None), add(None)   # reserved, filled in below
    kids = []
    for bw in pages:
        art_h = band_pt * bw.height / bw.width
        page_h, _ = choose_page(art_h)
        data = zlib.compress(bw.tobytes(), 9)
        img = add(b"<< /Type /XObject /Subtype /Image /Width %d /Height %d "
                  b"/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode "
                  b"/Length %d >>\nstream\n" % (bw.width, bw.height, len(data))
                  + data + b"\nendstream")
        # Top-align: PDF origin is bottom-left, so a receipt shorter than the
        # sheet must be lifted, or it prints after a run of blank roll.
        cs = b"q %.4f 0 0 %.4f %.4f %.4f cm /Im0 Do Q" % (band_pt, art_h, ml, page_h - art_h)
        cont = add(b"<< /Length %d >>\nstream\n" % len(cs) + cs + b"\nendstream")
        pg = add(b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.4f %.4f] "
                 b"/Resources << /XObject << /Im0 %d 0 R >> >> /Contents %d 0 R >>"
                 % (pages_id, paper, page_h, img, cont))
        kids.append(pg)
    objs[root - 1] = b"<< /Type /Catalog /Pages %d 0 R >>" % pages_id
    objs[pages_id - 1] = (b"<< /Type /Pages /Count %d /Kids [%s] >>"
                          % (len(kids), b" ".join(b"%d 0 R" % k for k in kids)))
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += (b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (len(objs) + 1, root, xref))
    return bytes(out)

rendered, heights = [], []
for n, png in enumerate(sorted(glob.glob(os.path.join(D, "p-*.png"))), 1):
    bw = to_bilevel(Image.open(png).convert("L"), n)
    if bw is None:
        print("  page %d is blank, skipped" % n)
        continue
    art_h = band_pt * bw.height / bw.width
    page_h, size_opt = choose_page(art_h)
    with open(os.path.join(D, "out-%04d.pdf" % len(rendered)), "wb") as f:
        f.write(pdf([bw]))
    rendered.append(bw)
    heights.append(size_opt)
    if verb:
        print("  page %d: %dx%d dots -> ink %.1fmm on %s (%.1fmm sheet)"
              % (n, bw.width, bw.height, art_h / 72.0 * 25.4, size_opt, page_h / 72.0 * 25.4))
if rendered:
    with open(os.path.join(D, "combined.pdf"), "wb") as f:
        f.write(pdf(rendered))

# The whole run as ONE ESC/POS stream.  Every page sent as its own CUPS job
# reopens the USB pipe while the head is still printing the previous page, and
# the CX583 then loses the first bytes of the new job -- the GS v 0 header --
# and prints the raster payload that follows as text: sparse / % @ ? above the
# next receipt.  One job has no such boundaries.
HEAD_DOTS = 384                         # 48mm head at 203dpi
BAND = 24                               # rows per GS v 0 chunk
gap = int(env.get("PRINT58_GAP_DOTS", "96"))   # blank feed between receipts
cut = env.get("PRINT58_CUT", "0") == "1"
def feed(dots):
    out = bytearray()
    while dots > 0:
        n = min(255, dots); out += b"\x1bJ" + bytes([n]); dots -= n
    return bytes(out)
head = bytearray(b"\x00" * int(env.get("PRINT58_RESYNC_BYTES", "65536")) if env.get("PRINT58_RESYNC", "1") == "1" else b"")
head += b"\x1b@"
if env.get("PRINT58_RESET", "0") == "1":
    head += feed(16)
tear = int(env.get("PRINT58_TEAR_DOTS", "120"))   # receipt end -> past the tear bar
wb = HEAD_DOTS // 8
job = bytearray(head)
for n, bw in enumerate(rendered):
    start = len(job)
    canvas = Image.new("1", (HEAD_DOTS, bw.height), 1)
    canvas.paste(bw.crop((0, 0, min(bw.width, HEAD_DOTS), bw.height)), (0, 0))
    # PIL "1": bit set = white; ESC/POS: bit set = burn.  Invert the bytes.
    raw = bytes(b ^ 0xFF for b in canvas.tobytes())
    for y in range(0, canvas.height, BAND):
        h = min(BAND, canvas.height - y)
        chunk = raw[y * wb:(y + h) * wb]
        if not any(chunk):
            job += feed(h)                  # blank rows: just advance paper
            continue
        job += b"\x1dv0\x00" + bytes([wb & 255, wb >> 8, h & 255, h >> 8]) + chunk
    body = bytes(job[start:])
    job += feed(gap)
    if cut:
        job += b"\x1dV\x01"
    # The same receipt as a job of its own, for --pause: fed clear of the tear
    # bar so it can be torn off before the next one is sent.  Each carries the
    # resync preamble, since nothing is left mid-chunk between them anyway.
    with open(os.path.join(D, "rcpt-%04d.prn" % n), "wb") as f:
        f.write(bytes(head) + body + feed(tear) + (b"\x1dV\x01" if cut else b""))
job += feed(80)                             # clear the tear bar
with open(os.path.join(D, "job.prn"), "wb") as f:
    f.write(job)
with open(os.path.join(D, "heights.txt"), "w") as f:
    # Trailing newline on every line: a bare `read` loop drops a final
    # unterminated line, which silently skipped single-page jobs.
    f.writelines("%s\n" % h for h in heights)
PY

  [ -s "$T/combined.pdf" ] || die "nothing to print from $SRC (all pages blank?)"

  if [ "$DRY" = "1" ]; then
    DEST="${OUT:-${SRC%.pdf}-58mm.pdf}"
    cp "$T/combined.pdf" "$DEST"
    echo "dry run -> $DEST"
    continue
  fi

  # Wait for the queue to empty, so pages are never stacked in the backend and
  # a page that fails is noticed before the next one is committed to the roll.
  drain() {
    local waited=0
    while [ -n "$(lpstat -W not-completed -o "$PRINTER" 2>/dev/null)" ]; do
      [ "$waited" -ge "${PRINT58_DRAIN_TIMEOUT:-120}" ] && return 1
      /bin/sleep 1
      waited=$((waited + 1))
    done
    return 0
  }

  # A job already sitting in the queue is one this script did not create, and
  # printing behind it is what leaves the head desynced.  Say so rather than
  # adding to the pile.
  if [ -n "$(lpstat -W not-completed -o "$PRINTER" 2>/dev/null)" ]; then
    if [ "$CLEAR" = "1" ]; then
      echo "print58: clearing job(s) already queued on $PRINTER" >&2
      cancel -a "$PRINTER" 2>/dev/null || true
      # cancel returns before the backend has torn the job down, so still wait
      # for the queue to actually empty before committing a page to the roll.
      drain || die "could not clear the queue on $PRINTER; if output is still garbled the head is desynced and needs a power cycle (unplug power AND USB ~10s)"
    else
      echo "print58: $PRINTER has a job already queued; waiting for it to clear (use --clear to cancel it)" >&2
      drain || die "queue on $PRINTER is stuck. Clear it with 'cancel -a $PRINTER' or rerun with --clear; if output is still garbled the head is desynced and needs a power cycle (unplug power AND USB ~10s)"
    fi
  fi

  if [ "$VIA_CUPS" = "0" ]; then
    # Default: every page, the resync preamble and all feeds in a single raw
    # job -- no job boundary for the head to lose bytes at (see job.prn above).
    NPAGES=$(grep -c . "$T/heights.txt")
    if [ "$PAUSE" = "1" ] && [ "$NPAGES" -gt 1 ]; then
      # One receipt per job, the next sent only once the operator has torn
      # off the last.  The printer is idle by then, so the job boundary that
      # garbles back-to-back jobs cannot bite.
      [ -t 0 ] || [ -r /dev/tty ] || die "--pause needs a terminal to wait on"
      for ((k = 0; k < NPAGES; k++)); do
        lp -d "$PRINTER" -n "$COPIES" -o raw "$T/rcpt-$(printf '%04d' "$k").prn" >/dev/null
        drain || die "receipt $((k + 1)) did not finish printing on $PRINTER (queue stuck; is it connected and online?)"
        [ $((k + 1)) -lt "$NPAGES" ] || break
        printf 'print58: receipt %d/%d printed -- tear it off, then Enter for the next (q to stop) ' $((k + 1)) "$NPAGES" >&2
        read -r reply < /dev/tty || reply=q
        case "$reply" in q|Q) echo "$SRC: stopped after $((k + 1)) of $NPAGES receipt(s)"; continue 2 ;; esac
      done
      echo "$SRC: printed $NPAGES receipt(s) on $PRINTER, pausing between each"
      continue
    fi
    lp -d "$PRINTER" -n "$COPIES" -o raw "$T/job.prn" >/dev/null
    drain || die "$SRC did not finish printing on $PRINTER (queue stuck; is it connected and online?)"
    echo "$SRC: printed $(grep -c . "$T/heights.txt") page(s) on $PRINTER as one job"
    continue
  fi

  # Once per run is enough: pages below are drained one at a time, so the head
  # cannot fall out of step again unless a page fails, which aborts the run.
  if [ "$RESYNC" = "1" ] && [ -z "${RESYNCED:-}" ]; then
    # NULs complete any pending raster chunk (blank dots) or are ignored as
    # commands; ESC @ then clears print modes left set by an earlier job.
    head -c "${PRINT58_RESYNC_BYTES:-65536}" /dev/zero > "$T/resync.prn"
    printf '\033@' >> "$T/resync.prn"
    [ "$RESET" = "1" ] && printf '\033J\020' >> "$T/resync.prn"
    lp -d "$PRINTER" -o raw "$T/resync.prn" >/dev/null
    drain || die "printer $PRINTER did not accept the resync job (is it connected and online?)"
    RESYNCED=1
  fi

  # Do NOT select Resolution explicitly: 203dpi is the only resolution this
  # printer has and is already the default, so naming it buys nothing.
  LPOPTS=()
  [ "$CUT" = "1" ] && LPOPTS+=(-o CutMedia=EndOfPage)
  i=0
  while read -r SIZE || [ -n "$SIZE" ]; do
    [ -n "$SIZE" ] || continue
    lp -d "$PRINTER" -n "$COPIES" \
       -o "PageSize=$SIZE" ${LPOPTS[@]+"${LPOPTS[@]}"} \
       "$T/out-$(printf '%04d' "$i").pdf" >/dev/null
    i=$((i + 1))
    drain || die "page $i did not finish printing on $PRINTER (queue stuck)"
  done < "$T/heights.txt"
  echo "$SRC: printed $i page(s) on $PRINTER"
done
