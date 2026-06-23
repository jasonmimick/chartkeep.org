#!/usr/bin/env python3
"""
chartkeep_previews.py — add preview PNGs to a vault built by chartkeep_ingest.py,
AND diagnose what your real CDs actually contain (the part that bites).

Usage:
    pip install pydicom pylibjpeg pylibjpeg-libjpeg python-gdcm pillow numpy --break-system-packages
    python3 chartkeep_previews.py /path/to/copied/cd ./vault

For each series it renders the MIDDLE slice to:
    vault/records/imaging/<folder>/files/<seriesShort>_preview.png
and appends an image link into note.md.

If a series fails to decode, it tells you the TransferSyntaxUID so you know
exactly which codec plugin is missing — the #1 real-CD problem.
"""
import os, sys, json, hashlib
from pathlib import Path
from collections import defaultdict
import pydicom
import numpy as np
from PIL import Image

# Human-readable names for the transfer syntaxes you'll actually meet on CDs
TS_NAMES = {
    "1.2.840.10008.1.2": "Implicit VR Little Endian (raw)",
    "1.2.840.10008.1.2.1": "Explicit VR Little Endian (raw)",
    "1.2.840.10008.1.2.4.50": "JPEG Baseline — needs pylibjpeg-libjpeg",
    "1.2.840.10008.1.2.4.51": "JPEG Extended — needs pylibjpeg-libjpeg",
    "1.2.840.10008.1.2.4.57": "JPEG Lossless — needs pylibjpeg-libjpeg",
    "1.2.840.10008.1.2.4.70": "JPEG Lossless SV1 — needs pylibjpeg-libjpeg",
    "1.2.840.10008.1.2.4.90": "JPEG 2000 lossless — needs pylibjpeg-openjpeg/gdcm",
    "1.2.840.10008.1.2.4.91": "JPEG 2000 — needs pylibjpeg-openjpeg/gdcm",
    "1.2.840.10008.1.2.5": "RLE Lossless",
}

def is_dicom(p):
    try:
        with open(p, "rb") as f:
            f.seek(128); return f.read(4) == b"DICM"
    except OSError:
        return False

def short(uid): return hashlib.sha1(uid.encode()).hexdigest()[:8]

def to_8bit(arr):
    arr = arr.astype(np.float32)
    lo, hi = np.percentile(arr, 1), np.percentile(arr, 99)  # window to 1-99% for contrast
    if hi <= lo: hi = arr.max(); lo = arr.min()
    arr = np.clip((arr - lo) / (hi - lo + 1e-6), 0, 1) * 255
    return arr.astype(np.uint8)

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, vault = Path(sys.argv[1]), Path(sys.argv[2])

    # group files by series
    series = defaultdict(list)
    for dp, _, fns in os.walk(src):
        for n in fns:
            p = Path(dp)/n
            if n.upper()=="DICOMDIR" or not is_dicom(p): continue
            try: ds = pydicom.dcmread(p, stop_before_pixels=True, force=True)
            except Exception: continue
            suid = getattr(ds, "SeriesInstanceUID", None)
            if suid: series[suid].append(str(p))

    if not series:
        print("No DICOM found."); sys.exit(0)

    # map series -> vault folder (by matching series short id in resource.fhir.json)
    folder_for_series = {}
    for fj in (vault/"records"/"imaging").glob("*/resource.fhir.json"):
        data = json.loads(fj.read_text())
        for s in data.get("series", []):
            folder_for_series[s["uid"]] = fj.parent

    diagnostics = []
    for suid, files in series.items():
        files.sort()
        mid = files[len(files)//2]
        folder = folder_for_series.get(suid)
        try:
            ds = pydicom.dcmread(mid, force=True)
            ts = str(getattr(ds.file_meta, "TransferSyntaxUID", "unknown"))
            arr = ds.pixel_array  # triggers decode; raises if codec missing
            if arr.ndim == 3: arr = arr[arr.shape[0]//2]  # multiframe -> middle frame
            img = Image.fromarray(to_8bit(arr))
            if folder:
                out = folder/"files"/f"{short(suid)}_preview.png"
                img.save(out)
                note = folder/"note.md"
                txt = note.read_text()
                link = f"\n![[files/{out.name}]]\n"
                if link.strip() not in txt:
                    note.write_text(txt + link)
                print(f"  ✓ preview {out.relative_to(vault)}")
            diagnostics.append((suid, ts, "OK"))
        except Exception as e:
            ds = pydicom.dcmread(mid, stop_before_pixels=True, force=True)
            ts = str(getattr(ds.file_meta, "TransferSyntaxUID", "unknown"))
            name = TS_NAMES.get(ts, "unknown syntax")
            diagnostics.append((suid, ts, f"FAILED: {type(e).__name__} — {name}"))
            print(f"  ✗ series {short(suid)} decode failed — {name}")

    print("\n--- Transfer-syntax report (what your CD actually uses) ---")
    seen = {}
    for _, ts, status in diagnostics:
        seen.setdefault(ts, [TS_NAMES.get(ts, "unknown"), 0, status])
        seen[ts][1] += 1
    for ts, (name, count, status) in seen.items():
        flag = "OK" if status == "OK" else "NEEDS PLUGIN"
        print(f"  [{flag}] {count} series — {name}\n           {ts}")
    if any(s != "OK" for _, _, s in diagnostics):
        print("\nFix: pip install pylibjpeg pylibjpeg-libjpeg pylibjpeg-openjpeg python-gdcm --break-system-packages")

if __name__ == "__main__":
    main()
