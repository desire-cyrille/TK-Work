import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Page connexion : le formulaire reste visible pendant la vérification de session.
 * Redirection vers /fonctions uniquement si le serveur a confirmé la connexion.
 */
export function RedirectIfAuthed() {
  const { isAuthenticated, authReady } = useAuth();

  if (authReady && isAuthenticated) {
    return <Navigate to="/fonctions" replace />;
  }

  return <Outlet />;
}
