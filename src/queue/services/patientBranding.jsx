import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from './apiBase';

const DEFAULT_BRANDING = {
  systemName: 'SWUMed Queuing System',
  logo: null,
  loginBackground: null,
  accent: '#9D0A0E',
};

const BrandingContext = createContext(DEFAULT_BRANDING);

function normalizeBranding(data = {}) {
  return {
    ...DEFAULT_BRANDING,
    ...data,
    logo: data.logo || null,
    loginBackground: data.loginBackground || null,
  };
}

export async function fetchPatientBranding() {
  const response = await fetch(`${API_URL}/branding`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Could not load branding.');
  return normalizeBranding(result.data);
}

export async function publishPatientBranding(
  { systemName, logo, loginBackground, accent },
  firebaseUser
) {
  if (!firebaseUser) throw new Error('A signed-in Super Admin is required to publish branding.');
  const token = await firebaseUser.getIdToken();
  const response = await fetch(`${API_URL}/branding`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemName,
      logo: logo || null,
      loginBackground: loginBackground || null,
      accent,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Could not save patient branding.');
  return normalizeBranding(result.data);
}

export async function uploadBrandingImage(kind, dataUrl, firebaseUser) {
  if (!firebaseUser) throw new Error('A signed-in Super Admin is required to upload branding images.');

  const token = await firebaseUser.getIdToken();
  const response = await fetch(`${API_URL}/branding/upload/${kind}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !result?.data?.url) {
    throw new Error(
      result?.message ||
        'The image could not be uploaded. Your current branding was kept.'
    );
  }

  return result.data.url;
}

export function PatientBrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  const refresh = useCallback(async () => {
    try {
      setBranding(await fetchPatientBranding());
    } catch {
      /* Keep the last known/default branding while offline. */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchPatientBranding();
        if (!cancelled) setBranding(next);
      } catch {
        /* Keep the last known/default branding while offline. */
      }
    };

    load();
    const interval = window.setInterval(load, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--swu-accent',
      branding.accent || DEFAULT_BRANDING.accent
    );
  }, [branding.accent]);

  useEffect(() => {
    document.title = branding.systemName || DEFAULT_BRANDING.systemName;

    const link = document.querySelector("link[rel~='icon']");
    if (!link) return undefined;

    const fallback = '/favicon.svg';
    let cancelled = false;

    if (!branding.logo) {
      link.href = fallback;
      return undefined;
    }

    const image = new Image();

    image.onload = () => {
      if (!cancelled) link.href = branding.logo;
    };

    image.onerror = () => {
      if (!cancelled) link.href = fallback;
    };

    image.src = branding.logo;

    return () => {
      cancelled = true;
    };
  }, [branding.logo, branding.systemName]);

  const value = useMemo(() => ({ ...branding, refresh }), [branding, refresh]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function usePatientBranding() {
  return useContext(BrandingContext);
}
