const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getAppBaseUrl() {
  const configured = String(process.env.APP_BASE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const firstCorsOrigin = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .find(Boolean);

  if (firstCorsOrigin) {
    return firstCorsOrigin.replace(/\/+$/, '');
  }

  return 'http://localhost:5173';
}

function getMailFromAddress() {
  return String(process.env.MAIL_FROM || 'Wellness Center Studio <no-reply@wellness.local>').trim();
}

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
}

function getTransporter() {
  if (!hasSmtpConfig()) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  return cachedTransporter;
}

async function sendAppEmail({ to, subject, text, html, actionUrl = '' }) {
  const transporter = getTransporter();
  const from = getMailFromAddress();

  if (!transporter) {
    console.log(JSON.stringify({
      level: 'info',
      event: 'email-preview',
      to,
      subject,
      actionUrl,
    }));

    return {
      delivered: false,
      actionUrl,
      transport: 'log-only',
    };
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return {
    delivered: true,
    transport: 'smtp',
    messageId: info.messageId,
    actionUrl,
  };
}

module.exports = {
  getAppBaseUrl,
  sendAppEmail,
};
