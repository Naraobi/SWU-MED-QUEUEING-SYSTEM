import { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../supabase';

const AuthContext = createContext(null);
const STORAGE_KEY = 'swumed_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore logged-in user when page is refreshed
  useEffect(() => {
    const restoreUser = async () => {
      if (!isSupabaseConfigured) {
        const demoUser = {
          id: 'demo-staff',
          auth_user_id: null,
          email: 'staff.demo@swu.local',
          first_name: 'Ruth',
          last_name: 'Abella',
          department: 'Billing Department',
          department_prefix: 'BP',
          role: { name: 'Staff' },
        };
        setUser(demoUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
        setLoading(false);
        return;
      }

      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        // 1. Get application user + role + department
        const { data: userData, error } = await supabase
          .from('user')
          .select(`
            id,
            auth_user_id,
            email,
            first_name,
            last_name,
            department,
            role_id,
            role:role_id (
              id,
              name
            )
          `)
          .eq('auth_user_id', authUser.id)
          .maybeSingle();

        if (error || !userData) {
          console.error('Error loading user profile:', error);
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        } else {
          // 2. Fetch the prefix from the departments table
          let fetchedPrefix = '';
          if (userData.department) {
            const { data: deptData } = await supabase
              .from('departments')
              .select('prefix')
              .eq('name', userData.department)
              .maybeSingle();
              
            if (deptData) {
              fetchedPrefix = deptData.prefix;
            }
          }

          // 3. Attach prefix to user data and save
          const finalUser = { ...userData, department_prefix: fetchedPrefix };
          setUser(finalUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));
        }
      } catch (error) {
        console.error('Error restoring user:', error);
        setUser(null);
      }

      setLoading(false);
    };

    restoreUser();
  }, []);

  async function signIn(email, password) {
    if (!isSupabaseConfigured) {
      const demoUser = {
        id: 'demo-staff',
        auth_user_id: null,
        email: email || 'staff.demo@swu.local',
        first_name: 'Ruth',
        last_name: 'Abella',
        department: 'Billing Department',
        department_prefix: 'BP',
        role: { name: 'Staff' },
      };
      setUser(demoUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
      return { error: null, user: demoUser, role: 'Staff' };
    }

    try {
      // 1. Supabase Auth verifies email + password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Authentication error:', authError);
        return { error: { message: 'Invalid email or password.' } };
      }

      const authUser = authData.user;

      // 2. Find the user in our public.users table
      const { data: userData, error } = await supabase
        .from('user')
        .select(`
          id,
          auth_user_id,
          email,
          first_name,
          last_name,
          department,
          role_id,
          role:role_id (
            id,
            name
          )
        `)
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (error || !userData) {
        console.error('User profile error:', error);
        await supabase.auth.signOut();
        return { error: { message: 'User profile could not be found.' } };
      }

      // 3. Get the role
      const roleName = userData.role?.name;

      if (!roleName) {
        await supabase.auth.signOut();
        return { error: { message: 'No role has been assigned to this account.' } };
      }

      // 4. Fetch the prefix from the departments table
      let fetchedPrefix = '';
      if (userData.department) {
        const { data: deptData } = await supabase
          .from('departments')
          .select('prefix')
          .eq('name', userData.department)
          .maybeSingle();
          
        if (deptData) {
          fetchedPrefix = deptData.prefix;
        }
      }

      const finalUser = { ...userData, department_prefix: fetchedPrefix };

      // Set user status to 'Active'
      try {
        await supabase
          .from('user')
          .update({ status: 'Active' })
          .eq('id', userData.id);
      } catch (updateError) {
        console.error('Failed to update status to Active:', updateError);
      }

      // 5. Store safe user information
      setUser(finalUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));

      // 6. Return the role so Login.jsx can redirect
      return {
        error: null,
        user: finalUser,
        role: roleName,
      };

    } catch (error) {
      console.error('Unexpected login error:', error);
      return { error: { message: 'Something went wrong while logging in.' } };
    }
  }

  async function signOut() {
    // Set user status back to 'Inactive' before wiping session
    if (isSupabaseConfigured && user && user.id) {
      try {
        await supabase
          .from('user')
          .update({ status: 'Inactive' })
          .eq('id', user.id);
      } catch (err) {
        console.error('Failed to update status to Inactive:', err);
      }
    }

    if (isSupabaseConfigured) await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = {
    user,
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
    throw new Error('useAuth must be used inside <AuthProvider>');
  }

  return ctx;
}