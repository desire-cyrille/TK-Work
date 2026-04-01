import { Navigate, useParams } from "react-router-dom";

export function LegacyLogementModifierRedirect() {
  const { id } = useParams();
  return <Navigate to={`/biens/logement/${id}/modifier`} replace />;
}

export function LegacyLocataireModifierRedirect() {
  const { id } = useParams();
  return <Navigate to={`/biens/locataire/${id}/modifier`} replace />;
}
