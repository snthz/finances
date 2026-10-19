import "server-only";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getT } from "@/i18n/server";
import { uid } from "./context";
import { MAIL_ICONS, type MailIcon } from "./mail-icons";
import { appSettings, getSetting, isMailKind, KEYS, setSetting, type SmtpSettings } from "./settings";

// Avisos por correo: cada usuario configura su propio servidor SMTP y destinatarios (Ajustes → Avisos).
// Se manda un correo por cada aviso nuevo de la campanita cuyo tipo esté activado.

export type MailResult = { ok: boolean; at: string; message?: string };

/** Hay servidor y remitente (y contraseña si hay usuario). */
export function smtpConfigured(s: SmtpSettings = appSettings().smtp) {
  return Boolean(s.host && s.from && (!s.user || s.pass));
}

function transport(s: SmtpSettings) {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.security === "ssl",
    requireTLS: s.security === "starttls",
    ignoreTLS: s.security === "none",
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

/** Prueba la conexión y el inicio de sesión. */
export async function verifySmtp(s: SmtpSettings = appSettings().smtp): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await transport(s).verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

function errorText(err: unknown) {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const msg = (e?.message ?? String(err)).split("\n")[0].slice(0, 200);
  return e?.code && !msg.includes(e.code) ? `${e.code}: ${msg}` : msg;
}

/** Destinatarios configurados o, si no hay, el correo de la cuenta. */
export async function mailRecipients(s: SmtpSettings = appSettings().smtp) {
  if (s.recipients.length) return s.recipients;
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, uid()));
  return u ? [u.email] : [];
}

