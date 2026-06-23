#!/usr/bin/env python3
"""
chartkeep_annotations.py — patient annotation layer (Layer 2).

AnnotationStore is the portable backend abstraction:
  - Chartkeep: backed by vault/patient/annotations.json
  - CareHub:   backed by PostgreSQL (same interface, different implementation)

Schema: see docs/annotation-layer.md
"""

import hashlib, json, uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

TARGET_TYPES = Literal[
    "problem", "medication", "allergy", "lab",
    "immunization", "encounter", "imaging_study", "vital"
]

ACTIONS = Literal["resolve", "dispute", "suppress", "note", "tag", "correct", "restore"]

SENSITIVE_CATEGORIES = Literal["mental_health", "substance_use", "reproductive", "hiv"]


def target_id(target_type: str, display_name: str) -> str:
    """Stable content-addressed ID for a health item across reimports."""
    key = f"{target_type}:{display_name.lower().strip()}"
    return "tgt-" + hashlib.sha1(key.encode()).hexdigest()[:12]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_store(patient_id: str = "local") -> dict:
    return {
        "schema_version": "1.0",
        "patient_id": patient_id,
        "annotations": [],
    }


class AnnotationStore:
    """
    Read/write patient annotations from a JSON file.

    Designed so the interface can be reimplemented against PostgreSQL for CareHub
    without changing any caller code. The projection helpers (apply_to_problems,
    apply_to_items) live here so they're shared between local and SaaS.
    """

    def __init__(self, vault_path: Path, patient_id: str = "local"):
        self._path = vault_path / "patient" / "annotations.json"
        self._patient_id = patient_id
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def _load(self) -> dict:
        if self._path.exists():
            return json.loads(self._path.read_text())
        return _empty_store(self._patient_id)

    def _save(self, store: dict) -> None:
        self._path.write_text(json.dumps(store, indent=2))

    # ── Read ──────────────────────────────────────────────────────────────────

    def all(self) -> list[dict]:
        return self._load()["annotations"]

    def for_target(self, tid: str) -> dict | None:
        """Return the current (most recent, non-superseded) annotation for a target."""
        annotations = [
            a for a in self.all()
            if a["target_id"] == tid and a.get("supersedes_id") is None or
               not any(b.get("supersedes_id") == a["id"] for b in self.all())
        ]
        # Filter to truly active (not superseded by another annotation)
        superseded_ids = {a.get("supersedes_id") for a in self.all() if a.get("supersedes_id")}
        active = [a for a in self.all()
                  if a["target_id"] == tid and a["id"] not in superseded_ids]
        if not active:
            return None
        return sorted(active, key=lambda a: a["updated_at"])[-1]

    def active_map(self) -> dict[str, dict]:
        """Return {target_id: annotation} for all currently active annotations."""
        superseded_ids = {a.get("supersedes_id") for a in self.all() if a.get("supersedes_id")}
        result = {}
        for ann in sorted(self.all(), key=lambda a: a["updated_at"]):
            if ann["id"] not in superseded_ids:
                result[ann["target_id"]] = ann
        return result

    # ── Write ─────────────────────────────────────────────────────────────────

    def annotate(
        self,
        ttype: str,
        display: str,
        action: str,
        *,
        encounter_folder: str = "",
        patient_status: str = "",
        resolved_date: str = "",
        reason: str = "",
        note: str = "",
        suppressed: bool = False,
        sensitive_category: str = "",
        share_default: bool = True,
        supersedes_id: str = "",
    ) -> dict:
        tid  = target_id(ttype, display)
        now  = _now()
        ann  = {
            "id":               "ann-" + str(uuid.uuid4())[:8],
            "created_at":       now,
            "updated_at":       now,
            "patient_id":       self._patient_id,
            "target_type":      ttype,
            "target_id":        tid,
            "target_ref": {
                "display":          display,
                "encounter_folder": encounter_folder,
            },
            "action":           action,
            "patient_status":   patient_status,
            "resolved_date":    resolved_date,
            "reason":           reason,
            "note":             note,
            "consent": {
                "suppressed":         suppressed,
                "sensitive_category": sensitive_category or None,
                "share_default":      share_default,
            },
            "supersedes_id":    supersedes_id or None,
        }
        store = self._load()
        store["annotations"].append(ann)
        self._save(store)
        return ann

    def update(self, ann_id: str, **kwargs) -> dict:
        """Supersede an existing annotation with an updated version."""
        old = next((a for a in self.all() if a["id"] == ann_id), None)
        if old is None:
            raise KeyError(f"Annotation {ann_id} not found")
        return self.annotate(
            ttype=old["target_type"],
            display=old["target_ref"]["display"],
            action=kwargs.get("action", old["action"]),
            encounter_folder=old["target_ref"].get("encounter_folder", ""),
            patient_status=kwargs.get("patient_status", old.get("patient_status", "")),
            resolved_date=kwargs.get("resolved_date", old.get("resolved_date", "")),
            reason=kwargs.get("reason", old.get("reason", "")),
            note=kwargs.get("note", old.get("note", "")),
            suppressed=kwargs.get("suppressed", old["consent"]["suppressed"]),
            sensitive_category=kwargs.get("sensitive_category", old["consent"].get("sensitive_category") or ""),
            share_default=kwargs.get("share_default", old["consent"]["share_default"]),
            supersedes_id=ann_id,
        )

    def restore(self, tid: str) -> dict:
        """Remove the active annotation for a target (restore to source record)."""
        existing = self.for_target(tid)
        if not existing:
            raise KeyError(f"No active annotation for target {tid}")
        return self.annotate(
            ttype=existing["target_type"],
            display=existing["target_ref"]["display"],
            action="restore",
            supersedes_id=existing["id"],
        )

    # ── Projection helpers ────────────────────────────────────────────────────

    def apply_to_problems(self, problems: list[str]) -> dict:
        """
        Merge annotations into a problem list.

        Returns:
            {
                "active":   [...],   # problems patient considers active
                "resolved": [...],   # patient-marked resolved (with metadata)
                "disputed": [...],   # patient-contested
                "suppressed": [...], # hidden (suppressed=true), included for audit
            }
        """
        amap = self.active_map()
        result = {"active": [], "resolved": [], "disputed": [], "suppressed": []}

        for p in problems:
            tid = target_id("problem", p)
            ann = amap.get(tid)

            if ann is None:
                result["active"].append({"display": p, "annotation": None})
                continue

            if ann["consent"]["suppressed"]:
                result["suppressed"].append({"display": p, "annotation": ann})
                continue

            status = ann.get("patient_status") or ann["action"]
            if status in ("resolve", "resolved"):
                result["resolved"].append({"display": p, "annotation": ann})
            elif status in ("dispute", "disputed"):
                result["disputed"].append({"display": p, "annotation": ann})
            else:
                result["active"].append({"display": p, "annotation": ann})

        return result

    def apply_to_items(self, items: list[str], ttype: str) -> list[dict]:
        """
        Generic annotation merge for medications, allergies, etc.
        Returns items with annotation metadata attached; suppressed items excluded.
        """
        amap = self.active_map()
        result = []
        for item in items:
            tid = target_id(ttype, item)
            ann = amap.get(tid)
            if ann and ann["consent"]["suppressed"]:
                continue
            result.append({"display": item, "annotation": ann})
        return result
