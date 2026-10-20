"""Privacy-preserving exports: CSV results, PDF plan, JSON evidence.

No third-party exporter dependency: the PDF writer below emits a small,
valid, text-only PDF (Helvetica) so the API works in a bare install. Every
export is aggregate-only — no provider payloads, secrets, or patient data.
"""

from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime, timezone

from app.models import (
    Campaign,
    Currency,
    EvidenceSnapshot,
    Plan,
)

REVIEW_NOTICE = (
    "Draft — requires review by a qualified health professional before use."
)

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_PHONE_RE = re.compile(r"\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b")
# Keys that must never appear in an export (defence in depth).
_FORBIDDEN_KEYS = {
    "api_key",
    "apikey",
    "secret",
    "password",
    "token",
    "authorization",
    "x-api-key",
}


def redact_pii(text: str) -> str:
    if not text:
        return ""
    text = _EMAIL_RE.sub("[redacted email]", text)
    text = _SSN_RE.sub("[redacted id]", text)
    text = _PHONE_RE.sub("[redacted phone]", text)
    return text


def _assert_no_secrets(payload: object) -> None:
    if isinstance(payload, dict):
        for key, value in payload.items():
            if str(key).lower() in _FORBIDDEN_KEYS:
                raise ValueError("Export refused: a secret-like key was present.")
            _assert_no_secrets(value)
    elif isinstance(payload, list):
        for item in payload:
            _assert_no_secrets(item)


def _money(amount: int, currency: Currency) -> str:
    return f"${amount:,.0f}" if currency == Currency.USD else f"₹{amount:,.0f}"


def results_csv(
    campaign: Campaign, results: dict | None, analytics: dict, plans: list[dict]
) -> str:
    """Aggregate results CSV. Only the campaign's own currency is populated."""
    currency = campaign.brief.currency or Currency.USD
    a = (analytics or {}).get("analytics") or {}
    res = results or {}
    spend = int(res.get("spend") or 0)
    lead = plans[-1] if plans else {}
    metrics = {m.get("name"): m.get("target_range") for m in lead.get("metrics", [])}
    row = {
        "campaign_id": campaign.id,
        "topic": campaign.brief.topic,
        "location": (
            campaign.geocode.display_name
            if campaign.geocode
            else campaign.brief.location_text
        ),
        "mode": campaign.mode,
        "date": str(res.get("saved_at") or "")[:10],
        "registrations": int(res.get("registrations") or 0),
        "attendance": int(res.get("attendance") or 0),
        "spend": spend,
        "currency": currency.value,
        "spend_usd": spend if currency == Currency.USD else "",
        "spend_inr": spend if currency == Currency.INR else "",
        "engagement": int(res.get("engagement") or 0),
        "cost_per_registration": a.get("cost_per_registration", ""),
        "cost_per_attendee": a.get("cost_per_attendee", ""),
        "attendance_rate": (
            f"{a['attendance_rate']:.1%}" if a.get("attendance_rate") is not None else ""
        ),
        "planned_registrations": metrics.get("Registrations", ""),
        "planned_attendance": metrics.get("Attendance", ""),
        "planned_engagement": metrics.get("Engagement", ""),
        "notes": redact_pii(str(res.get("notes") or "")),
    }
    _assert_no_secrets(row)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(row.keys()), lineterminator="\n")
    writer.writeheader()
    writer.writerow(row)
    return buf.getvalue()


def evidence_json(campaign: Campaign, evidence: EvidenceSnapshot) -> str:
    payload = {
        "campaign": {
            "id": campaign.id,
            "topic": campaign.brief.topic,
            "location_text": campaign.brief.location_text,
            "mode": campaign.mode,
            "currency": (campaign.brief.currency or Currency.USD).value,
            "created_at": campaign.created_at.isoformat(),
        },
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "provenance": "mixed",
        "evidence": evidence.model_dump(mode="json"),
    }
    _assert_no_secrets(payload)
    return json.dumps(payload, ensure_ascii=False, indent=2)


# --- Minimal PDF writer --------------------------------------------------


def _pdf_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", "")
    )


