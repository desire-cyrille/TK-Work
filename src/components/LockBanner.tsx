import styles from "./LockBanner.module.css";

type Props = {
  message: string;
};

export function LockBanner({ message }: Props) {
  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <span className={styles.icon} aria-hidden>
        ●
      </span>
      <span>{message}</span>
    </div>
  );
}
