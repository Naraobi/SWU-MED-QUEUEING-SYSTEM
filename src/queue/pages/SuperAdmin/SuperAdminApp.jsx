import { useState } from 'react';
import Layout from './Layout';
import Dashboard from './Dashboard';
import UserCrud from './UserCrud';
import DepartmentManagement from './DepartmentManagement';
import Reports from './Reports';
import AdminQueueManagement from './QueueManagement';

export default function SuperAdminApp() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'dashboard' && <Dashboard />}
      {activePage === 'users' && <UserCrud />}
      {activePage === 'departments' && <DepartmentManagement />}
      {activePage === 'reports' && <Reports />}
      {activePage === 'queues' && <AdminQueueManagement />}
      {activePage === 'settings' && (
        <p className="text-sm text-slate-500">Settings &mdash; coming soon.</p>
      )}
    </Layout>
  );
}
