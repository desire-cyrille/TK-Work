import { Navigate, Outlet } from "react-router-dom";

/** La page connexion reste affichée ; pas de redirection automatique (évite les flashs Chrome). */
export function RedirectIfAuthed() {
  return <Outlet />;
}
