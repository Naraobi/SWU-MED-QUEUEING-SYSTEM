import { getOfflineData, saveOfflineData } from './offlineStorage';

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";

import {
  getCurrentUserProfile,
  getStaffTerminal,
  releaseTerminal,
} from "./backendApi";

import { auth } from "../../firebase";

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});


const AuthContext = createContext(null);

const STORAGE_KEY = "swumed_user";

/*
|--------------------------------------------------------------------------
| STAFF TERMINAL STORAGE
|--------------------------------------------------------------------------
|
| TerminalSelectionPage.jsx and DashboardPage.jsx save the selected
| terminal under a per-staff key so two staff accounts on the same
| browser never share one terminal's saved state:
|
| swumed_staff_terminal_<staffId>
|
| The unsuffixed key is the legacy single-account key. It is still read
| as a fallback by Topbar.jsx, so it is kept in sync here too.
|
*/

const STAFF_TERMINAL_KEY_PREFIX =
  "swumed_staff_terminal";

/*
|--------------------------------------------------------------------------
| RELEASE DEDUPE WINDOW
|--------------------------------------------------------------------------
|
| Calling firebaseSignOut() makes onAuthStateChanged() fire again with
| no Firebase user, which is the same session end the explicit signOut()
| is already releasing. A short window keeps that second, redundant
| pass from releasing twice, while still allowing a genuine later
| logout by the same staff member to release normally.
|
*/

const RELEASE_DEDUPE_WINDOW_MS = 15000;

let lastReleasedStaff = null;

const ALLOWED_ROLES = new Set([
  "superadmin",
  "admin",
  "staff",
]);

/*
|--------------------------------------------------------------------------
| STAFF TERMINAL STORAGE HELPERS
|--------------------------------------------------------------------------
*/

function getStaffTerminalStorageKey(
  staffId
) {
  return staffId
    ? `${STAFF_TERMINAL_KEY_PREFIX}_${String(
        staffId
      )}`
    : STAFF_TERMINAL_KEY_PREFIX;
}

function readSavedStaffTerminalId(
  staffId
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const keys = [
    getStaffTerminalStorageKey(staffId),
    STAFF_TERMINAL_KEY_PREFIX,
  ];

  for (const key of keys) {
    try {
      const raw =
        window.localStorage.getItem(
          key
        );

      if (!raw) continue;

      const parsed =
        JSON.parse(raw);

      const terminalId =
        parsed?.terminal_id ??
        parsed?.counter_id ??
        parsed?.id ??
        null;

      if (terminalId) {
        return terminalId;
      }
    } catch {
      // A corrupt entry must never block logout.
    }
  }

  return null;
}

function clearStaffTerminalStorage(
  staffId
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(
      getStaffTerminalStorageKey(
        staffId
      )
    );

    window.localStorage.removeItem(
      STAFF_TERMINAL_KEY_PREFIX
    );
  } catch {
    // Storage is best-effort only.
  }
}

/*
|--------------------------------------------------------------------------
| STAFF ID
|--------------------------------------------------------------------------
|
| Keep the same fallbacks the staff pages already use, so the release
| always scopes to the identical ID the assign request used.
|
*/

function resolveStaffId(userLike) {
  return (
    userLike?.staff_id ??
    userLike?.user_id ??
    userLike?.id ??
    null
  );
}

/*
|--------------------------------------------------------------------------
| RELEASE THE STAFF TERMINAL
|--------------------------------------------------------------------------
|
| The single place a staff terminal is freed.
|
| A counter is available when assigned_staff_id IS NULL, so releasing
| means clearing that column and nothing else. The counter's own status
| column is deliberately left untouched.
|
| The release is always scoped to one staff member, and the backend
| UPDATE is guarded by assigned_staff_id = ?, so a terminal held by
| somebody else can never be released here.
|
*/

