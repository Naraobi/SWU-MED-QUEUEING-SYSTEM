import db from "../config/mysql.js";

// Get all roles
export const getAllRoles = async () => {
  try {
    const [rows] = await db.query(`
      SELECT
        role_id,
        role,
        description,
        status,
        permissions,
        created_at,
        updated_at
      FROM role
      ORDER BY role ASC
    `);

    return rows;
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

    // MySQL JSON field may come back as a string depending on configuration
    if (typeof rows[0].permissions === "string") {
      try {
        rows[0].permissions = JSON.parse(rows[0].permissions);
      } catch (parseError) {
        rows[0].permissions = [];
      }
    }

    return rows[0];
  } catch (error) {
    console.error("GET ROLE BY ID ERROR:", error);
    throw error;
  }
};

// Create role
export const createRole = async (roleData) => {
  try {
    const {
      role_id,
      role,
      description,
      status,
      permissions
    } = roleData;

    // Validate required fields
    if (!role_id) {
      throw new Error("role_id is required.");
    }

    if (!role || !role.trim()) {
      throw new Error("Role name is required.");
    }

    // Check duplicate role name
    const [existing] = await db.query(
      `
      SELECT role_id
      FROM role
      WHERE LOWER(role) = LOWER(?)
      LIMIT 1
      `,
      [role.trim()]
    );

    if (existing.length > 0) {
      throw new Error("A role with this name already exists.");
    }

    // Insert role into MySQL
    await db.query(
      `
      INSERT INTO role (
        role_id,
        role,
        description,
        status,
        permissions,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        role_id,
        role.trim(),
        description || null,
        status || "Active",
        JSON.stringify(permissions || [])
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
      description,
      status,
      permissions
    } = roleData;

    if (!role || !role.trim()) {
      throw new Error("Role name is required.");
    }

    // Check if another role already uses this name
    const [existing] = await db.query(
      `
      SELECT role_id
      FROM role
      WHERE LOWER(role) = LOWER(?)
        AND role_id != ?
      LIMIT 1
      `,
      [role.trim(), roleId]
    );

    if (existing.length > 0) {
      throw new Error("A role with this name already exists.");
    }

    const [result] = await db.query(
      `
      UPDATE role
      SET
        role = ?,
        description = ?,
        status = ?,
        permissions = ?,
        updated_at = NOW()
      WHERE role_id = ?
      `,
      [
        role.trim(),
        description || null,
        status || "Active",
        JSON.stringify(permissions || []),
        roleId
      ]
    );

    if (result.affectedRows === 0) {
      throw new Error("Role not found.");
    }

    return await getRoleById(roleId);
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);
    throw error;
  }
};

// Delete role
export const deleteRole = async (roleId) => {
  try {
    // Check if role is being used by a user
    const [users] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM user
      WHERE role_id = ?
      `,
      [roleId]
    );

    if (users[0].count > 0) {
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
      message: "Role deleted successfully."
    };
  } catch (error) {
    console.error("DELETE ROLE ERROR:", error);
    throw error;
  }
};