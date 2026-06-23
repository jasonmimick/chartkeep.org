#!/usr/bin/env python3
"""
chartkeep_ccda_ingest.py — ingest C-CDA visit summaries from any patient portal.

Usage:
    python3 chartkeep_ccda_ingest.py <export.zip> <vault>

Supports: Epic/MyChart, Cerner, athenahealth, Kaiser, VA Blue Button,
          and any USCDI-compliant C-CDA export.

Creates one folder per visit:
    vault/records/encounters/<date>-<provider>-<shortid>/
        note.md              (human-readable visit summary)
        encounter.ccda.xml   (source C-CDA document)

Original zip is always preserved at:
    vault/imports/<timestamp>-<filename>
"""

import hashlib, re, sys, zipfile, shutil
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

_PHONE_RE    = re.compile(r'\d{3}[-.\s]\d{3}[-.\s]\d{4}')
_ADDRESS_RE  = re.compile(r'\d{2,5}\s+[A-Z][a-z]')
_DATETIME_RE = re.compile(r'\d{1,2}/\d{1,2}/\d{4}\s+\d')
_EMBEDDED_FLAG = re.compile(r'\s*\(([HL][*]?)\)\s*$')
_BODY_DIRS   = {"right", "left", "bilateral", "anterior", "posterior", "superior", "inferior"}

NS = "urn:hl7-org:v3"
N  = lambda tag: f"{{{NS}}}{tag}"


