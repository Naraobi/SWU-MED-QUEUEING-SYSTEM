const { randomUUID } = require("crypto");

const {
  generateTemporaryPassword,
} = require("../utils/passwordGenerator");

const {
  sendTemporaryPasswordEmail,
} = require("../utils/emailService");

const pool = require("../config/mysql");
const { db, auth } = require("../config/firebase");

const {
  getDatabaseMode,
} = require("./databaseService");

const {
  cleanupStaleAssignments,
} = require("./counterService");

const USERS_COLLECTION = "users";

/*
|--------------------------------------------------------------------------
| STATUS HELPERS
|--------------------------------------------------------------------------
*/

function toMySQLStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "inactive" ||
    normalized === "deactivated"
  ) {
    return "inactive";
  }

  return "active";
}

function toFrontendStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "inactive" ||
    normalized === "deactivated"
  ) {
    return "Inactive";
  }

  return "Active";
}

/*
|--------------------------------------------------------------------------
| DISPLAY NAME
|--------------------------------------------------------------------------
*/

function buildDisplayName(user) {
  return `${user.first_name || ""} ${user.last_name || ""}`
    .trim();
}

/*
|--------------------------------------------------------------------------
| POSITION HELPERS
|--------------------------------------------------------------------------
*/

/*
 * Position is currently stored in the `user.position` column
 * as the POSITION NAME.
 *
 * Example:
 *
 * user.position = "Manager"
 *
 * This matches:
 *
 * position.name = "Manager"
 *
 * NULL means the user has no assigned position and therefore
 * receives the existing full-access behavior.
 */

function normalizePositionValue(position) {
  if (
    position === null ||
    position === undefined
  ) {
    return null;
  }

  const normalized = String(position).trim();

  if (
    normalized === "" ||
    normalized.toLowerCase() === "null" ||
    normalized.toLowerCase() === "undefined"
  ) {
    return null;
  }

  return normalized;
}

/*
 * MySQL JSON columns can be returned as:
 *
 * - an array
 * - a JSON string
 * - a comma-separated string
 * - null
 *
 * Normalize everything into an array.
 */

function normalizePositionTabs(tabs) {
  if (Array.isArray(tabs)) {
    return tabs
      .map((tab) =>
        String(tab).trim()
      )
      .filter(Boolean);
  }

  if (
    typeof tabs === "string" &&
    tabs.trim()
  ) {
    try {
      const parsed =
        JSON.parse(tabs);

      if (Array.isArray(parsed)) {
        return parsed
          .map((tab) =>
            String(tab).trim()
          )
          .filter(Boolean);
      }
    } catch {
      return tabs
        .split(",")
        .map((tab) =>
          tab.trim()
        )
        .filter(Boolean);
    }
  }

  return [];
}

/*
|--------------------------------------------------------------------------
| NORMALIZE USER PROFILE
|--------------------------------------------------------------------------
*/

function normalizeUserProfile(user) {
  if (!user) {
    return null;
  }

  const departmentPrefix =
    user.department_prefix ||
    user.departmentPrefix ||
    user.prefix ||
    null;

  const normalizedPosition =
    normalizePositionValue(
      user.position
    );

  return {
    user_id:
      user.user_id || null,

    firebase_uid:
      user.firebase_uid ||
      user.firebaseUid ||
      null,

    first_name:
      user.first_name || "",

    last_name:
      user.last_name || "",

    mi:
      user.mi || null,

    contact_number:
      user.contact_number || null,

    email:
      user.email || "",

    role_id:
      user.role_id || null,

    role:
      user.role || "",

    /*
    |--------------------------------------------------------------------------
    | POSITION
    |--------------------------------------------------------------------------
    */

    position:
      normalizedPosition,

    position_id:
      user.position_id || null,

    position_name:
      user.position_name ||
      normalizedPosition ||
      null,

    position_tabs:
      normalizePositionTabs(
        user.position_tabs
      ),

    position_status:
      user.position_status || null,

    kiosk_id:
      user.kiosk_id || null,

    kiosk:
      user.kiosk || null,

    department_id:
      user.department_id || null,

    department:
      user.department || null,

    department_prefix:
      departmentPrefix,

    departmentPrefix:
      departmentPrefix,

    status:
      toFrontendStatus(
        user.status
      ),

    /*
    |--------------------------------------------------------------------------
    | PASSWORD CHANGE STATUS
    |--------------------------------------------------------------------------
    */

    must_change_password:
      Boolean(
        user.must_change_password
      ),

    password_changed_at:
      user.password_changed_at ||
      null,

    /*
    |--------------------------------------------------------------------------
    | TEMPORARY PASSWORD EXPIRATION
    |--------------------------------------------------------------------------
    */

    temporary_password_expires_at:
      user.temporary_password_expires_at ||
      null,

    created_at:
      user.created_at || null,

    updated_at:
      user.updated_at || null,
  };
}

/*
|--------------------------------------------------------------------------
| GET ALL USERS
|--------------------------------------------------------------------------
*/

