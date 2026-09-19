const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
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

A request was made to create or change your Security PIN for the SWU Med Queue System.

Your verification code is:

${verificationCode}

This code will expire in 10 minutes.

If you did not request this change, please ignore this email and contact your system administrator.

Thank you,
SWU Med Queue System`,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendTemporaryPasswordEmail,
  sendPinVerificationEmail,
};