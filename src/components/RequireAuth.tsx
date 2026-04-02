import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate to="/connexion" replace state={{ from: location.pathname }} />
    );
  }

  if (
    mustChangePassword &&
    location.pathname !== "/changement-mot-de-passe"
  ) {
    return <Navigate to="/changement-mot-de-passe" replace />;
  }

  if (
    !mustChangePassword &&
    location.pathname === "/changement-mot-de-passe"
  ) {
    return <Navigate to="/fonctions" replace />;
  }

  return <Outlet />;
}