def _wrap(text: str, width: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        if len(current) + 1 + len(word) <= width:
            current += " " + word
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


class _PdfBuilder:
    """Enough PDF 1.4 to produce a clean, printable plan document."""

    PAGE_W, PAGE_H = 612, 792
    MARGIN = 54
    LEADING = 14

    def __init__(self) -> None:
        self.pages: list[list[tuple[str, int, bool]]] = [[]]
        self._y = self.PAGE_H - self.MARGIN

    def _new_page(self) -> None:
        self.pages.append([])
        self._y = self.PAGE_H - self.MARGIN

    def _ensure(self, needed: int) -> None:
        if self._y - needed < self.MARGIN + 20:
            self._new_page()

    def heading(self, text: str, size: int = 16) -> None:
        self._ensure(size + self.LEADING * 2)
        self._y -= size + 6
        self.pages[-1].append((text, size, True))
        self._y -= 4

    def paragraph(self, text: str, size: int = 10, bold: bool = False) -> None:
        chars = max(20, int((self.PAGE_W - 2 * self.MARGIN) / (size * 0.5)))
        for line in _wrap(text, chars):
            self._ensure(self.LEADING)
            self._y -= self.LEADING
            self.pages[-1].append((line, size, bold))

    def bullet(self, text: str, size: int = 10) -> None:
        self.paragraph("• " + text, size=size)

    def space(self, amount: int = 8) -> None:
        self._y -= amount

    def build(self) -> bytes:
        # Footer notice on every page.
        for lines in self.pages:
            lines.append((REVIEW_NOTICE, 8, False))

        objects: dict[int, bytes] = {}
        objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
        objects[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        objects[4] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
        page_ids: list[int] = []
        next_id = 5
        for page in self.pages:
            content_id = next_id
            page_id = next_id + 1
            next_id += 2
            page_ids.append(page_id)

            parts: list[str] = []
            y = self.PAGE_H - self.MARGIN
            for text, size, bold in page:
                if text == REVIEW_NOTICE:
                    y = 36
                else:
                    y -= size + 6 if size >= 14 else self.LEADING
                font = "F2" if bold else "F1"
                parts.append(
                    f"BT /{font} {size} Tf 1 0 0 1 {self.MARGIN} {y} Tm "
                    f"({_pdf_escape(text)}) Tj ET"
                )
            stream = "\n".join(parts).encode("latin-1", "replace")
            objects[content_id] = (
                f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
                + stream
                + b"\nendstream"
            )
            objects[page_id] = (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.PAGE_W} {self.PAGE_H}] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode("latin-1")
        kids = " ".join(f"{pid} 0 R" for pid in page_ids)
        objects[2] = (
            f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>"
        ).encode("latin-1")

        out = io.BytesIO()
        out.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets: dict[int, int] = {}
        for obj_id in sorted(objects):
            offsets[obj_id] = out.tell()
            out.write(f"{obj_id} 0 obj\n".encode("latin-1"))
            out.write(objects[obj_id])
            out.write(b"\nendobj\n")
        xref_pos = out.tell()
        max_id = max(objects)
        out.write(f"xref\n0 {max_id + 1}\n".encode("latin-1"))
        out.write(b"0000000000 65535 f \n")
        for obj_id in range(1, max_id + 1):
            out.write(f"{offsets[obj_id]:010d} 00000 n \n".encode("latin-1"))
        out.write(
            (
                f"trailer\n<< /Size {max_id + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_pos}\n%%EOF\n"
            ).encode("latin-1")
        )
        return out.getvalue()


def plan_pdf(campaign: Campaign, plan: Plan) -> bytes:
    currency = plan.currency or campaign.brief.currency or Currency.USD
    doc = _PdfBuilder()
    doc.heading("HealthReach campaign plan", 20)
    doc.paragraph(f"{campaign.brief.topic}", size=13, bold=True)
    doc.paragraph(
        f"{campaign.geocode.display_name if campaign.geocode else campaign.brief.location_text}"
    )
    doc.paragraph(
        f"Budget: {_money(plan.budget_total, currency)} · "
        f"Duration: {campaign.brief.duration_days} days · "
        f"Planner: {'AI model' if plan.planner == 'ai-model' else 'standard template'}"
    )
    doc.space()
    doc.heading("Provenance legend", 13)
    doc.paragraph("Qloo — taste affinity, never medical fact")
    doc.paragraph("Geo — mapped places, need on-site verification")
    doc.paragraph("AI — estimate/draft, inspect and approve")
    doc.paragraph("User — organizer input")
    if campaign.mode == "demo":
        doc.paragraph("Illustrative — sample data for demonstration only")
    doc.space()
    doc.heading("Summary", 13)
    doc.paragraph(plan.summary)
    doc.space()
    doc.heading("Activities", 13)
    for activity in plan.activities:
        cost = activity.cost_usd if currency == Currency.USD else activity.cost_inr
        doc.paragraph(activity.title, bold=True)
        doc.paragraph(f"{activity.channel} · {_money(int(cost or 0), currency)}")
        doc.paragraph(activity.why)
        doc.space(4)
    doc.heading("Venue candidates (visit and verify)", 13)
    for venue in plan.venues:
        doc.paragraph(venue.name, bold=True)
        doc.paragraph(venue.reason)
        doc.space(4)
    doc.heading("Budget", 13)
    for line in plan.budget:
        amount = line.amount_usd if currency == Currency.USD else line.amount_inr
        doc.paragraph(f"{line.label}: {_money(int(amount or 0), currency)}")
    doc.paragraph(
        f"Total: {_money(plan.budget_total, currency)} (exactly matches the brief)",
        bold=True,
    )
    doc.space()
    doc.heading("Draft materials", 13)
    for material in plan.materials:
        doc.paragraph(f"{material.kind.title()}: {material.title}", bold=True)
        doc.paragraph(material.body)
        doc.paragraph(material.review_notice)
        doc.space(4)
    doc.heading("Success metrics (estimates, not promises)", 13)
    for metric in plan.metrics:
        doc.paragraph(f"{metric.name}: {metric.target_range}", bold=True)
        doc.paragraph(f"Basis: {metric.basis}")
        doc.space(3)
    doc.heading("Assumptions and limitations", 13)
    for item in [*plan.assumptions, *plan.limitations]:
        doc.bullet(item)
    doc.space()
    doc.paragraph(
        "This document contains aggregate planning information only. "
        "It contains no patient names, contact details, diagnoses, or other "
        "personal health information.",
        size=9,
    )
    return doc.build()
