import styles from "./BrandTitle.module.css";

const DEFAULT = "TK Pro Gestion";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo-tk-pro.png`;

export type BrandTitleVariant = "gate" | "module" | "sidebar";

type Props = {
  name?: string;
  variant: BrandTitleVariant;
};

const logoMod = {
  gate: styles.logoGate,
  module: styles.logoModule,
  sidebar: styles.logoSidebar,
} as const;

/** Logo seul (lisible, taille adaptée au bandeau / barre latérale). */
export function BrandTitle({ name, variant }: Props) {
  const label = (name?.trim() || DEFAULT).trim() || DEFAULT;
  return (
    <span className={styles.row}>
      <img
        src={LOGO_SRC}
        alt={label}
        className={`${styles.logo} ${logoMod[variant]}`}
      />
    </span>
  );
}
