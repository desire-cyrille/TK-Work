import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAdmin() {
  // Profil unique admin: tout le monde est admin.
  useAuth();
  return <Outlet />;
}
