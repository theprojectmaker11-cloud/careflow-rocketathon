"use client";

/**
 * The conversational surface. It is intentionally NOT a ChatGPT clone:
 * responses render as the same structured ResultPanel used everywhere else, and
 * the composer keeps the user's context (profile + uploaded reports) visible.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "../../components/icons";
import { AnalysisLoading } from "../../components/AnalysisLoading";
import { ResultPanel } from "../../components/ResultPanel";
import { UploadPanel } from "../../components/UploadPanel";
import { useCareflow } from "../../components/CareflowProvider";
import {
  Alert,
  Badge,
  Button,
  Card,
  Disclaimer,
  EmptyState,
  IconButton,
  PageHeader,
  Skeleton,
  Spinner,
  Textarea,
  cx,
} from "../../components/ui";
import { askAssistant, newTurn } from "../../lib/api";
import { FOLLOW_UPS, clockTime, truncate } from "../../lib/format";
import type { StoredAnalysis } from "../../lib/types";

export default function AssistantPage() {
  // useSearchParams() requires a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={<AssistantSkeleton />}>
      <AssistantThread />
    </Suspense>
  );
}

function AssistantSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading assistant">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40 w-full rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
    </div>
  );
}

function AssistantThread() {
  const params = useSearchParams();
  const { state, addTurn, updateTurn, addAnalysis, setSessionId } = useCareflow();
  const [draft, setDraft] = useState(() => params.get("q") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const turns = state.turns;


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (content.length < 3 || busy) return;

    setDraft("");
    setError(null);
    setBusy(true);

    const userTurn = newTurn("user", content, {
      document_ids: state.documents.map((d) => d.id),
    });
    addTurn(userTurn);

    const botId = newTurn("assistant", "", { pending: true });
    addTurn(botId);

    try {
      const res = await askAssistant({
        message: content,
        language: state.settings.language,
        session_id: state.session_id || null,
        document_ids: state.documents.map((d) => d.id),
        patient: {
          full_name: state.profile.full_name || null,
          age: state.profile.age,
          sex: state.profile.sex,
          allergies: state.profile.allergies,
          chronic: state.profile.chronic,
          current_meds: state.profile.current_meds,
          is_pregnant: state.profile.is_pregnant || null,
          is_breastfeeding: state.profile.is_breastfeeding || null,
        },
      });

      if (res.session_id) setSessionId(res.session_id);

      updateTurn(botId.id, {
        message: res.assessment.patient_summary,
        response: res,
        pending: false,
      });

      const entry: StoredAnalysis = {
        id: res.assessment_id ?? `${res.session_id}-${Date.now()}`,
        created_at: new Date().toISOString(),
        session_id: res.session_id,
        question: content,
        triage: res.triage,
        assessment: res.assessment,
        document_ids: state.documents.map((d) => d.id),
        document_names: state.documents.map((d) => d.file_name),
      };
      addAnalysis(entry);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      updateTurn(botId.id, { message: "", error: message, pending: false });
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  /** Browser Speech Recognition — optional enhancement, never required. */
  function toggleDictation() {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!Ctor) {
      setError("This browser does not support voice input. You can type instead.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = state.settings.language === "en" ? "en-PK" : "ur-PK";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
      setError("Voice input stopped unexpectedly. You can continue typing.");
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  const attachments = state.documents;

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col">
      <PageHeader
        eyebrow="Assistant"
        title="Ask about your health"
        description="CareFlow keeps your uploaded reports and profile in view, so follow-up questions build on what it already knows."
        actions={
          attachments.length ? (
            <Badge tone="primary" icon="file">
              {attachments.length} {attachments.length === 1 ? "report" : "reports"} in context
            </Badge>
          ) : undefined
        }
      />

      <div className="mt-5 flex flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* -------------------------------------------------- thread */}
        <div className="order-2 flex min-w-0 flex-1 flex-col lg:order-1">
          <div className="flex-1 space-y-5">
            {turns.length === 0 ? (
              <EmptyState
                icon="chat"
                title="Ask anything about your health"
                body="CareFlow is best at explaining test results, understanding symptoms, and checking whether the medicines you take might interact."
                className="py-8"
              />
            ) : null}

            {turns.map((turn) => (
              <div key={turn.id} className="space-y-2">
                {/* user */}
                {turn.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-card rounded-br-[6px] bg-primary px-4 py-3 text-[14.5px] leading-relaxed text-inverse">
                      {turn.message}
                    </div>
                  </div>
                ) : (
                  /* assistant */
                  <div className="min-w-0">
                    {turn.pending ? (
                      <Card>
                        <AnalysisLoading compact />
                      </Card>
                    ) : turn.error ? (
                      <Alert tone="alert" title="I could not complete that">
                        {turn.error}
                      </Alert>
                    ) : turn.response ? (
                      <ResultPanel
                        assessment={turn.response.assessment}
                        triage={turn.response.triage}
                        question={turns[turns.indexOf(turn) - 1]?.message}
                        documentNames={attachments.map((d) => d.file_name)}
                        citations={turn.response.citations}
                        traceId={turn.response.trace_id}
                        onFollowUp={(q) => void send(q)}
                      />
                    ) : null}
                  </div>
                )}
                <p
                  className={cx(
                    "text-[11.5px] text-faint",
                    turn.role === "user" ? "text-right" : "text-left",
                  )}
                >
                  {clockTime(turn.created_at)}
                </p>
              </div>
            ))}

            {error ? (
              <Alert tone="alert" title="Something went wrong" action={<Button size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
                {error}
              </Alert>
            ) : null}

            <div ref={endRef} />
          </div>

          {/* ------------------------------------------- composer */}
          <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-background via-background to-transparent pt-3">
            <Card className="p-3 shadow-raised">
              <label htmlFor="cf-composer" className="sr-only">
                Describe your symptoms or ask a question
              </label>
              <Textarea
                id="cf-composer"
                ref={textareaRef}
                rows={2}
                value={draft}
                placeholder="Describe your symptoms, or ask about a result…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                className="resize-none border-0 bg-transparent px-2 py-1.5 focus:ring-0"
              />

              <div className="mt-2 flex items-center gap-2 border-t border-line pt-2.5">
                <IconButton
                  name="upload"
                  label="Attach a test report"
                  onClick={() => setShowUpload((v) => !v)}
                  className={showUpload ? "bg-primary-soft text-primary" : ""}
                />
                <IconButton
                  name={listening ? "activity" : "mic"}
                  label={listening ? "Stop voice input" : "Start voice input"}
                  onClick={toggleDictation}
                  className={listening ? "bg-alert-soft text-alert" : ""}
                />
                {listening ? (
                  <span className="flex items-center gap-1.5 text-[12.5px] text-alert-text">
                    <Spinner size={12} />
                    Listening…
                  </span>
                ) : null}
                {busy ? <span className="text-[12.5px] text-muted">CareFlow is thinking…</span> : null}

                <Button
                  tone="primary"
                  icon="send"
                  onClick={() => void send()}
                  loading={busy}
                  disabled={draft.trim().length < 3}
                  className="ml-auto"
                >
                  Send
                </Button>
              </div>
            </Card>

            <Disclaimer className="mt-2.5 px-1" compact />
          </div>
        </div>

        {/* ---------------------------------------------------- aside */}
        <aside className="order-1 space-y-4 lg:order-2 lg:w-[268px] lg:shrink-0 lg:sticky lg:top-6">
          <Card>
            <div className="p-4">
              <h2 className="text-[14px] font-semibold text-ink">Suggested questions</h2>
              <ul className="mt-3 space-y-1.5">
                {FOLLOW_UPS.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => void send(q)}
                      disabled={busy}
                      className="flex w-full items-start gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-left text-[13px] leading-snug text-muted hover:border-primary-line hover:bg-primary-soft hover:text-primary-text disabled:opacity-50"
                    >
                      <Icon name="chat" size={13} className="mt-0.5 shrink-0 text-faint" />
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {showUpload ? (
            <Card>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-ink">Add a report</h2>
                  <IconButton name="x" label="Close" onClick={() => setShowUpload(false)} />
                </div>
                <UploadPanel
                  compact
                  mrn={state.profile.mrn || undefined}
                  age={state.profile.age ?? undefined}
                  onUploaded={() => setShowUpload(false)}
                />
              </div>
            </Card>
          ) : attachments.length ? (
            <Card>
              <div className="p-4">
                <h2 className="text-[14px] font-semibold text-ink">In context</h2>
                <ul className="mt-3 space-y-2">
                  {attachments.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2.5">
                      <Icon name="file" size={14} className="shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                        {doc.file_name}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-faint">
                        {doc.findings.length}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                  {truncate(
                    "CareFlow sends these to the analysis service with every message in this conversation.",
                    120,
                  )}
                </p>
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