/** Origen público para los enlaces: APP_URL o el que se vio al guardar el SMTP. */
async function linkBase() {
  const v = process.env.APP_URL || (await getSetting(KEYS.smtpLinkBase));
  return v ? v.replace(/\/+$/, "") : null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type MailDetail = { label: string; value: string };

type MailContent = {
  subject: string;
  icon: MailIcon;
  eyebrow: string;
  title: string;
  body?: string | null;
  details?: MailDetail[];
  href?: string | null;
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Correo transaccional sobrio, en tablas (compatible con Gmail/Outlook/Apple Mail): logo, ícono del aviso,
 * etiqueta, título, detalle en filas y botón a la app. Los íconos van como adjuntos inline (cid:).
 */
function render(c: MailContent, base: string | null) {
  const t = getT().settings.mail;
  const url = base ? `${base}${c.href ?? "/"}` : null;
  const manage = base ? `${base}/settings?tab=avisos` : null;
  const rows = (c.details ?? [])
    .map(
      (d, i) =>
        `<tr><td style="padding:12px 0;${i ? "border-top:1px solid #f0f0f0;" : ""}font-size:14px;color:#737373">${esc(d.label)}</td>` +
        `<td align="right" style="padding:12px 0;${i ? "border-top:1px solid #f0f0f0;" : ""}font-size:14px;font-weight:600;color:#0a0a0a">${esc(d.value)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden">${esc(c.body || c.details?.map((d) => d.value).join(" · ") || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;font-family:${FONT}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 20px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle"><img src="cid:logo" width="28" height="28" alt="" style="display:block;border:0;border-radius:7px"></td>
    <td style="vertical-align:middle;padding-left:10px;line-height:1">
      <div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#0a0a0a">Finances</div>
      <div style="font-size:10px;letter-spacing:0.02em;color:#737373;padding-top:2px">by Fallxn<b style="color:#404040">Studio</b></div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;padding:32px">
  <img src="cid:icon" width="48" height="48" alt="" style="display:block;border:0">
  <div style="padding-top:20px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#737373">${esc(c.eyebrow)}</div>
  <div style="padding-top:6px;font-size:22px;font-weight:600;line-height:1.3;letter-spacing:-0.02em;color:#0a0a0a">${esc(c.title)}</div>
  ${c.body ? `<div style="padding-top:8px;font-size:15px;line-height:1.55;color:#525252">${esc(c.body)}</div>` : ""}
  ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5">${rows}</table>` : ""}
  ${url ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td style="background:#0a0a0a;border-radius:10px"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${esc(t.open)}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.6;color:#8a8a8a">
  ${esc(t.footer)}${manage ? ` <a href="${esc(manage)}" style="color:#525252;text-decoration:underline">${esc(t.manage)}</a>` : ""}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [
    c.eyebrow.toUpperCase(),
    c.title,
    c.body ?? "",
    ...(c.details ?? []).map((d) => `${d.label}: ${d.value}`),
    url ? `\n${t.open}: ${url}` : "",
    `\n${t.footer}${manage ? ` ${manage}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

const inline = (cid: string, b64: string) => ({ filename: `${cid}.png`, content: Buffer.from(b64, "base64"), contentType: "image/png", cid, contentDisposition: "inline" as const });

async function send(s: SmtpSettings, c: MailContent) {
  const to = await mailRecipients(s);
  if (!to.length) throw new Error(getT().settings.mail.noRecipients);
  const { html, text } = render(c, await linkBase());
  await transport(s).sendMail({
    from: s.fromName ? { name: s.fromName, address: s.from } : s.from,
    to,
    subject: c.subject,
    text,
    html,
    attachments: [inline("logo", MAIL_ICONS.logo), inline("icon", MAIL_ICONS[c.icon])],
  });
}

/** HTML del correo de un aviso (para vistas previas y pruebas). */
export function renderMailPreview(c: MailContent, base: string | null = null) {
  return render(c, base);
}

async function saveResult(r: MailResult) {
  await setSetting(KEYS.smtpLastResult, JSON.stringify(r));
}

export async function lastMailResult(): Promise<MailResult | null> {
  try {
    return JSON.parse((await getSetting(KEYS.smtpLastResult)) ?? "null");
  } catch {
    return null;
  }
}

/** Correo de prueba con la configuración guardada. */
export async function sendTestMail(): Promise<{ ok: true; to: string[] } | { ok: false; error: string }> {
  const s = appSettings().smtp;
  const t = getT().settings.mail;
  if (!smtpConfigured(s)) return { ok: false, error: t.notConfigured };
  try {
    const to = await mailRecipients(s);
    await send(s, {
      subject: t.testSubject,
      icon: "test",
      eyebrow: t.testEyebrow,
      title: t.testTitle,
      body: t.testBody,
      details: [
        { label: t.details.server, value: `${s.host}:${s.port}` },
        { label: t.details.recipients, value: to.join(", ") },
      ],
      href: "/settings?tab=avisos",
    });
    await saveResult({ ok: true, at: new Date().toISOString() });
    return { ok: true, to };
  } catch (err) {
    const error = errorText(err);
    await saveResult({ ok: false, at: new Date().toISOString(), message: error });
    return { ok: false, error };
  }
}

/**
 * Manda por correo un aviso recién creado si el usuario lo tiene activado para ese tipo.
 * Con `details` el correo muestra el detalle en filas (monto, vencimiento…) en vez del texto corto.
 * Nunca lanza: un SMTP caído no debe frenar los recordatorios de la campanita.
 */
export async function mailNotification(n: { kind: string; title: string; body?: string | null; href?: string | null; details?: MailDetail[] }) {
  try {
    const s = appSettings().smtp;
    if (!s.enabled || !smtpConfigured(s) || !isMailKind(n.kind) || !s.kinds.includes(n.kind)) return;
    await send(s, {
      subject: n.title,
      icon: n.kind,
      eyebrow: getT().settings.page.notifications.kindNames[n.kind],
      title: n.title,
      body: n.details?.length ? null : n.body,
      details: n.details,
      href: n.href,
    });
    await saveResult({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    console.error(`[mail] usuario ${uid()}:`, errorText(err));
    await saveResult({ ok: false, at: new Date().toISOString(), message: errorText(err) }).catch(() => {});
  }
}
