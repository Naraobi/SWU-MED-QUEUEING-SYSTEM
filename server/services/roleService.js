
import db from "../config/mysql.js";

const VALID_ROLE_TYPES = ["superadmin", "admin", "staff"];

// Normalize permissions returned from MySQL
const normalizePermissions = (permissions) => {
  if (Array.isArray(permissions)) {
    return permissions;
  }

  if (typeof permissions === "string") {
    try {
      const parsed = JSON.parse(permissions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

// Normalize role records
const normalizeRole = (role) => ({
  ...role,
  permissions: normalizePermissions(role.permissions),
});

// Get all roles
export const getAllRoles = async () => {
  try {
    const [rows] = await db.query(`
      SELECT
        role_id,
        role,
        role_name,
        description,
        status,
        permissions,
        created_at,
        updated_at
      FROM role
      ORDER BY role ASC, role_name ASC
    `);

    return rows.map(normalizeRole);
  } catch (error) {
    console.error("GET ROLES ERROR:", error);
    throw error;
  }
};

// Get one role by ID
export const getRoleById = async (roleId) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        role_id,
        role,
        role_name,
        description,
        status,
        permissions,
        created_at,
        updated_at
      FROM role
      WHERE role_id = ?
      LIMIT 1
      `,
      [roleId]
    );

    if (!rows[0]) {
      return null;
    }

    return normalizeRole(rows[0]);
  } catch (error) {
    console.error("GET ROLE BY ID ERROR:", error);
    throw error;
  }
};

// Validate role data
const validateRoleData = ({ role, role_name }) => {
  if (
    typeof role !== "string" ||
    !VALID_ROLE_TYPES.includes(role.trim().toLowerCase())
  ) {
    throw new Error(
      "Role classification must be superadmin, admin, or staff."
    );
  }

  if (
    typeof role_name !== "string" ||
    !role_name.trim()
  ) {
    throw new Error("Custom role name is required.");
  }
};

// Check for duplicate role names across ALL classifications
const checkDuplicateRoleName = async (
  role_name,
  excludeRoleId = null
) => {
  let query = `
    SELECT role_id
    FROM role
    WHERE LOWER(TRIM(role_name)) = LOWER(TRIM(?))
  `;

  const params = [role_name];

  // Exclude the current role when updating
  if (excludeRoleId !== null) {
    query += ` AND role_id <> ?`;
    params.push(excludeRoleId);
  }

  query += ` LIMIT 1`;

const [existing] = await db.query(query, params);

console.log('DUPLICATE ROLE CHECK:', {
  searchedName: role_name,
  excludeRoleId,
  query,
  params,
  matches: existing,
});

if (existing.length > 0) {
  throw new Error(
    "A role with this name already exists."
  );
}
};
// Create role
export const createRole = async (roleData) => {
  try {
    const {
      role_id,
      role,
      role_name,
      description,
      status,
      permissions,
    } = roleData;

    if (!role_id) {
      throw new Error("role_id is required.");
    }

    validateRoleData({ role, role_name });

    const normalizedRole = role.trim().toLowerCase();
    const normalizedRoleName = role_name.trim();

   await checkDuplicateRoleName(
  normalizedRoleName
);
    await db.query(
      `
      INSERT INTO role (
        role_id,
        role,
        role_name,
        description,
        status,
        permissions,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        role_id,
        normalizedRole,
        normalizedRoleName,
        description || null,
        status || "Active",
        JSON.stringify(
          Array.isArray(permissions) ? permissions : []
        ),
      ]
    );

    return await getRoleById(role_id);
  } catch (error) {
    console.error("CREATE ROLE ERROR:", error);
    throw error;
  }
};

// Update role
export const updateRole = async (roleId, roleData) => {
  try {
    const {
      role,
      role_name,
      description,
      status,
      permissions,
    } = roleData;

    validateRoleData({ role, role_name });

    const normalizedRole = role.trim().toLowerCase();
    const normalizedRoleName = role_name.trim();

    // Verify the role exists
    const existingRole = await getRoleById(roleId);

    if (!existingRole) {
      throw new Error("Role not found.");
    }

await checkDuplicateRoleName(
  normalizedRoleName,
  roleId
);

    await db.query(
      `
      UPDATE role
      SET
        role = ?,
        role_name = ?,
        description = ?,
        status = ?,
        permissions = ?,
        updated_at = NOW()
      WHERE role_id = ?
      `,
      [
        normalizedRole,
        normalizedRoleName,
        description || null,
        status || "Active",
        JSON.stringify(
          Array.isArray(permissions) ? permissions : []
        ),
        roleId,
      ]
    );

    return await getRoleById(roleId);
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);
    throw error;
  }
};

// Delete role
export const deleteRole = async (roleId) => {
  try {
    // Check whether the role is assigned to a user
    const [users] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM user
      WHERE role_id = ?
      `,
      [roleId]
    );

    if (Number(users[0].count) > 0) {
      throw new Error(
        "This role cannot be deleted because it is assigned to one or more users."
      );
    }

    const [result] = await db.query(
      `
      DELETE FROM role
      WHERE role_id = ?
      `,
      [roleId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Role not found.");
    }

    return {
      success: true,
      message: "Role deleted successfully.",
    };
  } catch (error) {
    console.error("DELETE ROLE ERROR:", error);
    throw error;
  }
};