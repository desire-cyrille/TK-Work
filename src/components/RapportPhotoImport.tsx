import { useCallback, useState } from "react";
import styles from "./RapportPhotoImport.module.css";

export type RapportPhotoImportProps = {
  inputId: string;
  onPick: (file: File) => void | Promise<void>;
  disabled?: boolean;
  hint?: string;
  sub?: string;
  browseLabel?: string;
  /** Zone plus compacte (ex. ligne « sites »). */
  compact?: boolean;
  /** Data URL ou URL affichée au-dessus de la zone d’import. */
  previewSrc?: string | null;
  previewAlt?: string;
  /** Taille de la vignette : logo (largeur type en-tête), couverture (plus haut), compact (liste sites). */
  previewVariant?: "logo" | "cover" | "compact";
  /** Affiche un lien sous la vignette (ex. retirer l’image). */
  onClearPreview?: () => void;
  clearPreviewLabel?: string;
};

export function RapportPhotoImport({
  inputId,
  onPick,
  disabled,
  hint = "Glissez-déposez une image ici",
  sub = "Fichiers image — max. 2 Mo",
  browseLabel = "Parcourir…",
  compact,
  previewSrc,
  previewAlt = "",
  previewVariant = "logo",
  onClearPreview,
  clearPreviewLabel = "Retirer l’image",
}: RapportPhotoImportProps) {
  const [active, setActive] = useState(false);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      void onPick(file);
    },
    [onPick, disabled],
  );

  const previewClass =
    previewVariant === "cover"
      ? styles.previewFrameCover
      : previewVariant === "compact"
        ? styles.previewFrameCompact
        : styles.previewFrameLogo;

  return (
    <div className={styles.block}>
      {previewSrc?.trim() ? (
        <div className={styles.previewRow}>
          <div className={`${styles.previewFrame} ${previewClass}`}>
            <img src={previewSrc} alt={previewAlt} className={styles.previewImg} />
          </div>
          {onClearPreview ? (
            <button
              type="button"
              className={styles.previewClear}
              disabled={disabled}
              onClick={(ev) => {
                ev.stopPropagation();
                onClearPreview();
              }}
            >
              {clearPreviewLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className={`${styles.dropZone} ${active ? styles.dropZoneActive : ""} ${compact ? styles.compact : ""}`}
        aria-disabled={disabled || undefined}
        onClick={(e) => {
          if (disabled) return;
          if ((e.target as HTMLElement).closest("button")) return;
          document.getElementById(inputId)?.click();
        }}
        onDragEnter={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          setActive(true);
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          const next = e.relatedTarget as Node | null;
          if (!e.currentTarget.contains(next)) setActive(false);
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          setActive(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className={styles.srOnly}
          disabled={disabled}
          onChange={(ev) => {
            handleFile(ev.target.files?.[0]);
            ev.target.value = "";
          }}
        />
        <p className={styles.hint}>{hint}</p>
        <p className={styles.sub}>{sub}</p>
        <button
          type="button"
          className={styles.browse}
          disabled={disabled}
          onClick={(ev) => {
            ev.stopPropagation();
            document.getElementById(inputId)?.click();
          }}
        >
          {browseLabel}
        </button>
      </div>
    </div>
  );
}
