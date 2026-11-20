const express = require("express");
const crypto = require("crypto");
const {
  db,
  storage,
  storageBucketCandidates,
} = require("../config/firebase");
const { authenticateRequest, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();
const BRANDING_DOC = "system/branding";
const DEFAULTS = {
  systemName: "SWUMed Queuing System",
  logo: null,
  loginBackground: null,
  accent: "#9D0A0E",
};

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i;
const STORAGE_URL = /^https:\/\/firebasestorage\.googleapis\.com\//i;
const MAX_IMAGE_BYTES = 1.2 * 1024 * 1024;

function storageUrl(bucketName, filePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    filePath
  )}?alt=media`;
}

async function uploadImage(filePath, buffer, contentType) {
  let lastError = null;

  for (const bucketName of storageBucketCandidates) {
    try {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);

      await file.save(buffer, {
        resumable: false,
        metadata: {
          contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
      });

      return storageUrl(bucket.name, filePath);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No Firebase Storage bucket is configured.");
}

router.get("/", async (_req, res) => {
  try {
    const snapshot = await db.doc(BRANDING_DOC).get();
    res.json({
      success: true,
      data: snapshot.exists ? { ...DEFAULTS, ...snapshot.data() } : DEFAULTS,
    });
  } catch (error) {
    console.error("Failed to load public branding:", error);
    res.status(500).json({ success: false, message: "Failed to load branding." });
  }
});

router.post(
  "/upload/:kind",
  authenticateRequest,
  authorizeRoles("superadmin"),
  async (req, res) => {
    const kind = String(req.params.kind || "");
    const allowedKinds = new Set(["logo", "login-background"]);

    if (!allowedKinds.has(kind)) {
      return res.status(400).json({ success: false, message: "Unknown branding image type." });
    }

    const image = typeof req.body?.image === "string" ? req.body.image : "";
    const match = IMAGE_DATA_URL.exec(image);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Choose a PNG, JPG, WEBP or SVG image.",
      });
    }

    const contentType = `image/${match[1].toLowerCase()}`;

    if (kind === "login-background" && contentType === "image/svg+xml") {
      return res.status(400).json({
        success: false,
        message: "The login background must be a PNG, JPG or WEBP image.",
      });
    }

    const buffer = Buffer.from(image.slice(match[0].length), "base64");

    if (!buffer.length) {
      return res.status(400).json({ success: false, message: "That image is empty." });
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({
        success: false,
        message: "That image is too large. Choose an image under 1.2 MB.",
      });
    }

    const extensions = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };

    const filePath = `branding/${kind}/${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}.${extensions[contentType]}`;

    try {
      const url = await uploadImage(filePath, buffer, contentType);
      return res.json({ success: true, data: { url } });
    } catch (error) {
      console.error("Failed to upload branding image:", error);
      return res.status(503).json({
        success: false,
        message:
          "Image storage is not available yet. Enable Firebase Storage and publish the Storage rules, then try again. Your current branding was not changed.",
      });
    }
  }
);

router.put("/", authenticateRequest, authorizeRoles("superadmin"), async (req, res) => {
  const systemName =
    String(req.body?.systemName || "").trim().slice(0, 120) ||
    DEFAULTS.systemName;
  const logo = req.body?.logo || null;
  const loginBackground = req.body?.loginBackground || null;
  const accent = /^#[0-9a-f]{6}$/i.test(req.body?.accent || "")
    ? req.body.accent
    : DEFAULTS.accent;

  if (logo !== null) {
    const isDataUrl = typeof logo === "string" && IMAGE_DATA_URL.test(logo);
    const isStorageUrl = typeof logo === "string" && STORAGE_URL.test(logo);

    if (!isDataUrl && !isStorageUrl) {
      return res.status(400).json({
        success: false,
        message: "Logo must be an uploaded image or an image data URL.",
      });
    }

    if (isDataUrl && Buffer.byteLength(logo, "utf8") > 900 * 1024) {
      return res.status(413).json({
        success: false,
        message: "Logo is too large to publish. Choose a smaller image (under 650 KB).",
      });
    }
  }

  if (
    loginBackground !== null &&
    (typeof loginBackground !== "string" || !STORAGE_URL.test(loginBackground))
  ) {
    return res.status(400).json({
      success: false,
      message: "Upload the login background before saving.",
    });
  }

  try {
    const data = {
      systemName,
      logo,
      loginBackground,
      accent,
      updatedAt: new Date().toISOString(),
    };

    await db.doc(BRANDING_DOC).set(data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Failed to save public branding:", error);
    res.status(500).json({ success: false, message: "Failed to save branding." });
  }
});

module.exports = router;
