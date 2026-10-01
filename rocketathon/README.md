# Aikti — Patient AI Medical Assistant

A patient-facing medical decision-support assistant for the **Alkhidmat** health network in
Pakistan. A patient describes their symptoms in their own language, attaches a lab report or a
prescription photo, and gets a safety-checked, plain-language explanation they can act on.

Built for the Bano Qabil × Alibaba Cloud AI Hackathon (Alkhidmat Foundation).

> Decision support and education. Not a diagnosis, not a prescription. The system is designed to
> refuse to give treatment advice when the information is insufficient, and to escalate instead of
> reason when it detects a red flag.

---

## Models: Google Gemini, no OpenAI account

Everything runs on Gemini, reached through Google's **OpenAI-compatible endpoint**. The
`openai` package is used purely as the transport — its `AsyncOpenAI` client and the Agents
SDK's `OpenAIChatCompletionsModel`, both pointed at `generativelanguage.googleapis.com`.
No OpenAI key, no LiteLLM, no second agent runtime: the same agents, handoffs, tools and
tracing.

```python
# aikti/llm.py
client = AsyncOpenAI(api_key=GEMINI_API_KEY, base_url=gemini_base_url)
chat_model("gemini-3.8-flash")   # -> OpenAIChatCompletionsModel
```

Roles are split deliberately, and every name is env-overridable:

| Role | Default model | Used by |
| --- | --- | --- |
| `assistant` | `gemini-3.8-flash` | Medical Assistant, Pharmacy Agent |
| `safety` | `gemini-pro-latest` | **Red Flag Agent**, Medication Safety Agent |
| `vision` | `gemini-3.8-flash` | Document Reader Agent |
| `embedding` | `gemini-embedding-001` | pgvector, 1536 dims |

The `safety` role points at the `gemini-pro-latest` alias rather than a pinned pro version on
purpose: the 2.5 generation is now rejected outright for new API keys, and preview model IDs get
retired without warning, whereas the alias always resolves to the newest stable pro.

The two safety-critical agents deliberately get the **stronger** model. Spending the
expensive reasoning only on the calls where a wrong answer could hurt someone is the single
highest-leverage routing decision in this codebase.

Embeddings use `gemini-embedding-001` with Matryoshka truncation pinned to 1536 dims, which
matches the `vector(1536)` columns — so no migration changes were needed. If you switch to
`text-embedding-004` (768d), you must change the column widths in both migrations first.

### Tracing: off by default, on purpose

The Agents SDK exports traces to OpenAI by default. Its spans contain **patient messages,
lab values, and retrieved clinical guidelines**. So `TRACE_TO_OPENAI=false` and a local
console processor (`aikti/tracing.py`) is installed instead, which logs the full
agent → handoff → tool chain. `trace_id` is still generated and stored on every assessment,
triage event, and document, so any clinical claim can be reconstructed locally.

---

## The interface

Eight routes, one design system, no new dependencies.

| Route | Purpose |
| --- | --- |
| `/` | Dashboard — alerts, recent analyses, reports, profile completeness |
| `/analysis` | Five-step flow: details → symptoms → reports → review → analysis |
| `/reports` | Uploaded reports, filterable by "needs review" |
| `/reports/[id]` | Report viewer — values, reference ranges, status, interpretations |
| `/history` | Past analyses, filterable, printable |
| `/history/[id]` | A saved summary, re-readable |
| `/assistant` | Conversational follow-ups on the same session |
| `/profile` | Clinical details, language, privacy, data deletion |

Three decisions worth defending:

**The result is a document, not a chat bubble.** `ResultPanel` is a structured
medical-information page with a sticky table of contents, a confidence bar, a
print stylesheet, and numbered sections. `ResultPanel` is reused verbatim by the
analysis flow, the assistant, and history, so a summary looks identical wherever
it appears.

