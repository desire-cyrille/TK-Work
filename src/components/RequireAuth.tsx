import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthBootSplash } from "./AuthBootSplash";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  const { isAuthenticated, authReady } = useAuth();
  const loc = useLocation();

  if (!authReady) {
    return <AuthBootSplash />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/connexion"
        replace
        state={{ from: `${loc.pathname}${loc.search}${loc.hash}` }}
      />
    );
  }
  return <Outlet />;
}
