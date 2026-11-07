import nodemailer, { type Transporter } from 'nodemailer'
import { env, isProd } from '../config/env.js'
import { logger } from './logger.js'

let transporter: Transporter | undefined

function getTransporter(): Transporter {
  if (transporter) return transporter
  if (env.SMTP_URL) {
    transporter = nodemailer.createTransport(env.SMTP_URL)
  } else {
    if (isProd) logger.warn('SMTP_URL not set — emails will only be logged')
    // No SMTP configured: render the message and log it instead of sending.
    transporter = nodemailer.createTransport({ jsonTransport: true })
  }
  return transporter
}

/** Sent messages are recorded here in tests so assertions can inspect them. */
export const sentMail: Array<{ to: string; subject: string; text: string }> = []

export interface MailMessage {
  to: string
  subject: string
  text: string
  html: string
}

/** Send an email. Never throws — mail failures must not break the request that triggered them. */
export async function sendMail(msg: MailMessage): Promise<void> {
  if (env.NODE_ENV === 'test') {
    sentMail.push({ to: msg.to, subject: msg.subject, text: msg.text })
    return
  }
  try {
    const info = await getTransporter().sendMail({ from: env.MAIL_FROM, ...msg })
    if (!env.SMTP_URL) logger.info({ to: msg.to, subject: msg.subject }, 'Email (not sent, no SMTP_URL)')
    else logger.debug({ messageId: info.messageId }, 'Email sent')
  } catch (err) {
    logger.error({ err, to: msg.to }, 'Failed to send email')
  }
}

/** Escape text for safe interpolation into HTML email bodies. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e2e8f0">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="font-size:22px;font-weight:700;color:#2dd4bf;margin-bottom:24px">splitFool</div>
<div style="background:#1e293b;border-radius:16px;padding:24px">
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>${bodyHtml}</div>
<p style="font-size:12px;color:#64748b;margin-top:24px">You can change email preferences in Settings.</p>
</div></body></html>`
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0 0"><a href="${escapeHtml(href)}" style="background:#14b8a6;color:#0f172a;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`

export const templates = {
  invite(p: { inviterName: string; groupName?: string; link: string }): Omit<MailMessage, 'to'> {
    const what = p.groupName ? `the group “${p.groupName}”` : 'splitFool'
    const subject = `${p.inviterName} invited you to ${p.groupName ? p.groupName : 'splitFool'}`
    return {
      subject,
      text: `${p.inviterName} invited you to ${what} to share expenses.\n\nJoin: ${p.link}\n\nThis invite expires in 14 days.`,
      html: layout(subject, `<p>${escapeHtml(p.inviterName)} invited you to ${escapeHtml(what)} to share expenses.</p>${button(p.link, 'Accept invite')}<p style="font-size:12px;color:#94a3b8;margin-top:16px">This invite expires in 14 days.</p>`),
    }
  },

  expenseAdded(p: { actorName: string; description: string; amount: string; yourShare: string; link: string }): Omit<MailMessage, 'to'> {
    const subject = `${p.actorName} added “${p.description}”`
    return {
      subject,
      text: `${p.actorName} added “${p.description}” (${p.amount}).\nYour share: ${p.yourShare}\n\n${p.link}`,
      html: layout(subject, `<p>${escapeHtml(p.actorName)} added <b>${escapeHtml(p.description)}</b> for ${escapeHtml(p.amount)}.</p><p>Your share: <b>${escapeHtml(p.yourShare)}</b></p>${button(p.link, 'View expense')}`),
    }
  },

  weeklySummary(p: { name: string; lines: string[]; link: string }): Omit<MailMessage, 'to'> {
    const subject = 'Your weekly splitFool summary'
    const list = p.lines.length ? p.lines : ['You are all settled up. 🎉']
    return {
      subject,
      text: `Hi ${p.name},\n\n${list.join('\n')}\n\n${p.link}`,
      html: layout(subject, `<p>Hi ${escapeHtml(p.name)},</p><ul style="padding-left:18px">${list.map((l) => `<li style="margin:6px 0">${escapeHtml(l)}</li>`).join('')}</ul>${button(p.link, 'Open splitFool')}`),
    }
  },
}
