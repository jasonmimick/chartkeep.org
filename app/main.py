#!/usr/bin/env python3
"""Chartkeep local web server — serves vault data and DICOM files."""

import json, re, io, tempfile, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
import pydicom
sys.path.insert(0, str(Path(__file__).parent.parent))
from chartkeep_ccda_ingest import parse_doc, extract_labs
from chartkeep_annotations import AnnotationStore, target_id as ann_target_id
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

SCRIPTS = Path(__file__).parent.parent  # chartkeep/ root

VAULT = Path(__file__).parent.parent / "vault"

app = FastAPI(title="Chartkeep")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def parse_frontmatter(text: str) -> dict:
    meta, in_fm, count = {}, False, 0
    for line in text.splitlines():
        if line.strip() == "---":
            count += 1
            in_fm = count == 1
            if count == 2:
                break
            continue
        if in_fm and ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()
    return meta


def note_body(text: str) -> str:
    """Return note content after frontmatter."""
    parts = text.split("---", 2)
    return parts[2].strip() if len(parts) >= 3 else text


# ── Imaging ──────────────────────────────────────────────────────────────────

@app.get("/api/imaging")
def list_imaging():
    base = VAULT / "records" / "imaging"
    studies = []
    for fhir_file in sorted(base.glob("*/resource.fhir.json"), reverse=True):
        data = json.loads(fhir_file.read_text())
        folder = fhir_file.parent
        previews = [
            f"/previews/{p.relative_to(VAULT)}"
            for p in sorted((folder / "files").glob("*_preview.png"))
        ]
        studies.append({**data, "folder": folder.name, "previews": previews})
    return studies


@app.get("/api/imaging/{folder}")
def get_imaging(folder: str):
    fhir_file = VAULT / "records" / "imaging" / folder / "resource.fhir.json"
    if not fhir_file.exists():
        raise HTTPException(404)
    data = json.loads(fhir_file.read_text())
    note = (fhir_file.parent / "note.md").read_text()
    folder_path = fhir_file.parent

    previews = [
        f"/previews/{p.relative_to(VAULT)}"
        for p in sorted((folder_path / "files").glob("*_preview.png"))
    ]

    dicom_dir = folder_path / "files" / "dicom"
    dicom_files = (
        [f"/api/frame/{folder}/{p.name}"
         for p in sorted(dicom_dir.glob("*")) if is_dicom(p)]
        if dicom_dir.exists() else []
    )

    return {**data, "folder": folder, "previews": previews,
            "dicom_files": dicom_files,
            "note_body": note_body(note), "note_meta": parse_frontmatter(note)}


def is_dicom(p: Path) -> bool:
    try:
        with open(p, "rb") as f:
            f.seek(128); return f.read(4) == b"DICM"
    except: return False


# ── Encounters ────────────────────────────────────────────────────────────────

@app.get("/api/encounters")
def list_encounters():
    base = VAULT / "records" / "encounters"
    if not base.exists():
        return []
    encounters = []
    for note_file in sorted(base.glob("*/note.md"), reverse=True):
        meta = parse_frontmatter(note_file.read_text())
        encounters.append({**meta, "folder": note_file.parent.name})
    return encounters


@app.get("/api/encounters/{folder}")
def get_encounter(folder: str):
    note_file = VAULT / "records" / "encounters" / folder / "note.md"
    if not note_file.exists():
        raise HTTPException(404)
    text = note_file.read_text()
    return {"folder": folder, "meta": parse_frontmatter(text), "body": note_body(text)}


# ── Summary ───────────────────────────────────────────────────────────────────

