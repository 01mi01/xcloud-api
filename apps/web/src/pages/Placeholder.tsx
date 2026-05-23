import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import styles from "./Home.module.css";

interface Props {
  title: string;
}

// Temporary page shown for routes not yet implemented
function Placeholder({ title }: Props) {
  return (
    <div className={styles.layout}>
      <LeftSidebar />
      <main className={styles.feed}>
        <div className={styles.feedHeader}>
          <span className={styles.tab} style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
            {title}
          </span>
        </div>
        <p className={styles.emptyMsg}>This page is coming soon.</p>
      </main>
      <RightSidebar />
    </div>
  );
}

export default Placeholder;