const mysql = require("mysql2/promise");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, "../.env"),
});

const isLocalHost = ["localhost", "127.0.0.1"].includes(
  process.env.MYSQL_HOST
);

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQL_PORT) || 3306,

  // TiDB Cloud (and most managed hosts) require SSL, but a local/same-server
  // MySQL host (e.g. shared hosting) generally does not support it.
  ssl: isLocalHost
    ? undefined
    : {
        rejectUnauthorized: true,
      },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// The server/DB run in UTC, but the hospital operates in Philippine
// Time (UTC+8). Queue numbering resets rely on MySQL's CURDATE()/NOW(),
// so every connection's session timezone is pinned to Manila time —
// otherwise "midnight" resets would happen at 8:00 AM local time instead.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+08:00'");
});

module.exports = pool;