async function releaseStaffTerminal(
  userLike,
  options = {}
) {
  const {
    skipIfRecentlyReleased = true,
  } = options;

  const staffId =
    resolveStaffId(userLike);

  if (!staffId) {
    // Never call the release endpoint without a real staff ID.
    return {
      released: false,
      reason: "no-staff-id",
    };
  }

  if (normalizeRole(userLike?.role) !== "staff") {
    return {
      released: false,
      reason: "not-staff",
    };
  }

  /*
  | The same logout can arrive twice: once from the explicit signOut()
  | call and once from the onAuthStateChanged() callback that
  | firebaseSignOut() triggers. Only that redundant pass is skipped, so an
  | explicit logout always releases even if the same staff member signs out
  | again moments after signing back in.
  */

  if (
    skipIfRecentlyReleased &&
    lastReleasedStaff &&
    String(
      lastReleasedStaff.staffId
    ) === String(staffId) &&
    Date.now() -
      lastReleasedStaff.at <
      RELEASE_DEDUPE_WINDOW_MS
  ) {
    return {
      released: true,
      reason: "already-released",
    };
  }

  /*
  | Capture the saved terminal ID before any local state is cleared.
  | It is only a fallback: the server lookup below is the source of
  | truth for what this staff member actually holds.
  */

  const savedTerminalId =
    readSavedStaffTerminalId(staffId);

  let terminalId = savedTerminalId;

  try {
    const assignedTerminal =
      await getStaffTerminal(staffId);

    terminalId =
      assignedTerminal?.counter_id ??
      assignedTerminal?.terminal_id ??
      assignedTerminal?.id ??
      savedTerminalId;
  } catch (lookupError) {
    console.error(
      "Could not read the assigned staff terminal:",
      lookupError
    );
  }

  if (!terminalId) {
    /*
    | Nothing is assigned to this staff member, so there is nothing to
    | release. This is a normal state, not a failure.
    */

    lastReleasedStaff = {
      staffId,
      at: Date.now(),
    };

    return {
      released: false,
      reason: "no-assignment",
    };
  }

  try {
    const result =
      await releaseTerminal(
        terminalId,
        staffId
      );

    /*
    | The endpoint reports whether the counter row was actually
    | cleared. released === false means the counter was already free
    | or now belongs to somebody else. Either way this session must not
    | keep claiming it.
    */

    lastReleasedStaff = {
      staffId,
      at: Date.now(),
    };

    if (result?.released === false) {
      console.warn(
        `Terminal ${terminalId} was not assigned to staff ${staffId}, so nothing was released.`
      );

      return {
        released: false,
        reason: "no-match",
        terminalId,
      };
    }

    console.log(
      `Terminal ${terminalId} released for staff ${staffId}.`
    );

    return {
      released: true,
      terminalId,
    };
  } catch (releaseError) {
    console.error(
      "Failed to release staff terminal:",
      releaseError
    );

    return {
      released: false,
      reason: "error",
      terminalId,
      error: releaseError,
    };
  }
}

/*
|--------------------------------------------------------------------------
| NORMALIZE ROLE
|--------------------------------------------------------------------------
*/

function normalizeRole(role) {
  if (
    typeof role === "object" &&
    role?.role
  ) {
    role = role.role;
  }

  return String(role ?? "")
    .trim()
    .toLowerCase();
}

/*
|--------------------------------------------------------------------------
| NORMALIZE DEPARTMENT
|--------------------------------------------------------------------------
*/

