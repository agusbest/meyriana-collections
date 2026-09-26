import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user } = useAuth();

  return (
    <header className="bg-surface-container-lowest border-b border-surface-container-high shadow-sm sticky top-0 flex justify-between items-center h-16 px-6 z-30">
      <div className="flex items-center gap-3">
        <span className="font-display font-bold text-lg text-on-surface">
          Meyriana Collections
        </span>
        <span className="px-2 py-0.5 rounded-full text-xs bg-primary-container text-on-primary-container font-semibold">
          V1 Pro
        </span>
        <div className="h-4 w-px bg-outline-variant hidden sm:block" />
        {/* <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold">Live Sync API</span>
        </div> */}
      </div>

      <div className="flex items-center gap-4">
        {/* <button className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined text-[22px]">
            notifications
          </span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />
        </button> */}
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-sm">
            {user?.name?.[0] ?? "U"}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold text-on-surface leading-tight">
              {user?.name ?? "User"}
            </p>
            <p className="text-xs text-on-surface-variant leading-tight">
              {user?.email ?? ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
