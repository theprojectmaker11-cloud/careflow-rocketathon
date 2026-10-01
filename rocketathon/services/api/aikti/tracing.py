"""Tracing.

The Agents SDK ships traces to OpenAI by default. That is the wrong default for
this app: the spans contain patient messages, lab values, and retrieved clinical
guidelines. So OpenAI export is off, and we install a local processor that logs
the tool-call chain instead.

The trace_id is still generated and still stored on every assessment, triage
event and document, so a clinical claim can always be reconstructed locally.
"""

from __future__ import annotations

import logging
import uuid

from agents import add_trace_processor, set_tracing_disabled

from aikti.config import get_settings

log = logging.getLogger("aikti.tracing")


def new_trace_id() -> str:
    """Mint a correlation id for one agent run.

    The SDK used to hang the trace id off `RunResult.trace_id`, but that
    attribute no longer exists (openai-agents 0.22 removed it) and
    `get_current_trace()` is already None by the time `Runner.run` returns,
    because the run's trace scope has closed. So the app owns the id: it is
    generated per run, passed through `RunConfig.trace_metadata` so it still
    lands in the local trace log, and stored on the triage, assessment and
    document rows. That is what makes a clinical claim reconstructable offline.
    """
    return uuid.uuid4().hex

_ICON = {
    "agent": "agent",
    "generation": "model",
    "function": "tool",
    "handoff": "handoff",
    "guardrail": "guardrail",
    "mcp_tools": "mcp",
    "custom_span": "span",
    "speech": "speech",
    "transcription": "stt",
}


class ConsoleTraceProcessor:
    """Minimal local exporter. Logs the agent/handoff/tool chain for a run."""

    def on_trace_start(self, trace) -> None:  # noqa: ANN001
        log.info("trace start: %s", getattr(trace, "trace_id", "?"))

    def on_trace_end(self, trace) -> None:  # noqa: ANN001
        log.info("trace end:   %s", getattr(trace, "trace_id", "?"))

    def on_span_start(self, span) -> None:  # noqa: ANN001
        data = getattr(span, "span_data", None)
        kind = _ICON.get(getattr(data, "type", ""), "span")
        name = getattr(data, "name", "") or kind
        log.info("  [%s] start %s", kind, name)

    def on_span_end(self, span) -> None:  # noqa: ANN001
        data = getattr(span, "span_data", None)
        kind = _ICON.get(getattr(data, "type", ""), "span")
        name = getattr(data, "name", "") or kind
        error = getattr(span, "error", None)
        suffix = f" ERROR: {error}" if error else ""
        log.info("  [%s] end   %s%s", kind, name, suffix)

    def shutdown(self) -> None:
        log.info("trace processor shut down")

    def force_flush(self) -> None:
        return None


def configure_tracing() -> None:
    settings = get_settings()
    set_tracing_disabled(not settings.trace_to_openai)
    if settings.trace_console and not settings.trace_to_openai:
        add_trace_processor(ConsoleTraceProcessor())
        log.info("tracing: local console processor active, OpenAI export disabled")
