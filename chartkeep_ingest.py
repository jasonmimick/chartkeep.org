#!/usr/bin/env python3
"""
chartkeep_ingest.py — ingest a DICOM CD into a local-first FHIR health vault.

Usage:
    pip install pydicom pylibjpeg pylibjpeg-libjpeg python-gdcm pillow --break-system-packages
    python3 chartkeep_ingest.py /path/to/copied/cd  ./vault

For each DICOM Study found, creates:
    vault/records/imaging/<date>-<modality>-<shortuid>/
        resource.fhir.json   (FHIR ImagingStudy)
        note.md              (human-readable summary + frontmatter)
        files/               (preview PNGs; originals stay where they are)

Identifies DICOM by magic bytes ("DICM" at offset 128), NOT by extension.
"""

import os
import sys
import json
import hashlib
import time
from pathlib import Path
from collections import defaultdict

import pydicom
from pydicom.errors import InvalidDicomError


def is_dicom(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            f.seek(128)
            return f.read(4) == b"DICM"
    except OSError:
        return False


def scan_via_dicomdir(dicomdir: Path) -> dict:
    """Parse DICOMDIR index — fast path, no per-file reads needed."""
    print(f"  Found DICOMDIR — reading index (fast path) ...")
    ds = pydicom.dcmread(str(dicomdir), force=True)
    root = dicomdir.parent

    studies = {}
    cur_study = cur_series = None

    for rec in ds.DirectoryRecordSequence:
        rtype = getattr(rec, "DirectoryRecordType", "").upper()

        if rtype == "STUDY":
            uid = str(getattr(rec, "StudyInstanceUID", ""))
            if not uid:
                continue
            cur_study = studies.setdefault(uid, {
                "StudyInstanceUID": uid,
                "StudyDate":        str(getattr(rec, "StudyDate", "")),
                "StudyDescription": str(getattr(rec, "StudyDescription", "")),
                "PatientName":      str(getattr(rec, "PatientName", "")),
                "PatientID":        str(getattr(rec, "PatientID", "")),
                "PatientBirthDate": str(getattr(rec, "PatientBirthDate", "")),
                "PatientSex":       str(getattr(rec, "PatientSex", "")),
                "modalities": set(),
                "series": defaultdict(lambda: {"meta": {}, "files": []}),
            })
            cur_series = None

        elif rtype == "SERIES" and cur_study is not None:
            suid = str(getattr(rec, "SeriesInstanceUID", ""))
            mod  = str(getattr(rec, "Modality", ""))
            if suid:
                cur_series = suid
                if mod:
                    cur_study["modalities"].add(mod)
                meta = cur_study["series"][suid]["meta"]
                if not meta:
                    meta.update({
                        "SeriesInstanceUID": suid,
                        "SeriesNumber":      getattr(rec, "SeriesNumber", ""),
                        "Modality":          mod,
                        "SeriesDescription": str(getattr(rec, "SeriesDescription", "")),
                        "BodyPartExamined":  str(getattr(rec, "BodyPartExamined", "")),
                        "SOPClassUID":       str(getattr(rec, "SOPClassUID", "")),
                    })

        elif rtype in ("IMAGE", "INSTANCE") and cur_study and cur_series:
            fid = getattr(rec, "ReferencedFileID", None)
            if fid is None:
                continue
            parts = list(fid) if hasattr(fid, "__iter__") and not isinstance(fid, str) else [fid]
            p = root.joinpath(*parts)
            cur_study["series"][cur_series]["files"].append(str(p))

    total = sum(
        len(ser["files"])
        for s in studies.values()
        for ser in s["series"].values()
    )
    print(f"  Index: {len(studies)} study(ies), {total} instances total")
    return studies


def scan_via_walk(root: Path) -> dict:
    """Fallback: walk every file, check magic bytes, read headers."""
    print("  No DICOMDIR found — scanning files (slow path) ...")
    studies = {}
    all_files = [
        Path(dp) / n
        for dp, _, fns in os.walk(root)
        for n in fns
        if n.upper() != "DICOMDIR"
    ]
    total = len(all_files)
    found = skipped = 0
    t0 = time.time()

    for i, p in enumerate(all_files, 1):
        if i % 100 == 0 or i == total:
            elapsed = time.time() - t0
            print(f"  [{i}/{total}] {found} DICOM found, {skipped} skipped — {elapsed:.0f}s elapsed", end="\r")

        if not is_dicom(p):
            skipped += 1
            continue
        try:
            ds = pydicom.dcmread(p, stop_before_pixels=True, force=True)
        except Exception:
            skipped += 1
            continue

        study_uid  = getattr(ds, "StudyInstanceUID", None)
        series_uid = getattr(ds, "SeriesInstanceUID", None)
        if not study_uid:
            skipped += 1
            continue

        found += 1
        s = studies.setdefault(study_uid, {
            "StudyInstanceUID": study_uid,
            "StudyDate":        getattr(ds, "StudyDate", ""),
            "StudyDescription": getattr(ds, "StudyDescription", ""),
            "PatientName":      str(getattr(ds, "PatientName", "")),
            "PatientID":        getattr(ds, "PatientID", ""),
            "PatientBirthDate": getattr(ds, "PatientBirthDate", ""),
            "PatientSex":       getattr(ds, "PatientSex", ""),
            "modalities": set(),
            "series": defaultdict(lambda: {"meta": {}, "files": []}),
        })
        mod = getattr(ds, "Modality", "")
        if mod:
            s["modalities"].add(mod)
        ser = s["series"][series_uid]
        ser["files"].append(str(p))
        if not ser["meta"]:
            ser["meta"] = {
                "SeriesInstanceUID": series_uid,
                "SeriesNumber":      getattr(ds, "SeriesNumber", ""),
                "Modality":          mod,
                "SeriesDescription": getattr(ds, "SeriesDescription", ""),
                "BodyPartExamined":  getattr(ds, "BodyPartExamined", ""),
                "SOPClassUID":       getattr(ds, "SOPClassUID", ""),
            }

    print()  # newline after progress line
    return studies


def scan(root: Path) -> dict:
    dicomdir = root / "DICOMDIR"
    if not dicomdir.exists():
        # case-insensitive check for discs that use lowercase
        matches = list(root.glob("DICOMDIR")) + list(root.glob("dicomdir"))
        dicomdir = matches[0] if matches else None

    if dicomdir and dicomdir.exists():
        return scan_via_dicomdir(dicomdir)
    return scan_via_walk(root)


def fmt_date(d: str) -> str:
    return f"{d[0:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else (d or "unknown")


def short(uid: str) -> str:
    return hashlib.sha1(uid.encode()).hexdigest()[:8]


def build_imaging_study(study: dict) -> dict:
    series_list = []
    total_instances = 0
    for series_uid, ser in study["series"].items():
        n = len(ser["files"])
        total_instances += n
        m = ser["meta"]
        series_list.append({
            "uid": series_uid,
            "number": int(m["SeriesNumber"]) if str(m.get("SeriesNumber")).isdigit() else None,
            "modality": {"code": m.get("Modality", "")},
            "description": m.get("SeriesDescription", ""),
            "numberOfInstances": n,
            "bodySite": {"text": m.get("BodyPartExamined", "")} if m.get("BodyPartExamined") else None,
        })
    return {
        "resourceType": "ImagingStudy",
        "id": short(study["StudyInstanceUID"]),
        "identifier": [{"system": "urn:dicom:uid", "value": f"urn:oid:{study['StudyInstanceUID']}"}],
        "status": "available",
        "subject": {"reference": "Patient/owner"},
        "started": fmt_date(study["StudyDate"]),
        "numberOfSeries": len(series_list),
        "numberOfInstances": total_instances,
        "modality": [{"code": m} for m in sorted(study["modalities"])],
        "description": study["StudyDescription"],
        "series": [{k: v for k, v in s.items() if v is not None} for s in series_list],
    }


def build_note(study: dict, fhir: dict, folder: str) -> str:
    mods = ", ".join(sorted(study["modalities"])) or "unknown"
    lines = [
        "---",
        f"id: imaging-{fhir['id']}",
        "type: ImagingStudy",
        f"date: {fmt_date(study['StudyDate'])}",
        f"modality: {mods}",
        f"study_uid: {study['StudyInstanceUID']}",
        f"fhir: resource.fhir.json",
        "---",
        "",
        f"# Imaging — {study['StudyDescription'] or mods} ({fmt_date(study['StudyDate'])})",
        "",
        f"- **Modality:** {mods}",
        f"- **Series:** {fhir['numberOfSeries']}  |  **Images:** {fhir['numberOfInstances']}",
        f"- **Study UID:** `{study['StudyInstanceUID']}`",
        "",
        "## Series",
        "",
    ]
    for s in fhir["series"]:
        desc = s.get("description") or "(no description)"
        body = f" — {s['bodySite']['text']}" if s.get("bodySite") else ""
        lines.append(f"- **#{s.get('number','?')} {s['modality']['code']}** {desc}{body} "
                     f"({s['numberOfInstances']} images)")
    lines += ["", "## Notes", "", "_Your free-text notes here. This prose never touches the FHIR JSON._", ""]
    return "\n".join(lines)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, vault = Path(sys.argv[1]), Path(sys.argv[2])
    t0 = time.time()
    print(f"\nScanning {src} ...")
    studies = scan(src)
    if not studies:
        print("No DICOM studies found.")
        sys.exit(0)
    print(f"Found {len(studies)} study(ies) in {time.time()-t0:.1f}s\n")

    base = vault / "records" / "imaging"
    base.mkdir(parents=True, exist_ok=True)

    for study in studies.values():
        fhir = build_imaging_study(study)
        folder = f"{fmt_date(study['StudyDate'])}-{'-'.join(sorted(study['modalities']) or ['NA'])}-{fhir['id']}"
        out = base / folder
        (out / "files").mkdir(parents=True, exist_ok=True)
        (out / "resource.fhir.json").write_text(json.dumps(fhir, indent=2))
        (out / "note.md").write_text(build_note(study, fhir, folder))
        print(f"  ✓ {folder}  ({fhir['numberOfSeries']} series, {fhir['numberOfInstances']} images)")

    print(f"\nVault written to {vault}/records/imaging/")
    print("Next: open the folder in Obsidian, and validate resource.fhir.json at validator.fhir.org")


if __name__ == "__main__":
    main()
