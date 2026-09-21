const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: String(process.env.EMAIL_SECURE).toLowerCase() === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});
async function sendTemporaryPasswordEmail(
  recipientEmail,
  firstName,
  temporaryPassword
) {
  const mailOptions = {
    from: `"SWU Med Queue System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "Your SWU Med Queue Account",
    text: `Hello ${firstName},

Your SWU Med Queue System account has been created.

Your temporary password is:

${temporaryPassword}

Please log in using your email address and this temporary password.

For security, you will be required to change your password after your first login.

Thank you,
SWU Med Queue System`,
  };

  await transporter.sendMail(mailOptions);
}

async function sendPinVerificationEmail(
  recipientEmail,
  firstName,
  verificationCode
) {
  const mailOptions = {
    from: `"SWU Med Queue System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "SWU Med Queue Security PIN Verification",
    text: `Hello ${firstName},

You requested to set or change your Security PIN.

Your verification code is:

${verificationCode}

This code will expire in 10 minutes.

If you did not request this, you can safely ignore this email.

Thank you,
SWU Med Queue System`,
  };

  await transporter.sendMail(mailOptions);
}

async function sendPasswordResetCodeEmail(
  recipientEmail,
  firstName,
  verificationCode
) {
  const mailOptions = {
    from: `"SWU Med Queue System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "SWU Med Queue Password Change Verification",
    text: `Hello ${firstName},

You requested to change your account password.

Your verification code is:

${verificationCode}

This code will expire in 10 minutes.

If you did not request this, you can safely ignore this email.

Thank you,
SWU Med Queue System`,
  };

  await transporter.sendMail(mailOptions);
}

async function sendPasswordChangedEmail(
  recipientEmail,
  firstName
) {
  const changedAt = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const mailOptions = {
    from: `"SWU Med Queue System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "Your SWU Med Queue Password Was Changed",
    text: `Hello ${firstName},

Your SWU Med Queue System password was changed on ${changedAt} (Asia/Manila).

If you did not make this change, please contact the administrator immediately.

Thank you,
SWU Med Queue System`,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendTemporaryPasswordEmail,
  sendPinVerificationEmail,
  sendPasswordResetCodeEmail,
  sendPasswordChangedEmail,
};