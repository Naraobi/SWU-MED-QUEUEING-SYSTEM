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

module.exports = {
  sendTemporaryPasswordEmail,
};