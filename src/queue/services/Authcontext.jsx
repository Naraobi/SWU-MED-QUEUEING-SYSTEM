import { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../supabase';

const AuthContext = createContext(null);
const STORAGE_KEY = 'swumed_user';

// Only these roles are allowed to access the system.
const ALLOWED_ROLES = new Set(['superadmin', 'admin', 'staff']);

function normalizeRole(role) {
  if (typeof role === 'object' && role?.role) {
    role = role.role;
  }

  return String(role ?? '').trim().toLowerCase();
}

function normalizeDepartment(department) {
  const value = String(department ?? '').trim();

  if (!value || value.toLowerCase() === 'null') {
    return null;
  }

  return value;
}

/**
 * Checks whether the user profile has a valid role and
 * whether the role has the required department assignment.
 *
 * Rules:
 * - Superadmin: department is NOT required.
 * - Admin: department IS required.
 * - Staff: department IS required.
 */
function validateUserAccess(userData) {
  if (!userData) {
    return {
      valid: false,
      message: 'User profile could not be found.',
    };
  }

  const roleName = normalizeRole(userData.role?.role);

  // Reject accounts with no role.
  if (!roleName) {
    return {
      valid: false,
      message: 'No role has been assigned to this account.',
    };
  }

  // Reject roles that are not part of the system.
  if (!ALLOWED_ROLES.has(roleName)) {
    return {
      valid: false,
      message: 'Your account does not have a valid role.',
    };
  }

  const department = normalizeDepartment(userData.department);

  // Superadmin does not need a department.
  if (roleName === 'superadmin') {
    return {
      valid: true,
      role: roleName,
    };
  }

  // Admin and Staff must have a department.
  if (!department) {
    const roleLabel =
      roleName === 'admin'
        ? 'Admin'
        : 'Staff';

    return {
      valid: false,
      message: `${roleLabel} accounts must be assigned to a department before they can log in.`,
    };
  }

  return {
    valid: true,
    role: roleName,
  };
}

async function fetchUserProfile(authUserId) {
  if (!authUserId) {
    return {
      data: null,
      error: new Error('Authentication user ID is missing.'),
    };
  }

  const { data, error } = await supabase
    .from('user')
    .select(`
      user_id,
      email,
      first_name,
      last_name,
      position,
      department,
      role_id,
      role:role_id (
        role_id,
        role
      )
    `)
    .eq('user_id', authUserId)
    .maybeSingle();

  return {
    data,
    error,
  };
}

async function fetchDepartmentPrefix(department) {
  if (!department) {
    return '';
  }

  const { data, error } = await supabase
    .from('departments')
    .select('prefix')
    .eq('name', department)
    .maybeSingle();

  if (error) {
    console.error('Error loading department prefix:', error);
    return '';
  }

  return data?.prefix ?? '';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreUser = async () => {
      // ---------------------------------------------------------
      // DEMO MODE
      // ---------------------------------------------------------
      if (!isSupabaseConfigured) {
        const demoUser = {
          user_id: 'demo-staff',
          email: 'staff.demo@swu.local',
          first_name: 'Ruth',
          last_name: 'Abella',
          position: null,
          department: 'Billing Department',
          department_prefix: 'BP',
          role: {
            role: 'Staff',
          },
        };

        setUser(demoUser);
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(demoUser)
        );

        setLoading(false);
        return;
      }

      // ---------------------------------------------------------
      // SUPABASE SESSION RESTORATION
      // ---------------------------------------------------------
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error(
            'Error getting authenticated user:',
            authError
          );
        }

        // No authenticated Supabase user.
        if (!authUser) {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        // -------------------------------------------------------
        // GET USER PROFILE FROM PUBLIC "user" TABLE
        // -------------------------------------------------------
        const {
          data: userData,
          error: userError,
        } = await fetchUserProfile(authUser.id);

        if (userError || !userData) {
          console.error(
            'Error loading user profile:',
            userError
          );

          await supabase.auth.signOut();

          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        // -------------------------------------------------------
        // VALIDATE ROLE + DEPARTMENT
        // -------------------------------------------------------
        const accessValidation =
          validateUserAccess(userData);

        if (!accessValidation.valid) {
          console.error(
            'User access validation failed:',
            accessValidation.message
          );

          await supabase.auth.signOut();

          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        // -------------------------------------------------------
        // GET DEPARTMENT PREFIX
        // -------------------------------------------------------
        const fetchedPrefix =
          await fetchDepartmentPrefix(
            userData.department
          );

        const finalUser = {
          ...userData,
          department_prefix: fetchedPrefix,
        };

        setUser(finalUser);

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(finalUser)
        );
      } catch (error) {
        console.error(
          'Error restoring user:',
          error
        );

        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error(
            'Error signing out invalid session:',
            signOutError
          );
        }

        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      }

      setLoading(false);
    };

    restoreUser();
  }, []);

  // ===========================================================
  // SIGN IN
  // ===========================================================
  async function signIn(email, password) {
    // ---------------------------------------------------------
    // DEMO MODE
    // ---------------------------------------------------------
    if (!isSupabaseConfigured) {
      const demoUser = {
        user_id: 'demo-staff',
        email:
          email || 'staff.demo@swu.local',
        first_name: 'Ruth',
        last_name: 'Abella',
        position: null,
        department: 'Billing Department',
        department_prefix: 'BP',
        role: {
          role: 'Staff',
        },
      };

      setUser(demoUser);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(demoUser)
      );

      return {
        error: null,
        user: demoUser,
        role: 'Staff',
        position: null,
      };
    }

    try {
      // -------------------------------------------------------
      // STEP 1: SUPABASE AUTHENTICATION
      // -------------------------------------------------------
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error(
          'Authentication error:',
          authError
        );

        return {
          error: {
            message: 'Invalid email or password.',
          },
        };
      }

      const authUser = authData?.user;

      if (!authUser) {
        return {
          error: {
            message: 'Authentication failed. Please try again.',
          },
        };
      }

      // -------------------------------------------------------
      // STEP 2: GET USER PROFILE FROM SUPABASE
      // -------------------------------------------------------
      const {
        data: userData,
        error: userError,
      } = await fetchUserProfile(authUser.id);

      if (userError || !userData) {
        console.error(
          'User profile error:',
          userError
        );

        await supabase.auth.signOut();

        return {
          error: {
            message:
              'User profile could not be found. Please contact the administrator.',
          },
        };
      }

      // -------------------------------------------------------
      // STEP 3: CHECK ROLE + DEPARTMENT ASSIGNMENT
      // -------------------------------------------------------
      const accessValidation =
        validateUserAccess(userData);

      if (!accessValidation.valid) {
        console.error(
          'Login access validation failed:',
          accessValidation.message
        );

        // Very important:
        // Authentication succeeded, but the user's
        // application-level access requirements failed.
        // Therefore immediately terminate the Supabase session.
        await supabase.auth.signOut();

        return {
          error: {
            message: accessValidation.message,
          },
        };
      }

      const roleName =
        accessValidation.role;

      // -------------------------------------------------------
      // STEP 4: GET DEPARTMENT PREFIX
      // -------------------------------------------------------
      const fetchedPrefix =
        await fetchDepartmentPrefix(
          userData.department
        );

      const finalUser = {
        ...userData,
        department_prefix: fetchedPrefix,
      };

      // -------------------------------------------------------
      // STEP 5: UPDATE USER STATUS
      // -------------------------------------------------------
      try {
        await supabase
          .from('user')
          .update({
            status: 'Active',
          })
          .eq(
            'user_id',
            authUser.id
          );
      } catch (updateError) {
        console.error(
          'Failed to update status to Active:',
          updateError
        );
      }

      // -------------------------------------------------------
      // STEP 6: SAVE USER TO CONTEXT + LOCAL STORAGE
      // -------------------------------------------------------
      setUser(finalUser);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(finalUser)
      );

      return {
        error: null,
        user: finalUser,
        role: roleName,
        position: finalUser.position,
      };
    } catch (error) {
      console.error(
        'Unexpected login error:',
        error
      );

      return {
        error: {
          message:
            'Something went wrong while logging in.',
        },
      };
    }
  }

  // ===========================================================
  // SIGN OUT
  // ===========================================================
  async function signOut() {
    if (
      isSupabaseConfigured &&
      user?.user_id
    ) {
      try {
        await supabase
          .from('user')
          .update({
            status: 'Inactive',
          })
          .eq(
            'user_id',
            user.user_id
          );
      } catch (err) {
        console.error(
          'Failed to update status to Inactive:',
          err
        );
      }
    }

    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }

    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  // ===========================================================
  // AUTH CONTEXT VALUE
  // ===========================================================
  const value = {
    user,
    role: user?.role?.role ?? null,
    position: user?.position ?? null,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used inside <AuthProvider>'
    );
  }

  return ctx;
}