import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const menu = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/settings/fees", icon: "percent", label: "Fee Marketplace" },
  { to: "/suppliers", icon: "contacts", label: "Supplier" },
  { to: "/products", icon: "inventory_2", label: "Produk" },
  { to: "/stock-history", icon: "history", label: "Histori Stok" },
  { to: "/purchases", icon: "local_shipping", label: "Pembelian Supplier" },
  { to: "/sales", icon: "storefront", label: "Penjualan Marketplace" },
];

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const { logout } = useAuth();

  const handleMenuClick = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Overlay untuk HP */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          bg-inverse-surface border-r border-outline-variant
          w-64 fixed left-0 top-0 h-screen
          flex flex-col justify-between p-4 z-50
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div>
          {/* Header Sidebar */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <img
              src="/logo.png"
              alt="SIMPRO"
              className="w-10 h-10 shrink-0 rounded-lg object-cover"
            />

            <div className="overflow-hidden">
              <span className="font-display font-bold text-inverse-on-surface truncate block">
                Smart Monitoring
              </span>
            </div>

            {/* Tombol close di HP */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-surface-dim hover:text-on-primary p-1"
              aria-label="Tutup menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-1.5">
            {menu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={handleMenuClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-surface-dim hover:text-on-primary hover:bg-white/10"
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Menu */}
        <div className="pt-4 border-t border-white/10 space-y-1.5">
          {/* <NavLink
            to="/settings/fees"
            onClick={handleMenuClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-surface-dim hover:text-on-primary hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[19px]">
              settings
            </span>

            <span>Pengaturan Fee</span>
          </NavLink> */}

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-error hover:bg-error-container/20"
          >
            <span className="material-symbols-outlined text-[19px]">
              logout
            </span>

            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
