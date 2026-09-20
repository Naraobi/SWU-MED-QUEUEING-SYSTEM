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

Please log in using your registered email address and the temporary password.

IMPORTANT:
This temporary password will expire 48 hours after your account is created.
Please log in and change your password within 48 hours.

Login here:
${loginUrl}

If the temporary password expires before you change it, you will need to contact the administrator.

Thank you,
SWU Med System`,

    // HTML version
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>SWU Med Queue System</h2>

        <p>Hello ${firstName},</p>

        <p>
          Your SWU Med Queue System account has been created.
        </p>

        <p><strong>Your temporary password is:</strong></p>

        <div style="
          background-color: #f4f4f4;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 18px;
          font-weight: bold;
          display: inline-block;
          letter-spacing: 1px;
        ">
          ${temporaryPassword}
        </div>

        <div style="
          margin-top: 20px;
          padding: 15px;
          background-color: #fff3cd;
          border: 1px solid #ffeeba;
          border-radius: 6px;
          color: #856404;
        ">
          <strong>Important: Temporary Password Expiration</strong>
          <p style="margin-bottom: 0;">
            This temporary password will expire
            <strong>48 hours after your account is created.</strong>
            Please log in and change your password within 48 hours.
          </p>
        </div>

        <p>
          Please log in using your registered email address and the
          temporary password above.
        </p>

        <p>
          <a
            href="${loginUrl}"
            style="
              display: inline-block;
              background-color: #0066cc;
              color: white;
              padding: 12px 20px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Login to SWU Med Queue System
          </a>
        </p>

        <p>
          If the button does not work, use this link:
          <br />
          <a href="${loginUrl}">${loginUrl}</a>
        </p>

        <p>
          <strong>
            If you do not change your password within 48 hours,
            your temporary password will expire and you will need
            to contact the administrator.
          </strong>
        </p>

        <p>
          Once you successfully change your password, the temporary
          password expiration will no longer apply.
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

module.exports = {
  sendTemporaryPasswordEmail,
};