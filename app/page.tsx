"use client";

import { useState } from "react";

const DEMO_DOMAINS = ["cal.com", "hasura.io", "zluri.com", "thoughtworks.com", "hubspot.com", "drata.com"];

type RunLog = any;

function badgeColor(disposition: string): string {
  switch (disposition) {
    case "QUALIFIED":
      return "var(--success)";
    case "QUALIFIED_FLAGGED":
      return "var(--warning)";
    case "DROPPED":
      return "var(--danger)";
    case "MANUAL_REVIEW":
      return "var(--text-muted)";
    default:
      return "var(--danger)";
  }
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

function GateRow({ gate }: { gate: any }) {
  return (
    <tr>
      <td>{gate.gate}</td>
      <td>{gate.name}</td>
      <td style={{ fontWeight: 600 }}>{gate.verdict}</td>
      <td style={{ color: "var(--text-muted)" }}>{gate.evidence}</td>
    </tr>
  );
}

function RunCard({ log }: { log: RunLog }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", marginBottom: 10 }}>
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
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600 }}>{log.domain}</span>
        <span style={{ color: badgeColor(log.disposition), fontWeight: 600, fontSize: 13 }}>{log.disposition}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>score {log.score} ({log.band})</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
          {log.error && <p style={{ color: "var(--danger)" }}>Error: {log.error}</p>}

          <h4>Reasoning</h4>
          <ul style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {log.reasoning?.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>

          {log.flags?.length > 0 && (
            <p style={{ color: "var(--warning)", fontSize: 13 }}>Flags: {log.flags.join("; ")}</p>
          )}

          <h4>Gates</h4>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                <th>Gate</th>
                <th>Name</th>
                <th>Verdict</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>{log.gates?.map((g: any) => <GateRow key={g.gate} gate={g} />)}</tbody>
          </table>

          {log.loopSteps?.length > 0 && (
            <>
              <h4>Agent loop</h4>
              <ul style={{ fontSize: 13 }}>
                {log.loopSteps.map((s: any, i: number) => (
                  <li key={i}>
                    Iteration {s.iteration} — missing for {s.missingGate}: {s.missingFields.join(", ")} → called <strong>{s.toolCalled}</strong>
                    {s.toolArg ? ` (${s.toolArg})` : ""} → {s.result}
                  </li>
                ))}
              </ul>
            </>
          )}

          {log.contact && (
            <>
              <h4>Contact candidates</h4>
              {log.contact.noPoc ? (
                <p style={{ color: "var(--text-muted)" }}>NO_POC — no candidate qualified, and no override on file.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                      <th>Email</th>
                      <th>Position</th>
                      <th>Tier</th>
                      <th>Confidence</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.contact.topCandidates.map((c: any) => (
                      <tr key={c.email}>
                        <td>{c.email}</td>
                        <td>{c.position}</td>
                        <td>{c.tier}</td>
                        <td>{c.confidence}</td>
                        <td style={{ color: "var(--text-muted)" }}>{c.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {log.pains && (
            <>
              <h4>Pain points</h4>
              <ul style={{ fontSize: 13 }}>
                {log.pains.map((p: any, i: number) => (
                  <li key={i}>
                    <strong>{p.pain}</strong>{p.inferred ? " (inferred)" : ""} — {p.why_this_persona}
                    {p.evidence_quote && <div style={{ color: "var(--text-muted)" }}>&ldquo;{p.evidence_quote}&rdquo;</div>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {log.email && (
            <>
              <h4>Email {log.email.regenerated ? "(regenerated once)" : ""}</h4>
              <p><strong>Subject:</strong> {log.email.draft?.subject}</p>
              <p style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{log.email.draft?.body}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {log.email.checks.map((c: any) => (
                    <tr key={c.name}>
                      <td style={{ color: c.passed ? "var(--success)" : "var(--danger)" }}>{c.passed ? "✓" : "✗"}</td>
                      <td>{c.name}</td>
                      <td style={{ color: "var(--text-muted)" }}>{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {log.send && (
            <p>
              <strong>Send:</strong> {log.send.status} — {log.send.detail}
            </p>
          )}

          <button onClick={() => downloadJson(log)} style={buttonStyle("secondary")}>
            Download JSON
          </button>
        </div>
      )}
    </div>
  );
}

function buttonStyle(kind: "primary" | "secondary"): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: "var(--radius)",
    border: kind === "primary" ? "none" : "1px solid var(--border)",
    background: kind === "primary" ? "var(--accent)" : "var(--surface)",
    color: kind === "primary" ? "var(--on-accent)" : "var(--text)",
    cursor: "pointer",
    fontSize: 14,
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
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ marginBottom: 4 }}>Sprinto Outreach</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>Scrape → qualify → find contact → draft → send, with every decision logged.</p>

      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Passcode</div>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Domains (one per line, max 8)</div>
          <textarea
            value={domainsText}
            onChange={(e) => setDomainsText(e.target.value)}
            rows={6}
            placeholder={"cal.com\nhasura.io\n..."}
            style={{ width: "100%", padding: 8, borderRadius: "var(--radius)", border: "1px solid var(--border)", fontFamily: "monospace", fontSize: 13 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14 }}>
          <input type="checkbox" checked={sendToInbox} onChange={(e) => setSendToInbox(e.target.checked)} />
          Send to my inbox
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={runBatch} disabled={running} style={buttonStyle("primary")}>
            {running ? "Running…" : "Run"}
          </button>
          <button onClick={() => setDomainsText(DEMO_DOMAINS.join("\n"))} disabled={running} style={buttonStyle("secondary")}>
            Try the demo list
          </button>
        </div>

        {error && <p style={{ color: "var(--danger)", marginTop: 10 }}>{error}</p>}
      </section>

      {progress.length > 0 && (
        <section style={{ marginBottom: 16, fontSize: 13, color: "var(--text-muted)" }}>
          {progress.map((p, i) => (
            <div key={i}>{p}</div>
          ))}
        </section>
      )}

      {results.length > 0 && (
        <>
          <h2>Summary</h2>
          <div style={{ overflowX: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "var(--surface)" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 6 }}>Domain</th>
                  <th style={{ padding: 6 }}>Disposition</th>
                  <th style={{ padding: 6 }}>Score</th>
                  <th style={{ padding: 6 }}>Contact</th>
                  <th style={{ padding: 6 }}>Send</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.domain} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 6 }}>{r.domain}</td>
                    <td style={{ padding: 6, color: badgeColor(r.disposition), fontWeight: 600 }}>{r.disposition}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>
                      {r.score}/100 ({r.band})
                    </td>
                    <td style={{ padding: 6 }}>{r.contact?.winner?.email ?? (r.contact?.noPoc ? "NO_POC" : "—")}</td>
                    <td style={{ padding: 6 }}>{r.send?.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Run details</h2>
          {results.map((r) => (
            <RunCard key={r.domain} log={r} />
          ))}
        </>
      )}
    </main>
  );
}
