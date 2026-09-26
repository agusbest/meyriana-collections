import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menu = [
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { to: '/products', icon: 'inventory_2', label: 'Produk' },
  { to: '/stock-history', icon: 'history', label: 'Histori Stok' },
  { to: '/purchases', icon: 'local_shipping', label: 'Pembelian Supplier' },
  { to: '/sales', icon: 'storefront', label: 'Penjualan Marketplace' },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="bg-inverse-surface border-r border-outline-variant w-64 fixed h-screen flex flex-col justify-between p-4 z-40">
      <div>
        <div className="flex items-center gap-3 px-2 py-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
            OP
          </div>
          <div className="overflow-hidden">
            <span className="font-display font-bold text-inverse-on-surface truncate block">
              OmniProfit Analytics
            </span>
            <p className="text-xs text-surface-dim truncate">Multi-Store Reconciliation</p>
          </div>
        </div>

        <nav className="space-y-1.5">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-surface-dim hover:text-on-primary hover:bg-white/10'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="pt-4 border-t border-white/10 space-y-1.5">
        <NavLink
          to="/settings/fees"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-surface-dim hover:text-on-primary hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-[19px]">settings</span>
          <span>Pengaturan Fee</span>
        </NavLink>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-error hover:bg-error-container/20"
        >
          <span className="material-symbols-outlined text-[19px]">logout</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
