import styles from "./Avatar.module.css";

interface Props {
  size?: number;
}

// Generic grey avatar — shown when user has no profile picture
function Avatar({ size = 40 }: Props) {
  return (
    <div className={styles.wrapper} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" className={styles.icon}>
        <circle cx="12" cy="8" r="4" fill="#6e767d" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#6e767d" strokeWidth={2} strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default Avatar;