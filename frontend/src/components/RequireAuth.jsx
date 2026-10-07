import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Halaman hanya untuk yang sudah login.
 * Token ada tapi data pengguna gagal dimuat (token kedaluwarsa, akun nonaktif) -> ke Login,
 * bukan tetap di aplikasi dengan nama "User".
 */
export default function RequireAuth({ children }) {
  const { user, ready } = useAuth();

  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }

  if (!ready) {
    return <p className="p-6 text-sm text-outline">Memuat...</p>;
  }

  return user ? children : <Navigate to="/login" replace />;
}
