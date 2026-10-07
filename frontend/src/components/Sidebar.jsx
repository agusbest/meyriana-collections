import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const menu = [
  { to: "/", icon: "home", label: "Home" },
  { to: "/dashboard", icon: "dashboard", label: "Dashboard", adminOnly: true },
  {
    key: "master",
    icon: "database",
    label: "Master Data",
    children: [
      { to: "/suppliers", icon: "contacts", label: "Supplier" },
      { to: "/products", icon: "inventory_2", label: "Produk" },
    ],
  },
  {
    key: "transaksi",
    icon: "receipt_long",
    label: "Transaksi",
    children: [
      { to: "/stock-history", icon: "history", label: "Histori Stok" },
      { to: "/purchases", icon: "local_shipping", label: "Pembelian" },
      { to: "/sales", icon: "storefront", label: "Penjualan" },
      { to: "/listings", icon: "sync_alt", label: "Listing" },
    ],
  },
  {
    key: "Keuangan",
    icon: "account_balance_wallet",
    label: "Keuangan",
    children: [
      { to: "/expenses", icon: "receipt_long", label: "Biaya Operasional" },
    ],
  },
  {
    key: "setting",
    icon: "settings",
    label: "Setting",
    children: [
      { to: "/settings/fees", icon: "percent", label: "Fee Marketplace" },
      { to: "/users", icon: "group", label: "Pengguna", adminOnly: true },
    ],
  },
];

// Buang menu khusus admin (adminOnly) untuk staf; grup yang jadi kosong ikut hilang
const menuFor = (isAdmin) =>
  menu
    .filter((item) => isAdmin || !item.adminOnly)
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((c) => isAdmin || !c.adminOnly) }
        : item,
    )
    .filter((item) => !item.children || item.children.length > 0);

const allLinks = menu.flatMap((m) => (m.children ? m.children : [m]));

// Cari link yang cocok dengan path saat ini
const matchLink = (pathname) =>
  allLinks.find((l) =>
    l.to === "/"
      ? pathname === "/"
      : pathname === l.to || pathname.startsWith(l.to + "/"),
  )?.to ?? null;

const isGroupActive = (group, pathname) =>
  group.children.some(
    (c) => pathname === c.to || pathname.startsWith(c.to + "/"),
  );

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const { logout, isAdmin } = useAuth();
  const visibleMenu = menuFor(isAdmin);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  // Satu-satunya item yang berwarna hijau (to untuk link, key untuk header grup)
  const [highlight, setHighlight] = useState(() => matchLink(pathname));

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    menu.forEach((item) => {
      if (item.children) initial[item.key] = isGroupActive(item, pathname);
    });
    return initial;
  });

  // Saat route berubah: sinkronkan highlight & buka grup yang berisi halaman aktif
  // useEffect(() => {
  //   setHighlight(matchLink(pathname));
  //   menu.forEach((item) => {
  //     if (item.children && isGroupActive(item, pathname)) {
  //       setOpenGroups((prev) =>
  //         prev[item.key] ? prev : { ...prev, [item.key]: true },
  //       );
  //     }
  //   });
  // }, [pathname]);
  useEffect(() => {
    setHighlight(matchLink(pathname));

    const activeGroup = menu.find(
      (item) => item.children && isGroupActive(item, pathname),
    );

    if (activeGroup) {
      // Halaman aktif ada di dalam grup: buka grup itu saja
      setOpenGroups((prev) => {
        if (
          prev[activeGroup.key] &&
          Object.values(prev).filter(Boolean).length === 1
        ) {
          return prev; // sudah benar, tidak perlu update
        }
        const next = Object.fromEntries(
          Object.keys(prev).map((k) => [k, false]),
        );
        next[activeGroup.key] = true;
        return next;
      });
    } else {
      // Home / Dashboard: tutup semua grup
      setOpenGroups((prev) =>
        Object.fromEntries(Object.keys(prev).map((k) => [k, false])),
      );
    }
  }, [pathname]);

  // Klik header: toggle buka/tutup + pindahkan warna hijau ke header
  const handleGroupClick = (key) => {
    setOpenGroups((prev) => {
      const next = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
      next[key] = !prev[key];
      return next;
    });
    setHighlight(key);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // Selalu pindah ke Login, apa pun respons server
      setSidebarOpen(false);
      navigate("/login", { replace: true });
    }
  };

  const handleMenuClick = (to) => {
    setHighlight(to);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const activeCls = "bg-primary text-on-primary shadow-sm";
  const idleCls = "text-surface-dim hover:text-on-primary hover:bg-white/10";

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          bg-inverse-surface border-r border-outline-variant
          w-72 fixed left-0 top-0 h-[100dvh]
          flex flex-col justify-between p-4 z-50
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="flex-1 min-h-0 flex flex-col">
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
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-surface-dim hover:text-on-primary p-1"
              aria-label="Tutup menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <nav className="space-y-1.5 flex-1 overflow-y-auto">
            {visibleMenu.map((item) => {
              // ===== Item tunggal =====
              if (!item.children) {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => handleMenuClick(item.to)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      highlight === item.to ? activeCls : idleCls
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              }

              // ===== Grup collapse =====
              const open = !!openGroups[item.key];
              const headerActive = highlight === item.key;
              const hasActiveChild = isGroupActive(item, pathname);

              return (
                <div key={item.key}>
                  <button
                    type="button"
                    onClick={() => handleGroupClick(item.key)}
                    aria-expanded={open}
                    aria-controls={`group-${item.key}`}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      headerActive
                        ? activeCls
                        : hasActiveChild
                          ? "text-on-primary hover:bg-white/10"
                          : idleCls
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span
                      className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${
                        open ? "rotate-180" : ""
                      }`}
                    >
                      expand_more
                    </span>
                  </button>

                  <div
                    id={`group-${item.key}`}
                    className={`grid transition-all duration-300 ease-in-out ${
                      open
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-1 ml-5 pl-3 border-l border-white/10 space-y-1">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            onClick={() => handleMenuClick(child.to)}
                            tabIndex={open ? 0 : -1}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              highlight === child.to ? activeCls : idleCls
                            }`}
                          >
                            <span className="material-symbols-outlined text-[19px]">
                              {child.icon}
                            </span>
                            <span>{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 pt-4 pb-[env(safe-area-inset-bottom)] border-t border-white/10 space-y-1.5">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-error hover:bg-error-container/20 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[19px]">
              logout
            </span>
            <span>{loggingOut ? "Keluar..." : "Logout"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
