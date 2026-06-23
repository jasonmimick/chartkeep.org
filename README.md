# Chartkeep

**Own your health records.**

Chartkeep is an open source personal health record vault. It ingests health data exports from Epic, Cerner, Apple Health, and other providers and turns them into a local-first vault you fully control — readable forever, with or without any cloud service.

> "Your hospital gives you a ZIP file of XML. Chartkeep turns it into something you can actually use."

## What it does

- Ingests **C-CDA / IHE XDM** exports (Epic MyChart, Albany Med, Trinity Health, etc.)
- Ingests **DICOM** imaging CDs
- Builds a local **vault/** folder of Markdown notes + structured data
- Runs a local web app to browse labs, visits, imaging, medications
- Parses lab results with reference ranges, trend charts, and severity flags
- Works 100% offline — your data never leaves your machine

## Quick start

```bash
git clone https://github.com/jasonmimick/chartkeep.org
cd chartkeep.org

# Install Python dependencies
pip3 install -r requirements.txt

# Ingest a health export ZIP (Epic MyChart, Albany Med, etc.)
python3 chartkeep_ccda_ingest.py ~/Downloads/MyHealthExport.zip vault/

# Run the local web app
cd app && uvicorn main:app --port 8765 &
cd frontend && npm install && npm run dev
```

Then open http://localhost:5173

## Vault format

Each record is a pair of files:

```
vault/records/encounters/2026-05-26-barraclough/
  note.md            ← human-readable, freely editable
  encounter.ccda.xml ← original source document
```

The vault is plain files. No database, no lock-in. Back it up with any tool you already use.

## Supported formats

| Format | Source | Status |
|--------|--------|--------|
| C-CDA (Epic/MyChart) | Epic EHR | ✅ |
| IHE XDM (Albany Med, Trinity) | Non-Epic EHR | ✅ |
| DICOM CD | Radiology | ✅ |
| Apple Health FHIR | iOS Health app | 🔜 |
| HL7 v2 | Labs | 🔜 |

## Project structure

```
chartkeep_ccda_ingest.py   ← parse C-CDA/IHE XDM exports into vault
chartkeep_ingest.py        ← DICOM CD ingestion
chartkeep_previews.py      ← render DICOM preview images
chartkeep_summary.py       ← generate health summary from vault
chartkeep_annotations.py   ← patient corrections / annotation layer
app/
  main.py                  ← FastAPI backend
  frontend/                ← React + Vite web UI
```

## Philosophy

- **Local first.** The vault lives on your machine. No account required.
- **Open formats.** Markdown + standard health data formats. Readable in 20 years.
- **You own it.** Export your data from your hospital. Keep it. Leave any service and still have your records.
- **No lock-in.** Chartkeep is MIT licensed. Fork it, modify it, build on it.

## Sponsored by

Chartkeep is sponsored by [Sandbox Industries](https://sandboxindustries.io), builders of CareHub — a care coordination platform built on open health data standards.

## Contributing

PRs welcome. The most valuable contributions right now:
- Parsers for additional C-CDA variants
- Apple Health FHIR import
- Better DICOM support
- More lab reference ranges

## License

MIT
