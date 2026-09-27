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

// =====================================================
// UNIVERSAL EMAIL DESIGN
// =====================================================
//
// Every outgoing email shares this one layout (header, body,
// footer) so the system doesn't send visually inconsistent
// messages. Individual senders below only build the middle
// section — the heading, footer, fonts, and colors all come
// from here.

const BRAND_ACCENT = "#9D0A0E";
const TEXT_COLOR = "#333";

function renderEmailLayout(bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: ${TEXT_COLOR}; max-width: 560px; margin: 0 auto;">
      <h2 style="margin: 0 0 16px 0;">SWU Med Queue System</h2>

      ${bodyHtml}

      <p style="margin-top: 28px;">
        Thank you,<br />
        <strong>SWU Med Queue System</strong>
      </p>
    </div>
  `;
}

function renderButton(url, label) {
  return `
    <p>
      <a
        href="${url}"
        style="
          display: inline-block;
          background-color: ${BRAND_ACCENT};
          color: #ffffff;
          padding: 12px 20px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        "
      >
        ${label}
      </a>
    </p>
  `;
}

function renderInfoBox(rows) {
  const rowsHtml = rows
    .map(
      (row, index) => `
        <p style="margin: ${index === 0 ? "0 0 8px 0" : "0"};">
          <strong>${row.label}:</strong> ${row.value}
        </p>
      `
    )
    .join("");

  return `
    <div
      style="
        background-color: #f8f9fa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 15px;
        margin: 20px 0;
      "
    >
      ${rowsHtml}
    </div>
  `;
}

function renderCodeBlock(code) {
  return `
    <p
      style="
        font-size: 28px;
        font-weight: bold;
        letter-spacing: 6px;
        color: ${BRAND_ACCENT};
        background-color: #f8f9fa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 16px;
        text-align: center;
        margin: 20px 0;
      "
    >
      ${code}
    </p>
  `;
}

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
    html: renderEmailLayout(`
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

      ${renderButton(loginUrl, "Login")}

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
    `),
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
    html: renderEmailLayout(`
      <p>Hello ${firstName},</p>

      <p>
        Your password for the SWU Med Queue System
        has been <strong>successfully changed</strong>.
      </p>

      ${renderInfoBox([
        { label: "Password changed", value: changedAt },
        { label: "Account", value: recipientEmail },
      ])}

      <p>
        If you made this change, no further action is required.
      </p>

      <p>
        <strong>
          If you did not change your password, please contact
          your system administrator immediately.
        </strong>
      </p>
    `),
  };

  console.log(
    "PASSWORD CHANGED EMAIL: Sending confirmation to",
    recipientEmail
  );

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

    html: renderEmailLayout(`
      <p>Hello ${firstName},</p>

      <p>
        A request was made to create or change your Security PIN
        for the SWU Med Queue System.
      </p>

      <p>Your verification code is:</p>

      ${renderCodeBlock(verificationCode)}

      <p>
        This code will expire in <strong>10 minutes</strong>.
      </p>

      <p>
        If you did not request this change, please ignore this email
        and contact your system administrator.
      </p>
    `),
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
    subject: "SWU Med Queue System Password Reset Verification Code",

    text: `Hello ${firstName},

A request was made to reset your password for the SWU Med Queue System.

Your 6-digit verification code is:

${verificationCode}

This code will expire in 10 minutes.

If you did not request a password reset, please ignore this email and contact your system administrator.

Thank you,
SWU Med Queue System`,

    html: renderEmailLayout(`
      <p>Hello ${firstName},</p>

      <p>
        A request was made to reset your password for the
        SWU Med Queue System.
      </p>

      <p>Your 6-digit verification code is:</p>

      ${renderCodeBlock(verificationCode)}

      <p>
        This code will expire in <strong>10 minutes</strong>.
      </p>

      <p>
        If you did not request a password reset, please ignore this
        email and contact your system administrator.
      </p>
    `),
  };

  await transporter.sendMail(mailOptions);
}


// =====================================================
// SECURITY PIN CHANGED EMAIL
// =====================================================

async function sendSecurityPinChangedEmail(
  recipientEmail,
  firstName
) {
  const changedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });

  const mailOptions = {
    from: `"SWU Med Queue System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject:
      "Your SWU Med Queue System Security PIN Was Changed",

    text: `Hello ${firstName},

Your Security PIN for the SWU Med Queue System has been successfully changed.

Security PIN changed: ${changedAt}
Account: ${recipientEmail}

If you made this change, no further action is required.

If you did not change your Security PIN, please contact your system administrator immediately.

Thank you,
SWU Med Queue System`,

    html: renderEmailLayout(`
      <p>Hello ${firstName},</p>

      <p>
        Your Security PIN for the SWU Med Queue System
        has been <strong>successfully changed</strong>.
      </p>

      ${renderInfoBox([
        { label: "Security PIN changed", value: changedAt },
        { label: "Account", value: recipientEmail },
      ])}

      <p>
        If you made this change, no further action is required.
      </p>

      <p>
        <strong>
          If you did not change your Security PIN, please contact
          your system administrator immediately.
        </strong>
      </p>
    `),
  };

  console.log(
    "SECURITY PIN CHANGED EMAIL: Sending confirmation to",
    recipientEmail
  );

  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendTemporaryPasswordEmail,
  sendPinVerificationEmail,
  sendPasswordChangedEmail,
  sendPasswordResetCodeEmail,
  sendSecurityPinChangedEmail,
};
