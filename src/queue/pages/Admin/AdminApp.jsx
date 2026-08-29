import { useState } from 'react';
import AdminSidebar, { AdminHeaderBar } from './AdminSidebar';
import AdminDashboard from './AdminDashboard';
import StaffManagementPage from './StaffManagementPage';

function AdminApp() {
  const [activeItem, setActiveItem] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar activeItem={activeItem} onSelect={setActiveItem} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeaderBar title="Admin / Billing Department" />

        <main className="flex-1 bg-[#eef2f6] p-6">
          {activeItem === 'dashboard' && <AdminDashboard />}
          {activeItem === 'staff' && <StaffManagementPage />}
          {activeItem !== 'dashboard' && activeItem !== 'staff' && <AdminDashboard />}
        </main>
      </div>
    </div>
  );
}

export default AdminApp;