async function getUsers() {
  try {
    return await getUsersFromMySQL();
  } catch (mysqlError) {
    console.error(
      "MYSQL GET USERS ERROR:",
      mysqlError.message
    );

    try {
      const snapshot =
        await db
          .collection(
            USERS_COLLECTION
          )
          .get();

      const users =
        snapshot.docs.map((doc) => {
          const data =
            doc.data();

          return normalizeUserProfile({
            ...data,

            user_id:
              data.user_id ||
              doc.id,
          });
        });

      users.sort((a, b) =>
        String(
          a.last_name || ""
        ).localeCompare(
          String(
            b.last_name || ""
          )
        )
      );

      return users;
    } catch (firebaseError) {
      console.error(
        "FIRESTORE GET USERS FALLBACK ERROR:",
        firebaseError.message
      );

      throw new Error(
        "Unable to retrieve users from MySQL or Firestore."
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET USERS FROM MYSQL
|--------------------------------------------------------------------------
*/

async function getUsersFromMySQL() {
  const [rows] =
    await pool.query(`
      SELECT
        u.user_id,
        u.firebase_uid,
        u.first_name,
        u.last_name,
        u.mi,
        u.contact_number,
        u.email,
        u.role_id,
        r.role,
        u.position,

        p.position_id AS position_id,
        p.name AS position_name,
        p.tabs AS position_tabs,
        p.status AS position_status,

        u.kiosk_id,
        u.kiosk,
        u.department_id,

        COALESCE(
          d.name,
          u.department
        ) AS department,

        d.prefix AS department_prefix,

        u.status,
        u.must_change_password,
        u.password_changed_at,
        u.temporary_password_expires_at,
        u.created_at,
        u.updated_at

      FROM \`user\` u

      LEFT JOIN \`role\` r
        ON r.role_id = u.role_id

      LEFT JOIN \`department\` d
        ON d.department_id =
           u.department_id

      LEFT JOIN \`position\` p
        ON LOWER(
          TRIM(p.name)
        ) = LOWER(
          TRIM(u.position)
        )

      ORDER BY
        u.last_name ASC,
        u.first_name ASC
    `);

  return rows.map((user) =>
    normalizeUserProfile(user)
  );
}

/*
|--------------------------------------------------------------------------
| GET ONE USER
|--------------------------------------------------------------------------
*/

async function getUserById(userId) {
  try {
    return await getUserFromMySQL(
      userId
    );
  } catch (mysqlError) {
    console.error(
      "MYSQL GET USER ERROR:",
      mysqlError.message
    );

    try {
      const userDoc =
        await db
          .collection(
            USERS_COLLECTION
          )
          .doc(userId)
          .get();

      if (!userDoc.exists) {
        return null;
      }

      const data =
        userDoc.data();

      return normalizeUserProfile({
        ...data,

        user_id:
          data.user_id ||
          userDoc.id,
      });
    } catch (firebaseError) {
      console.error(
        "FIRESTORE GET USER FALLBACK ERROR:",
        firebaseError.message
      );

      throw new Error(
        "Unable to retrieve the user."
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET ONE USER FROM MYSQL
|--------------------------------------------------------------------------
*/

async function getUserFromMySQL(
  userId
) {
  const [rows] =
    await pool.query(
      `
      SELECT
        u.user_id,
        u.firebase_uid,
        u.first_name,
        u.last_name,
        u.mi,
        u.contact_number,
        u.email,
        u.role_id,
        r.role,
        u.position,

        p.position_id AS position_id,
        p.name AS position_name,
        p.tabs AS position_tabs,
        p.status AS position_status,

        u.kiosk_id,
        u.kiosk,
        u.department_id,

        COALESCE(
          d.name,
          u.department
        ) AS department,

        d.prefix AS department_prefix,

        u.status,
        u.must_change_password,
        u.password_changed_at,
        u.temporary_password_expires_at,
        u.created_at,
        u.updated_at

      FROM \`user\` u

      LEFT JOIN \`role\` r
        ON r.role_id = u.role_id

      LEFT JOIN \`department\` d
        ON d.department_id =
           u.department_id

      LEFT JOIN \`position\` p
        ON LOWER(
          TRIM(p.name)
        ) = LOWER(
          TRIM(u.position)
        )

      WHERE u.user_id = ?

      LIMIT 1
      `,
      [userId]
    );

  if (rows.length === 0) {
    return null;
  }

  return normalizeUserProfile(
    rows[0]
  );
}

/*
|--------------------------------------------------------------------------
| GET USER BY FIREBASE UID
|--------------------------------------------------------------------------
*/

async function getUserByFirebaseUid(
  firebaseUid
) {
  const normalizedUid =
    String(
      firebaseUid || ""
    ).trim();

  if (!normalizedUid) {
    return null;
  }

  const [rows] =
    await pool.query(
      `
      SELECT
        u.user_id,
        u.firebase_uid,
        u.first_name,
        u.last_name,
        u.mi,
        u.contact_number,
        u.email,
        u.role_id,
        r.role,
        u.position,

        p.position_id AS position_id,
        p.name AS position_name,
        p.tabs AS position_tabs,
        p.status AS position_status,

        u.kiosk_id,
        u.kiosk,
        u.department_id,

        COALESCE(
          d.name,
          u.department
        ) AS department,

        d.prefix AS department_prefix,

        u.status,
        u.must_change_password,
        u.password_changed_at,
        u.temporary_password_expires_at,
        u.created_at,
        u.updated_at

      FROM \`user\` u

      LEFT JOIN \`role\` r
        ON r.role_id = u.role_id

      LEFT JOIN \`department\` d
        ON d.department_id =
           u.department_id

      LEFT JOIN \`position\` p
        ON LOWER(
          TRIM(p.name)
        ) = LOWER(
          TRIM(u.position)
        )

      WHERE u.firebase_uid = ?

      LIMIT 1
      `,
      [normalizedUid]
    );

  if (rows.length === 0) {
    return null;
  }

  return normalizeUserProfile(
    rows[0]
  );
}

/*
|--------------------------------------------------------------------------
| GET AUTHENTICATED USER PROFILE
|--------------------------------------------------------------------------
|
| Firebase Authentication verifies the Firebase login.
|
| MySQL supplies the application profile.
|
| Position permissions are loaded through the `position` table.
|
|--------------------------------------------------------------------------
*/

async function getAuthenticatedUserProfile(
  firebaseUid,
  firebaseEmail = null,
  emailVerified = true
) {
  if (!firebaseUid) {
    throw new Error(
      "Firebase UID is required."
    );
  }

  let user =
    await getUserByFirebaseUid(
      firebaseUid
    );

  /*
  |--------------------------------------------------------------------------
  | MIGRATION FALLBACK
  |--------------------------------------------------------------------------
  */

  if (!user && firebaseEmail) {
    user =
      await getUserByEmailFromMySQL(
        firebaseEmail
      );

    if (user) {
      try {
        await pool.query(
          `
          UPDATE \`user\`
          SET
            firebase_uid = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
          `,
          [
            firebaseUid,
            user.user_id,
          ]
        );

        user.firebase_uid =
          firebaseUid;

        console.log(
          `Firebase UID linked to MySQL user: ${user.user_id}`
        );
      } catch (error) {
        console.error(
          "FIREBASE UID LINK ERROR:",
          error.message
        );

        throw new Error(
          "The user was found, but the Firebase account could not be linked to the MySQL profile."
        );
      }
    }
  }

  if (!user) {
    throw new Error(
      "Your Firebase account is authenticated, but no application user profile was found."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ACCOUNT STATUS
  |--------------------------------------------------------------------------
  */

  if (
    String(
      user.status || ""
    ).toLowerCase() ===
    "inactive"
  ) {
    throw new Error(
      "This account has been disabled."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | TEMPORARY PASSWORD EXPIRATION
  |--------------------------------------------------------------------------
  */

  if (
    Boolean(
      user.must_change_password
    ) &&
    user.temporary_password_expires_at
  ) {
    const expirationDate =
      new Date(
        user.temporary_password_expires_at
      );

    if (
      !Number.isNaN(
        expirationDate.getTime()
      ) &&
      expirationDate <= new Date()
    ) {
      const error =
        new Error(
          "Your temporary password has expired. Please contact the administrator."
        );

      error.code =
        "TEMPORARY_PASSWORD_EXPIRED";

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | ROLE VALIDATION
  |--------------------------------------------------------------------------
  */

  const roleName =
    String(
      typeof user.role ===
        "object"
        ? user.role?.role
        : user.role || ""
    )
      .trim()
      .toLowerCase();

  const allowedRoles =
    new Set([
      "superadmin",
      "admin",
      "staff",
    ]);

  if (
    !allowedRoles.has(
      roleName
    )
  ) {
    throw new Error(
      "Your account does not have a valid role."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DEPARTMENT VALIDATION
  |--------------------------------------------------------------------------
  */

  const department =
    String(
      user.department || ""
    ).trim();

  if (
    roleName !== "superadmin" &&
    !department
  ) {
    const roleLabel =
      roleName === "admin"
        ? "Admin"
        : "Staff";

    throw new Error(
      `${roleLabel} accounts must be assigned to a department before they can log in.`
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DEPARTMENT PREFIX VALIDATION
  |--------------------------------------------------------------------------
  */

  const departmentPrefix =
    String(
      user.department_prefix ||
        user.departmentPrefix ||
        ""
    ).trim();

  if (
    roleName !== "superadmin" &&
    !departmentPrefix
  ) {
    const roleLabel =
      roleName === "admin"
        ? "Admin"
        : "Staff";

    throw new Error(
      `${roleLabel} accounts must be assigned to a department with a valid queue prefix before they can log in.`
    );
  }

  return {
    ...user,

    firebase_uid:
      firebaseUid,

    uid:
      firebaseUid,

    email:
      user.email ||
      firebaseEmail ||
      "",

    emailVerified:
      Boolean(emailVerified),

    role:
      roleName,

    status:
      toFrontendStatus(
        user.status
      ),

    position:
      normalizePositionValue(
        user.position
      ),

    position_id:
      user.position_id ||
      null,

    position_name:
      user.position_name ||
      normalizePositionValue(
        user.position
      ) ||
      null,

    position_tabs:
      normalizePositionTabs(
        user.position_tabs
      ),

    position_status:
      user.position_status ||
      null,

    department_prefix:
      departmentPrefix ||
      null,

    departmentPrefix:
      departmentPrefix ||
      null,

    must_change_password:
      Boolean(
        user.must_change_password
      ),

    password_changed_at:
      user.password_changed_at ||
      null,

    temporary_password_expires_at:
      user.temporary_password_expires_at ||
      null,
  };
}

/*
|--------------------------------------------------------------------------
| CHECK EMAIL IN MYSQL
|--------------------------------------------------------------------------
*/

async function emailExists(
  email,
  excludeUserId = null
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  let sql = `
    SELECT user_id
    FROM \`user\`
    WHERE LOWER(email) = ?
  `;

  const params = [
    normalizedEmail,
  ];

  if (excludeUserId) {
    sql +=
      ` AND user_id <> ?`;

    params.push(
      excludeUserId
    );
  }

  sql += ` LIMIT 1`;

  const [rows] =
    await pool.query(
      sql,
      params
    );

  return rows.length > 0;
}

/*
|--------------------------------------------------------------------------
| CHECK EMAIL IN FIRESTORE
|--------------------------------------------------------------------------
*/

async function emailExistsInFirebase(
  email
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const snapshot =
    await db
      .collection(
        USERS_COLLECTION
      )
      .where(
        "email",
        "==",
        normalizedEmail
      )
      .limit(1)
      .get();

  return !snapshot.empty;
}

/*
|--------------------------------------------------------------------------
| GET FIREBASE AUTH USER BY EMAIL
|--------------------------------------------------------------------------
*/

async function getFirebaseAuthUserByEmail(
  email
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  try {
    return await auth.getUserByEmail(
      normalizedEmail
    );
  } catch (error) {
    if (
      error.code ===
      "auth/user-not-found"
    ) {
      return null;
    }

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| CHECK FIREBASE AUTH EMAIL
|--------------------------------------------------------------------------
*/

async function emailExistsInFirebaseAuth(
  email,
  excludeUid = null
) {
  const firebaseUser =
    await getFirebaseAuthUserByEmail(
      email
    );

  if (!firebaseUser) {
    return false;
  }

  if (
    excludeUid &&
    firebaseUser.uid ===
      excludeUid
  ) {
    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| GET ROLE
|--------------------------------------------------------------------------
*/

async function getRoleByIdFromMySQL(
  roleId
) {
  if (!roleId) {
    return null;
  }

  const [rows] =
    await pool.query(
      `
      SELECT
        role_id,
        role,
        description,
        status,
        permissions

      FROM \`role\`

      WHERE role_id = ?

      LIMIT 1
      `,
      [roleId]
    );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

/*
|--------------------------------------------------------------------------
| LEGACY LOGIN / AUTHENTICATE USER
|--------------------------------------------------------------------------
*/

async function authenticateUser() {
  throw new Error(
    "Password authentication is handled by Firebase Authentication. Please use Firebase Authentication login."
  );
}

/*
|--------------------------------------------------------------------------
| CREATE USER
|--------------------------------------------------------------------------
*/

async function createUser(
  userData
) {
  console.log(
    "🔥 BACKEND CREATE USER CALLED"
  );

  const userId =
    userData.user_id ||
    randomUUID();

  /*
  |--------------------------------------------------------------------------
  | GENERATE TEMPORARY PASSWORD
  |--------------------------------------------------------------------------
  */

  const temporaryPassword =
    generateTemporaryPassword();

  /*
  |--------------------------------------------------------------------------
  | TEMPORARY PASSWORD EXPIRES IN 48 HOURS
  |--------------------------------------------------------------------------
  */

  const temporaryPasswordExpiresAt =
    new Date(
      Date.now() +
        48 * 60 * 60 * 1000
    );

  console.log(
    "TEMPORARY PASSWORD EXPIRATION GENERATED:",
    temporaryPasswordExpiresAt
  );

  const profile = {
    user_id:
      userId,

    firebase_uid:
      null,

    first_name:
      userData.first_name || "",

    last_name:
      userData.last_name || "",

    mi:
      userData.mi || null,

    contact_number:
      userData.contact_number || null,

    email:
      String(
        userData.email || ""
      )
        .trim()
        .toLowerCase(),

    role_id:
      userData.role_id || null,

    role:
      userData.role || "",

    /*
    |--------------------------------------------------------------------------
    | POSITION
    |--------------------------------------------------------------------------
    */

    position:
      normalizePositionValue(
        userData.position
      ),

    kiosk_id:
      userData.kiosk_id || null,

    kiosk:
      userData.kiosk || null,

    department_id:
      userData.department_id || null,

    department:
      userData.department || null,

    department_prefix:
      userData.department_prefix ||
      userData.departmentPrefix ||
      userData.prefix ||
      null,

    status:
      userData.status ||
      "Active",

    /*
    |--------------------------------------------------------------------------
    | NEW ACCOUNT PASSWORD STATUS
    |--------------------------------------------------------------------------
    */

    must_change_password:
      true,

    password_changed_at:
      null,

    temporary_password_expires_at:
      temporaryPasswordExpiresAt,
  };

  if (!profile.email) {
    throw new Error(
      "Email is required."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL DUPLICATE CHECK
  |--------------------------------------------------------------------------
  */

  if (
    await emailExists(
      profile.email
    )
  ) {
    throw new Error(
      "A user with this email already exists."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FIREBASE AUTH DUPLICATE CHECK
  |--------------------------------------------------------------------------
  */

  if (
    await emailExistsInFirebaseAuth(
      profile.email
    )
  ) {
    throw new Error(
      "A user with this email already exists in Firebase Authentication."
    );
  }

  const mode =
    await getDatabaseMode();

  /*
  |--------------------------------------------------------------------------
  | NEW LOGIN ACCOUNTS REQUIRE FIREBASE
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    throw new Error(
      "Firebase Authentication is required to create a new login account."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FIREBASE MODE
  |--------------------------------------------------------------------------
  */

  if (mode === "firebase") {
    let firebaseUser = null;

    /*
    |--------------------------------------------------------------------------
    | STEP 1 — CREATE FIREBASE AUTH ACCOUNT
    |--------------------------------------------------------------------------
    */

    try {
      firebaseUser =
        await auth.createUser({
          email:
            profile.email,

          password:
            temporaryPassword,

          displayName:
            buildDisplayName(
              profile
            ),

          disabled:
            toMySQLStatus(
              profile.status
            ) === "inactive",
        });

      console.log(
        `Firebase Authentication user created: ${firebaseUser.uid}`
      );
    } catch (error) {
      console.error(
        "FIREBASE AUTH CREATE USER ERROR:",
        error.message
      );

      throw new Error(
        `User was not created in Firebase Authentication: ${error.message}`
      );
    }

    profile.firebase_uid =
      firebaseUser.uid;

    /*
    |--------------------------------------------------------------------------
    | STEP 2 — CREATE MYSQL PROFILE
    |--------------------------------------------------------------------------
    */

    try {
      await insertUserIntoMySQL(
        profile
      );

      console.log(
        `MySQL user created: ${profile.user_id}`
      );
    } catch (mysqlError) {
      console.error(
        "MYSQL CREATE USER ERROR:",
        mysqlError.message
      );

      /*
      |--------------------------------------------------------------------------
      | ROLLBACK FIREBASE ACCOUNT
      |--------------------------------------------------------------------------
      */

      try {
        await auth.deleteUser(
          firebaseUser.uid
        );

        console.log(
          `Firebase Authentication rollback successful: ${firebaseUser.uid}`
        );
      } catch (rollbackError) {
        console.error(
          "FIREBASE AUTH ROLLBACK ERROR:",
          rollbackError.message
        );
      }

      throw mysqlError;
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 3 — FIRESTORE PROFILE COPY
    |--------------------------------------------------------------------------
    */

    const now =
      new Date().toISOString();

    let firebaseSynced = true;

    try {
      await db
        .collection(
          USERS_COLLECTION
        )
        .doc(profile.user_id)
        .set({
          user_id:
            profile.user_id,

          firebase_uid:
            profile.firebase_uid,

          first_name:
            profile.first_name,

          last_name:
            profile.last_name,

          mi:
            profile.mi,

          contact_number:
            profile.contact_number,

          email:
            profile.email,

          role_id:
            profile.role_id,

          role:
            profile.role,

          position:
            normalizePositionValue(
              profile.position
            ),

          kiosk_id:
            profile.kiosk_id,

          kiosk:
            profile.kiosk,

          department_id:
            profile.department_id,

          department:
            profile.department,

          department_prefix:
            profile.department_prefix,

          status:
            toFrontendStatus(
              profile.status
            ),

          must_change_password:
            true,

          password_changed_at:
            null,

          temporary_password_expires_at:
            profile
              .temporary_password_expires_at
              .toISOString(),

          created_at:
            now,

          updated_at:
            now,
        });

      console.log(
        `Firestore user profile created: ${profile.user_id}`
      );
    } catch (firestoreError) {
      firebaseSynced = false;

      console.error(
        "FIRESTORE CREATE USER ERROR:",
        firestoreError.message
      );
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 4 — SEND TEMPORARY PASSWORD EMAIL
    |--------------------------------------------------------------------------
    */

    try {
      await sendTemporaryPasswordEmail(
        profile.email,
        profile.first_name,
        temporaryPassword
      );

      console.log(
        `Temporary password email sent to: ${profile.email}`
      );
    } catch (emailError) {
      console.error(
        "TEMPORARY PASSWORD EMAIL ERROR:",
        emailError.message
      );

      console.warn(
        `User account was created, but the temporary password email could not be sent to ${profile.email}.`
      );
    }

    /*
    |--------------------------------------------------------------------------
    | RETURN PROFILE
    |--------------------------------------------------------------------------
    */

    return {
      ...normalizeUserProfile(
        profile
      ),

      status:
        toFrontendStatus(
          profile.status
        ),

      created_at:
        now,

      updated_at:
        now,

      firebase_synced:
        firebaseSynced,
    };
  }

  throw new Error(
    "No database is currently available."
  );
}

/*
|--------------------------------------------------------------------------
| INSERT USER INTO MYSQL
|--------------------------------------------------------------------------
*/

async function insertUserIntoMySQL(
  user
) {
  const mysqlStatus =
    toMySQLStatus(
      user.status
    );

  const normalizedPosition =
    normalizePositionValue(
      user.position
    );

  console.log(
    "TEMP PASSWORD EXPIRATION BEING SAVED:",
    user.temporary_password_expires_at
  );

  console.log(
    "POSITION BEING SAVED:",
    normalizedPosition
  );

  const [result] =
    await pool.execute(
      `
      INSERT INTO \`user\` (
        user_id,
        firebase_uid,
        first_name,
        last_name,
        mi,
        contact_number,
        email,
        role_id,
        position,
        kiosk_id,
        kiosk,
        department_id,
        department,
        status,
        must_change_password,
        password_changed_at,
        temporary_password_expires_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
      `,
      [
        user.user_id,
        user.firebase_uid ||
          null,
        user.first_name || "",
        user.last_name || "",
        user.mi || null,
        user.contact_number ||
          null,
        user.email || "",
        user.role_id || null,

        normalizedPosition,

        user.kiosk_id || null,
        user.kiosk || null,
        user.department_id ||
          null,
        user.department || null,
        mysqlStatus,

        user.must_change_password
          ? 1
          : 0,

        user.password_changed_at ||
          null,

        user.temporary_password_expires_at ||
          null,
      ]
    );

  return result;
}

/*
|--------------------------------------------------------------------------
| UPDATE USER
|--------------------------------------------------------------------------
*/

async function updateUser(
  userId,
  userData
) {
  const existingUser =
    await getUserFromMySQL(
      userId
    );

  if (!existingUser) {
    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | POSITION UPDATE
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | We must distinguish:
  |
  | position property missing
  |        ↓
  | keep existing position
  |
  | position explicitly NULL
  |        ↓
  | remove the position
  |
  |--------------------------------------------------------------------------
  */

  const normalizedUpdatedPosition =
    Object.prototype.hasOwnProperty.call(
      userData,
      "position"
    )
      ? normalizePositionValue(
          userData.position
        )
      : normalizePositionValue(
          existingUser.position
        );

  const updatedUser = {
    user_id:
      userId,

    firebase_uid:
      userData.firebase_uid ??
      userData.firebaseUid ??
      existingUser.firebase_uid ??
      null,

    first_name:
      userData.first_name ??
      existingUser.first_name ??
      "",

    last_name:
      userData.last_name ??
      existingUser.last_name ??
      "",

    mi:
      userData.mi ??
      existingUser.mi ??
      null,

    contact_number:
      userData.contact_number ??
      existingUser.contact_number ??
      null,

    email:
      String(
        userData.email ??
          existingUser.email ??
          ""
      )
        .trim()
        .toLowerCase(),

    role_id:
      userData.role_id ??
      existingUser.role_id ??
      null,

    role:
      userData.role ??
      existingUser.role ??
      "",

    position:
      normalizedUpdatedPosition,

    kiosk_id:
      userData.kiosk_id ??
      existingUser.kiosk_id ??
      null,

    kiosk:
      userData.kiosk ??
      existingUser.kiosk ??
      null,

    department_id:
      userData.department_id ??
      existingUser.department_id ??
      null,

    department:
      userData.department ??
      existingUser.department ??
      null,

    department_prefix:
      userData.department_prefix ??
      userData.departmentPrefix ??
      existingUser.department_prefix ??
      existingUser.departmentPrefix ??
      null,

    status:
      userData.status ??
      existingUser.status ??
      "Active",

    /*
    |--------------------------------------------------------------------------
    | PRESERVE PASSWORD CHANGE STATUS
    |--------------------------------------------------------------------------
    */

    must_change_password:
      userData.must_change_password ??
      existingUser.must_change_password ??
      false,

    password_changed_at:
      userData.password_changed_at ??
      existingUser.password_changed_at ??
      null,

    /*
    |--------------------------------------------------------------------------
    | PRESERVE TEMPORARY PASSWORD EXPIRATION
    |--------------------------------------------------------------------------
    */

    temporary_password_expires_at:
      existingUser
        .temporary_password_expires_at ||
      null,
  };

  if (!updatedUser.email) {
    throw new Error(
      "Email is required."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL EMAIL DUPLICATE CHECK
  |--------------------------------------------------------------------------
  */

  if (
    await emailExists(
      updatedUser.email,
      userId
    )
  ) {
    throw new Error(
      "A user with this email already exists."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FIREBASE AUTH EMAIL DUPLICATE CHECK
  |--------------------------------------------------------------------------
  */

  if (
    await emailExistsInFirebaseAuth(
      updatedUser.email,
      updatedUser.firebase_uid
    )
  ) {
    throw new Error(
      "A user with this email already exists in Firebase Authentication."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | OPTIONAL ADMIN PASSWORD CHANGE
  |--------------------------------------------------------------------------
  */

  let newPassword = null;

  if (
    userData.password !==
      undefined &&
    userData.password !==
      null &&
    String(
      userData.password
    ) !== ""
  ) {
    newPassword =
      String(
        userData.password
      );
  }

  const mode =
    await getDatabaseMode();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE MODE
  |--------------------------------------------------------------------------
  */

  if (mode === "firebase") {
    const oldMySQLUser =
      existingUser;

    /*
    |--------------------------------------------------------------------------
    | MYSQL UPDATE FIRST
    |--------------------------------------------------------------------------
    */

    try {
      await updateUserInMySQL(
        userId,
        updatedUser
      );
    } catch (mysqlError) {
      console.error(
        "MYSQL UPDATE USER ERROR:",
        mysqlError.message
      );

      throw mysqlError;
    }

    /*
    |--------------------------------------------------------------------------
    | FIREBASE AUTH UPDATE
    |--------------------------------------------------------------------------
    */

    if (
      updatedUser.firebase_uid
    ) {
      try {
        const firebaseAuthUpdates =
          {
            email:
              updatedUser.email,

            displayName:
              buildDisplayName(
                updatedUser
              ),

            disabled:
              toMySQLStatus(
                updatedUser.status
              ) === "inactive",
          };

        if (newPassword) {
          firebaseAuthUpdates.password =
            newPassword;
        }

        await auth.updateUser(
          updatedUser.firebase_uid,
          firebaseAuthUpdates
        );

        console.log(
          `Firebase Authentication user updated: ${updatedUser.firebase_uid}`
        );
      } catch (firebaseAuthError) {
        console.error(
          "FIREBASE AUTH UPDATE USER ERROR:",
          firebaseAuthError.message
        );

        /*
        |--------------------------------------------------------------------------
        | ROLLBACK MYSQL PROFILE
        |--------------------------------------------------------------------------
        */

        try {
          await restoreUserInMySQL(
            oldMySQLUser
          );
        } catch (rollbackError) {
          console.error(
            "MYSQL UPDATE ROLLBACK ERROR:",
            rollbackError.message
          );
        }

        throw new Error(
          `User was not updated because Firebase Authentication update failed: ${firebaseAuthError.message}`
        );
      }
    } else {
      if (newPassword) {
        try {
          await restoreUserInMySQL(
            oldMySQLUser
          );
        } catch (rollbackError) {
          console.error(
            "MYSQL ROLLBACK ERROR:",
            rollbackError.message
          );
        }

        throw new Error(
          "This user is not linked to Firebase Authentication. The password cannot be changed until the Firebase account is linked."
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | FIRESTORE PROFILE COPY
    |--------------------------------------------------------------------------
    */

    let firebaseSynced = true;

    try {
      await db
        .collection(
          USERS_COLLECTION
        )
        .doc(userId)
        .set(
          {
            ...updatedUser,

            position:
              normalizePositionValue(
                updatedUser.position
              ),

            status:
              toFrontendStatus(
                updatedUser.status
              ),

            temporary_password_expires_at:
              updatedUser
                .temporary_password_expires_at
                ? new Date(
                    updatedUser
                      .temporary_password_expires_at
                  ).toISOString()
                : null,

            updated_at:
              new Date().toISOString(),
          },
          {
            merge: true,
          }
        );

      console.log(
        `Firestore user profile updated: ${userId}`
      );
    } catch (firestoreError) {
      firebaseSynced = false;

      console.error(
        "FIRESTORE UPDATE USER ERROR:",
        firestoreError.message
      );
    }

    await cleanupStaleAssignments();

    /*
    |--------------------------------------------------------------------------
    | RELOAD USER FROM MYSQL
    |--------------------------------------------------------------------------
    |
    | This ensures the returned profile contains the latest
    | position tabs.
    |--------------------------------------------------------------------------
    */

    const refreshedUser =
      await getUserFromMySQL(
        userId
      );

    return {
      ...normalizeUserProfile(
        refreshedUser ||
          updatedUser
      ),

      firebase_synced:
        firebaseSynced,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL-ONLY MODE
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    if (newPassword) {
      throw new Error(
        "Password changes require Firebase Authentication."
      );
    }

    await updateUserInMySQL(
      userId,
      updatedUser
    );

    await cleanupStaleAssignments();

    const refreshedUser =
      await getUserFromMySQL(
        userId
      );

    return normalizeUserProfile(
      refreshedUser ||
        updatedUser
    );
  }

  throw new Error(
    "No database is currently available."
  );
}

/*
|--------------------------------------------------------------------------
| UPDATE USER IN MYSQL
|--------------------------------------------------------------------------
*/

async function updateUserInMySQL(
  userId,
  user
) {
  const mysqlStatus =
    toMySQLStatus(
      user.status
    );

  const normalizedPosition =
    normalizePositionValue(
      user.position
    );

  await pool.query(
    `
    UPDATE \`user\`

    SET
      firebase_uid = ?,
      first_name = ?,
      last_name = ?,
      mi = ?,
      contact_number = ?,
      email = ?,
      role_id = ?,
      position = ?,
      kiosk_id = ?,
      kiosk = ?,
      department_id = ?,
      department = ?,
      status = ?,
      must_change_password = ?,
      password_changed_at = ?,
      temporary_password_expires_at = ?,
      updated_at = CURRENT_TIMESTAMP

    WHERE user_id = ?
    `,
    [
      user.firebase_uid ||
        null,

      user.first_name,
      user.last_name,
      user.mi,
      user.contact_number,
      user.email,
      user.role_id,

      normalizedPosition,

      user.kiosk_id,
      user.kiosk,
      user.department_id,
      user.department,
      mysqlStatus,

      user.must_change_password
        ? 1
        : 0,

      user.password_changed_at ||
        null,

      user.temporary_password_expires_at ||
        null,

      userId,
    ]
  );
}

/*
|--------------------------------------------------------------------------
| RESTORE USER IN MYSQL
|--------------------------------------------------------------------------
*/

async function restoreUserInMySQL(
  user
) {
  const mysqlStatus =
    toMySQLStatus(
      user.status
    );

  const normalizedPosition =
    normalizePositionValue(
      user.position
    );

  await pool.query(
    `
    UPDATE \`user\`

    SET
      firebase_uid = ?,
      first_name = ?,
      last_name = ?,
      mi = ?,
      contact_number = ?,
      email = ?,
      role_id = ?,
      position = ?,
      kiosk_id = ?,
      kiosk = ?,
      department_id = ?,
      department = ?,
      status = ?,
      must_change_password = ?,
      password_changed_at = ?,
      temporary_password_expires_at = ?,
      updated_at = CURRENT_TIMESTAMP

    WHERE user_id = ?
    `,
    [
      user.firebase_uid ||
        null,

      user.first_name,
      user.last_name,
      user.mi,
      user.contact_number,
      user.email,
      user.role_id,

      normalizedPosition,

      user.kiosk_id,
      user.kiosk,
      user.department_id,
      user.department,
      mysqlStatus,

      user.must_change_password
        ? 1
        : 0,

      user.password_changed_at ||
        null,

      user.temporary_password_expires_at ||
        null,

      user.user_id,
    ]
  );
}

/*
|--------------------------------------------------------------------------
| DELETE USER
|--------------------------------------------------------------------------
*/

async function deleteUser(userId) {
  /*
  |--------------------------------------------------------------------------
  | ALWAYS READ PRIMARY MYSQL PROFILE FIRST
  |--------------------------------------------------------------------------
  */

  const existingUser =
    await getUserFromMySQL(userId);

  if (!existingUser) {
    return false;
  }

  const mode =
    await getDatabaseMode();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE MODE
  |--------------------------------------------------------------------------
  |
  | Firebase Authentication is responsible for login accounts.
  | MySQL stores the application user profile.
  |
  */

  if (mode === "firebase") {
    /*
    |--------------------------------------------------------------------------
    | STEP 1 — DELETE FIREBASE AUTH ACCOUNT
    |--------------------------------------------------------------------------
    */

    if (existingUser.firebase_uid) {
      try {
        await auth.deleteUser(
          existingUser.firebase_uid
        );

        console.log(
          `Firebase Authentication user deleted: ${existingUser.firebase_uid}`
        );
      } catch (firebaseAuthError) {
        if (
          firebaseAuthError.code ===
          "auth/user-not-found"
        ) {
          console.log(
            `Firebase Authentication user already deleted: ${existingUser.firebase_uid}`
          );
        } else {
          console.error(
            "FIREBASE AUTH DELETE USER ERROR:",
            firebaseAuthError
          );

          throw new Error(
            `Firebase Authentication user could not be deleted: ${firebaseAuthError.message}`
          );
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 2 — DELETE MYSQL PROFILE
    |--------------------------------------------------------------------------
    */

    const mysqlDeleted =
      await deleteUserFromMySQL(
        userId
      );

    if (!mysqlDeleted) {
      throw new Error(
        "Firebase Authentication user was deleted, but the MySQL user could not be deleted."
      );
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 3 — DELETE FIRESTORE PROFILE
    |--------------------------------------------------------------------------
    */

    try {
      await db
        .collection(
          USERS_COLLECTION
        )
        .doc(userId)
        .delete();

      console.log(
        `Firestore user profile deleted: ${userId}`
      );
    } catch (firestoreError) {
      console.error(
        "FIRESTORE DELETE USER ERROR:",
        firestoreError.message
      );

      /*
      |----------------------------------------------------------------------
      | Do not fail the entire deletion because Firestore cleanup failed.
      | MySQL and Firebase Auth have already been deleted.
      |----------------------------------------------------------------------
      */
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 4 — CLEAN STALE COUNTER ASSIGNMENTS
    |--------------------------------------------------------------------------
    */

    try {
      await cleanupStaleAssignments();
    } catch (cleanupError) {
      console.error(
        "CLEANUP STALE ASSIGNMENTS ERROR:",
        cleanupError.message
      );
    }

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL-ONLY MODE
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    /*
    |--------------------------------------------------------------------------
    | Firebase Authentication is still used for login, so remove the
    | Firebase Auth account when one exists.
    |--------------------------------------------------------------------------
    */

    if (existingUser.firebase_uid) {
      try {
        await auth.deleteUser(
          existingUser.firebase_uid
        );

        console.log(
          `Firebase Authentication user deleted: ${existingUser.firebase_uid}`
        );
      } catch (firebaseAuthError) {
        if (
          firebaseAuthError.code ===
          "auth/user-not-found"
        ) {
          console.log(
            `Firebase Authentication user already deleted: ${existingUser.firebase_uid}`
          );
        } else {
          console.error(
            "FIREBASE AUTH DELETE USER ERROR:",
            firebaseAuthError
          );

          throw new Error(
            `Firebase Authentication user could not be deleted: ${firebaseAuthError.message}`
          );
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Delete MySQL profile
    |--------------------------------------------------------------------------
    */

    const mysqlDeleted =
      await deleteUserFromMySQL(
        userId
      );

    if (!mysqlDeleted) {
      throw new Error(
        "The MySQL user could not be deleted."
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Delete Firestore profile copy
    |--------------------------------------------------------------------------
    */

    try {
      await db
        .collection(
          USERS_COLLECTION
        )
        .doc(userId)
        .delete();

      console.log(
        `Firestore user profile deleted: ${userId}`
      );
    } catch (firestoreError) {
      console.error(
        "FIRESTORE DELETE USER ERROR:",
        firestoreError.message
      );
    }

    try {
      await cleanupStaleAssignments();
    } catch (cleanupError) {
      console.error(
        "CLEANUP STALE ASSIGNMENTS ERROR:",
        cleanupError.message
      );
    }

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | UNKNOWN DATABASE MODE
  |--------------------------------------------------------------------------
  */

  throw new Error(
    `No database is currently available. Database mode: ${mode}`
  );
}
/*
|--------------------------------------------------------------------------
| DELETE USER FROM MYSQL
|--------------------------------------------------------------------------
*/

async function deleteUserFromMySQL(
  userId
) {
  const [result] =
    await pool.query(
      `
      DELETE FROM \`user\`
      WHERE user_id = ?
      `,
      [userId]
    );

  return (
    result.affectedRows > 0
  );
}

/*
|--------------------------------------------------------------------------
| USER DELETION LOG
|--------------------------------------------------------------------------
*/

async function createUserDeletionLog({
  userId,
  userData,
  reason,
  deletedBy = "superadmin",
}) {
  const deletedAt =
    new Date();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE DELETED USERS ARCHIVE
  |--------------------------------------------------------------------------
  */

  try {
    await db
      .collection(
        "deleted_users"
      )
      .doc(userId)
      .set({
        user_id:
          userId,

        user_data:
          userData,

        deleted_reason:
          reason || "",

        deleted_at:
          deletedAt.toISOString(),

        deleted_by:
          deletedBy,
      });
  } catch (error) {
    console.error(
      "FIREBASE DELETE LOG ERROR:",
      error.message
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL DELETION LOG
  |--------------------------------------------------------------------------
  */

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_deletion_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        deleted_reason TEXT NULL,
        deleted_by VARCHAR(100) NULL,
        deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(
      `
      INSERT INTO user_deletion_logs (
        user_id,
        deleted_reason,
        deleted_by,
        deleted_at
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        userId,
        reason || "",
        deletedBy,
        deletedAt,
      ]
    );
  } catch (error) {
    console.error(
      "MYSQL DELETE LOG ERROR:",
      error.message
    );
  }
}

/*
|--------------------------------------------------------------------------
| GET STAFF BY DEPARTMENT
|--------------------------------------------------------------------------
*/

async function getStaffByDepartment(
  departmentId
) {
  if (!departmentId) {
    throw new Error(
      "Department ID is required."
    );
  }

  try {
    return await getStaffByDepartmentFromMySQL(
      departmentId
    );
  } catch (mysqlError) {
    console.error(
      "MYSQL GET STAFF BY DEPARTMENT ERROR:",
      mysqlError.message
    );

    try {
      const snapshot =
        await db
          .collection(
            USERS_COLLECTION
          )
          .where(
            "department_id",
            "==",
            departmentId
          )
          .get();

      const staff =
        snapshot.docs
          .map((doc) => {
            const data =
              doc.data();

            return normalizeUserProfile({
              ...data,

              user_id:
                data.user_id ||
                doc.id,
            });
          })
          .filter((user) => {
            const roleValue =
              typeof user.role ===
              "object"
                ? user.role?.role
                : user.role;

            return (
              String(
                roleValue || ""
              )
                .trim()
                .toLowerCase() ===
              "staff"
            );
          });

      staff.sort((a, b) =>
        `${a.last_name || ""} ${
          a.first_name || ""
        }`.localeCompare(
          `${b.last_name || ""} ${
            b.first_name || ""
          }`
        )
      );

      return staff;
    } catch (firebaseError) {
      console.error(
        "FIRESTORE GET STAFF BY DEPARTMENT ERROR:",
        firebaseError.message
      );

      throw new Error(
        "Unable to retrieve staff for this department."
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET STAFF BY DEPARTMENT FROM MYSQL
|--------------------------------------------------------------------------
*/

async function getStaffByDepartmentFromMySQL(
  departmentId
) {
  const [rows] =
    await pool.query(
      `
      SELECT
        u.user_id,
        u.firebase_uid,
        u.first_name,
        u.last_name,
        u.mi,
        u.contact_number,
        u.email,
        u.role_id,
        r.role,
        u.position,

        p.position_id AS position_id,
        p.name AS position_name,
        p.tabs AS position_tabs,
        p.status AS position_status,

        u.kiosk_id,
        u.kiosk,
        u.department_id,

        COALESCE(
          d.name,
          u.department
        ) AS department,

        d.prefix AS department_prefix,

        u.status,
        u.must_change_password,
        u.password_changed_at,
        u.temporary_password_expires_at,
        u.created_at,
        u.updated_at

      FROM \`user\` u

      LEFT JOIN \`role\` r
        ON r.role_id = u.role_id

      LEFT JOIN \`department\` d
        ON d.department_id =
           u.department_id

      LEFT JOIN \`position\` p
        ON LOWER(
          TRIM(p.name)
        ) = LOWER(
          TRIM(u.position)
        )

      WHERE
        u.department_id = ?

        AND LOWER(
          TRIM(r.role)
        ) = 'staff'

      ORDER BY
        u.last_name ASC,
        u.first_name ASC
      `,
      [departmentId]
    );

  return rows.map((user) =>
    normalizeUserProfile(user)
  );
}

/*
|--------------------------------------------------------------------------
| GET USER BY EMAIL
|--------------------------------------------------------------------------
*/

async function getUserByEmail(
  email
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  try {
    return await getUserByEmailFromMySQL(
      normalizedEmail
    );
  } catch (mysqlError) {
    console.error(
      "MYSQL GET USER BY EMAIL ERROR:",
      mysqlError.message
    );

    try {
      const snapshot =
        await db
          .collection(
            USERS_COLLECTION
          )
          .where(
            "email",
            "==",
            normalizedEmail
          )
          .limit(1)
          .get();

      if (snapshot.empty) {
        return null;
      }

      const userDoc =
        snapshot.docs[0];

      const data =
        userDoc.data();

      return normalizeUserProfile({
        ...data,

        user_id:
          data.user_id ||
          userDoc.id,
      });
    } catch (firebaseError) {
      console.error(
        "FIRESTORE GET USER BY EMAIL FALLBACK ERROR:",
        firebaseError.message
      );

      throw new Error(
        "Unable to retrieve the user by email."
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET USER BY EMAIL FROM MYSQL
|--------------------------------------------------------------------------
*/

async function getUserByEmailFromMySQL(
  email
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const [rows] =
    await pool.query(
      `
      SELECT
        u.user_id,
        u.firebase_uid,
        u.first_name,
        u.last_name,
        u.mi,
        u.contact_number,
        u.email,
        u.role_id,
        r.role,
        u.position,

        p.position_id AS position_id,
        p.name AS position_name,
        p.tabs AS position_tabs,
        p.status AS position_status,

        u.kiosk_id,
        u.kiosk,
        u.department_id,

        COALESCE(
          d.name,
          u.department
        ) AS department,

        d.prefix AS department_prefix,

        u.status,
        u.must_change_password,
        u.password_changed_at,
        u.temporary_password_expires_at,
        u.created_at,
        u.updated_at

      FROM \`user\` u

      LEFT JOIN \`role\` r
        ON r.role_id = u.role_id

      LEFT JOIN \`department\` d
        ON d.department_id =
           u.department_id

      LEFT JOIN \`position\` p
        ON LOWER(
          TRIM(p.name)
        ) = LOWER(
          TRIM(u.position)
        )

      WHERE LOWER(u.email) = ?

      LIMIT 1
      `,
      [normalizedEmail]
    );

  if (rows.length === 0) {
    return null;
  }

  return normalizeUserProfile(
    rows[0]
  );
}

/*
|--------------------------------------------------------------------------
| MARK PASSWORD AS CHANGED
|--------------------------------------------------------------------------
*/

async function markPasswordChanged(
  firebaseUid
) {
  const normalizedUid =
    String(
      firebaseUid || ""
    ).trim();

  if (!normalizedUid) {
    throw new Error(
      "Firebase UID is required."
    );
  }

  const [result] =
    await pool.query(
      `
      UPDATE \`user\`
      SET
        must_change_password = 0,
        password_changed_at = CURRENT_TIMESTAMP,
        temporary_password_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE firebase_uid = ?
      `,
      [normalizedUid]
    );

  if (
    result.affectedRows === 0
  ) {
    throw new Error(
      "User profile could not be found."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE FIRESTORE PROFILE COPY
  |--------------------------------------------------------------------------
  */

  try {
    const user =
      await getUserByFirebaseUid(
        normalizedUid
      );

    if (user) {
      await db
        .collection(
          USERS_COLLECTION
        )
        .doc(user.user_id)
        .set(
          {
            must_change_password:
              false,

            password_changed_at:
              new Date().toISOString(),

            /*
            |--------------------------------------------------------------------------
            | IMPORTANT:
            | Once password changes, expiration is removed.
            |--------------------------------------------------------------------------
            */

            temporary_password_expires_at:
              null,

            updated_at:
              new Date().toISOString(),
          },
          {
            merge: true,
          }
        );
    }
  } catch (firestoreError) {
    console.error(
      "FIRESTORE PASSWORD STATUS UPDATE ERROR:",
      firestoreError.message
    );

    /*
    |--------------------------------------------------------------------------
    | Do not fail password change because Firestore failed.
    |
    | MySQL is the primary application database.
    |--------------------------------------------------------------------------
    */
  }

  return {
    success: true,

    firebase_uid:
      normalizedUid,

    must_change_password:
      false,

    temporary_password_expires_at:
      null,
  };
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  /*
  |--------------------------------------------------------------------------
  | User management
  |--------------------------------------------------------------------------
  */

  getUsers,
  getUsersFromMySQL,

  getUserById,
  getUserFromMySQL,

  getUserByEmail,
  getUserByEmailFromMySQL,

  getStaffByDepartment,
  getStaffByDepartmentFromMySQL,

  createUser,
  updateUser,
  deleteUser,

  emailExists,
  emailExistsInFirebase,
  emailExistsInFirebaseAuth,

  createUserDeletionLog,

  /*
  |--------------------------------------------------------------------------
  | Firebase Authentication / Profile
  |--------------------------------------------------------------------------
  */

  getUserByFirebaseUid,
  getAuthenticatedUserProfile,
  markPasswordChanged,

  /*
  |--------------------------------------------------------------------------
  | Legacy authentication
  |--------------------------------------------------------------------------
  */

  authenticateUser,
};