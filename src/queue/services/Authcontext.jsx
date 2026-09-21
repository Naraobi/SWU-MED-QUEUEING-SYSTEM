import { getOfflineData, saveOfflineData } from './offlineStorage';

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { auth } from "../../firebase";

import {
  getCurrentUserProfile,
} from "./backendApi";

const AuthContext = createContext(null);

const STORAGE_KEY = "swumed_user";

const ALLOWED_ROLES = new Set([
  "superadmin",
  "admin",
  "staff",
]);

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

function clearLocalUser() {
  localStorage.removeItem(
    STORAGE_KEY
  );

  localStorage.removeItem(
    "swumed_staff_terminal"
  );
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

  /*
  |--------------------------------------------------------------------------
  | FIREBASE AUTH SESSION
  |--------------------------------------------------------------------------
  |
  | Firebase is responsible for maintaining the authentication session.
  |
  | MySQL is NOT required for Firebase authentication.
  |
  |--------------------------------------------------------------------------
  */

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
            setUser(null);
            clearLocalUser();
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

              await firebaseSignOut(
                auth
              );

              clearLocalUser();
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
              await firebaseSignOut(
                auth
              );

              clearLocalUser();
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

              await firebaseSignOut(
                auth
              );

              clearLocalUser();
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

  /*
  |--------------------------------------------------------------------------
  | SIGN IN
  |--------------------------------------------------------------------------
  |
  | React
  |   ↓
  | Firebase Authentication
  |   ↓
  | Firebase verifies email/password
  |   ↓
  | Firebase UID
  |   ↓
  | Application profile
  |
  |--------------------------------------------------------------------------
  */

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

      /*
      |--------------------------------------------------------------------------
      | STEP 1
      | FIREBASE AUTHENTICATION
      |--------------------------------------------------------------------------
      |
      | MySQL is NOT contacted here.
      |
      |--------------------------------------------------------------------------
      */

      const credential =
        await signInWithEmailAndPassword(
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

      /*
      |--------------------------------------------------------------------------
      | RETURN RESULT
      |--------------------------------------------------------------------------
      */

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
          finalUser.position_tabs ?? [],
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
    try {
      await firebaseSignOut(
        auth
      );

      setUser(null);

      clearLocalUser();
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

      clearLocalUser();
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