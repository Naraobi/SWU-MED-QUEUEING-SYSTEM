import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardPage from './DashboardPage.jsx';
import QueueHistoryPage from './QueueHistoryPage.jsx';

const STAFF_TERMINAL_KEY = 'swumed_staff_terminal';

export default function StaffApp() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = window.localStorage.getItem(STAFF_TERMINAL_KEY);

    if (!saved) {
      navigate('/staff/select-terminal', { replace: true });
    }
  }, [navigate]);

  if (pathname.endsWith('/history')) {
    return <QueueHistoryPage />;
  }

  return <DashboardPage />;
}