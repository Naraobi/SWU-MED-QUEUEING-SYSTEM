const express = require("express");
const { db } = require("../config/firebase");
const { authenticateRequest, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();
const BRANDING_DOC = "system/branding";
const DEFAULTS = { systemName: "SWUMed Queuing System", logo: null, accent: "#9D0A0E" };

router.get("/", async (_req, res) => {
  try {
    const snapshot = await db.doc(BRANDING_DOC).get();
    res.json({ success: true, data: snapshot.exists ? { ...DEFAULTS, ...snapshot.data() } : DEFAULTS });
  } catch (error) {
    console.error("Failed to load public branding:", error);
    res.status(500).json({ success: false, message: "Failed to load branding." });
  }
});

router.put("/", authenticateRequest, authorizeRoles("superadmin"), async (req, res) => {
  const systemName = String(req.body?.systemName || "").trim().slice(0, 120) || DEFAULTS.systemName;
  const logo = req.body?.logo || null;
  const accent = /^#[0-9a-f]{6}$/i.test(req.body?.accent || "") ? req.body.accent : DEFAULTS.accent;

  if (logo !== null && (typeof logo !== "string" || !/^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.test(logo) || Buffer.byteLength(logo, "utf8") > 900 * 1024)) {
    return res.status(413).json({ success: false, message: "Logo is too large to publish. Choose a smaller image (under 650 KB)." });
  }

  try {
    const data = { systemName, logo, accent, updatedAt: new Date().toISOString() };
    await db.doc(BRANDING_DOC).set(data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Failed to save public branding:", error);
    res.status(500).json({ success: false, message: "Failed to save branding." });
  }
});

module.exports = router;
