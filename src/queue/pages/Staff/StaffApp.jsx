import { useLocation } from 'react-router-dom';
import DashboardPage from './DashboardPage.jsx';
import QueueHistoryPage from './QueueHistoryPage.jsx';

export default function StaffApp() {
  const { pathname } = useLocation();
  return pathname.endsWith('/history') ? <QueueHistoryPage /> : <DashboardPage />;
}