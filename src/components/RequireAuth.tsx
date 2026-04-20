import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  // Profil unique admin: l'app ne bloque plus l'accès derrière une connexion.
  // On conserve le composant pour ne pas refactorer tout le routing.
  useAuth();
  useLocation();
  return <Outlet />;
}
