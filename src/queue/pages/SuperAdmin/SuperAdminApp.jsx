import { useState } from 'react';
import Layout from './Layout';
import Dashboard from './Dashboard';
import UserCrud from './UserCrud';
import RoleManagement from './roleManagement';
import DepartmentManagement from './DepartmentManagement';
import Reports from './Reports';
import AdminQueueManagement from './QueueManagement';
import Settings from './Settings';
import KioskManagement from './KioskManagement';
import PositionManagement from './PositionManagement';

export default function SuperAdminApp() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'dashboard' && <Dashboard />}
      {activePage === 'users' && <UserCrud />}
      {activePage === 'roles' && <RoleManagement />}
      {activePage === 'departments' && <DepartmentManagement />}
      {activePage === 'kiosks' && <KioskManagement />}
      {activePage === 'reports' && <Reports />}
      {activePage === 'queues' && <AdminQueueManagement />}
      {activePage === 'settings' && <Settings />}
      {activePage === 'positions' && <PositionManagement />}
    </Layout>
  );
}
