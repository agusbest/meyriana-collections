import { useAuth } from "../context/AuthContext";

export default function Topbar({ sidebarOpen, setSidebarOpen }) {
  const { user } = useAuth();

  return (
    <header className="bg-surface-container-lowest border-b border-surface-container-high shadow-sm sticky top-0 flex justify-between items-center h-16 px-4 sm:px-6 z-30">
      {/* Left */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Hamburger - HP & Tablet */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low shrink-0"
          aria-label="Buka menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <span className="font-display font-bold text-base sm:text-lg text-on-surface truncate">
          Meyriana Collection
        </span>

        <span className="px-2 py-0.5 rounded-full text-xs bg-primary-container text-on-primary-container font-semibold shrink-0">
          V1 Pro
        </span>

        <div className="h-4 w-px bg-outline-variant hidden sm:block" />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="h-6 w-px bg-outline-variant hidden sm:block" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-sm shrink-0">
            {user?.name?.[0] ?? "U"}
          </div>

          <div className="text-left hidden sm:block max-w-[180px]">
            <p className="text-sm font-semibold text-on-surface leading-tight truncate">
              {user?.name ?? "User"}
            </p>

            <p className="text-xs text-on-surface-variant leading-tight truncate">
              {user?.email ?? ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