@app.get("/api/summary")
def get_summary():
    summary_file = VAULT / "summary.md"
    if not summary_file.exists():
        raise HTTPException(404, "Run chartkeep_summary.py first")
    text = summary_file.read_text()
    meta = parse_frontmatter(text)

    def extract_section(body: str, heading: str) -> list[str]:
        items, in_section = [], False
        for line in body.splitlines():
            if re.match(rf"^##\s+.*{re.escape(heading)}", line, re.I):
                in_section = True
                continue
            if in_section:
                if line.startswith("##"):
                    break
                if line.startswith("- "):
                    items.append(line[2:].strip())
        return items

    body  = note_body(text)
    store = AnnotationStore(VAULT)

    raw_problems   = extract_section(body, "Problems")
    raw_meds       = extract_section(body, "Medications")
    raw_allergies  = [a for a in extract_section(body, "Allergies")
                      if not re.search(r"no\s+known", a, re.I)]

    problem_view = store.apply_to_problems(raw_problems)

    return {
        "as_of":       meta.get("as_of", ""),
        "provider":    meta.get("source_provider", ""),
        # Active problems only — resolved/suppressed excluded from count
        "problems":    [p["display"] for p in problem_view["active"]],
        "problems_resolved":  [{"display": p["display"], "annotation": p["annotation"]}
                               for p in problem_view["resolved"]],
        "problems_disputed":  [{"display": p["display"], "annotation": p["annotation"]}
                               for p in problem_view["disputed"]],
        "medications": [m["display"] for m in store.apply_to_items(raw_meds, "medication")],
        "allergies":   [a["display"] for a in store.apply_to_items(raw_allergies, "allergy")],
    }


# ── Annotations ───────────────────────────────────────────────────────────────

class AnnotationRequest(BaseModel):
    target_type: str
    display: str
    action: str
    encounter_folder: str = ""
    patient_status: str = ""
    resolved_date: str = ""
    reason: str = ""
    note: str = ""
    suppressed: bool = False
    sensitive_category: str = ""
    share_default: bool = True


@app.get("/api/annotations")
def get_annotations():
    return AnnotationStore(VAULT).active_map()


@app.post("/api/annotations")
def create_annotation(req: AnnotationRequest):
    store = AnnotationStore(VAULT)
    ann = store.annotate(
        ttype=req.target_type,
        display=req.display,
        action=req.action,
        encounter_folder=req.encounter_folder,
        patient_status=req.patient_status,
        resolved_date=req.resolved_date,
        reason=req.reason,
        note=req.note,
        suppressed=req.suppressed,
        sensitive_category=req.sensitive_category,
        share_default=req.share_default,
    )
    return ann


@app.delete("/api/annotations/{target_type}/{display:path}")
def remove_annotation(target_type: str, display: str):
    store = AnnotationStore(VAULT)
    tid   = ann_target_id(target_type, display)
    try:
        ann = store.restore(tid)
        return {"status": "restored", "annotation": ann}
    except KeyError:
        raise HTTPException(404, f"No annotation found for {target_type}:{display}")


@app.get("/api/annotations/history")
def get_annotation_history():
    """All annotation events in reverse chronological order (full audit log)."""
    store = AnnotationStore(VAULT)
    return sorted(store.all(), key=lambda a: a["created_at"], reverse=True)


# ── Profile ───────────────────────────────────────────────────────────────────

def _parse_demographics() -> dict:
    """Pull name/DOB/contact from the most recent encounter XML."""
    from xml.etree import ElementTree as ET
    NS = "urn:hl7-org:v3"
    N  = lambda t: f"{{{NS}}}{t}"

    xmls = sorted((VAULT / "records" / "encounters").glob("*/encounter.ccda.xml"), reverse=True)
    if not xmls:
        return {}
    root = ET.fromstring(xmls[0].read_bytes())

    pat = root.find(f".//{N('patient')}")
    def el_text(el):
        return "".join(el.itertext()).strip() if el is not None else ""

    # Prefer legal name (use="L"), fall back to first name found
    given = family = None
    for name_el in (pat.findall(f"{N('name')}") if pat is not None else []):
        if name_el.get("use","") in ("L","") or given is None:
            g = name_el.find(N("given"))
            f = name_el.find(N("family"))
            if g is not None: given  = g
            if f is not None: family = f

    dob_el = pat.find(f"{N('birthTime')}") if pat is not None else None
    ms_el  = pat.find(f"{N('maritalStatusCode')}") if pat is not None else None

    dob_raw = dob_el.get("value","") if dob_el is not None else ""
    from datetime import date
    try:
        dob = date(int(dob_raw[:4]), int(dob_raw[4:6]), int(dob_raw[6:8]))
        age = (date.today() - dob).days // 365
        dob_fmt = dob.strftime("%B %-d, %Y")
    except Exception:
        age = None; dob_fmt = dob_raw

    addr = root.find(f".//{N('patientRole')}/{N('addr')}")
    def addr_part(tag):
        el = addr.find(f"{N(tag)}") if addr is not None else None
        return el_text(el).title() if el is not None else ""

    tels = root.findall(f".//{N('patientRole')}/{N('telecom')}")
    phone = next((t.get("value","").replace("tel:","") for t in tels if "tel:" in t.get("value","")), "")
    email = next((t.get("value","").replace("mailto:","") for t in tels if "mailto:" in t.get("value","")), "")

    return {
        "name":           f"{el_text(given)} {el_text(family)}".strip(),
        "dob":            dob_fmt,
        "age":            age,
        "marital_status": ms_el.get("displayName","") if ms_el is not None else "",
        "address":        ", ".join(filter(None, [
                            addr_part("streetAddressLine"),
                            addr_part("city"),
                            addr_part("state"),
                            addr_part("postalCode"),
                          ])),
        "phone":          phone,
        "email":          email,
    }

