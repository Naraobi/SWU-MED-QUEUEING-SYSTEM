import { useLocation } from 'react-router-dom';
import DashboardPage from './DashboardPage.jsx';
import QueueHistoryPage from './QueueHistoryPage.jsx';

const STAFF_TERMINAL_KEY = 'swumed_staff_terminal';

export default function StaffApp() {
  const { pathname } = useLocation();

  if (pathname.endsWith('/history')) {
    return <QueueHistoryPage />;
  }

  return <DashboardPage />;
}