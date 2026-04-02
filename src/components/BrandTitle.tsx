import styles from "./BrandTitle.module.css";

const DEFAULT = "TK Pro Gestion";

export type BrandTitleVariant = "gate" | "module" | "sidebar";

type Props = {
  name?: string;
  variant: BrandTitleVariant;
};

const rowMod = {
  gate: styles.variantGate,
  module: styles.variantModule,
  sidebar: styles.variantSidebar,
} as const;

const textMod = {
  gate: styles.textGate,
  module: styles.textModule,
  sidebar: styles.textSidebar,
} as const;

/** « TK » en wordmark (dégradé) + suite du nom, même taille de police. */
export function BrandTitle({ name, variant }: Props) {
  const label = (name?.trim() || DEFAULT).trim() || DEFAULT;
  const m = /^TK(\s+)(.+)$/i.exec(label);
  const rowClass = `${styles.row} ${rowMod[variant]}`;
  const textClass = textMod[variant];

  if (m) {
    const rest = `${m[1]}${m[2]}`;
    return (
      <span className={rowClass}>
        <span className={styles.mark}>TK</span>
        <span className={textClass}>{rest}</span>
      </span>
    );
  }

  return <span className={`${rowClass} ${textClass}`}>{label}</span>;
}
