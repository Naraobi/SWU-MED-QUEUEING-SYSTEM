const configuredBase = import.meta.env.VITE_API_URL;
const defaultBase = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://lightsteelblue-mandrill-330485.hostingersite.com';

export const API_BASE_URL = String(configuredBase || defaultBase).replace(/\/+$/, '');
export const API_URL = `${API_BASE_URL}/api`;
