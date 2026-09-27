import { useLocation } from 'react-router-dom';
import DashboardPage from './DashboardPage.jsx';
import QueueHistoryPage from './QueueHistoryPage.jsx';
import StaffSettingsPage from './StaffSettingsPage.jsx';
import { StaffPreferencesProvider } from './StaffPreferencesContext.jsx';

const STAFF_TERMINAL_KEY = 'swumed_staff_terminal';

function StaffRoutes() {
  const { pathname } = useLocation();

  if (pathname.endsWith('/settings')) {
    return <StaffSettingsPage />;
  }

  if (pathname.endsWith('/history')) {
    return <QueueHistoryPage />;
  }

  return <DashboardPage />;
}

export default function StaffApp() {
  return (
    <StaffPreferencesProvider>
      <StaffRoutes />
    </StaffPreferencesProvider>
  );
}