const { randomUUID } = require("crypto");

const pool = require("../config/mysql");

/*
|--------------------------------------------------------------------------
| NORMALIZE STATUS
|--------------------------------------------------------------------------
*/

function normalizeStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  return normalized === "inactive"
    ? "inactive"
    : "active";
}

/*
|--------------------------------------------------------------------------
| FORMAT POSITION
|--------------------------------------------------------------------------
*/

function formatPosition(row) {
  let tabs = [];

  if (Array.isArray(row.tabs)) {
    tabs = row.tabs;
  } else if (typeof row.tabs === "string" && row.tabs.trim()) {
    try {
      const parsed = JSON.parse(row.tabs);

      if (Array.isArray(parsed)) {
        tabs = parsed;
      }
    } catch {
      tabs = row.tabs
        .split(",")
        .map((tab) => tab.trim())
        .filter(Boolean);
    }
  }

  return {
    position_id: row.position_id,
    name: row.name || "",
    status:
      String(row.status || "").toLowerCase() === "inactive"
        ? "inactive"
        : "active",
    tabs,
    users: Number(row.users || 0),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

/*
|--------------------------------------------------------------------------
| VALIDATE POSITION
|--------------------------------------------------------------------------
*/

function validatePositionData(positionData = {}) {
  const name = String(positionData.name || "").trim();

  if (!name) {
    throw new Error("Position name is required.");
  }

  const tabs = Array.isArray(positionData.tabs)
    ? positionData.tabs
    : [];

  if (tabs.length === 0) {
    throw new Error(
      "At least one feature access tab is required."
    );
  }

  return {
    name,
    status: normalizeStatus(positionData.status),
    tabs,
  };
}

/*
|--------------------------------------------------------------------------
| CHECK DUPLICATE NAME
|--------------------------------------------------------------------------
*/

async function positionNameExists(
  name,
  excludePositionId = null
) {
  let sql = `
    SELECT position_id
    FROM \`position\`
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
  `;

  const params = [name];

  if (excludePositionId) {
    sql += `
      AND position_id <> ?
    `;

    params.push(excludePositionId);
  }

  sql += `
    LIMIT 1
  `;

  const [rows] = await pool.query(
    sql,
    params
  );

  return rows.length > 0;
}

/*
|--------------------------------------------------------------------------
| GET ALL POSITIONS
|--------------------------------------------------------------------------
*/

async function getPositions() {
  const [rows] = await pool.query(`
    SELECT
      position_id,
      name,
      status,
      tabs,
      created_at,
      updated_at
    FROM \`position\`
    ORDER BY name ASC
  `);

  /*
   * User count is intentionally handled separately for now.
   * This keeps Position Management independent from the current
   * user table structure.
   */
  return rows.map((row) =>
    formatPosition({
      ...row,
      users: 0,
    })
  );
}

/*
|--------------------------------------------------------------------------
| GET POSITION BY ID
|--------------------------------------------------------------------------
*/

async function getPositionById(positionId) {
  const [rows] = await pool.query(
    `
    SELECT
      position_id,
      name,
      status,
      tabs,
      created_at,
      updated_at
    FROM \`position\`
    WHERE position_id = ?
    LIMIT 1
    `,
    [positionId]
  );

  if (rows.length === 0) {
    return null;
  }

  return formatPosition({
    ...rows[0],
    users: 0,
  });
}

/*
|--------------------------------------------------------------------------
| CREATE POSITION
|--------------------------------------------------------------------------
*/

async function createPosition(positionData = {}) {
  const {
    name,
    status,
    tabs,
  } = validatePositionData(
    positionData
  );

  const duplicate =
    await positionNameExists(name);

  if (duplicate) {
    throw new Error(
      "A position with this name already exists."
    );
  }

  const positionId = randomUUID();

  await pool.query(
    `
    INSERT INTO \`position\` (
      position_id,
      name,
      status,
      tabs
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      positionId,
      name,
      status,
      JSON.stringify(tabs),
    ]
  );

  return getPositionById(positionId);
}

/*
|--------------------------------------------------------------------------
| UPDATE POSITION
|--------------------------------------------------------------------------
*/

async function updatePosition(
  positionId,
  positionData = {}
) {
  if (!positionId) {
    throw new Error(
      "Position ID is required."
    );
  }

  const {
    name,
    status,
    tabs,
  } = validatePositionData(
    positionData
  );

  const existing =
    await getPositionById(positionId);

  if (!existing) {
    throw new Error(
      "Position not found."
    );
  }

  const duplicate =
    await positionNameExists(
      name,
      positionId
    );

  if (duplicate) {
    throw new Error(
      "A position with this name already exists."
    );
  }

  await pool.query(
    `
    UPDATE \`position\`
    SET
      name = ?,
      status = ?,
      tabs = ?
    WHERE position_id = ?
    `,
    [
      name,
      status,
      JSON.stringify(tabs),
      positionId,
    ]
  );

  return getPositionById(positionId);
}

/*
|--------------------------------------------------------------------------
| DELETE POSITION
|--------------------------------------------------------------------------
*/

async function deletePosition(positionId) {
  if (!positionId) {
    throw new Error(
      "Position ID is required."
    );
  }

  const existing =
    await getPositionById(positionId);

  if (!existing) {
    throw new Error(
      "Position not found."
    );
  }

  await pool.query(
    `
    DELETE FROM \`position\`
    WHERE position_id = ?
    `,
    [positionId]
  );

  return {
    position_id: positionId,
    deleted: true,
  };
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  getPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
};