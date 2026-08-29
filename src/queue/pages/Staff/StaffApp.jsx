import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './DashboardPage.jsx';
import QueueHistoryPage from './QueueHistoryPage.jsx';

export default function StaffApp() {
  return (
    <Routes>
      {/* Base /staff route goes to Dashboard */}
      <Route path="/" element={<DashboardPage />} />
      
      {/* /staff/history goes to History */}
      <Route path="/history" element={<QueueHistoryPage />} />
      
      {/* Catch any invalid /staff/xyz links and send to Dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}