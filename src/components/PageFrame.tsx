import type { ReactNode } from "react";
import styles from "./PageFrame.module.css";

type Props = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageFrame({ title, actions, children }: Props) {
  return (
    <>
      <header className={styles.hero}>
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div
          className={`${styles.heroContent} ${actions ? "" : styles.heroContentSolo}`}
        >
          <div className={styles.heroRow}>
            <div className={styles.heroTitleWrap}>
              <h1 className={styles.heroTitle}>{title}</h1>
            </div>
            <div className={styles.heroRedTrack}>
              <div className={styles.heroRedBar}>
                <span className={styles.heroRedBarText}>{title}</span>
              </div>
            </div>
            {actions ? (
              <div className={styles.heroActions}>{actions}</div>
            ) : null}
          </div>
        </div>
      </header>
      <div className={styles.workspace}>{children}</div>
    </>
  );
}
