const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function wrapEmail(bodyHtml) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:28px 0;background:#f0eeea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
    <tr><td>
      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e1116;border-radius:12px 12px 0 0;">
        <tr><td style="padding:20px 30px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;height:34px;background:#4f46e5;border-radius:8px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-weight:700;font-size:16px;line-height:34px;display:block;">D</span>
            </td>
            <td style="padding-left:10px;color:#fff;font-weight:600;font-size:17px;vertical-align:middle;">DeskFlow</td>
            <td style="padding-left:8px;vertical-align:middle;">
              <span style="color:#818cf8;font-size:11px;">Helpdesk &amp; Ticketing</span>
            </td>
          </tr></table>
        </td></tr>
      </table>
      <!-- Accent bar -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#4f46e5);"></td>
        </tr>
      </table>
      <!-- Body -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <tr><td style="padding:34px 30px 26px;">${bodyHtml}</td></tr>
      </table>
      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <tr><td style="padding:14px 30px;text-align:center;">
          <span style="color:#9ca3af;font-size:11.5px;">© 2026 DeskFlow &nbsp;·&nbsp; Non rispondere a questa email automatica</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </td></tr></table>
</body>
</html>`;
}

function detailTable(rows) {
    const rowsHtml = rows.map((r, i) => `
        <tr>
            <td style="padding:9px 14px;color:#6b7280;font-size:12.5px;width:100px;border-bottom:1px solid #e5e7eb;background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">${r[0]}</td>
            <td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">${r[1]}</td>
        </tr>`).join('');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;margin:20px 0;">${rowsHtml}</table>`;
}

async function sendEmailNotification(to, subject, bodyHtml) {
    try {
        const info = await transporter.sendMail({
            from: `"DeskFlow" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: wrapEmail(bodyHtml)
        });
        console.log(`Email inviata a ${to} — ${info.messageId}`);
    } catch (err) {
        console.error('Errore invio email:', err.message);
    }
}

module.exports = { sendEmailNotification, detailTable };
