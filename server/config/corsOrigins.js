const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://swumedqs.swucite.tech",
  "https://www.swumedqs.swucite.tech",
  "https://lightsteelblue-mandrill-330485.hostingersite.com",
];

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

module.exports = [...new Set([...defaultOrigins, ...configuredOrigins])];
