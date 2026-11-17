import nodemailer from "nodemailer";
import { EmailDraft } from "./email";

export interface SendResult {
  status: "sent" | "dry_run" | "failed";
  detail: string;
  eml?: string;
}

function buildEml(to: string, from: string, draft: EmailDraft): string {
  return [`To: ${to}`, `From: ${from}`, `Subject: ${draft.subject}`, "", draft.body].join("\n");
}

/** Sends to SEND_TO only — read server-side from the environment, never from the request. */
export async function sendEmail(companyName: string, draft: EmailDraft, dryRun: boolean): Promise<SendResult> {
  const to = process.env.SEND_TO;
  const from = process.env.GMAIL_ADDRESS;
  if (!to) throw new Error("SEND_TO is not set — refusing to send");
  if (!from) throw new Error("GMAIL_ADDRESS is not set — refusing to send");

  const subject = `${draft.subject} — ${companyName}`;
  const withSubject: EmailDraft = { ...draft, subject };

  if (dryRun) {
    return { status: "dry_run", detail: `Would send to ${to}`, eml: buildEml(to, from, withSubject) };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: from, pass: process.env.GMAIL_APP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject: withSubject.subject,
      text: withSubject.body,
    });
    return { status: "sent", detail: `Sent to ${to}` };
  } catch (err) {
    try {
      await transporter.sendMail({
        from,
        to,
        subject: withSubject.subject,
        text: withSubject.body,
      });
      return { status: "sent", detail: `Sent to ${to} (after one retry)` };
    } catch (err2) {
      return { status: "failed", detail: `Gmail error: ${(err2 as Error).message}`, eml: buildEml(to, from, withSubject) };
    }
  }
}
