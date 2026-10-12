import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL } from './apiBase';

const DEFAULT_BRANDING = { systemName: 'SWUMed Queuing System', logo: null, accent: '#9D0A0E' };
const BrandingContext = createContext(DEFAULT_BRANDING);

export async function fetchPatientBranding() {
  const response = await fetch(`${API_URL}/branding`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Could not load branding.');
  return { ...DEFAULT_BRANDING, ...result.data };
}

export async function publishPatientBranding({ systemName, logo, accent }, firebaseUser) {
  if (!firebaseUser) throw new Error('A signed-in Super Admin is required to publish branding.');
  const token = await firebaseUser.getIdToken();
  const response = await fetch(`${API_URL}/branding`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemName, logo: logo || null, accent }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Could not save patient branding.');
  return { ...DEFAULT_BRANDING, ...result.data };
}

export function PatientBrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const refresh = useCallback(async () => {
    try { setBranding(await fetchPatientBranding()); } catch { /* Keep the last known/default branding while offline. */ }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.style.setProperty('--swu-accent', branding.accent || DEFAULT_BRANDING.accent);
  }, [branding.accent]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function usePatientBranding() {
  return useContext(BrandingContext);
}
