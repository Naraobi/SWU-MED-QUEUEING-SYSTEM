const express = require("express");

const {
  getPublicVapidKey,
  subscribeToPush,
} = require("../controllers/pushController");

const router = express.Router();

router.get(
  "/public-key",
  getPublicVapidKey
);

router.post(
  "/subscribe",
  subscribeToPush
);

module.exports = router;