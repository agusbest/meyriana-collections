import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import StockHistory from "./pages/StockHistory";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import Listings from "./pages/Listings";
import ImportShopee from "./pages/ImportShopee";
import Expenses from "./pages/Expenses";
import Fees from "./pages/Fees";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Semua halaman setelah login memakai layout yang sama */}
          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Home />} />

            {/* Khusus admin: staf yang membuka alamat ini dialihkan ke Home */}
            <Route
              path="/dashboard"
              element={
                <RequireAdmin>
                  <Dashboard />
                </RequireAdmin>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAdmin>
                  <Users />
                </RequireAdmin>
              }
            />

            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/stock-history" element={<StockHistory />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/listings" element={<Listings />} />
            <Route path="/listings/import" element={<ImportShopee />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/settings/fees" element={<Fees />} />
            <Route path="/expenses" element={<Expenses />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
