// =====================================================
// SHARED BRAND COLORS
// =====================================================
//
// Single source of truth for the hex values reused as inline
// style={{}} colors across Admin, Staff, and Patient screens
// (Tailwind utility classes keep using these same hex values
// directly, e.g. bg-[#9D0A0E], and are unaffected by this file).
//
export const THEME = {
  primary: '#9D0A0E',
  primaryHover: '#7d0809',
  secondary: '#B34C4C',
  textMain: '#1F2937',
  textSecondary: '#4B5563',
  neutral: '#F1F3F5',
  border: '#E5E7EB',
  page: '#F8F9FA',
};

// Queue status colors, shared by any screen that renders a
// status badge/dot (e.g. Staff queue history, Admin dashboard).
export const STATUS_COLORS = {
  waiting: { bg: '#F1F3F5', text: '#4B5563', dot: '#4B5563' },
  called: { bg: '#fff4df', text: '#a66a00', dot: '#a66a00' },
  serving: { bg: '#e4f7ee', text: '#18864b', dot: '#18864b' },
  completed: { bg: '#e4f7ee', text: '#18864b', dot: '#18864b' },
  cancelled: { bg: '#fce8e8', text: '#9D0A0E', dot: '#9D0A0E' },
  skipped: { bg: '#fce8e8', text: '#9D0A0E', dot: '#9D0A0E' },
};

export function getStatusColors(status) {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_COLORS[key] || STATUS_COLORS.waiting;
}
