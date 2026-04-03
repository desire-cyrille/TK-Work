import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import styles from "./Layout.module.css";

export function Layout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.mainOutletWrap}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
