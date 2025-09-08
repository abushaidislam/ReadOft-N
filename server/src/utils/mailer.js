export async function sendMail(to, subject, text, html) {
  try {
    const from = process.env.EMAIL_FROM || 'no-reply@readoft.local'
    const smtpUrl = process.env.SMTP_URL || process.env.NODEMAILER_URL || ''
    if (!smtpUrl) {
      console.log('[DEV EMAIL]', { to, subject, text, html })
      return { ok: true, dev: true }
    }
    let nodemailer
    try {
      nodemailer = await import('nodemailer')
    } catch (e) {
      console.warn('nodemailer not installed; printing email to console instead')
      console.log('[DEV EMAIL]', { to, subject, text, html })
      return { ok: true, dev: true }
    }

    const transporter = nodemailer.createTransport(smtpUrl)
    const info = await transporter.sendMail({ from, to, subject, text, html })
    return { ok: true, messageId: info?.messageId }
  } catch (e) {
    console.error('sendMail fatal error', e)
    return { ok: false, error: e?.message || String(e) }
  }
}

