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

    position:
      user.position || null,

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
      toFrontendStatus(user.status),

    /*
    |--------------------------------------------------------------------------
    | PASSWORD CHANGE STATUS
    |--------------------------------------------------------------------------
    |
    | Firebase Authentication owns the actual password.
    |
    | MySQL only stores whether the user still needs to change
    | the temporary password.
    |
    |--------------------------------------------------------------------------
    */

    must_change_password:
      Boolean(
        user.must_change_password
      ),

    password_changed_at:
      user.password_changed_at || null,

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
|
| MySQL is the PRIMARY application database.
|
| Firestore is only used as a fallback if MySQL cannot be reached.
|
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
      const snapshot = await db
        .collection(USERS_COLLECTION)
        .get();

      const users = snapshot.docs.map((doc) => {
        const data = doc.data();

        return normalizeUserProfile({
          ...data,

          user_id:
            data.user_id || doc.id,
        });
      });

      users.sort((a, b) =>
        String(a.last_name || "").localeCompare(
          String(b.last_name || "")
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
  const [rows] = await pool.query(`
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
      u.kiosk_id,
      u.kiosk,
      u.department_id,
      u.department,

      d.prefix AS department_prefix,

      u.status,
      u.must_change_password,
      u.password_changed_at,
      u.created_at,
      u.updated_at

    FROM \`user\` u

    LEFT JOIN \`role\` r
      ON r.role_id = u.role_id

    LEFT JOIN \`department\` d
      ON d.department_id = u.department_id

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
    return await getUserFromMySQL(userId);
  } catch (mysqlError) {
    console.error(
      "MYSQL GET USER ERROR:",
      mysqlError.message
    );

    try {
      const userDoc = await db
        .collection(USERS_COLLECTION)
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        return null;
      }

      const data = userDoc.data();

      return normalizeUserProfile({
        ...data,

        user_id:
          data.user_id || userDoc.id,
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

async function getUserFromMySQL(userId) {
  const [rows] = await pool.query(
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
      u.kiosk_id,
      u.kiosk,
      u.department_id,
      u.department,

      d.prefix AS department_prefix,

      u.status,
      u.must_change_password,
      u.password_changed_at,
      u.created_at,
      u.updated_at

    FROM \`user\` u

    LEFT JOIN \`role\` r
      ON r.role_id = u.role_id

    LEFT JOIN \`department\` d
      ON d.department_id = u.department_id

    WHERE u.user_id = ?

    LIMIT 1
    `,
    [userId]
  );

  if (rows.length === 0) {
    return null;
  }

  return normalizeUserProfile(rows[0]);
}

/*
|--------------------------------------------------------------------------
| GET USER BY FIREBASE UID
|--------------------------------------------------------------------------
*/

async function getUserByFirebaseUid(firebaseUid) {
  const normalizedUid = String(
    firebaseUid || ""
  ).trim();

  if (!normalizedUid) {
    return null;
  }

  const [rows] = await pool.query(
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
      u.kiosk_id,
      u.kiosk,
      u.department_id,
      u.department,

      d.prefix AS department_prefix,

      u.status,
      u.must_change_password,
      u.password_changed_at,
      u.created_at,
      u.updated_at

    FROM \`user\` u

    LEFT JOIN \`role\` r
      ON r.role_id = u.role_id

    LEFT JOIN \`department\` d
      ON d.department_id = u.department_id

    WHERE u.firebase_uid = ?

    LIMIT 1
    `,
    [normalizedUid]
  );

  if (rows.length === 0) {
    return null;
  }

  return normalizeUserProfile(rows[0]);
}

/*
|--------------------------------------------------------------------------
| GET AUTHENTICATED USER PROFILE
|--------------------------------------------------------------------------
|
| Firebase Authentication verifies the login.
|
| MySQL supplies the application profile.
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
    String(user.status || "")
      .toLowerCase() === "inactive"
  ) {
    throw new Error(
      "This account has been disabled."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ROLE VALIDATION
  |--------------------------------------------------------------------------
  */

  const roleName = String(
    typeof user.role === "object"
      ? user.role?.role
      : user.role || ""
  )
    .trim()
    .toLowerCase();

  const allowedRoles = new Set([
    "superadmin",
    "admin",
    "staff",
  ]);

  if (!allowedRoles.has(roleName)) {
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
    String(user.department || "").trim();

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

    department_prefix:
      departmentPrefix || null,

    departmentPrefix:
      departmentPrefix || null,

    must_change_password:
      Boolean(
        user.must_change_password
      ),

    password_changed_at:
      user.password_changed_at || null,
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
  const normalizedEmail = String(
    email || ""
  )
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
    sql += ` AND user_id <> ?`;
    params.push(excludeUserId);
  }

  sql += ` LIMIT 1`;

  const [rows] = await pool.query(
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

async function emailExistsInFirebase(email) {
  const normalizedEmail = String(
    email || ""
  )
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const snapshot = await db
    .collection(USERS_COLLECTION)
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

async function getFirebaseAuthUserByEmail(email) {
  const normalizedEmail = String(
    email || ""
  )
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
    firebaseUser.uid === excludeUid
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

  const [rows] = await pool.query(
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
|
| NEW USER FLOW:
|
| React
|   ↓
| Node.js
|   ↓
| Generate temporary password
|   ↓
| Firebase Authentication
|   ↓
| Firebase UID
|   ↓
| MySQL profile
|   ↓
| Firestore profile copy
|
| IMPORTANT:
|
| The temporary password is NEVER stored in:
|
| - MySQL
| - Firestore
| - React response
|
| It will later be passed to the email service.
|
|--------------------------------------------------------------------------
*/

async function createUser(userData) {
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

    position:
      userData.position || null,

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
    | NEW ACCOUNT MUST CHANGE PASSWORD
    |--------------------------------------------------------------------------
    */

    must_change_password:
      true,

    password_changed_at:
      null,
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
  | MYSQL-ONLY MODE
  |--------------------------------------------------------------------------
  |
  | New login accounts require Firebase Authentication.
  |
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

          /*
          |--------------------------------------------------------------------------
          | Firebase Authentication OWNS the password.
          |--------------------------------------------------------------------------
          */

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

    /*
    |--------------------------------------------------------------------------
    | STEP 2 — SAVE FIREBASE UID
    |--------------------------------------------------------------------------
    */

    profile.firebase_uid =
      firebaseUser.uid;

    /*
    |--------------------------------------------------------------------------
    | STEP 3 — INSERT MYSQL PROFILE
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | The temporary password is NOT inserted into MySQL.
    |
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
      | ROLLBACK FIREBASE AUTH
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
    | STEP 4 — FIRESTORE PROFILE COPY
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | temporaryPassword is intentionally NOT included.
    |
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
            profile.position,

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

      /*
      |--------------------------------------------------------------------------
      | DO NOT DELETE MYSQL OR FIREBASE AUTH.
      |--------------------------------------------------------------------------
      */
    }
  
    /*
    |--------------------------------------------------------------------------
    | STEP 5 — RETURN CREATED PROFILE
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | The temporary password is NOT returned to React.
    |
    | The email service will handle sending it.
    |
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
|
| Firebase Authentication owns the password.
|
| MySQL stores only the application profile and password-change status.
|
|--------------------------------------------------------------------------
*/

async function insertUserIntoMySQL(user) {
  const mysqlStatus =
    toMySQLStatus(
      user.status
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
        password_changed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user.user_id,
        user.firebase_uid || null,
        user.first_name || "",
        user.last_name || "",
        user.mi || null,
        user.contact_number || null,
        user.email || "",
        user.role_id || null,
        user.position || null,
        user.kiosk_id || null,
        user.kiosk || null,
        user.department_id || null,
        user.department || null,
        mysqlStatus,

        /*
        |--------------------------------------------------------------------------
        | NEW USERS MUST CHANGE TEMPORARY PASSWORD
        |--------------------------------------------------------------------------
        */

        user.must_change_password ? 1 : 0,

        user.password_changed_at || null,
      ]
    );

  return result;
}

/*
|--------------------------------------------------------------------------
| UPDATE USER
|--------------------------------------------------------------------------
|
| UPDATE FLOW:
|
| 1. Read existing MySQL profile
| 2. Validate new profile
| 3. Update MySQL
| 4. Update Firebase Authentication
| 5. Update Firestore copy
|
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
      userData.position ??
      existingUser.position ??
      null,

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
  | OPTIONAL PASSWORD
  |--------------------------------------------------------------------------
  |
  | This is retained for existing edit functionality.
  |
  | Password is sent ONLY to Firebase Authentication.
  |
  |--------------------------------------------------------------------------
  */

  let newPassword = null;

  if (
    userData.password !== undefined &&
    userData.password !== null &&
    String(userData.password) !== ""
  ) {
    newPassword =
      String(
        userData.password
      );

    /*
    |--------------------------------------------------------------------------
    | Firebase validates the password itself.
    |--------------------------------------------------------------------------
    */
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
        const firebaseAuthUpdates = {
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

        /*
        |--------------------------------------------------------------------------
        | OPTIONAL ADMIN PASSWORD CHANGE
        |--------------------------------------------------------------------------
        */

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

            status:
              toFrontendStatus(
                updatedUser.status
              ),

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

    return {
      ...normalizeUserProfile(
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

    return normalizeUserProfile(
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
      updated_at = CURRENT_TIMESTAMP

    WHERE user_id = ?
    `,
    [
      user.firebase_uid || null,
      user.first_name,
      user.last_name,
      user.mi,
      user.contact_number,
      user.email,
      user.role_id,
      user.position,
      user.kiosk_id,
      user.kiosk,
      user.department_id,
      user.department,
      mysqlStatus,

      user.must_change_password ? 1 : 0,

      user.password_changed_at || null,

      userId,
    ]
  );
}

/*
|--------------------------------------------------------------------------
| RESTORE USER IN MYSQL
|--------------------------------------------------------------------------
*/

async function restoreUserInMySQL(user) {
  const mysqlStatus =
    toMySQLStatus(
      user.status
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
      user.position,
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
    await getUserFromMySQL(
      userId
    );

  if (!existingUser) {
    return false;
  }

  const mode =
    await getDatabaseMode();

  if (mode === "firebase") {
    /*
    |--------------------------------------------------------------------------
    | STEP 1 — DELETE MYSQL PROFILE
    |--------------------------------------------------------------------------
    */

    await deleteUserFromMySQL(
      userId
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 2 — DELETE FIREBASE AUTH ACCOUNT
    |--------------------------------------------------------------------------
    */

    if (
      existingUser.firebase_uid
    ) {
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
            firebaseAuthError.message
          );

          throw new Error(
            `MySQL user was deleted, but Firebase Authentication deletion failed: ${firebaseAuthError.message}`
          );
        }
      }
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
    } catch (firebaseError) {
      console.error(
        "FIRESTORE DELETE USER ERROR:",
        firebaseError.message
      );

      throw new Error(
        `MySQL and Firebase Authentication user were deleted, but Firestore deletion failed: ${firebaseError.message}`
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
    await deleteUserFromMySQL(
      userId
    );

    return true;
  }

  throw new Error(
    "No database is currently available."
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

  return result.affectedRows > 0;
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
      .collection("deleted_users")
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
        u.kiosk_id,
        u.kiosk,
        u.department_id,
        u.department,

        d.prefix AS department_prefix,

        u.status,
        u.must_change_password,
        u.password_changed_at,
        u.created_at,
        u.updated_at

      FROM \`user\` u

      LEFT JOIN \`role\` r
        ON r.role_id = u.role_id

      LEFT JOIN \`department\` d
        ON d.department_id =
           u.department_id

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
        u.kiosk_id,
        u.kiosk,
        u.department_id,
        u.department,

        d.prefix AS department_prefix,

        u.status,
        u.must_change_password,
        u.password_changed_at,
        u.created_at,
        u.updated_at

      FROM \`user\` u

      LEFT JOIN \`role\` r
        ON r.role_id = u.role_id

      LEFT JOIN \`department\` d
        ON d.department_id =
           u.department_id

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
|
| Firebase Authentication owns the actual password.
|
| MySQL only records that the temporary password has
| been replaced by the user.
|
|--------------------------------------------------------------------------
*/

async function markPasswordChanged(firebaseUid) {
  const normalizedUid = String(
    firebaseUid || ""
  ).trim();

  if (!normalizedUid) {
    throw new Error(
      "Firebase UID is required."
    );
  }

  const [result] = await pool.query(
    `
    UPDATE \`user\`
    SET
      must_change_password = 0,
      password_changed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE firebase_uid = ?
    `,
    [normalizedUid]
  );

  if (result.affectedRows === 0) {
    throw new Error(
      "User profile could not be found."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Also update the Firestore profile copy
  |--------------------------------------------------------------------------
  */

  try {
    const user =
      await getUserByFirebaseUid(
        normalizedUid
      );

    if (user) {
      await db
        .collection(USERS_COLLECTION)
        .doc(user.user_id)
        .set(
          {
            must_change_password: false,
            password_changed_at:
              new Date().toISOString(),
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
    | Do not fail the password change because Firestore failed.
    |
    | MySQL is the primary application database.
    |--------------------------------------------------------------------------
    */
  }

  return {
    success: true,
    firebase_uid: normalizedUid,
    must_change_password: false,
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