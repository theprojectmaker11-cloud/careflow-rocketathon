"use client";

import { Icon } from "../../components/icons";
import { useCareflow } from "../../components/CareflowProvider";
import {
  Alert,
  Button,
  Card,
  Disclaimer,
  Divider,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Select,
  Skeleton,
  Toggle,
} from "../../components/ui";
import { LANGUAGES, fullDate, relativeTime } from "../../lib/format";

export default function ProfilePage() {
  const { state, updateProfile, updateSettings, clearAll } = useCareflow();
  const { profile, settings, documents, analyses, turns } = state;

  if (!state.ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Your details and preferences"
        description="CareFlow uses these to make its summaries safer. The more it knows about you, the more it can flag things that matter."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-6">
          {/* ------------------------------------------------ identity */}
          <section>
            <SectionTitle icon="user">About you</SectionTitle>
            <Card>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Full name" htmlFor="pf-name">
                  <Input
                    id="pf-name"
                    value={profile.full_name}
                    placeholder="e.g. Ayesha Khan"
                    onChange={(e) => updateProfile({ full_name: e.target.value })}
                  />
                </Field>
                <Field label="Age" htmlFor="pf-age" hint="Reference ranges differ by age">
                  <Input
                    id="pf-age"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    value={profile.age ?? ""}
                    placeholder="e.g. 34"
                    onChange={(e) =>
                      updateProfile({ age: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
                <Field label="Sex" htmlFor="pf-sex">
                  <Select
                    id="pf-sex"
                    value={profile.sex ?? ""}
                    onChange={(e) =>
                      updateProfile({ sex: (e.target.value || null) as typeof profile.sex })
                    }
                  >
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Weight" htmlFor="pf-weight" hint="kg">
                  <Input
                    id="pf-weight"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={profile.weight_kg ?? ""}
                    placeholder="e.g. 62"
                    onChange={(e) =>
                      updateProfile({ weight_kg: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
                <Field
                  label="Medical record number (MRN)"
                  htmlFor="pf-mrn"
                  hint="Optional. Lets CareFlow match existing records."
                  className="sm:col-span-2"
                >
                  <Input
                    id="pf-mrn"
                    value={profile.mrn}
                    placeholder="e.g. MRN-2291"
                    onChange={(e) => updateProfile({ mrn: e.target.value })}
                  />
                </Field>
              </div>
            </Card>
          </section>

          {/* ---------------------------------------------- clinical */}
          <section>
            <SectionTitle
              icon="pill"
              description="CareFlow cross-checks these against your reports and against each other."
            >
              Health information
            </SectionTitle>
            <Card>
              <div className="space-y-4 p-5">
                <Field
                  label="Allergies"
                  htmlFor="pf-allergies"
                  hint="Separate with commas. This is the most safety-critical field on the page."
                >
                  <Input
                    id="pf-allergies"
                    value={profile.allergies.join(", ")}
                    placeholder="e.g. Penicillin, Sulfa, Aspirin"
                    onChange={(e) =>
                      updateProfile({
                        allergies: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Current medicines" htmlFor="pf-meds" hint="Name, and dose if known">
                  <Input
                    id="pf-meds"
                    value={profile.current_meds.join(", ")}
                    placeholder="e.g. Metformin 500mg, Atorvastatin 10mg"
                    onChange={(e) =>
                      updateProfile({
                        current_meds: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Long-term conditions"
                  htmlFor="pf-chronic"
                  hint="e.g. Type 2 diabetes, hypertension, asthma"
                >
                  <Input
                    id="pf-chronic"
                    value={profile.chronic.join(", ")}
                    placeholder="e.g. Hypertension"
                    onChange={(e) =>
                      updateProfile({
                        chronic: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>

                <div
                  className={
                    profile.is_pregnant || profile.is_breastfeeding
                      ? "flex flex-col gap-3 rounded-card border border-warn-line bg-warn-soft/50 p-4 sm:flex-row sm:gap-6"
                      : "rounded-card border border-line bg-sunken/60 p-4"
                  }
                >
                  <label className="flex items-center gap-2.5 text-[14px] text-ink">
                    <input
                      type="checkbox"
                      checked={profile.is_pregnant}
                      onChange={(e) => updateProfile({ is_pregnant: e.target.checked })}
                      className="h-4 w-4 rounded border-line-strong accent-[var(--warn)]"
                    />
                    Currently pregnant
                  </label>
                  <label className="flex items-center gap-2.5 text-[14px] text-ink">
                    <input
                      type="checkbox"
                      checked={profile.is_breastfeeding}
                      onChange={(e) => updateProfile({ is_breastfeeding: e.target.checked })}
                      className="h-4 w-4 rounded border-line-strong accent-[var(--warn)]"
                    />
                    Currently breastfeeding
                  </label>
                </div>

                {profile.allergies.length === 0 ? (
                  <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-warn-text">
                    <Icon name="alert" size={14} className="mt-px shrink-0" />
                    No allergies recorded. Without them, CareFlow cannot warn you about a
                    medicine that may not suit you.
                  </p>
                ) : null}
              </div>
            </Card>
          </section>

          {/* --------------------------------------------- preferences */}
          <section>
            <SectionTitle icon="translate">Preferences</SectionTitle>
            <Card>
              <div className="p-5">
                <Field
                  label="Language for AI responses"
                  htmlFor="pf-lang"
                  hint="Reports and results stay in the language of the document."
                >
                  <Select
                    id="pf-lang"
                    value={settings.language}
                    onChange={(e) =>
                      updateSettings({
                        language: e.target.value as typeof settings.language,
                      })
                    }
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.native} ({l.label})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Divider className="my-3" />

                <Toggle
                  id="pf-listen"
                  label="Use voice input by default"
                  description="Shows the microphone as the primary input on the assistant screen."
                  checked={settings.auto_listen}
                  onChange={(auto_listen) => updateSettings({ auto_listen })}
                />
                <Divider className="my-1" />
                <Toggle
                  id="pf-history"
                  label="Save my analyses on this device"
                  description="Turning this off clears past summaries from this browser when you next analyse."
                  checked={settings.keep_history}
                  onChange={(keep_history) => updateSettings({ keep_history })}
                />
              </div>
            </Card>
          </section>
        </div>

        {/* ------------------------------------------------------ aside */}
        <aside className="space-y-5">
          <Card>
            <div className="p-5">
              <h2 className="text-[14.5px] font-semibold text-ink">Your data</h2>
              <dl className="mt-3 space-y-2.5 text-[13.5px]">
                {[
                  { label: "Reports uploaded", value: documents.length },
                  { label: "Analyses saved", value: analyses.length },
                  { label: "Messages sent", value: turns.filter((t) => t.role === "user").length },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="font-semibold tabular-nums text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {analyses.length ? (
                <p className="mt-3 text-[12px] text-faint">
                  Oldest: {fullDate(analyses[analyses.length - 1].created_at)} (
                  {relativeTime(analyses[analyses.length - 1].created_at)})
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="p-5">
              <h2 className="text-[14.5px] font-semibold text-ink">Privacy</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Everything you enter is stored in this browser and sent to the CareFlow analysis
                service only when you run an analysis. There is no account, and CareFlow does not
                sell or share your health information.
              </p>
              <Alert tone="info" className="mt-3">
                If you are using a shared or public computer, clear your data when you are done.
              </Alert>
              <Button
                tone="danger"
                icon="trash"
                className="mt-4 w-full"
                onClick={() => {
                  if (window.confirm("Delete your profile, reports, history and chats from this browser?")) {
                    clearAll();
                  }
                }}
              >
                Delete everything
              </Button>
            </div>
          </Card>

          <Card className="bg-sunken/60">
            <div className="p-5">
              <h2 className="text-[14.5px] font-semibold text-ink">Important</h2>
              <Disclaimer className="mt-2" />
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                If you think you are having a medical emergency, call your local emergency number
                now rather than waiting for an app.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
