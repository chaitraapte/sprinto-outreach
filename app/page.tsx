"use client";

import { useState } from "react";

const DEMO_DOMAINS = ["cal.com", "hasura.io", "zluri.com", "thoughtworks.com", "hubspot.com", "drata.com"];

type RunLog = any;

const STATUS: Record<string, { color: string; soft: string; label: string }> = {
  QUALIFIED: { color: "var(--success)", soft: "var(--success-soft)", label: "Qualified" },
  QUALIFIED_FLAGGED: { color: "var(--warning)", soft: "var(--warning-soft)", label: "Qualified · flagged" },
  DROPPED: { color: "var(--danger)", soft: "var(--danger-soft)", label: "Dropped" },
  MANUAL_REVIEW: { color: "var(--text-muted)", soft: "var(--muted-soft)", label: "Manual review" },
  FAILED: { color: "var(--danger)", soft: "var(--danger-soft)", label: "Failed" },
};

function statusOf(disposition: string) {
  return STATUS[disposition] ?? { color: "var(--text-muted)", soft: "var(--muted-soft)", label: disposition };
}

function Dot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0 }} />;
}

function StatusPill({ disposition }: { disposition: string }) {
  const s = statusOf(disposition);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: s.soft,
        color: s.color,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      <Dot color={s.color} />
      {s.label}
    </span>
  );
}

function VerdictPill({ verdict }: { verdict: string }) {
  const map: Record<string, { color: string; soft: string }> = {
    pass: { color: "var(--success)", soft: "var(--success-soft)" },
    fail: { color: "var(--danger)", soft: "var(--danger-soft)" },
    unresolved: { color: "var(--warning)", soft: "var(--warning-soft)" },
  };
  const s = map[verdict] ?? { color: "var(--text-muted)", soft: "var(--muted-soft)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        background: s.soft,
        color: s.color,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      <Dot color={s.color} />
      {verdict}
    </span>
  );
}

function downloadJson(log: RunLog) {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${log.domain}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    ...extra,
  };
}

function sectionLabel(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 };
}

function StatTile({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={card({ padding: "14px 16px", flex: "1 1 120px" })}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: color ?? "var(--text)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function GateRow({ gate }: { gate: any }) {
  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td style={{ padding: "7px 8px 7px 0", fontWeight: 700, fontSize: 12, color: "var(--text-muted)" }}>{gate.gate}</td>
      <td style={{ padding: "7px 8px" }}>{gate.name}</td>
      <td style={{ padding: "7px 8px" }}>
        <VerdictPill verdict={gate.verdict} />
      </td>
      <td style={{ padding: "7px 0", color: "var(--text-muted)" }}>{gate.evidence}</td>
    </tr>
  );
}

function WindowChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={card({ overflow: "hidden" })}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-3)",
        }}
      >
        <span style={{ display: "flex", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#f87171" }} />
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#fbbf24" }} />
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#4ade80" }} />
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function RunCard({ log }: { log: RunLog }) {
  const [open, setOpen] = useState(false);
  const s = statusOf(log.disposition);

  return (
    <WindowChrome title={`${log.domain} · run log`}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: "12px 14px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>{log.domain}</span>
        <StatusPill disposition={log.disposition} />
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          score <strong style={{ color: "var(--text)" }}>{log.score}</strong>/100 · {log.band}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "4px 14px 16px", borderTop: "1px solid var(--border)" }}>
          {log.error && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 12 }}>
              <Dot color="var(--danger)" /> Error: {log.error}
            </p>
          )}

          <div style={{ marginTop: 14 }}>
            <div style={sectionLabel()}>Activity</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {log.reasoning?.map((r: string, i: number) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {log.flags?.length > 0 && (
            <p style={{ color: "var(--warning)", fontSize: 13, marginTop: 10, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <Dot color="var(--warning)" />
              <span>{log.flags.join("; ")}</span>
            </p>
          )}

          {log.gates?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabel()}>Gates</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>{log.gates.map((g: any) => <GateRow key={g.gate} gate={g} />)}</tbody>
              </table>
            </div>
          )}

          {log.loopSteps?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabel()}>Agent loop</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {log.loopSteps.map((s: any, i: number) => (
                  <div key={i} style={{ fontSize: 13, background: "var(--muted-soft)", borderRadius: "var(--radius-sm)", padding: "7px 10px" }}>
                    <strong>{s.missingGate}</strong> missing {s.missingFields.join(", ")} → <strong>{s.toolCalled}</strong>
                    {s.toolArg ? ` (${s.toolArg})` : ""} <span style={{ color: "var(--text-muted)" }}>— {s.result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.contact && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabel()}>Contact candidates</div>
              {log.contact.noPoc ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>NO_POC — no candidate qualified, and no override on file.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Email</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Position</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Tier</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Confidence</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.contact.topCandidates.map((c: any) => (
                      <tr key={c.email} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px 6px 0" }}>{c.email}</td>
                        <td style={{ padding: "6px 8px" }}>{c.position}</td>
                        <td style={{ padding: "6px 8px" }}>{c.tier}</td>
                        <td style={{ padding: "6px 8px" }}>{c.confidence}</td>
                        <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{c.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {log.pains && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabel()}>Pain points</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {log.pains.map((p: any, i: number) => (
                  <div key={i} style={{ fontSize: 13 }}>
                    <strong>{p.pain}</strong>
                    {p.inferred ? <span style={{ color: "var(--text-muted)" }}> (inferred)</span> : null} — {p.why_this_persona}
                    {p.evidence_quote && <div style={{ color: "var(--text-muted)", marginTop: 2 }}>&ldquo;{p.evidence_quote}&rdquo;</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.email && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabel()}>Email{log.email.regenerated ? " · regenerated once" : ""}</div>
              <div style={{ background: "var(--muted-soft)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 10 }}>
                <p style={{ margin: "0 0 6px", fontSize: 13 }}>
                  <strong>Subject:</strong> {log.email.draft?.subject}
                </p>
                <p style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0 }}>{log.email.draft?.body}</p>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {log.email.checks.map((c: any) => (
                    <tr key={c.name} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "5px 8px 5px 0", width: 20 }}>
                        <Dot color={c.passed ? "var(--success)" : "var(--danger)"} />
                      </td>
                      <td style={{ padding: "5px 8px" }}>{c.name}</td>
                      <td style={{ padding: "5px 0", color: "var(--text-muted)" }}>{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {log.send && (
            <p style={{ fontSize: 13, marginTop: 16 }}>
              <strong>Send:</strong> {log.send.status} — {log.send.detail}
            </p>
          )}

          <button onClick={() => downloadJson(log)} style={buttonStyle("secondary")}>
            Download JSON
          </button>
        </div>
      )}
    </WindowChrome>
  );
}

function buttonStyle(kind: "primary" | "secondary"): React.CSSProperties {
  return {
    padding: "9px 16px",
    borderRadius: "var(--radius-sm)",
    border: kind === "primary" ? "none" : "1px solid var(--border)",
    background: kind === "primary" ? "var(--accent)" : "var(--surface)",
    color: kind === "primary" ? "var(--on-accent)" : "var(--text)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    marginTop: 8,
  };
}

export default function Home() {
  const [passcode, setPasscode] = useState("");
  const [domainsText, setDomainsText] = useState("");
  const [sendToInbox, setSendToInbox] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [results, setResults] = useState<RunLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const domains = domainsText
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean);

  const counts = results.reduce(
    (acc, r) => {
      acc.total++;
      if (r.disposition === "QUALIFIED") acc.qualified++;
      else if (r.disposition === "QUALIFIED_FLAGGED") acc.flagged++;
      else if (r.disposition === "DROPPED") acc.dropped++;
      else if (r.disposition === "MANUAL_REVIEW") acc.review++;
      if (r.send?.status === "sent") acc.sent++;
      return acc;
    },
    { total: 0, qualified: 0, flagged: 0, dropped: 0, review: 0, sent: 0 }
  );

  async function runBatch() {
    setError(null);
    if (domains.length === 0) {
      setError("Enter at least one domain.");
      return;
    }
    if (domains.length > 8) {
      setError("Max 8 domains per batch.");
      return;
    }
    setRunning(true);
    setResults([]);
    setProgress([]);

    for (const domain of domains) {
      setProgress((p) => [...p, `Running ${domain}…`]);
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-passcode": passcode },
          body: JSON.stringify({ domain, send: sendToInbox, dryRun: false }),
        });
        if (res.status === 401) {
          setError("Wrong passcode.");
          setRunning(false);
          return;
        }
        const log = await res.json();
        setResults((r) => [...r, log]);
        setProgress((p) => [...p.slice(0, -1), `${domain}: ${log.disposition ?? log.error ?? "done"}`]);
      } catch (e) {
        setProgress((p) => [...p.slice(0, -1), `${domain}: request failed`]);
      }
    }
    setRunning(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 16px 60px" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Cold outreach, <span style={{ color: "var(--accent)" }}>every decision logged.</span>
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: 10, fontSize: 15 }}>
          Scrape → qualify → find contact → draft → send — run by the rules in <code>evidence_map.yaml</code>, not a vibe.
        </p>
      </header>

      <section style={card({ padding: 20, marginBottom: 20 })}>
        <label style={{ display: "block", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Passcode
          </div>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: "100%", padding: "9px 11px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 14 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Domains (one per line, max 8)
          </div>
          <textarea
            value={domainsText}
            onChange={(e) => setDomainsText(e.target.value)}
            rows={6}
            placeholder={"cal.com\nhasura.io\n..."}
            style={{
              width: "100%",
              padding: "9px 11px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13,
            }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 14 }}>
          <input type="checkbox" checked={sendToInbox} onChange={(e) => setSendToInbox(e.target.checked)} />
          Send to my inbox
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={runBatch} disabled={running} style={buttonStyle("primary")}>
            {running ? "Running…" : "Run"}
          </button>
          <button onClick={() => setDomainsText(DEMO_DOMAINS.join("\n"))} disabled={running} style={buttonStyle("secondary")}>
            Try the demo list
          </button>
        </div>

        {error && (
          <p style={{ color: "var(--danger)", marginTop: 12, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
            <Dot color="var(--danger)" /> {error}
          </p>
        )}
      </section>

      {progress.length > 0 && (
        <section style={{ marginBottom: 20, fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
          {progress.map((p, i) => (
            <div key={i}>{p}</div>
          ))}
        </section>
      )}

      {results.length > 0 && (
        <>
          <div style={sectionLabel()}>Summary</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
            <StatTile value={counts.total} label="Domains run" />
            <StatTile value={counts.qualified + counts.flagged} label="Qualified" color="var(--success)" />
            <StatTile value={counts.dropped} label="Dropped" color="var(--danger)" />
            <StatTile value={counts.review} label="Manual review" color="var(--warning)" />
            <StatTile value={counts.sent} label="Emails sent" color="var(--accent)" />
          </div>

          <div style={{ overflowX: "auto", marginBottom: 28 }}>
            <table style={card({ width: "100%", borderCollapse: "collapse", fontSize: 13 })}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 12px" }}>Domain</th>
                  <th style={{ padding: "10px 12px" }}>Disposition</th>
                  <th style={{ padding: "10px 12px" }}>Score</th>
                  <th style={{ padding: "10px 12px" }}>Contact</th>
                  <th style={{ padding: "10px 12px" }}>Send</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.domain} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.domain}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <StatusPill disposition={r.disposition} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {r.score}/100 <span style={{ color: "var(--text-muted)" }}>({r.band})</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{r.contact?.winner?.email ?? (r.contact?.noPoc ? "NO_POC" : "—")}</td>
                    <td style={{ padding: "10px 12px" }}>{r.send?.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={sectionLabel()}>Run details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map((r) => (
              <RunCard key={r.domain} log={r} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