PROFILE_PATH = VAULT / "patient" / "profile.json"

def _load_profile() -> dict:
    if PROFILE_PATH.exists():
        return json.loads(PROFILE_PATH.read_text())
    source = _parse_demographics()
    profile = {
        "source": source,
        "patient": {
            "blood_type": "",
            "organ_donor": None,
            "advance_directive": "",
            "emergency_contact_name": "",
            "emergency_contact_phone": "",
            "emergency_contact_relation": "",
            "primary_care_provider": "",
            "family_history": [],
            "surgical_history": [],
            "notes": "",
        }
    }
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(json.dumps(profile, indent=2))
    return profile


@app.get("/api/profile")
def get_profile():
    return _load_profile()


@app.put("/api/profile")
def update_profile(data: dict):
    profile = _load_profile()
    # Only allow updating patient-asserted section
    if "patient" in data:
        profile["patient"].update(data["patient"])
    PROFILE_PATH.write_text(json.dumps(profile, indent=2))
    return profile


# ── Shares ────────────────────────────────────────────────────────────────────

SHARES_PATH = VAULT / "patient" / "shares.json"

def _load_shares() -> dict:
    if SHARES_PATH.exists():
        return json.loads(SHARES_PATH.read_text())
    return {"shares": []}

class ShareRequest(BaseModel):
    recipient_type: str
    recipient_name: str
    recipient_org: str = ""
    includes: list = []
    excludes_sensitive: bool = True
    expiry: str = ""
    notes: str = ""

@app.get("/api/shares")
def get_shares():
    return _load_shares()["shares"]

@app.post("/api/shares")
def create_share(req: ShareRequest):
    import uuid
    from datetime import datetime, timezone
    shares = _load_shares()
    new_share = {
        "id": f"share-{str(uuid.uuid4())[:6]}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "recipient_type": req.recipient_type,
        "recipient_name": req.recipient_name,
        "recipient_org": req.recipient_org or None,
        "includes": req.includes,
        "excludes_sensitive": req.excludes_sensitive,
        "expiry": req.expiry or None,
        "status": "active",
        "notes": req.notes,
    }
    shares["shares"].append(new_share)
    SHARES_PATH.write_text(json.dumps(shares, indent=2))
    return new_share

@app.delete("/api/shares/{share_id}")
def revoke_share(share_id: str):
    shares = _load_shares()
    for s in shares["shares"]:
        if s["id"] == share_id:
            s["status"] = "revoked"
            SHARES_PATH.write_text(json.dumps(shares, indent=2))
            return s
    raise HTTPException(404, f"Share {share_id} not found")


# ── DICOM file serving ────────────────────────────────────────────────────────

@app.get("/dicom/{file_path:path}")
def serve_dicom(file_path: str):
    p = VAULT / "records" / "imaging" / file_path
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(str(p), media_type="application/octet-stream",
                        headers={"Access-Control-Allow-Origin": "*"})


# ── DICOM frame endpoint (server-side decode → PNG) ──────────────────────────

@app.get("/api/frame/{folder}/{filename}")
def get_frame(folder: str, filename: str):
    p = VAULT / "records" / "imaging" / folder / "files" / "dicom" / filename
    if not p.exists():
        raise HTTPException(404)
    try:
        ds  = pydicom.dcmread(str(p), force=True)
        arr = ds.pixel_array
        if arr.ndim == 3:
            arr = arr[arr.shape[0] // 2]
        arr  = arr.astype(np.float32)
        lo, hi = np.percentile(arr, 1), np.percentile(arr, 99)
        if hi <= lo: hi = arr.max(); lo = arr.min()
        arr = np.clip((arr - lo) / (hi - lo + 1e-6), 0, 1) * 255
        img = Image.fromarray(arr.astype(np.uint8))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png",
                                 headers={"Cache-Control": "max-age=3600"})
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Static assets (preview PNGs) ──────────────────────────────────────────────

