import styles from "./AuthBootSplash.module.css";

export function AuthBootSplash() {
  return (
    <div className={styles.shell} role="status" aria-live="polite">
      <p className={styles.text}>Chargement…</p>
    </div>
  );
}
