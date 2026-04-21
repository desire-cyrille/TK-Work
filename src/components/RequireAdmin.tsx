import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  const loc = useLocation();
  if (!isAdmin) {
    return <Navigate to="/fonctions" replace state={{ from: loc.pathname }} />;
  }
  return <Outlet />;
}