**Confidence never implies diagnostic certainty.** The API returns a 0–1 number;
the UI shows only a verbal band (Limited / Moderate / Good) plus the sentence
*"This reflects how complete the information you provided was — not the chance
that you have any particular condition."* Causes are labelled
Confirmed / Probable / Possible / Less likely with a legend explaining each.

**Medication verdicts can never read as a prescription.** There is no green
"safe" state — the calmest verdict is "Looks consistent", and every card ends
with a line telling the user to confirm with a doctor or pharmacist before
starting, stopping, or changing anything.

Supporting pieces: `app/globals.css` holds every colour, radius and shadow as a
CSS variable; `components/ui.tsx` is the presentational kit (no `"use client"`, so
it renders on the server); `components/interactive.tsx` holds the three stateful
primitives; `components/icons.tsx` is a hand-rolled SVG set so no icon library is
needed. Client state lives in one `useSyncExternalStore` store
(`components/CareflowProvider.tsx`) backed by `localStorage` — no account, and
`/profile` says so plainly.

Accessibility: skip link, `aria-current` on navigation, labelled controls, visible
`:focus-visible` rings, `role="switch"` toggles, `role="alert"` reserved for
genuinely urgent clinical states, status never communicated by colour alone
(every badge has a text label), and a `prefers-reduced-motion` block that
disables all animation.

---

## What it does, mapped to the spec

| Requirement | How it is implemented |
| --- | --- |
| 1. Patient information analysis | Every turn carries an explicit patient profile block. Anything unstated is rendered as *not reported*, never inferred. |
| — Lab & diagnostic reports | `Document Reader Agent` (Gemini vision) transcribes the upload, then `get_reference_range` looks up real ranges from Postgres before any number is called normal, high, or critical. A PDF is rasterised page by page to PNG (`med_agents/pdf.py`) rather than parsed, because Gemini's OpenAI-compatible endpoint only accepts images in an `image_url` part — and because showing the model the page as printed is what lets it read a report whose layout it has never seen. |
| 2. Clinical reasoning | `possible_causes[]` requires a status of `confirmed` / `probable` / `possible` plus the specific test that would settle it. Empty list is a valid, expected answer. |
| 3. Medication & treatment safety | Dedicated `Medication Safety Agent`. One entry per medicine with a verdict, reasons, contraindication checks, and `safer_alternatives` that are **generic names only, never doses**. |
| 4. Treatment guidance | General self-care only, with an explicit "discuss with a doctor" framing and a `pharmacist_question` the patient can literally ask out loud. |
| 5. Emergency detection | The `Red Flag Agent` runs **first on every turn** and gates the whole pipeline. On `is_emergency` the pipeline short-circuits: no differential, no treatment advice, just urgent-care instructions. |
| 6. Response format | `PatientAssessment` is a Pydantic model whose fields *are* the nine sections. The model is schema-constrained, and the frontend renders them in fixed order. |
| Voice or text | Browser Web Speech API in the chat composer — audio never leaves the device. |
| IMPORTANT — no fabrication | Enforced three ways: schema-constrained output, "not reported" convention in the instructions, and every claim traceable to a retrieved document. |
| — decision support | `requires_consultation` defaults true; the disclaimer is always rendered. |

---

## Architecture

```
┌─────────────── Next.js 16 + Tailwind 4 ───────────────┐
│  /chat      text + voice + report upload               │
│  /api/ask   server proxy (OpenAI key never in browser) │
└──────────────────────┬─────────────────────────────────┘
                       │ REST
┌──────────── FastAPI (Python) ────────────┐
│  med_agents/assistant.py   pipeline      │
│                                          │
│   1. Red Flag Agent ──► TriageScreen      │  ALWAYS FIRST · gemini-pro-latest
│        ├─ is_emergency ──► SHORT-CIRCUIT  │  no reasoning at all
│        └─ otherwise                        │
│   2. Medical Assistant ─► PatientAssessment│  gemini-3.8-flash
│        ├─ handoff → Medication Safety Agent│  gemini-pro-latest
│        └─ handoff → Pharmacy Agent         │
│                                          │
│   Document Reader Agent (vision)          │
│   7 @function_tool tools, all DB-backed   │
│   aikti/llm.py  Gemini via OpenAI-compat  │
└────────┬────────────────────────┬─────────┘
         │                        │
  ┌──────▼────────┐      ┌────────▼──────────┐
  │ Supabase      │      │ MongoDB Atlas     │
  │ patients      │      │ chat history      │
  │ documents     │      │ raw transcripts   │
  │ lab_results   │      │ Atlas Vector      │
  │ reference_    │      │  Search (scale)   │
  │   ranges      │      └───────────────────┘
  │ clinical_kb   │
  │ formulary     │  ── pgvector: guidelines, emergency
  │ assessments   │     protocols, reference ranges,
  │ triage_events │     formulary, patient memory
  └───────────────┘
```

