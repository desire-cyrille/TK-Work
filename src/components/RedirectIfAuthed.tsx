import { Navigate, Outlet } from "react-router-dom";
import { AuthBootSplash } from "./AuthBootSplash";
import { useAuth } from "../context/AuthContext";

/** Pour la page de connexion : redirige vers le hub des fonctions si déjà connecté. */
export function RedirectIfAuthed() {
  const { isAuthenticated, authReady } = useAuth();

  if (!authReady) {
    return <AuthBootSplash />;
  }

  if (isAuthenticated) {
    return <Navigate to="/fonctions" replace />;
  }

  return <Outlet />;
}
