const pool = require("../config/mysql");
const { publicKey } = require("../config/webPush");

// =====================================================
// GET PUBLIC VAPID KEY
// =====================================================

async function getPublicVapidKey(req, res) {
  try {
    if (!publicKey) {
      return res.status(500).json({
        success: false,
        message: "Web Push is not configured.",
      });
    }

    return res.json({
      success: true,
      publicKey,
    });
  } catch (error) {
    console.error(
      "[Web Push] Failed to get VAPID public key:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to get Web Push configuration.",
    });
  }
}

// =====================================================
// SAVE PUSH SUBSCRIPTION
// =====================================================

async function subscribeToPush(req, res) {
  try {
    const {
      queue_id,
      endpoint,
      keys,
    } = req.body;

    if (
      !endpoint ||
      !keys ||
      !keys.p256dh ||
      !keys.auth
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription.",
      });
    }

    const [existing] = await pool.query(
      `
      SELECT id
      FROM push_subscriptions
      WHERE endpoint = ?
      LIMIT 1
      `,
      [endpoint]
    );

    if (existing.length > 0) {
      await pool.query(
        `
        UPDATE push_subscriptions
        SET
          queue_id = ?,
          p256dh = ?,
          auth = ?
        WHERE endpoint = ?
        `,
        [
          queue_id || null,
          keys.p256dh,
          keys.auth,
          endpoint,
        ]
      );

      return res.json({
        success: true,
        message: "Push subscription updated.",
      });
    }

    await pool.query(
      `
      INSERT INTO push_subscriptions
      (
        queue_id,
        endpoint,
        p256dh,
        auth
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        queue_id || null,
        endpoint,
        keys.p256dh,
        keys.auth,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Push subscription saved.",
    });
  } catch (error) {
    console.error(
      "[Web Push] Subscribe error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save push subscription.",
      error: error.message,
    });
  }
}

module.exports = {
  getPublicVapidKey,
  subscribeToPush,
};