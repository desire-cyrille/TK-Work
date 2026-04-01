import { Navigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import { useBiens } from "../context/BiensContext";
import type { Logement } from "../types/domain";
import { LogementForm } from "./LogementForm";
import styles from "./NouveauLogement.module.css";

function pickFields(l: Logement): Omit<Logement, "id" | "bailleurId"> {
  const { id: _i, bailleurId: _b, ...rest } = l;
  return rest;
}

export function EditionLogement() {
  const { id } = useParams<{ id: string }>();
  const { getLogement } = useBiens();
  const logement = id ? getLogement(id) : undefined;

  if (!id || !logement) {
    return <Navigate to="/biens/logement" replace />;
  }

  return (
    <PageFrame title="Modifier le logement">
      <LogementForm
        key={logement.id}
        editingId={logement.id}
        initialBailleurId={logement.bailleurId}
        initialFields={pickFields(logement)}
        introText={
          <>
            Modifiez les informations du bien. Les champs marqués{" "}
            <span className={styles.req}>*</span> sont obligatoires.
          </>
        }
        submitLabel="Enregistrer les modifications"
      />
    </PageFrame>
  );
}
