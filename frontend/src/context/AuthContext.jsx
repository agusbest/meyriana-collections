import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setReady(true);
      return;
    }
    client
      .get('/me')
      .then((res) => setUser(res.data))
      // Token tidak berlaku lagi (logout di perangkat lain, akun dinonaktifkan, dll.)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setReady(true));
  }, []);

  async function login(email, password) {
    const { data } = await client.post('/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  }

  /**
   * Keluar SEKARANG di sisi aplikasi, lalu beri tahu server di latar belakang.
   * Tidak menunggu server, supaya tombol Logout tidak macet saat server lambat/error.
   */
  async function logout() {
    const token = localStorage.getItem('token');
    localStorage.removeItem('token');
    setUser(null);

    if (token) {
      client
        .post('/logout', null, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 })
        .catch(() => {});
    }
  }

  // admin = semua menu; staff = semua menu kecuali Dashboard & Pengguna
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, setUser, isAdmin, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