def short(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()[:8]


def fmt_date(d: str) -> str:
    try:
        return datetime.strptime(d[:8], "%Y%m%d").strftime("%Y-%m-%d")
    except Exception:
        return d[:8] if d else "unknown"


def fmt_date_human(d: str) -> str:
    try:
        return datetime.strptime(d[:8], "%Y%m%d").strftime("%B %-d, %Y")
    except Exception:
        return d


def td_text(td) -> str:
    return " ".join(t.strip() for t in td.itertext() if t.strip())


def section_rows(sec) -> list[list[str]]:
    """Return all tbody rows as lists of cell text."""
    text_el = sec.find(N("text"))
    if text_el is None:
        return []
    rows = []
    for tbody in text_el.findall(f".//{N('tbody')}"):
        for tr in tbody.findall(N("tr")):
            cells = [td_text(td).strip() for td in tr.findall(N("td"))]
            if any(cells):
                rows.append(cells)
    return rows


def section_col(sec, col: int = 0) -> list[str]:
    """Extract text from a single column across all rows."""
    text_el = sec.find(N("text"))
    if text_el is None:
        return []
    # Handle plain content (e.g. "No known allergies")
    for content in text_el.findall(f".//{N('content')}"):
        t = (content.text or "").strip()
        if t:
            return [t]
    vals = []
    for tbody in text_el.findall(f".//{N('tbody')}"):
        for tr in tbody.findall(N("tr")):
            tds = tr.findall(N("td"))
            if len(tds) > col:
                v = td_text(tds[col]).strip()
                if v:
                    vals.append(v)
    return list(dict.fromkeys(vals))


def find_section(root, *loinc_codes):
    for sec in root.findall(f".//{N('section')}"):
        code = sec.find(N("code"))
        if code is not None and code.get("code") in loinc_codes:
            return sec
    return None


_NO_KNOWN_RE = re.compile(r"no\s+known", re.I)

def extract_section(root, *loinc_codes, col=0) -> list[str]:
    sec = find_section(root, *loinc_codes)
    return section_col(sec, col) if sec is not None else []


def extract_allergies(root) -> list[str]:
    items = extract_section(root, "48765-2")
    return [i for i in items if not _NO_KNOWN_RE.search(i)]


# ── Section-specific parsers ───────────────────────────────────────────────────

def extract_medications(root) -> list[str]:
    sec = find_section(root, "10160-0")
    if sec is None:
        return []
    meds = []
    text_el = sec.find(N("text"))
    if text_el is None:
        return []
    for tbody in text_el.findall(f".//{N('tbody')}"):
        for tr in tbody.findall(N("tr")):
            if any(x in tr.get("styleCode", "") for x in ("Historic", "historic")):
                continue
            tds = tr.findall(N("td"))
            if len(tds) < 1:
                continue
            name = td_text(tds[0]).strip()
            sig  = td_text(tds[1]).strip() if len(tds) > 1 else ""
            if name:
                meds.append(f"{name}" + (f" — {sig}" if sig else ""))
    return list(dict.fromkeys(meds))


def extract_labs(root) -> list[dict]:
    """
    Extract lab results from Results section (30954-2).
    Returns list of {name, value, range, flag, date}.
    Skips historic and comment rows.
    """
    sec = find_section(root, "30954-2")
    if sec is None:
        return []

    # Try structured <observation> elements first — these have clean ISO dates
    # and proper displayNames. Falls back to HTML table parsing for Epic format.
    structured = _extract_labs_structured(sec)
    if structured:
        return structured

    # Values that indicate a panel header row, not an actual result
    PANEL_HEADERS = {"final result", "preliminary", "corrected", "cancelled",
                     "lab blood orderables", "orderables"}

    labs = []
    for row in section_rows(sec):
        if not row or not row[0]:
            continue
        name = row[0].strip()

        # Skip historic, comment, and panel header rows
        if "HISTOR" in name.upper():
            continue
        if name.lower().startswith("comment"):
            continue
        if len(row) < 2:
            continue

        value = row[1].strip() if len(row) > 1 else ""

        # Skip panel headers and non-values
        if value.lower() in PANEL_HEADERS or not value or value in ("-", "—", "N/A", "n/a"):
            continue
        if "orderable" in value.lower():
            continue

        # Skip if value looks like a phone number, address, or datetime (misaligned row)
        if _PHONE_RE.search(value) or _ADDRESS_RE.search(value) or _DATETIME_RE.search(value):
            continue

        ref   = row[2].strip() if len(row) > 2 else ""

        # Skip if ref column is a status phrase (another panel header pattern)
        if ref.lower() in PANEL_HEADERS:
            continue

        # Skip value-only-body-direction rows (procedure/imaging entries in results section)
        if value.lower() in _BODY_DIRS:
            continue

        # Skip specimen-type rows (e.g. "Blood: Venous blood / Unknown")
        specimen_words = ("venous", "arterial", "serum", "plasma", "urine", "swab", "tissue", "specimen")
        if any(w in value.lower() for w in specimen_words):
            continue

        flag  = row[3].strip() if len(row) > 3 else ""
        date  = row[4].strip() if len(row) > 4 else ""

        # Skip rows where flag looks like a timestamp or phone (wrong column alignment)
        if _PHONE_RE.search(flag) or _DATETIME_RE.search(flag):
            continue

        # Pull embedded flag out of value string (e.g. "160 (H)" → value="160", flag="H")
        em = _EMBEDDED_FLAG.search(value)
        if em:
            flag  = flag or em.group(1)
            value = value[:em.start()].strip()

        labs.append({
            "name":  name,
            "value": value,
            "range": ref,
            "flag":  flag,
            "date":  date,
        })

    return labs


_XSI_NS = "{http://www.w3.org/2001/XMLSchema-instance}"
_INTERP_MAP = {"H": "H", "HH": "H", "H*": "H", "L": "L", "LL": "L", "L*": "L"}
_SKIP_LAB_NAMES = {"lab interpretation", ""}


def _extract_labs_structured(sec) -> list[dict]:
    """Extract labs from structured <observation> elements (fallback for non-Epic formats)."""
    labs = []
    seen = set()

    for ob in sec.findall(f".//{N('observation')}"):
        oc = ob.find(N("code"))
        ov = ob.find(N("value"))
        ot = ob.find(N("effectiveTime"))
        if oc is None or ov is None:
            continue
        if oc.get("nullFlavor") or ov.get("nullFlavor"):
            continue

        xsi = ov.get(f"{_XSI_NS}type", "")
        if xsi not in ("PQ", "REAL"):
            continue
        val = ov.get("value", "").strip()
        if not val:
            continue

        unit = ov.get("unit", "")
        name = oc.get("displayName", "").strip()
        if not name:
            orig = oc.find(N("originalText"))
            name = "".join(orig.itertext()).strip() if orig is not None else ""
        if not name or name.lower() in _SKIP_LAB_NAMES:
            continue

        date_raw = (ot.get("value", "") if ot is not None else "")[:8]
        date = fmt_date(date_raw) if date_raw else ""

        # Reference range
        ref = ""
        ref_el = ob.find(f".//{N('referenceRange')}/{N('observationRange')}/{N('value')}")
        if ref_el is not None:
            lo = ref_el.find(N("low"))
            hi = ref_el.find(N("high"))
            lo_v = lo.get("value", "") if lo is not None else ""
            hi_v = hi.get("value", "") if hi is not None else ""
            if lo_v and hi_v:
                ref = f"{lo_v} - {hi_v} {unit}".strip()
            elif hi_v:
                ref = f"<{hi_v} {unit}".strip()
            elif lo_v:
                ref = f">={lo_v} {unit}".strip()

        # Interpretation flag
        flag = ""
        interp = ob.find(N("interpretationCode"))
        if interp is not None:
            flag = _INTERP_MAP.get(interp.get("code", "").upper(), "")

        value_str = f"{val} {unit}".strip() if unit else val

        key = (name, value_str, date_raw)
        if key in seen:
            continue
        seen.add(key)

        labs.append({
            "name":  name,
            "value": value_str,
            "range": ref,
            "flag":  flag,
            "date":  date,
        })

    return labs


def extract_vitals(root) -> list[str]:
    """Vital signs — flatten all non-empty cells into readable lines."""
    sec = find_section(root, "8716-3")
    if sec is None:
        return []
    vitals = []
    text_el = sec.find(N("text"))
    if text_el is None:
        return []
    # Try table rows first
    rows = []
    for tbody in text_el.findall(f".//{N('tbody')}"):
        for tr in tbody.findall(N("tr")):
            cells = [td_text(td).strip() for td in tr.findall(N("td")) if td_text(td).strip()]
            if cells:
                rows.append(cells)
    if rows:
        # Typically: Date | BP | Pulse | Temp | Height | Weight | BMI | SpO2
        for row in rows:
            vitals.append("  ·  ".join(c for c in row if c))
        return vitals
    # Fallback: paragraph text
    for p in text_el.findall(f".//{N('paragraph')}"):
        t = "".join(p.itertext()).strip()
        if t:
            vitals.append(t)
    return vitals


def extract_immunizations(root) -> list[str]:
    sec = find_section(root, "11369-6")
    if sec is None:
        return []
    items = []
    for row in section_rows(sec):
        name = row[0].strip() if row else ""
        date = row[1].strip() if len(row) > 1 else ""
        if name and not name.lower().startswith("vaccine"):
            items.append(f"{name}" + (f" ({date})" if date else ""))
    return list(dict.fromkeys(items))


def extract_diagnoses(root) -> list[str]:
    # 51848-0 = Assessment, 29308-4 = Diagnosis — try both
    return extract_section(root, "51848-0", "29308-4")


def extract_plan(root) -> list[str]:
    sec = find_section(root, "18776-5")
    if sec is None:
        return []
    text_el = sec.find(N("text"))
    if text_el is None:
        return []
    items = []
    for tbody in text_el.findall(f".//{N('tbody')}"):
        for tr in tbody.findall(N("tr")):
            tds = tr.findall(N("td"))
            if not tds:
                continue
            if len(tds) >= 2:
                col1 = td_text(tds[1]).strip()
                if col1 in ("Office Visit", "Telephone", "Video Visit", "Procedure"):
                    date = td_text(tds[0]).strip()
                    items.append(f"Upcoming: {col1} — {date}")
                    continue
            name = td_text(tds[0]).strip()
            if name:
                due = td_text(tds[1]).strip() if len(tds) > 1 else ""
                items.append(f"{name}" + (f" (due {due})" if due else ""))
    return list(dict.fromkeys(items))


def extract_social_history(root) -> list[str]:
    sec = find_section(root, "29762-2")
    if sec is None:
        return []
    items = []
    for row in section_rows(sec):
        category = row[0].strip() if row else ""
        value    = row[1].strip() if len(row) > 1 else ""
        if category:
            items.append(f"{category}: {value}" if value else category)
    return list(dict.fromkeys(items))


def extract_care_team(root) -> list[str]:
    sec = find_section(root, "85847-2")
    if sec is None:
        return []
    members = []
    for row in section_rows(sec):
        name = row[0].strip() if row else ""
        role = row[1].strip() if len(row) > 1 else ""
        if name:
            members.append(f"{name}" + (f" — {role}" if role else ""))
    return list(dict.fromkeys(members))


# ── Document parser ────────────────────────────────────────────────────────────

def parse_doc(xml_bytes: bytes) -> dict | None:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return None

    enc_time = root.find(f".//{N('encompassingEncounter')}/{N('effectiveTime')}/{N('low')}")
    if enc_time is None:
        enc_time = root.find(f".//{N('encompassingEncounter')}/{N('effectiveTime')}")
    # Summary documents (no encompassingEncounter) — use document effectiveTime
    if enc_time is None:
        enc_time = root.find(N("effectiveTime"))
    date_raw = enc_time.get("value", "") if enc_time is not None else ""
    if not date_raw:
        return None

    prov_given  = root.find(f".//{N('encompassingEncounter')}//{N('assignedPerson')}/{N('name')}/{N('given')}")
    prov_family = root.find(f".//{N('encompassingEncounter')}//{N('assignedPerson')}/{N('name')}/{N('family')}")
    if prov_given is None and prov_family is None:
        # Summary doc — try author block
        prov_given  = root.find(f".//{N('author')}/{N('assignedAuthor')}/{N('assignedPerson')}/{N('name')}/{N('given')}")
        prov_family = root.find(f".//{N('author')}/{N('assignedAuthor')}/{N('assignedPerson')}/{N('name')}/{N('family')}")
    provider = " ".join(filter(None, [
        prov_given.text.strip()  if prov_given  is not None and prov_given.text  else "",
        prov_family.text.strip() if prov_family is not None and prov_family.text else "",
    ])) or "Unknown Provider"

    org_el = root.find(f".//{N('serviceProviderOrganization')}/{N('name')}")
    org = org_el.text.strip().title() if org_el is not None and org_el.text else "Unknown Org"

    doc_id = root.find(N("id"))
    uid = doc_id.get("root", "") + doc_id.get("extension", "") if doc_id is not None else date_raw + provider

    return {
        "date_raw":    date_raw,
        "date":        fmt_date(date_raw),
        "date_human":  fmt_date_human(date_raw),
        "provider":    provider,
        "org":         org,
        "uid":         uid,
        "reason":      extract_section(root, "29299-5"),
        "diagnoses":   extract_diagnoses(root),
        "problems":    extract_section(root, "11450-4"),
        "meds":        extract_medications(root),
        "allergies":   extract_allergies(root),
        "vitals":      extract_vitals(root),
        "labs":        extract_labs(root),
        "immunizations": extract_immunizations(root),
        "social_history": extract_social_history(root),
        "care_team":   extract_care_team(root),
        "plan":        extract_plan(root),
    }


# ── Provenance & document integrity ───────────────────────────────────────────

# Trust tiers:
#   verified  — fetched directly from a known EHR endpoint via SMART on FHIR
#   imported  — user-provided file/ZIP; provenance unconfirmed
#   flagged   — failed one or more integrity checks

_KNOWN_ISSUERS = {
    "epic",
    "mychart",
    "cerner",
    "athenahealth",
    "allscripts",
    "meditech",
    "nextgen",
}

_SIG_TAGS = [
    "{http://www.w3.org/2000/09/xmldsig#}Signature",
    "{urn:hl7-org:v3}signature",
]


def check_provenance(xml_bytes: bytes, root, source_zip: str) -> dict:
    """
    Analyze a C-CDA document and return provenance metadata.
    Does NOT make pass/fail decisions — just captures everything observable
    so future checks can act on it.
    """
    sha256 = hashlib.sha256(xml_bytes).hexdigest()
    size   = len(xml_bytes)
    ingest_ts = datetime.now(timezone.utc).isoformat()

    # Digital signature present?
    has_signature = any(root.find(tag) is not None for tag in _SIG_TAGS)

    # Custodian / issuing organization
    custodian_el = root.find(f".//{N('custodian')}//{N('name')}")
    custodian    = custodian_el.text.strip() if custodian_el is not None and custodian_el.text else ""

    # Detect known EHR issuer by custodian name
    custodian_lower = custodian.lower()
    known_issuer = any(k in custodian_lower for k in _KNOWN_ISSUERS)

    # Structured author device (some EHRs embed software name)
    device_el = root.find(f".//{N('author')}//{N('manufacturerModelName')}")
    device    = device_el.text.strip() if device_el is not None and device_el.text else ""

    # Creation timestamp from document header
    created_el  = root.find(N("effectiveTime"))
    doc_created = created_el.get("value", "") if created_el is not None else ""

    # Assign trust tier
    # "verified" reserved for direct FHIR pulls (not yet implemented)
    # Documents with no signature and unknown custodian are still "imported" —
    # "flagged" is reserved for active integrity failures caught by future checks
    if has_signature:
        trust = "imported+signed"
    else:
        trust = "imported"

    return {
        "trust":          trust,
        "ingest_method":  "zip_upload",
        "ingest_ts":      ingest_ts,
        "source_zip":     source_zip,
        "sha256":         sha256,
        "size_bytes":     size,
        "has_signature":  has_signature,
        "custodian":      custodian,
        "known_issuer":   known_issuer,
        "device":         device,
        "doc_created":    doc_created,
    }


TRUST_EMOJI = {
    "verified":        "🟢",
    "imported+signed": "🟡",
    "imported":        "🟡",
    "flagged":         "🔴",
}


# ── Note builder ───────────────────────────────────────────────────────────────

def build_note(d: dict) -> str:
    def section(title: str, items: list, fmt=None) -> list:
        if not items:
            return []
        lines = [f"## {title}", ""]
        for item in items:
            lines.append(f"- {fmt(item) if fmt else item}")
        lines.append("")
        return lines

    prov  = d.get("provenance", {})
    trust = prov.get("trust", "imported")
    emoji = TRUST_EMOJI.get(trust, "🟡")

    lines = [
        "---",
        f"id: encounter-{short(d['uid'])}",
        "type: Encounter",
        f"date: {d['date']}",
        f"provider: {d['provider']}",
        f"org: {d['org']}",
        f"source: encounter.ccda.xml",
        f"trust: {trust}",
        f"sha256: {prov.get('sha256', '')}",
        f"ingest_ts: {prov.get('ingest_ts', '')}",
        f"ingest_method: {prov.get('ingest_method', '')}",
        f"has_signature: {str(prov.get('has_signature', False)).lower()}",
        f"custodian: {prov.get('custodian', '')}",
        "---",
        "",
        f"# Visit — {d['date_human']}",
        f"**{d['provider']}** &nbsp;·&nbsp; {d['org']}",
        "",
    ]

    if d["reason"]:
        lines += ["## Reason for Visit", ""]
        for r in d["reason"][:3]:
            lines.append(f"> {r}")
        lines.append("")

    lines += section("Visit Diagnoses",   d["diagnoses"])
    lines += section("Active Problems",   d["problems"])
    lines += section("Medications",       d["meds"])
    lines += section("Allergies",         d["allergies"])

    if d["vitals"]:
        lines += ["## Vital Signs", ""]
        for v in d["vitals"]:
            lines.append(f"- {v}")
        lines.append("")

    if d["labs"]:
        lines += ["## Lab Results", ""]
        for lab in d["labs"]:
            flag = f" ⚠ {lab['flag']}" if lab["flag"] else ""
            ref  = f" (ref: {lab['range']})" if lab["range"] else ""
            lines.append(f"- **{lab['name']}**: {lab['value']}{ref}{flag}")
        lines.append("")

    lines += section("Immunizations",    d["immunizations"])
    lines += section("Social History",   d["social_history"])
    lines += section("Care Team",        d["care_team"])
    lines += section("Plan of Treatment",d["plan"])

    lines += ["## Notes", "", "_Your notes here._", ""]
    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    src   = Path(sys.argv[1])
    vault = Path(sys.argv[2])
    base  = vault / "records" / "encounters"
    base.mkdir(parents=True, exist_ok=True)

    if not src.exists():
        print(f"Not found: {src}"); sys.exit(1)

    # Always preserve the original source zip
    imports_dir = vault / "imports"
    imports_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    archive = imports_dir / f"{ts}-{src.name}"
    shutil.copy2(src, archive)
    print(f"Archived source: {archive.name}")

    with zipfile.ZipFile(src) as zf:
        xml_files = sorted(n for n in zf.namelist() if n.endswith(".XML") and "/DOC" in n)
        print(f"Found {len(xml_files)} documents in {src.name}\n")

        created = skipped = 0
        for name in xml_files:
            xml_bytes = zf.read(name)
            root_el = ET.fromstring(xml_bytes)
            d = parse_doc(xml_bytes)
            if d is None:
                print(f"  ⚠  {Path(name).name}  — no encounter date, skipping")
                skipped += 1
                continue

            d["provenance"] = check_provenance(xml_bytes, root_el, src.name)

            folder_name = f"{d['date']}-{d['provider'].split()[-1].lower()}-{short(d['uid'])}"
            out = base / folder_name
            out.mkdir(parents=True, exist_ok=True)

            (out / "note.md").write_text(build_note(d))
            (out / "encounter.ccda.xml").write_bytes(xml_bytes)

            prov      = d["provenance"]
            trust_ico = TRUST_EMOJI.get(prov["trust"], "🟡")
            lab_count = len(d["labs"])
            print(f"  {trust_ico}  {d['date']}  {d['provider']:25}  {d['org'][:30]}"
                  + (f"  [{lab_count} labs]" if lab_count else "")
                  + (f"  ✍ signed" if prov["has_signature"] else ""))
            created += 1

    print(f"\n{created} encounters written to {base}")
    if skipped:
        print(f"{skipped} skipped (no encounter date)")


if __name__ == "__main__":
    main()
