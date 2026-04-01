import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Pour la page de connexion : redirige vers le hub des fonctions si déjà connecté. */
export function RedirectIfAuthed() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/fonctions" replace />;
  }

  return <Outlet />;
}
