import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function DashboardLayout() {
  return (
    <div className="bg-background text-on-surface min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-64">
        <Topbar />
        <main className="flex-1 p-8 space-y-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
