import { PageFrame } from "../components/PageFrame";
import styles from "./PlaceholderPage.module.css";

type Props = {
  title: string;
  description?: string;
};

export function PlaceholderPage({ title, description }: Props) {
  return (
    <PageFrame title={title}>
      <div className={styles.body}>
        {description ? (
          <p className={styles.text}>{description}</p>
        ) : (
          <p className={styles.text}>
            Cette section sera enrichie avec vos données (listes, formulaires,
            etc.).
          </p>
        )}
      </div>
    </PageFrame>
  );
}
