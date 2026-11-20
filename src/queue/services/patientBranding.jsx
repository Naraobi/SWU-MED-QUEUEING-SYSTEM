import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL, brandingMediaUrl } from './apiBase';

const DEFAULT_BRANDING = {
  systemName: 'SWUMed Queuing System',
  logo: null,
  loginBackground: null,
  accent: '#9D0A0E',
};

const FALLBACK_ICON = '/favicon.svg';
const ICON_TYPES = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const BrandingContext = createContext(DEFAULT_BRANDING);

function iconType(src) {
  if (src.startsWith('data:')) {
    return src.match(/^data:(image\/[a-z0-9.+-]+)/i)?.[1] || '';
  }
  const path = src.split(/[?#]/, 1)[0];
  return ICON_TYPES[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] || '';
}

function normalizeBranding(data = {}) {
  return {
    ...DEFAULT_BRANDING,
    ...data,
    logo: data.logo || null,
    loginBackground: data.loginBackground || null,
  };
}

export async function fetchPatientBranding() {
  const response = await fetch(`${API_URL}/branding`, { cache: 'no-store' });
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

    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    const applyIcon = (src, explicitType) => {
      link.href = src;
      const type = explicitType || iconType(src);
      if (type) link.type = type;
      else link.removeAttribute('type');
    };

    let cancelled = false;
    const logoUrl = brandingMediaUrl(branding.logo, 'logo', branding.updatedAt);

    if (!logoUrl) {
      applyIcon(FALLBACK_ICON);
      return undefined;
    }

    const image = new Image();

    image.onload = () => {
      if (!cancelled) applyIcon(logoUrl, iconType(branding.logo));
    };

    image.onerror = () => {
      if (!cancelled) applyIcon(FALLBACK_ICON);
    };

    image.src = logoUrl;

    return () => {
      cancelled = true;
    };
  }, [branding.logo, branding.systemName, branding.updatedAt]);

  const value = useMemo(() => ({ ...branding, refresh }), [branding, refresh]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function usePatientBranding() {
  return useContext(BrandingContext);
}