**Why both databases.** Supabase Postgres holds the structured clinical record where relational
integrity, RLS and auditability matter, and `pgvector` serves every RAG lookup. MongoDB Atlas
holds the unstructured layer — chat turns, raw transcripts, camp registers — and supports Atlas
Vector Search when you outgrow one cluster's vector index.

---

## The agents

| Agent | Job | Tools |
| --- | --- | --- |
| **Red Flag** | Screen for emergencies. Runs first, gates everything. Emits `TriageScreen`. | `search_emergency_protocol`, `search_clinical_guideline` |
| **Medical Assistant** | The nine-section answer. Entry agent. | `get_patient_summary`, `get_reference_range`, `search_clinical_guideline` |
| **Medication Safety** | One verdict per medicine, with reasons. Never emits a dose. | + `check_drug_interaction`, `lookup_formulary` |
| **Pharmacy** | "Is it stocked, is there a cheaper version, is it zakat-subsidised?" | `lookup_formulary`, `search_clinical_guideline` |
| **Document Reader** | Vision transcription of reports, prescriptions, scans. | none (reads the image) |

**Structured output is validated, not assumed.** Every agent's `output_type` is enforced
through `response_format: json_schema`. The OpenAI-compat layer honours that, but its
strict-mode adherence is looser than OpenAI's own, so `_run_structured` catches
`ModelBehaviorError` and `ModelRefusalError` and retries once with an explicit
JSON-only instruction. If it still fails, the request returns 502 — an unvalidated parse
never reaches a patient.

**Nothing is answered from model memory.** Reference ranges, guideline text, and pharmacy stock
all come back from Postgres through `pgvector`. If retrieval fails, the tool returns an explicit
"unavailable" marker so the agent says it could not verify something rather than guessing.

**Every turn is auditable.** Each run emits an Agents SDK `trace_id`, stored on the assessment,
the triage event, and the document. Open it on the OpenAI Traces dashboard to watch the actual
tool-call chain live during a demo.

---

## Setup

### 1. Frontend
```bash
npm install
cp .env.example .env.local      # CAREFLOW_API_URL=http://127.0.0.1:8000
npm run dev                     # http://localhost:3000/chat
```

### 2. Supabase
Run both migrations in the SQL editor, in order:
- `supabase/migrations/20260929000001_init.sql`
- `supabase/migrations/20260929000002_patient_assistant.sql`

Then in **Project Settings > API Keys**, copy the project URL, the **secret key**
(`sb_secret_...`) and the **publishable key** (`sb_publishable_...`) into
`services/api/.env` as `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and
`SUPABASE_PUBLISHABLE_KEY`.

Do not use the legacy `anon` / `service_role` keys. They are deprecated, are no
longer issued to new projects, and are removed late 2026. If you have an older
`.env` that still uses them, the service keeps accepting them, but migrate.

### 3. MongoDB Atlas
Free M0 cluster, add your IP to the access list, then paste the standard SRV
connection string from the cluster's Connect dialog into `MONGO_URI`. SCRAM
username/password auth is still current, so nothing else is needed. Indexes are
created at startup.

### 4. Agent service
```bash
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # Windows
pip install -r requirements.txt
Copy-Item .env.example .env         # fill in the keys
python seed.py                      # 18 KB docs + 32 reference ranges + 41 medicines, embedded
uvicorn main:app --reload --port 8000
```

Check `http://localhost:8000/health` and `http://localhost:8000/docs`.

