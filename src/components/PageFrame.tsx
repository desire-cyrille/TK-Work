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
        <h1 className={styles.topBarTitle}>{title}</h1>
        {actions ? (
          <div className={styles.topBarActions}>{actions}</div>
        ) : null}
      </header>
      <div className={styles.workspace}>{children}</div>
    </>
  );
}
