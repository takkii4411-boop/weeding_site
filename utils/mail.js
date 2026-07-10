const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

async function sendContactEmail({ name, email, phone, event_type, event_date, message }) {
  const to = process.env.NOTIFY_EMAIL || 'admin@aropnweddings.com';
  const subject = `New Contact Inquiry from ${name}`;
  const html = `
    <h2>New Contact Inquiry</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Name</td><td style="padding:8px;border:1px solid #ddd">${name}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Email</td><td style="padding:8px;border:1px solid #ddd">${email}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Phone</td><td style="padding:8px;border:1px solid #ddd">${phone || '-'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Event Type</td><td style="padding:8px;border:1px solid #ddd">${event_type || '-'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Event Date</td><td style="padding:8px;border:1px solid #ddd">${event_date || '-'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Message</td><td style="padding:8px;border:1px solid #ddd">${message}</td></tr>
    </table>
  `;
  try {
    await transporter.sendMail({ from: `"Aropn Weddings" <${process.env.SMTP_USER || email}>`, to, subject, html });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

module.exports = { sendContactEmail };
