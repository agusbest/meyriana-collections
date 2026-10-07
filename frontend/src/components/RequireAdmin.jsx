import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Bungkus halaman khusus admin. Staf dialihkan ke Home. */
export default function RequireAdmin({ children }) {
  const { ready, isAdmin } = useAuth();

  if (!ready) {
    return <p className="p-6 text-sm text-outline">Memuat...</p>;
  }

  return isAdmin ? children : <Navigate to="/" replace />;
}
