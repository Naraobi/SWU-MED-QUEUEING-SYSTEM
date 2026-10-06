const webpush = require("web-push");

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (!publicKey || !privateKey || !subject) {
  console.warn(
    "[Web Push] VAPID configuration is incomplete."
  );
} else {
  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );
}

module.exports = {
  webpush,
  publicKey,
};