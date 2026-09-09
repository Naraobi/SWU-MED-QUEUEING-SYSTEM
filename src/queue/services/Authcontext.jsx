import { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../supabase';

const AuthContext = createContext(null);
const STORAGE_KEY = 'swumed_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreUser = async () => {
      if (!isSupabaseConfigured) {
        const demoUser = {
          user_id: 'demo-staff', email: 'staff.demo@swu.local', first_name: 'Ruth', last_name: 'Abella',
          position: null, department: 'Billing Department', department_prefix: 'BP', role: { role: 'Staff' },
        };
        setUser(demoUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
        setLoading(false);
        return;
      }

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        const { data: userData, error } = await supabase
          .from('user')
          .select(`
            user_id,
            email,
            first_name,
            last_name,
            position,
            department,
            role_id,
            role:role_id (role_id, role)
          `)
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (error || !userData) {
          console.error('Error loading user profile:', error);
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        } else {
          let fetchedPrefix = '';
          if (userData.department) {
            const { data: deptData } = await supabase
              .from('departments').select('prefix').eq('name', userData.department).maybeSingle();
            if (deptData) fetchedPrefix = deptData.prefix;
          }
          const finalUser = { ...userData, department_prefix: fetchedPrefix };
          setUser(finalUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));
        }
      } catch (error) {
        console.error('Error restoring user:', error);
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      }
      setLoading(false);
    };
    restoreUser();
  }, []);

  async function signIn(email, password) {
    if (!isSupabaseConfigured) {
      const demoUser = {
        user_id: 'demo-staff', email: email || 'staff.demo@swu.local', first_name: 'Ruth', last_name: 'Abella',
        position: null, department: 'Billing Department', department_prefix: 'BP', role: { role: 'Staff' },
      };
      setUser(demoUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
      return { error: null, user: demoUser, role: 'Staff', position: null };
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        console.error('Authentication error:', authError);
        return { error: { message: 'Invalid email or password.' } };
      }

      const authUser = authData.user;
      const { data: userData, error } = await supabase
        .from('user')
        .select(`
          user_id,
          email,
          first_name,
          last_name,
          position,
          department,
          role_id,
          role:role_id (role_id, role)
        `)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error || !userData) {
        console.error('User profile error:', error);
        await supabase.auth.signOut();
        return { error: { message: 'User profile could not be found.' } };
      }

      const roleName = userData.role?.role;
      if (!roleName) {
        await supabase.auth.signOut();
        return { error: { message: 'No role has been assigned to this account.' } };
      }

      let fetchedPrefix = '';
      if (userData.department) {
        const { data: deptData } = await supabase
          .from('departments').select('prefix').eq('name', userData.department).maybeSingle();
        if (deptData) fetchedPrefix = deptData.prefix;
      }

      const finalUser = { ...userData, department_prefix: fetchedPrefix };

      try {
        await supabase.from('user').update({ status: 'Active' }).eq('user_id', authUser.id);
      } catch (updateError) {
        console.error('Failed to update status to Active:', updateError);
      }

      setUser(finalUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));
      return { error: null, user: finalUser, role: roleName, position: finalUser.position };
    } catch (error) {
      console.error('Unexpected login error:', error);
      return { error: { message: 'Something went wrong while logging in.' } };
    }
  }

  async function signOut() {
    if (isSupabaseConfigured && user?.user_id) {
      try {
        await supabase.from('user').update({ status: 'Inactive' }).eq('user_id', user.user_id);
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
    role: user?.role?.role ?? null,
    position: user?.position ?? null,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