@app.get("/previews/{file_path:path}")
def serve_preview(file_path: str):
    p = VAULT / file_path
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p, media_type="image/png")


# ── Labs ─────────────────────────────────────────────────────────────────────

@app.get("/api/labs")
def get_labs():
    """Aggregate all lab results across every encounter XML."""
    base = VAULT / "records" / "encounters"
    results = []
    for xml_file in sorted(base.glob("*/encounter.ccda.xml")):
        folder = xml_file.parent.name
        try:
            from xml.etree import ElementTree as ET
            root = ET.fromstring(xml_file.read_bytes())
            labs = extract_labs(root)
            if not labs:
                continue
            # Get encounter date + provider from frontmatter
            note = xml_file.parent / "note.md"
            meta = parse_frontmatter(note.read_text()) if note.exists() else {}
            enc_date = meta.get("date", folder[:10])
            for lab in labs:
                # Use the lab's own observation date when it differs from enc_date
                # (summary documents carry many dates; structured observations know their own)
                lab_date = lab.get("date") or enc_date
                results.append({
                    "folder":   folder,
                    **lab,
                    "date":     lab_date,
                    "provider": meta.get("provider", ""),
                })
        except Exception:
            continue
    return sorted(results, key=lambda r: r["date"], reverse=True)


# ── Import endpoints ──────────────────────────────────────────────────────────

@app.get("/api/vault-path")
def vault_path():
    return {"path": str(VAULT)}

@app.get("/api/import/discs")
def list_discs():
    """Find mounted volumes that look like DICOM discs."""
    volumes = Path("/Volumes")
    discs = []
    for vol in volumes.iterdir():
        if vol.name.startswith("."): continue
        dicomdir = vol / "DICOMDIR"
        if dicomdir.exists():
            discs.append({"name": vol.name, "path": str(vol), "has_dicomdir": True})
        else:
            # Check for DICOM files anywhere in top 2 levels
            dcm = list(vol.glob("*/*.dcm"))[:1] or list(vol.glob("*.dcm"))[:1]
            if dcm:
                discs.append({"name": vol.name, "path": str(vol), "has_dicomdir": False})
    return discs

def _run_summary(output_lines: list[str]):
    """Regenerate vault/summary.md — called after every successful import."""
    r = subprocess.run(
        [sys.executable, str(SCRIPTS / "chartkeep_summary.py"), str(VAULT)],
        capture_output=True, text=True, timeout=30
    )
    output_lines.append("\n--- Updating summary ---")
    output_lines.append(r.stdout + r.stderr)


@app.post("/api/import/records")
async def import_records(file: UploadFile = File(...)):
    """Accept a health summary zip (any USCDI/C-CDA portal export) and ingest it."""
    suffix = Path(file.filename or "upload").suffix or ".zip"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)
    try:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "chartkeep_ccda_ingest.py"),
             str(tmp_path), str(VAULT)],
            capture_output=True, text=True, timeout=120
        )
        lines = [result.stdout + result.stderr]
        if result.returncode != 0:
            raise HTTPException(500, detail=lines[0])
        _run_summary(lines)
        return {"ok": True, "output": "\n".join(lines)}
    finally:
        tmp_path.unlink(missing_ok=True)


@app.post("/api/import/dicom")
def import_dicom(body: dict):
    """Ingest a DICOM disc from a mounted volume path."""
    disc_path = body.get("path")
    if not disc_path or not Path(disc_path).exists():
        raise HTTPException(400, "Invalid disc path")
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "chartkeep_ingest.py"),
         disc_path, str(VAULT)],
        capture_output=True, text=True, timeout=300
    )
    lines = [result.stdout + result.stderr]
    if result.returncode != 0:
        raise HTTPException(500, detail=lines[0])
    _run_summary(lines)
    return {"ok": True, "output": "\n".join(lines)}


# ── Serve built frontend ──────────────────────────────────────────────────────

frontend_dist = Path(__file__).parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8765, reload=True)
