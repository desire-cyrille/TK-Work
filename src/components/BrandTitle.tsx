import styles from "./BrandTitle.module.css";

const DEFAULT = "TK Pro Gestion";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo-tk-pro.png`;

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

/** Logo TK (image) + suite du nom, hauteur du logo calée sur le corps du texte. */
export function BrandTitle({ name, variant }: Props) {
  const label = (name?.trim() || DEFAULT).trim() || DEFAULT;
  const m = /^TK(\s+)(.+)$/i.exec(label);
  const rowClass = `${styles.row} ${rowMod[variant]}`;
  const textClass = textMod[variant];

  if (m) {
    const rest = `${m[1]}${m[2]}`;
    return (
      <span className={rowClass}>
        <img src={LOGO_SRC} alt="TK" className={styles.logo} />
        <span className={textClass}>{rest}</span>
      </span>
    );
  }

  return <span className={`${rowClass} ${textClass}`}>{label}</span>;
}
