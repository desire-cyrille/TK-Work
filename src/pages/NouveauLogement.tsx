import { PageFrame } from "../components/PageFrame";
import { emptyLogementFields, LogementForm } from "./LogementForm";
import styles from "./NouveauLogement.module.css";

export function NouveauLogement() {
  return (
    <PageFrame title="Nouveau logement">
      <LogementForm
        initialBailleurId=""
        initialFields={emptyLogementFields()}
        introText={
          <>
            Renseignez les informations du bien : identité, adresse, descriptif
            et bailleur. Les champs marqués{" "}
            <span className={styles.req}>*</span> sont obligatoires.
          </>
        }
        submitLabel="Enregistrer le logement"
      />
    </PageFrame>
  );
}
