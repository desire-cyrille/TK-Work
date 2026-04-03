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
      <header className={styles.topBar}>
        <div className={styles.topBarLead}>
          <h1 className={styles.topBarTitle}>{title}</h1>
          <div className={styles.topBarPill} aria-hidden="true">
            <span className={styles.topBarPillText}>{title}</span>
          </div>
        </div>
        {actions ? (
          <div className={styles.topBarActions}>{actions}</div>
        ) : null}
      </header>
      <div className={styles.workspace}>{children}</div>
    </>
  );
}
