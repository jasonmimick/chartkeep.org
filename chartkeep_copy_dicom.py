#!/usr/bin/env python3
"""Copy DICOM files from disc into the vault, organized by study folder."""
import json, shutil, sys
from pathlib import Path
from collections import defaultdict
import pydicom

VAULT = Path("./vault")

def is_dicom(p):
    try:
        with open(p, "rb") as f:
            f.seek(128); return f.read(4) == b"DICM"
    except: return False

def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Volumes/Untitled UDF Volume")
    dicomdir = src / "DICOMDIR"

    # Build study_uid -> vault_folder map
    uid_to_folder = {}
    for fj in (VAULT / "records" / "imaging").glob("*/resource.fhir.json"):
        data = json.loads(fj.read_text())
        for ident in data.get("identifier", []):
            uid = ident.get("value", "").replace("urn:oid:", "")
            if uid:
                uid_to_folder[uid] = fj.parent

    print(f"Mapped {len(uid_to_folder)} studies")

    # Walk DICOMDIR for file paths
    if dicomdir.exists():
        import pydicom as pd
        ds = pd.dcmread(str(dicomdir), force=True)
        cur_study_uid = cur_series_uid = None
        file_map = defaultdict(list)  # series_uid -> [(study_uid, path)]

        for rec in ds.DirectoryRecordSequence:
            rtype = getattr(rec, "DirectoryRecordType", "").upper()
            if rtype == "STUDY":
                cur_study_uid = str(getattr(rec, "StudyInstanceUID", ""))
            elif rtype == "SERIES":
                cur_series_uid = str(getattr(rec, "SeriesInstanceUID", ""))
            elif rtype in ("IMAGE", "INSTANCE") and cur_study_uid and cur_series_uid:
                fid = getattr(rec, "ReferencedFileID", None)
                if fid is None: continue
                parts = list(fid) if hasattr(fid, "__iter__") and not isinstance(fid, str) else [fid]
                p = src.joinpath(*parts)
                file_map[cur_study_uid].append((cur_series_uid, p))
    else:
        print("No DICOMDIR — skipping"); sys.exit(1)

    total_copied = 0
    for study_uid, files in file_map.items():
        folder = uid_to_folder.get(study_uid)
        if not folder:
            print(f"  ⚠ No vault folder for study {study_uid[:20]}..."); continue

        dest_base = folder / "files" / "dicom"
        dest_base.mkdir(parents=True, exist_ok=True)

        study_copied = 0
        for series_uid, src_path in files:
            if not src_path.exists(): continue
            dest = dest_base / src_path.name
            if not dest.exists():
                shutil.copy2(src_path, dest)
                study_copied += 1

        print(f"  ✓ {folder.name}  — {study_copied} files copied")
        total_copied += study_copied

    print(f"\nDone. {total_copied} DICOM files copied to vault.")

if __name__ == "__main__":
    main()
