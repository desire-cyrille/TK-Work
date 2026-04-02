import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/fonctions" replace />;
  }
  return <Outlet />;
}
