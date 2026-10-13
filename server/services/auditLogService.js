const pool = require("../config/mysql");

/*
|--------------------------------------------------------------------------
| AUDIT LOG SERVICE
|--------------------------------------------------------------------------
|
| Records who changed what across the admin-managed records (users,
| departments, terminals, roles, positions and kiosks) and reads them
| back for the Reports "Audit Logs" modal.
|
| The table is created lazily with CREATE TABLE IF NOT EXISTS, following
| the same pattern the user deletion log already uses. Every write is
| best-effort: a logging failure must never break the request it came
| from, so errors are logged to the console and swallowed.
|
*/

let tableReady = false;

async function ensureAuditLogsTable() {
  if (tableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      actor_id VARCHAR(100) NULL,
      actor_name VARCHAR(190) NULL,
      actor_role VARCHAR(32) NULL,
      actor_email VARCHAR(190) NULL,
      action VARCHAR(32) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NULL,
      entity_name VARCHAR(190) NULL,
      details TEXT NULL,
      department_id VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_created_at (created_at),
      INDEX idx_audit_entity_type (entity_type),
      INDEX idx_audit_department (department_id)
    )
  `);

  tableReady = true;
}

function toText(value, maxLength) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.slice(0, maxLength);
}

async function recordAudit(entry = {}) {
  try {
    await ensureAuditLogsTable();

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_id,
        actor_name,
        actor_role,
        actor_email,
        action,
        entity_type,
        entity_id,
        entity_name,
        details,
        department_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        toText(entry.actorId, 100),
        toText(entry.actorName, 190),
        toText(entry.actorRole, 32),
        toText(entry.actorEmail, 190),
        toText(entry.action, 32),
        toText(entry.entityType, 50),
        toText(entry.entityId, 100),
        toText(entry.entityName, 190),
        toText(entry.details, 1000),
        toText(entry.departmentId, 100),
      ]
    );
  } catch (error) {
    console.error("AUDIT LOG WRITE ERROR:", error.message);
  }
}

async function listAuditLogs({
  startDate,
  endDate,
  search,
  action,
  entityType,
  departmentId,
  limit = 100,
  offset = 0,
} = {}) {
  await ensureAuditLogsTable();

  const where = [];
  const params = [];

  if (startDate) {
    where.push("DATE(created_at) >= ?");
    params.push(startDate);
  }

  if (endDate) {
    where.push("DATE(created_at) <= ?");
    params.push(endDate);
  }

  if (action) {
    where.push("action = ?");
    params.push(action);
  }

  if (entityType) {
    where.push("entity_type = ?");
    params.push(entityType);
  }

  if (departmentId) {
    where.push("department_id = ?");
    params.push(departmentId);
  }

  if (search) {
    where.push(
      `(actor_name LIKE ?
        OR entity_name LIKE ?
        OR details LIKE ?
        OR entity_type LIKE ?
        OR action LIKE ?)`
    );

    const like = `%${search}%`;

    params.push(like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`,
    params
  );

  const [rows] = await pool.query(
    `
    SELECT
      log_id,
      actor_id,
      actor_name,
      actor_role,
      actor_email,
      action,
      entity_type,
      entity_id,
      entity_name,
      details,
      department_id,
      created_at
    FROM audit_logs
    ${whereSql}
    ORDER BY created_at DESC, log_id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, safeOffset]
  );

  return {
    total: Number(countRows[0]?.total) || 0,
    logs: rows.map((row) => ({
      logId: row.log_id,
      actorId: row.actor_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      actorEmail: row.actor_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      details: row.details,
      departmentId: row.department_id,
      createdAt: row.created_at,
    })),
  };
}

module.exports = {
  ensureAuditLogsTable,
  recordAudit,
  listAuditLogs,
};