### 5. Before you demo to real patients
Set `EMERGENCY_AMBULANCE` and `EMERGENCY_CONTACT_NOTE` in `.env` to your own verified numbers.
The defaults ship as placeholders.

---

## Demo script (2 minutes)

1. Open `/chat`. Click the **cough example** (Roman Urdu) or speak into the mic.
2. The Red Flag Agent's banner appears first — watch the urgency level resolve.
3. Scroll the nine sections. The `possible_causes` entries each name the test that would settle
   them, and the `confidence` figure is honest about a thin history.
4. Upload a lab report photo. The Document Reader transcribes it; the section that follows
   compares each value to a real range from Postgres, and flags anything critical.
5. Ask *"main yeh goli khata hoon, kya ibuprofen le sakta hoon?"* — the Medication Safety
   Agent returns a verdict, the reason, and a question to ask the pharmacist.
6. Paste the **meningitis example** (child, fever, non-blanching rash) — the pipeline
   short-circuits to emergency instructions with no diagnosis at all. Contrast it with #1.
7. Switch the language selector to Urdu, and read `plain_urdu` in the lab table aloud.

---

## Data model

| Table | Purpose |
| --- | --- |
| `patients` | Profile, allergies, conditions, current medicines |
| `documents` | Uploaded reports, transcription, extracted findings |
| `lab_results` | Per-test values, status, plain-Urdu explanation |
| `reference_ranges` | Normal **and critical** ranges, with age and sex |
| `clinical_kb` | Guidelines, protocols, emergencies, patient education (`vector(1536)`) |
| `formulary` | Brand/generic, strength, price, stock (`vector(1536)`) |
| `chat_sessions` | Conversation, language, channel, last triage level |
| `assessments` | The full nine-section record + `trace_id` + latency |
| `triage_events` | Every escalation, for audit and for alerting staff |
| `facilities` / `encounters` | Network data, for the referral follow-up |

MongoDB: `chat_turns`, `transcripts`, room for `camp_registers`.

---

## Safety design decisions worth naming in the pitch

- **The gate is a separate agent, not a prompt section.** A "be careful" instruction inside the
  main prompt is advice; a separate agent that can stop the pipeline is a control.
- **Emergency short-circuits the reasoning.** No differential, no treatment advice, no
  medication suggestions. Only what to do right now.
- **Poverty never lowers urgency.** Stated explicitly in the triage instructions, because
  "can you afford to see a doctor" is the most realistic way a Pakistani patient dies at home.
- **Ambiguity escalates.** When a missing detail would change the urgency, the triage agent is
  told to choose the higher level and ask the question.
- **The pharmacy agent may not recommend anything.** It answers stock, price, and generic
  equivalence. It cannot tell a patient to take a drug.
- **Costs are capped and flagged.** The medication agent is explicitly forbidden from returning
  a dose or schedule; `safer_alternatives` is typed to hold generic names only.
- **Traces are stored.** Every clinical claim has an id that resolves to the exact tool calls
  and retrieved documents behind it — and the trace itself never leaves your infrastructure.

---

## Next 24 hours, if you want more

- **WhatsApp channel** — same `POST /api/ask`, webhook from the Business API. This is where the
  real patients are; `chat_sessions.channel` is already in the schema.
- **Stream the answer** — `Runner.run_streamed` so sections appear as they are produced
- **TTS the Urdu summary** so low-literacy patients get an audio answer
- **Referral** — on `urgent`/`emergency`, match the nearest Alkhidmat centre with live queue
  from the `facilities` table and send the patient a location
- **Staff dashboard** — the `triage_events` table is already a live queue of patients who
  need a human call back
