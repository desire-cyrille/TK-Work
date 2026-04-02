import logoSrc from "../assets/logo-tk-pro.png?url";
import styles from "./BrandTitle.module.css";

const DEFAULT = "TK Pro Gestion";

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

/** Monogramme TK (asset bitmap), taille adaptée au bandeau / barre latérale. */
export function BrandTitle({ name, variant }: Props) {
  const label = (name?.trim() || DEFAULT).trim() || DEFAULT;
  return (
    <span className={styles.row}>
      <span className={styles.logoPad}>
        <img
          src={logoSrc}
          alt={label}
          className={`${styles.logo} ${logoMod[variant]}`}
        />
      </span>
    </span>
  );
}
