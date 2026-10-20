"""Backend-observed progress for the Qloo agent chain.

The evidence endpoint is a single long request. The workspace polls the
progress endpoint while that request is in flight; this tracker is the shared,
honest source of truth (provider requests, retries, cache hits, step status).
Nothing here is inferred from frontend polling.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import QlooProgress, QlooStepProgress


def _now() -> datetime:
    return datetime.now(timezone.utc)


class QlooProgressTracker:
    def __init__(self, campaign_id: str) -> None:
        self.campaign_id = campaign_id
        self.steps: list[QlooStepProgress] = []
        self.overall_status: str = "pending"
        self.current_step = 0
        self.total_requests = 0
        self.retries = 0
        self.cache_hits = 0
        self.requests_by_step: dict[str, int] = {}

    def _step(self, number: int) -> QlooStepProgress | None:
        for s in self.steps:
            if s.step == number:
                return s
        return None

    def begin(self, titles: dict[int, str] | None = None) -> None:
        """Start pending step cards so the UI can show the whole chain."""
        titles = titles or {
            1: "Looked at culture spots near here",
            2: "Checked what fans of the top place also like",
            3: "Double-checked with a second place",
        }
        if not self.steps:
            self.steps = [
                QlooStepProgress(step=n, title=titles.get(n, f"Step {n}"))
                for n in (1, 2, 3)
            ]
        self.overall_status = "in_progress"

    def begin_step(self, number: int, title: str) -> None:
        if not self.steps:
            self.begin()
        step = self._step(number)
        if step is None:
            step = QlooStepProgress(step=number, title=title)
            self.steps.append(step)
            self.steps.sort(key=lambda s: s.step)
        step.title = title
        step.status = "in_progress"
        step.started_at = step.started_at or _now()
        self.current_step = number
        self.overall_status = "in_progress"

    def record_request(
        self, number: int, *, cached: bool = False, retry: bool = False
    ) -> None:
        step = self._step(number)
        if step is None:
            return
        if cached:
            step.cache_hits += 1
            self.cache_hits += 1
            return
        step.requests_made += 1
        self.total_requests += 1
        self.requests_by_step[str(number)] = (
            self.requests_by_step.get(str(number), 0) + 1
        )
        if retry:
            step.retries += 1
            self.retries += 1

    def complete_step(self, number: int) -> None:
        step = self._step(number)
        if step is None:
            return
        step.status = "completed"
        step.completed_at = _now()

    def skip_step(self, number: int, reason: str) -> None:
        step = self._step(number)
        if step is None:
            return
        step.status = "skipped"
        step.skip_reason = reason
        step.completed_at = _now()

    def fail_step(self, number: int, reason: str) -> None:
        step = self._step(number)
        if step is None:
            return
        step.status = "failed"
        step.skip_reason = reason
        step.completed_at = _now()

    def finish(self, status: str | None = None) -> None:
        if status is None:
            any_ok = any(s.status == "completed" for s in self.steps)
            status = "completed" if any_ok else "failed"
        self.overall_status = status
        if self.current_step == 0:
            self.current_step = max((s.step for s in self.steps), default=0)

    def snapshot(self) -> QlooProgress:
        return QlooProgress(
            campaign_id=self.campaign_id,
            total_requests=self.total_requests,
            requests_by_step=dict(self.requests_by_step),
            retries=self.retries,
            cache_hits=self.cache_hits,
            steps=[s.model_copy(deep=True) for s in self.steps],
            overall_status=self.overall_status,  # type: ignore[arg-type]
            current_step=self.current_step,
        )
