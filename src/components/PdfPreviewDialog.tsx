import { useEffect, useCallback } from "react";
import styles from "./PdfPreviewDialog.module.css";

export type PdfApercu = {
  blobUrl: string;
  fileName: string;
  title: string;
};

type Props = {
  open: boolean;
  /** Données d’aperçu ; si fermé, passer null après avoir révoqué l’URL côté parent. */
  apercu: PdfApercu | null;
  onClose: () => void;
  /** Libellé du bouton qui ferme sans télécharger (ex. retour à la fiche location). */
  fermerLabel?: string;
};

export function PdfPreviewDialog({
  open,
  apercu,
  onClose,
  fermerLabel = "Fermer l’aperçu",
}: Props) {
  const telecharger = useCallback(() => {
    if (!apercu?.blobUrl) return;
    const a = document.createElement("a");
    a.href = apercu.blobUrl;
    a.download = apercu.fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [apercu]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !apercu) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-apercu-titre"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="pdf-apercu-titre" className={styles.title}>
              {apercu.title}
            </h2>
            <div className={styles.fileName}>{apercu.fileName}</div>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={onClose}>
              {fermerLabel}
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={telecharger}
            >
              Télécharger
            </button>
          </div>
        </div>
        <div className={styles.frameWrap}>
          <iframe
            className={styles.frame}
            title={apercu.title}
            src={`${apercu.blobUrl}#toolbar=1`}
          />
        </div>
        <p className={styles.hint}>
          Aperçu du PDF : faites défiler ou utilisez les contrôles du lecteur
          pour parcourir toutes les pages (signatures en fin de document). «
          Télécharger » enregistre le fichier. « {fermerLabel} » ferme
          uniquement cet aperçu et vous ramène à la fiche sans télécharger.
        </p>
      </div>
    </div>
  );
}
