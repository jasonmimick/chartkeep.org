#!/usr/bin/env python3
"""
chartkeep_summary.py — generate a current health snapshot from the most recent C-CDA.

Usage:
    python3 chartkeep_summary.py ./vault
"""

import sys, zipfile
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

NS = "urn:hl7-org:v3"
N  = lambda tag: f"{{{NS}}}{tag}"


def td_text(td) -> str:
    return " ".join(t.strip() for t in td.itertext() if t.strip())


def section_rows(root, loinc: str, col: int = 0) -> list[str]:
    for sec in root.findall(f".//{N('section')}"):
        code = sec.find(N("code"))
        if code is None or code.get("code") != loinc:
            continue
        text_el = sec.find(N("text"))
        if text_el is None:
            return []
        for content in text_el.findall(f".//{N('content')}"):
            t = (content.text or "").strip()
            if t:
                return [t]
        rows = []
        for tbody in text_el.findall(f".//{N('tbody')}"):
            for tr in tbody.findall(N("tr")):
                tds = tr.findall(N("td"))
                if len(tds) > col:
                    val = td_text(tds[col]).strip()
                    if val:
                        rows.append(val)
        return list(dict.fromkeys(rows))
    return []


def active_meds(root) -> list[str]:
    for sec in root.findall(f".//{N('section')}"):
        code = sec.find(N("code"))
        if code is None or code.get("code") != "10160-0":
            continue
        text_el = sec.find(N("text"))
        if text_el is None:
            return []
        meds = []
        for tbody in text_el.findall(f".//{N('tbody')}"):
            for tr in tbody.findall(N("tr")):
                if "Historic" in tr.get("styleCode", ""):
                    continue
                tds = tr.findall(N("td"))
                if tds:
                    name = td_text(tds[0]).strip()
                    sig  = td_text(tds[1]).strip() if len(tds) > 1 else ""
                    if name:
                        meds.append(f"{name}" + (f" — {sig}" if sig else ""))
        return list(dict.fromkeys(meds))
    return []


def fmt(d: str) -> str:
    try:
        return datetime.strptime(d[:8], "%Y%m%d").strftime("%B %-d, %Y")
    except Exception:
        return d


def build_summary(root, source_date: str, provider: str, org: str) -> str:
    import re
    problems  = section_rows(root, "11450-4")
    meds      = active_meds(root)
    allergies = [a for a in section_rows(root, "48765-2")
                 if not re.search(r"no\s+known", a, re.I)]

    def section(title, icon, items):
        if not items:
            return []
        lines = [f"## {icon} {title}", ""]
        for item in items:
            lines.append(f"- {item}")
        lines += [""]
        return lines

    lines = [
        "---",
        "type: HealthSummary",
        f"as_of: {source_date}",
        f"source_provider: {provider}",
        "---",
        "",
        "# Health Summary",
        f"_Current snapshot as of **{fmt(source_date.replace('-',''))}** — {provider}, {org}_",
        "_Pull from most recent visit. Re-run `chartkeep_summary.py` after each new ingest._",
        "",
        "---",
        "",
    ]

    lines += section("Active Problems", "🩺", problems)
    lines += section("Current Medications", "💊", meds)
    lines += section("Allergies", "⚠️", allergies)

    lines += [
        "## 📋 Notes",
        "",
        "_Your personal health notes here._",
        "",
    ]

    return "\n".join(lines)


def main():
    vault = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("./vault")
    enc_base = vault / "records" / "encounters"

    if not enc_base.exists():
        print("No encounters found. Run chartkeep_ccda_ingest.py first.")
        sys.exit(1)

    # Find most recent encounter by folder date prefix
    folders = sorted(enc_base.glob("*/encounter.ccda.xml"), reverse=True)
    if not folders:
        print("No C-CDA files found in encounters.")
        sys.exit(1)

    most_recent = folders[0]
    folder      = most_recent.parent
    print(f"Using most recent encounter: {folder.name}")

    xml_bytes = most_recent.read_bytes()
    root      = ET.fromstring(xml_bytes)

    # Pull provider + org from note frontmatter (already parsed)
    note_lines = (folder / "note.md").read_text().splitlines()
    meta = {}
    in_fm = False
    for line in note_lines:
        if line == "---":
            if not in_fm:
                in_fm = True; continue
            else: break
        if in_fm and ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    out = vault / "summary.md"
    out.write_text(build_summary(root, meta.get("date",""), meta.get("provider",""), meta.get("org","")))
    print(f"Summary written → {out}")


if __name__ == "__main__":
    main()
