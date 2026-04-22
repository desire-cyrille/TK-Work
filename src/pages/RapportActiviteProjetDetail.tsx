import { Navigate, useParams } from "react-router-dom";

/** Ancienne URL : redirection vers la rédaction du rapport. */
export function RapportActiviteProjetDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id?.trim()) {
    return <Navigate to="/rapport-activite/accueil" replace />;
  }
  return (
    <Navigate to={`/rapport-activite/projet/${encodeURIComponent(id)}/redaction`} replace />
  );
}