function normalizeDepartment(department) {
  const value = String(
    department ?? ""
  ).trim();

  if (
    !value ||
    value.toLowerCase() === "null"
  ) {
    return null;
  }

  return value;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE DEPARTMENT PREFIX
|--------------------------------------------------------------------------
|
| The department prefix comes from the department data.
|
| Examples:
|
| Information -> IN
| Admission   -> AD
| Laboratory  -> LAB
|
|--------------------------------------------------------------------------
*/

function normalizeDepartmentPrefix(prefix) {
  const value = String(
    prefix ?? ""
  ).trim();

  if (
    !value ||
    value.toLowerCase() === "null"
  ) {
    return null;
  }

  return value;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE POSITION TABS
|--------------------------------------------------------------------------
|
| Position tabs come from the position table.
|
| Expected:
|
| [
|   "dashboard",
|   "users",
|   "queue"
| ]
|
| This also safely handles JSON strings because cached/offline data
| may contain the tabs as a string.
|
|--------------------------------------------------------------------------
*/

function normalizePositionTabs(tabs) {
  /*
  |----------------------------------------------------------------------
  | Already an array
  |----------------------------------------------------------------------
  */

  if (Array.isArray(tabs)) {
    return tabs
      .map((tab) =>
        String(tab ?? "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
  }

  /*
  |----------------------------------------------------------------------
  | JSON string or comma-separated string
  |----------------------------------------------------------------------
  */

  if (typeof tabs === "string") {
    const value = tabs.trim();

    if (!value) {
      return [];
    }

    /*
    |--------------------------------------------------------------------
    | Try JSON first
    |--------------------------------------------------------------------
    */

    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map((tab) =>
            String(tab ?? "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean);
      }
    } catch {
      /*
      |------------------------------------------------------------------
      | Not JSON. Continue as comma-separated data.
      |------------------------------------------------------------------
      */
    }

    return value
      .split(",")
      .map((tab) =>
        tab
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
  }

  return [];
}

/*
|--------------------------------------------------------------------------
| VALIDATE USER ACCESS
|--------------------------------------------------------------------------
*/

function validateUserAccess(userData) {
  if (!userData) {
    return {
      valid: false,
      message:
        "User profile could not be found.",
    };
  }

  const roleName = normalizeRole(
    userData.role
  );

  if (!roleName) {
    return {
      valid: false,
      message:
        "No role has been assigned to this account.",
    };
  }

  if (!ALLOWED_ROLES.has(roleName)) {
    return {
      valid: false,
      message:
        "Your account does not have a valid role.",
    };
  }

  const department =
    normalizeDepartment(
      userData.department
    );

  /*
  |--------------------------------------------------------------------------
  | SUPERADMIN
  |--------------------------------------------------------------------------
  */

  if (roleName === "superadmin") {
    return {
      valid: true,
      role: roleName,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | ADMIN / STAFF
  |--------------------------------------------------------------------------
  */

  if (!department) {
    const roleLabel =
      roleName === "admin"
        ? "Admin"
        : "Staff";

    return {
      valid: false,
      message:
        `${roleLabel} accounts must be assigned to a department before they can log in.`,
    };
  }

  return {
    valid: true,
    role: roleName,
  };
}

/*
|--------------------------------------------------------------------------
| BUILD FINAL USER
|--------------------------------------------------------------------------
|
| Firebase Authentication is responsible for identity.
|
| The application profile comes from the backend/database.
|
| Firebase UID is preserved as:
|
| - firebase_uid
| - firebaseUid
| - uid
|
|--------------------------------------------------------------------------
*/

function buildFinalUser(
  userData,
  firebaseUser = null
) {
  const normalizedRole =
    normalizeRole(userData?.role);

  /*
  |--------------------------------------------------------------------------
  | DEPARTMENT PREFIX
  |--------------------------------------------------------------------------
  */

  const departmentPrefix =
    normalizeDepartmentPrefix(
      userData?.department_prefix ??
      userData?.departmentPrefix ??
      userData?.prefix
    );

  /*
  |--------------------------------------------------------------------------
  | POSITION TABS
  |--------------------------------------------------------------------------
  |
  | These are the permissions assigned to the user's position.
  |
  |--------------------------------------------------------------------------
  */

  const positionTabs =
    normalizePositionTabs(
      userData?.position_tabs ??
      userData?.positionTabs ??
      userData?.tabs
    );

  /*
  |--------------------------------------------------------------------------
  | FIREBASE UID
  |--------------------------------------------------------------------------
  */

  const firebaseUid =
    firebaseUser?.uid ??
    userData?.firebase_uid ??
    userData?.firebaseUid ??
    userData?.uid ??
    null;

  /*
  |--------------------------------------------------------------------------
  | EMAIL
  |--------------------------------------------------------------------------
  */

  const firebaseEmail =
    firebaseUser?.email ??
    null;

  return {
    ...userData,

    /*
    |--------------------------------------------------------------------------
    | USER IDENTIFIERS
    |--------------------------------------------------------------------------
    */

    user_id:
      userData?.user_id ??
      null,

    firebase_uid:
      firebaseUid,

    firebaseUid:
      firebaseUid,

    uid:
      firebaseUid ??
      userData?.user_id ??
      null,

    /*
    |--------------------------------------------------------------------------
    | EMAIL
    |--------------------------------------------------------------------------
    */

    email:
      firebaseEmail ??
      userData?.email ??
      null,

    emailVerified:
      firebaseUser?.emailVerified ??
      userData?.emailVerified ??
      true,

    /*
    |--------------------------------------------------------------------------
    | DEPARTMENT
    |--------------------------------------------------------------------------
    */

    department:
      normalizeDepartment(
        userData?.department
      ),

    department_id:
      userData?.department_id ??
      null,

    /*
    |--------------------------------------------------------------------------
    | DEPARTMENT PREFIX
    |--------------------------------------------------------------------------
    */

    department_prefix:
      departmentPrefix,

    departmentPrefix:
      departmentPrefix,

    /*
    |--------------------------------------------------------------------------
    | ROLE
    |--------------------------------------------------------------------------
    */

    role:
      normalizedRole,

    role_id:
      userData?.role_id ??
      null,

    /*
    |--------------------------------------------------------------------------
    | POSITION
    |--------------------------------------------------------------------------
    */

    position:
      userData?.position ??
      null,

    /*
    |--------------------------------------------------------------------------
    | POSITION ID
    |--------------------------------------------------------------------------
    */

    position_id:
      userData?.position_id ??
      null,

    /*
    |--------------------------------------------------------------------------
    | POSITION NAME
    |--------------------------------------------------------------------------
    */

    position_name:
      userData?.position_name ??
      userData?.position ??
      null,

    /*
    |--------------------------------------------------------------------------
    | POSITION TABS
    |--------------------------------------------------------------------------
    |
    | This is the important new property.
    |
    |--------------------------------------------------------------------------
    */

    position_tabs:
      positionTabs,

    /*
    | Alias for compatibility.
    */

    positionTabs:
      positionTabs,

    /*
    |--------------------------------------------------------------------------
    | KIOSK
    |--------------------------------------------------------------------------
    */

    kiosk:
      userData?.kiosk ??
      null,

    kiosk_id:
      userData?.kiosk_id ??
      null,

    /*
    |--------------------------------------------------------------------------
    | ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    status:
      userData?.status ??
      "Active",

    must_change_password:
      Number(
        userData?.must_change_password
      ) === 1,

    password_changed_at:
      userData?.password_changed_at ??
      null,
  };
}

/*
|--------------------------------------------------------------------------
| SAVE USER LOCALLY
|--------------------------------------------------------------------------
*/

const saveUserLocally = async (userData) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(userData)
  );

  try {
    await saveOfflineData(
      "user_profile",
      userData
    );
  } catch (error) {
    console.warn(
      "Could not save offline user profile:",
      error
    );
  }
};

/*
|--------------------------------------------------------------------------
| CLEAR USER LOCALLY
|--------------------------------------------------------------------------
*/

function clearLocalUser(staffId = null) {
  localStorage.removeItem(
    STORAGE_KEY
  );

  /*
  | The selected terminal is saved per staff account, so clearing only
  | the unsuffixed key leaves swumed_staff_terminal_<staffId> behind and
  | the next login restores a terminal this session no longer owns.
  |
  | Callers pass the staff ID whenever they know it, which is always the
  | case on logout. Without one the legacy key is removed exactly as
  | before.
  */

  clearStaffTerminalStorage(
    staffId
  );
}

/*
|--------------------------------------------------------------------------
| READ THE STORED SESSION USER
|--------------------------------------------------------------------------
|
| A synchronous read of the session the app itself persisted on login.
|
| onAuthStateChanged() registers its callback with an empty dependency
| list, so that closure always sees the first render's user, which is
| null. Reading the stored session is therefore the only way to know
| who the ending session belonged to.
|
*/

function readStoredSessionUser() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) return null;

    const parsed =
      JSON.parse(raw);

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| LOAD SAVED USER
|--------------------------------------------------------------------------
*/

const loadSavedUser = async () => {
  /*
  |--------------------------------------------------------------------------
  | LOCAL STORAGE
  |--------------------------------------------------------------------------
  */

  try {
    const saved =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (saved) {
      const parsed =
        JSON.parse(saved);

      if (
        parsed?.status &&
        [
          "inactive",
          "deactivated",
          "disabled",
        ].includes(
          String(parsed.status)
            .trim()
            .toLowerCase()
        )
      ) {
        clearLocalUser();
        return null;
      }

      const validated =
        validateUserAccess(
          parsed
        );

      if (validated.valid) {
        return buildFinalUser(
          parsed,
          null
        );
      }
    }
  } catch (error) {
    console.warn(
      "Could not load local user:",
      error
    );
  }

  /*
  |--------------------------------------------------------------------------
  | OFFLINE STORAGE
  |--------------------------------------------------------------------------
  */

  try {
    const offlineUser =
      await getOfflineData(
        "user_profile"
      );

    if (offlineUser) {
      if (
        offlineUser?.status &&
        [
          "inactive",
          "deactivated",
          "disabled",
        ].includes(
          String(
            offlineUser.status
          )
            .trim()
            .toLowerCase()
        )
      ) {
        clearLocalUser();
        return null;
      }

      if (
        validateUserAccess(
          offlineUser
        ).valid
      ) {
        return buildFinalUser(
          offlineUser,
          null
        );
      }
    }
  } catch (error) {
    console.warn(
      "Could not load offline user profile:",
      error
    );
  }

  return null;
};

/*
|--------------------------------------------------------------------------
| AUTH PROVIDER
|--------------------------------------------------------------------------
*/

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          /*
          |--------------------------------------------------------------------------
          | NO FIREBASE USER
          |--------------------------------------------------------------------------
          */

          if (!firebaseUser) {
            /*
            |--------------------------------------------------------------
            | NO FIREBASE USER
            |--------------------------------------------------------------
            |
            | The session ended without going through signOut(): a revoked
            | or expired token, "sign out on all devices", or the app being
            | reopened after the Firebase session had already died. The
            | staff terminal has to be freed here too, otherwise the counter
            | stays assigned to a staff member who is no longer signed in.
            |
            | Identity comes from the session this app persisted, never from
            | a bare storage key, and the release is scoped to that staff ID,
            | so no other staff member's terminal can be touched.
            |
            |--------------------------------------------------------------
            */

            const sessionUser =
              readStoredSessionUser();

            const sessionStaffId =
              resolveStaffId(sessionUser);

            await releaseStaffTerminal(
              sessionUser
            );

            setUser(null);

            clearLocalUser(
              sessionStaffId
            );

            setLoading(false);

            return;
          }

          try {
            /*
            |--------------------------------------------------------------------------
            | GET APPLICATION USER PROFILE
            |--------------------------------------------------------------------------
            |
            | Firebase has already authenticated the user.
            |
            | The backend provides:
            |
            | - role
            | - department
            | - department_id
            | - department_prefix
            | - kiosk
            | - position
            | - position_id
            | - position_name
            | - position_tabs
            | - status
            |
            |--------------------------------------------------------------------------
            */

            const userData =
              await getCurrentUserProfile(
                firebaseUser
              );

            if (!userData) {
              console.error(
                "Firebase user authenticated, but application profile was not found."
              );

              /*
              | The session is being ended, so any terminal this staff member
              | still holds must be freed. Identity comes from the stored
              | session, since the profile lookup returned nothing.
              */

              const storedSession =
                readStoredSessionUser();

              await releaseStaffTerminal(
                storedSession
              );

              await firebaseSignOut(
                auth
              );

              clearLocalUser(
                resolveStaffId(
                  storedSession
                )
              );

              setUser(null);
              setLoading(false);

              return;
            }

            /*
            |--------------------------------------------------------------------------
            | CHECK ACCOUNT STATUS
            |--------------------------------------------------------------------------
            */

            if (
              String(
                userData.status ?? ""
              ).toLowerCase() ===
              "inactive"
            ) {
              /*
              | A deactivated staff member must not keep holding a terminal,
              | so this forced sign-out releases it too. The release is
              | scoped to this staff member and only ever clears their own
              | assignment.
              */

              await releaseStaffTerminal(
                userData
              );

              await firebaseSignOut(
                auth
              );

              clearLocalUser(
                resolveStaffId(
                  userData
                )
              );

              setUser(null);
              setLoading(false);

              return;
            }

            /*
            |--------------------------------------------------------------------------
            | CHECK ROLE / DEPARTMENT
            |--------------------------------------------------------------------------
            */

            const accessValidation =
              validateUserAccess(
                userData
              );

            if (
              !accessValidation.valid
            ) {
              console.warn(
                "Firebase-authenticated user failed access validation:",
                accessValidation.message
              );

              await releaseStaffTerminal(
                userData
              );

              await firebaseSignOut(
                auth
              );

              clearLocalUser(
                resolveStaffId(
                  userData
                )
              );

              setUser(null);
              setLoading(false);

              return;
            }

            /*
            |--------------------------------------------------------------------------
            | BUILD FINAL USER
            |--------------------------------------------------------------------------
            */

            const finalUser =
              buildFinalUser(
                userData,
                firebaseUser
              );

            /*
            |--------------------------------------------------------------------------
            | SAVE USER
            |--------------------------------------------------------------------------
            */

            setUser(finalUser);

            saveUserLocally(
              finalUser
            );

            /*
            |--------------------------------------------------------------------------
            | DEBUG
            |--------------------------------------------------------------------------
            */

            console.log(
              "Firebase authenticated user:",
              {
                firebase_uid:
                  finalUser.firebase_uid,

                email:
                  finalUser.email,

                role:
                  finalUser.role,

                department:
                  finalUser.department,

                department_id:
                  finalUser.department_id,

                department_prefix:
                  finalUser.department_prefix,

                position:
                  finalUser.position,

                position_id:
                  finalUser.position_id,

                position_name:
                  finalUser.position_name,

                position_tabs:
                  finalUser.position_tabs,

                kiosk:
                  finalUser.kiosk,
              }
            );
          } catch (error) {
            console.error(
              "Error loading authenticated user profile:",
              error
            );

            /*
            |--------------------------------------------------------------------------
            | OFFLINE FALLBACK
            |--------------------------------------------------------------------------
            |
            | Firebase authentication succeeded, but the backend/database
            | may currently be unavailable.
            |
            | Firebase remains the authentication authority.
            |
            |--------------------------------------------------------------------------
            */

            console.warn(
              "Backend unavailable. Attempting to restore saved offline session."
            );

            const savedUser =
              await loadSavedUser();

            if (savedUser) {
              const finalUser =
                buildFinalUser(
                  savedUser,
                  firebaseUser
                );

              setUser(finalUser);

              console.log(
                "Offline session restored:",
                {
                  firebase_uid:
                    finalUser.firebase_uid,

                  email:
                    finalUser.email,

                  role:
                    finalUser.role,

                  department:
                    finalUser.department,

                  department_id:
                    finalUser.department_id,

                  department_prefix:
                    finalUser.department_prefix,

                  position:
                    finalUser.position,

                  position_id:
                    finalUser.position_id,

                  position_tabs:
                    finalUser.position_tabs,

                  kiosk:
                    finalUser.kiosk,
                }
              );
            } else {
              console.warn(
                "No saved offline session is available."
              );

              setUser(null);
              clearLocalUser();
            }
          } finally {
            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  async function signIn(
    email,
    password
  ) {
    try {
      /*
      |--------------------------------------------------------------------------
      | NORMALIZE EMAIL
      |--------------------------------------------------------------------------
      */

      const normalizedEmail =
        String(email ?? "")
          .trim()
          .toLowerCase();

      if (!normalizedEmail) {
        return {
          error: {
            message:
              "Email is required.",
          },
        };
      }

      if (!password) {
        return {
          error: {
            message:
              "Password is required.",
          },
        };
      }

 console.log("EMAIL LOGIN DEBUG:", {
  email: normalizedEmail,
  passwordProvided: !!password,
  passwordLength: password?.length,
  firebaseProject: auth.app.options.projectId,
  authDomain: auth.app.options.authDomain,
});

const credential = await signInWithEmailAndPassword(
  auth,
  normalizedEmail,
  password
);

      const firebaseUser =
        credential.user;

      if (!firebaseUser) {
        return {
          error: {
            message:
              "Firebase authentication failed.",
          },
        };
      }

      /*
      |--------------------------------------------------------------------------
      | STEP 2
      | GET APPLICATION PROFILE
      |--------------------------------------------------------------------------
      |
      | Firebase has verified the credentials.
      |
      | The backend provides the user's application information,
      | including position_tabs.
      |
      |--------------------------------------------------------------------------
      */

      let userData;

      try {
        userData =
          await getCurrentUserProfile(
            firebaseUser
          );
      } catch (profileError) {
        console.error(
          "Failed to retrieve application user profile:",
          profileError
        );

        /*
        |--------------------------------------------------------------------------
        | SIGN OUT FIREBASE IF PROFILE CANNOT BE LOADED
        |--------------------------------------------------------------------------
        */

        await firebaseSignOut(
          auth
        );

        clearLocalUser();

        return {
          error: {
            message:
              profileError?.message ||
              "Login succeeded, but your user profile could not be loaded.",
          },
        };
      }

      if (!userData) {
        await firebaseSignOut(
          auth
        );

        clearLocalUser();

        return {
          error: {
            message:
              "Login succeeded, but your application user profile could not be found.",
          },
        };
      }

      /*
      |--------------------------------------------------------------------------
      | STEP 3
      | STATUS CHECK
      |--------------------------------------------------------------------------
      */

      if (
        String(
          userData.status ?? ""
        ).toLowerCase() ===
        "inactive"
      ) {
        await firebaseSignOut(
          auth
        );

        clearLocalUser();
        setUser(null);

        return {
          error: {
            message:
              "This account has been disabled.",
          },
        };
      }

      /*
      |--------------------------------------------------------------------------
      | STEP 4
      | ROLE / DEPARTMENT CHECK
      |--------------------------------------------------------------------------
      */

      const accessValidation =
        validateUserAccess(
          userData
        );

      if (
        !accessValidation.valid
      ) {
        await firebaseSignOut(
          auth
        );

        clearLocalUser();
        setUser(null);

        return {
          error: {
            message:
              accessValidation.message,
          },
        };
      }

      /*
      |--------------------------------------------------------------------------
      | STEP 5
      | BUILD FINAL USER
      |--------------------------------------------------------------------------
      */

      const finalUser =
        buildFinalUser(
          userData,
          firebaseUser
        );

      /*
      |--------------------------------------------------------------------------
      | STEP 6
      | SAVE SESSION
      |--------------------------------------------------------------------------
      */

      setUser(finalUser);

      saveUserLocally(
        finalUser
      );

      /*
      |--------------------------------------------------------------------------
      | DEBUG
      |--------------------------------------------------------------------------
      */

      console.log(
        "Authenticated user:",
        {
          firebase_uid:
            finalUser.firebase_uid,

          email:
            finalUser.email,

          role:
            finalUser.role,

          department:
            finalUser.department,

          department_id:
            finalUser.department_id,

          department_prefix:
            finalUser.department_prefix,

          position:
            finalUser.position,

          position_id:
            finalUser.position_id,

          position_name:
            finalUser.position_name,

          position_tabs:
            finalUser.position_tabs,

          kiosk:
            finalUser.kiosk,
        }
      );

const hasPasswordProvider = firebaseUser.providerData.some(
  (provider) => provider.providerId === "password"
);

return {
  error: null,
  user: finalUser,
  role: accessValidation.role,
  position: finalUser.position ?? null,
  position_id: finalUser.position_id ?? null,
  position_tabs: finalUser.position_tabs ?? [],
  hasPasswordProvider,
};
    } catch (error) {
      console.error(
        "Firebase authentication error:",
        error
      );

      /*
      |--------------------------------------------------------------------------
      | FIREBASE ERROR MESSAGES
      |--------------------------------------------------------------------------
      */

      let message =
        "Something went wrong while logging in.";

      switch (error?.code) {
        case "auth/invalid-credential":
          message =
            "Invalid email or password.";
          break;

        case "auth/invalid-email":
          message =
            "Please enter a valid email address.";
          break;

        case "auth/user-disabled":
          message =
            "This account has been disabled.";
          break;

        case "auth/user-not-found":
          message =
            "Invalid email or password.";
          break;

        case "auth/wrong-password":
          message =
            "Invalid email or password.";
          break;

        case "auth/too-many-requests":
          message =
            "Too many login attempts. Please try again later.";
          break;

        case "auth/network-request-failed":
          message =
            "Unable to connect to Firebase. Please check your internet connection.";
          break;

        default:
          message =
            error?.message ||
            message;
      }

      return {
        error: {
          message,
        },
      };
    }
  }

  async function signInWithGoogle(
  email,
  password
) {
  let pendingGoogleCredential = null;

  try {
    /*
    |--------------------------------------------------------------------------
    | NORMALIZE EMAIL
    |--------------------------------------------------------------------------
    */

    const normalizedEmail =
      String(email ?? "")
        .trim()
        .toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | STEP 1
    | TRY GOOGLE LOGIN
    |--------------------------------------------------------------------------
    */

    let googleResult;

    try {
      googleResult =
        await signInWithPopup(
          auth,
          googleProvider
        );
    } catch (googleError) {

      /*
      |--------------------------------------------------------------------------
      | EXISTING EMAIL/PASSWORD ACCOUNT
      |--------------------------------------------------------------------------
      |
      | Firebase tells us that this email already belongs to another
      | sign-in provider.
      |
      | Since Superadmin-created users already have email/password,
      | we sign into that existing account and link Google to it.
      |
      */

      if (
        googleError?.code ===
        "auth/account-exists-with-different-credential"
      ) {

        pendingGoogleCredential =
          GoogleAuthProvider
            .credentialFromError(
              googleError
            );

        const googleEmail =
          googleError?.customData?.email;

        if (
          !googleEmail
        ) {
          return {
            error: {
              message:
                "Unable to determine the Google account email.",
            },
          };
        }

        /*
        |--------------------------------------------------------------------------
        | VERIFY EMAIL MATCH
        |--------------------------------------------------------------------------
        */

        if (
          normalizedEmail &&
          normalizedEmail !==
            String(
              googleEmail
            )
              .trim()
              .toLowerCase()
        ) {
          return {
            error: {
              message:
                "The Google account email does not match the SWU Med account email.",
            },
          };
        }

        /*
        |--------------------------------------------------------------------------
        | PASSWORD IS REQUIRED FOR FIRST-TIME LINKING
        |--------------------------------------------------------------------------
        */

        if (!password) {
          return {
            error: {
              message:
                "Enter your temporary password in the password field, then continue with Google to connect your account.",
            },
          };
        }

        /*
        |--------------------------------------------------------------------------
        | SIGN INTO EXISTING FIREBASE ACCOUNT
        |--------------------------------------------------------------------------
        */

        const existingCredential =
          await signInWithEmailAndPassword(
            auth,
            googleEmail,
            password
          );

        const existingFirebaseUser =
          existingCredential.user;

        if (
          !existingFirebaseUser
        ) {
          return {
            error: {
              message:
                "Unable to sign in to your existing SWU Med account.",
            },
          };
        }

        /*
        |--------------------------------------------------------------------------
        | LINK GOOGLE TO EXISTING FIREBASE USER
        |--------------------------------------------------------------------------
        */

        try {
          await linkWithCredential(
            existingFirebaseUser,
            pendingGoogleCredential
          );
        } catch (linkError) {

          console.error(
            "Failed to link Google account:",
            linkError
          );

          if (
            linkError?.code ===
            "auth/provider-already-linked"
          ) {
            // Google is already linked.
          } else {
            await firebaseSignOut(
              auth
            );

            clearLocalUser();
            setUser(null);

            return {
              error: {
                message:
                  "The Google account could not be linked to your SWU Med account.",
              },
            };
          }
        }

        /*
        |--------------------------------------------------------------------------
        | GOOGLE IS NOW LINKED
        |--------------------------------------------------------------------------
        */

        googleResult = {
          user:
            existingFirebaseUser,
        };
      } else {

        throw googleError;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 2
    | GET FIREBASE USER
    |--------------------------------------------------------------------------
    */
const firebaseUser = googleResult?.user;

if (!firebaseUser) {
  return {
    error: {
      message: "Google authentication failed.",
    },
  };
}

const hasPasswordProvider =
  firebaseUser.providerData.some(
    (provider) => provider.providerId === "password"
  );

console.log(
  "GOOGLE LOGIN PROVIDERS:",
  firebaseUser.providerData.map(
    (provider) => ({
      providerId: provider.providerId,
      email: provider.email,
    })
  )
);

    /*
    |--------------------------------------------------------------------------
    | STEP 3
    | GET SWU MED APPLICATION PROFILE
    |--------------------------------------------------------------------------
    */

    let userData;

    try {
      userData =
        await getCurrentUserProfile(
          firebaseUser
        );
    } catch (profileError) {

      console.error(
        "Failed to retrieve application profile after Google login:",
        profileError
      );

      await firebaseSignOut(
        auth
      );

      clearLocalUser();
      setUser(null);

      return {
        error: {
          message:
            "This Google account is not registered in the SWU Med system.",
        },
      };
    }

    if (!userData) {

      await firebaseSignOut(
        auth
      );

      clearLocalUser();
      setUser(null);

      return {
        error: {
          message:
            "This Google account is not registered in the SWU Med system. Please contact your administrator.",
        },
      };
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 4
    | STATUS CHECK
    |--------------------------------------------------------------------------
    */

    if (
      String(
        userData.status ?? ""
      ).toLowerCase() ===
      "inactive"
    ) {

      await firebaseSignOut(
        auth
      );

      clearLocalUser();
      setUser(null);

      return {
        error: {
          message:
            "This account has been disabled.",
        },
      };
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 5
    | ROLE / DEPARTMENT CHECK
    |--------------------------------------------------------------------------
    */

    const accessValidation =
      validateUserAccess(
        userData
      );

    if (
      !accessValidation.valid
    ) {

      await firebaseSignOut(
        auth
      );

      clearLocalUser();
      setUser(null);

      return {
        error: {
          message:
            accessValidation.message,
        },
      };
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 6
    | BUILD FINAL USER
    |--------------------------------------------------------------------------
    */

  const finalUser =
  buildFinalUser(
    userData,
    firebaseUser
  );
    /*
    |--------------------------------------------------------------------------
    | STEP 7
    | SAVE SESSION
    |--------------------------------------------------------------------------
    */

    setUser(finalUser);

    saveUserLocally(
      finalUser
    );

    console.log(
      "Authenticated with Google:",
      {
        firebase_uid:
          finalUser.firebase_uid,

        email:
          finalUser.email,

        role:
          finalUser.role,

        department:
          finalUser.department,

        department_id:
          finalUser.department_id,
      }
    );

    return {
      error: null,

      user:
        finalUser,

      role:
        accessValidation.role,

      position:
        finalUser.position ??
        null,

      position_id:
        finalUser.position_id ??
        null,

      position_tabs:
        finalUser.position_tabs ??
        [],
        hasPasswordProvider,
    };

  } catch (error) {

    console.error(
      "Google authentication error:",
      error
    );

    let message =
      "Something went wrong while signing in with Google.";

    switch (error?.code) {

      case "auth/popup-closed-by-user":
        message =
          "Google sign-in was cancelled.";
        break;

      case "auth/popup-blocked":
        message =
          "The Google sign-in popup was blocked by your browser.";
        break;

      case "auth/cancelled-popup-request":
        message =
          "Google sign-in was cancelled.";
        break;

      case "auth/invalid-credential":
        message =
          "The email or temporary password is incorrect.";
        break;

      case "auth/wrong-password":
        message =
          "The email or temporary password is incorrect.";
        break;

      case "auth/user-not-found":
        message =
          "No SWU Med account was found with this email.";
        break;

      case "auth/network-request-failed":
        message =
          "Unable to connect to Firebase. Please check your internet connection.";
        break;

      default:
        message =
          error?.message ||
          message;
    }

    return {
      error: {
        message,
      },
    };
  }
}
  /*
  |--------------------------------------------------------------------------
  | SIGN OUT
  |--------------------------------------------------------------------------
  |
  | Firebase is responsible for ending the authentication session.
  |
  |--------------------------------------------------------------------------
  */

  async function signOut() {
    /*
    |--------------------------------------------------------------------------
    | RELEASE THE STAFF TERMINAL
    |--------------------------------------------------------------------------
    |
    | A staff member's assigned terminal must be freed the moment they log
    | out, so another staff member can pick it (or be assigned to it) right
    | away. Without this, the counter row keeps assigned_staff_id set after
    | the session ends, and the terminal stays stuck as "occupied" even
    | though nobody is signed in on it.
    |
    | Best-effort: a failed release must never block logout itself, but it
    | is reported rather than swallowed.
    |
    |----------------------------------------------------------------------
    |
    | releaseStaffTerminal() is the only implementation. It reads the staff
    | ID and the terminal ID before anything is cleared, so the release never
    | depends on data that is about to disappear. It also marks this staff
    | member as already released, so the onAuthStateChanged() callback that
    | firebaseSignOut() triggers cannot release a second time.
    |
    |----------------------------------------------------------------------
    */

    const staffId =
      resolveStaffId(user);

    const releaseResult =
      await releaseStaffTerminal(
        user,

        // An explicit logout must never be skipped, even if this same staff
        // member released a terminal moments ago.
        { skipIfRecentlyReleased: false }
      );

    if (
      releaseResult.released ===
        false &&
      releaseResult.reason ===
        "error"
    ) {
      console.error(
        "Staff terminal was not released before logout. It may stay marked as assigned until the next assignment check.",
        releaseResult.error
      );
    }

    try {
      await firebaseSignOut(
        auth
      );

      setUser(null);

      /*
      | Only now, after the release has been attempted, is the local
      | terminal state dropped. The per-staff key goes with it so the next
      | login cannot restore a terminal this session no longer owns.
      */

      clearLocalUser(staffId);
    } catch (error) {
      console.error(
        "Sign-out error:",
        error
      );

      /*
      |--------------------------------------------------------------------------
      | EVEN IF FIREBASE SIGN-OUT FAILS
      | CLEAR THE LOCAL APPLICATION SESSION
      |--------------------------------------------------------------------------
      */

      setUser(null);

      clearLocalUser(staffId);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CONTEXT VALUE
  |--------------------------------------------------------------------------
  */

  const value = {
    user,

    role:
      normalizeRole(
        user?.role
      ) || null,

    position:
      user?.position ??
      null,

    position_id:
      user?.position_id ??
      null,

    position_tabs:
      user?.position_tabs ??
      [],

    loading,

signInWithGoogle,

    signIn,

    signOut,
  };

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

/*
|--------------------------------------------------------------------------
| USE AUTH
|--------------------------------------------------------------------------
*/

export function useAuth() {
  const ctx =
    useContext(
      AuthContext
    );

  if (!ctx) {
    throw new Error(
      "useAuth must be used inside <AuthProvider>"
    );
  }

  return ctx;
}