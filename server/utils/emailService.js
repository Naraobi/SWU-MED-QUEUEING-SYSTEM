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
  const loginUrl = "https://swumedqs.swucite.tech/superadmin/login";

  const mailOptions = {
    from: `"SWU Med Queue System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "Your SWU Med Queue System Account",

    // Plain-text version
    text: `Hello ${firstName},

Your SWU Med Queue System account has been created.

Temporary Password:
${temporaryPassword}

Please log in using your registered email address and temporary password.

Your temporary password expires 48 hours after your account is created.
Please change your password within this period.

Login here:
${loginUrl}

If your temporary password expires before you change it, please contact the administrator.

Once you change your password, the temporary password expiration no longer applies.

Thank you,
SWU Med Queue System`,

    // HTML version
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>SWU Med Queue System</h2>

        <p>Hello ${firstName},</p>

        <p>
          Your SWU Med Queue System account has been created.
        </p>

        <p>
          <strong>Temporary Password: ${temporaryPassword}</strong>
        </p>

        <p>
          Please log in using your registered email address and temporary password.
        </p>

        <p>
          <strong>
            Your temporary password expires 48 hours after your account is created.
          </strong>
          Please change your password within this period.
        </p>

        <p>
          <a
            href="${loginUrl}"
            style="
              display: inline-block;
              background-color: #9D0A0E;
              color: #ffffff;
              padding: 12px 20px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Login
          </a>
        </p>

        <p>
          If the button does not work, use this link:
          <br />
          <a href="${loginUrl}">${loginUrl}</a>
        </p>

        <p>
          If your temporary password expires before you change it,
          please contact the administrator.
        </p>

        <p>
          Once you successfully change your password,
          the temporary password expiration no longer applies.
        </p>

        <p>
          Thank you,<br />
          <strong>SWU Med Queue System</strong>
        </p>
      </div>
    `,
  };

  console.log(
    "TEMPORARY PASSWORD EMAIL VERSION: 48-HOUR EXPIRATION"
  );

  await transporter.sendMail(mailOptions);
}

async function sendPasswordChangedEmail(recipientEmail, firstName) {
  const changedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });

  const mailOptions = {
    from: `"SWU Med Queue System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "Your SWU Med Queue System Password Was Changed",

    // Plain-text version
    text: `Hello ${firstName},

Your password for the SWU Med Queue System has been successfully changed.

Password changed: ${changedAt}
Account: ${recipientEmail}

If you made this change, no further action is required.

If you did not change your password, please contact your system administrator immediately.

Thank you,
SWU Med Queue System`,

    // HTML version
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>SWU Med Queue System</h2>

        <p>Hello ${firstName},</p>

        <p>
          Your password for the SWU Med Queue System
          has been <strong>successfully changed</strong>.
        </p>

        <div
          style="
            background-color: #f8f9fa;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
          "
        >
          <p style="margin: 0 0 8px 0;">
            <strong>Password changed:</strong> ${changedAt}
          </p>

          <p style="margin: 0;">
            <strong>Account:</strong> ${recipientEmail}
          </p>
        </div>

        <p>
          If you made this change, no further action is required.
        </p>

        <p>
          <strong>
            If you did not change your password, please contact
            your system administrator immediately.
          </strong>
        </p>

        <p>
          Thank you,<br />
          <strong>SWU Med Queue System</strong>
        </p>
      </div>
    `,
  };

  console.log(
    "PASSWORD CHANGED EMAIL: Sending confirmation to",
    recipientEmail
  );

  await transporter.sendMail(mailOptions);
}
module.exports = {
  sendTemporaryPasswordEmail,
  sendPasswordChangedEmail,
};