import { NavLink, useNavigate } from "react-router-dom";
import { mockCurrentUser } from "../../data/mockData";
import Avatar from "../common/Avatar";
import styles from "./LeftSidebar.module.css";

const X_PATH = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

const HomeIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
    <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h4a1 1 0 001-1v-4h3v4a1 1 0 001 1h4c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696z" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BellIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const UserIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
  </svg>
);

const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);

const UsersIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const navItems = [
  { to: "/home",          label: "Home",          icon: HomeIcon },
  { to: "/search",        label: "Search",        icon: SearchIcon },
  { to: "/notifications", label: "Notifications", icon: BellIcon },
  { to: "/bookmarks",     label: "Bookmarks",     icon: BookmarkIcon },
  { to: "/following",     label: "Following",     icon: UsersIcon },
  { to: "/profile",       label: "Profile",       icon: UserIcon },
];

function LeftSidebar() {
  const navigate = useNavigate();
  const user = mockCurrentUser;

  return (
    <aside className={styles.sidebar}>

      <div className={styles.logo} onClick={() => navigate("/home")}>
        <svg viewBox="0 0 24 24" className={styles.logoSvg}>
          <path d={X_PATH} />
        </svg>
      </div>

      <nav className={styles.nav}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon filled={isActive} />
                <span className={styles.navLabel}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button className={styles.postBtn} onClick={() => {}}>
        <span className={styles.postBtnText}>Post</span>
        <span className={styles.postBtnIcon}>+</span>
      </button>

      <div className={styles.userPill}>
        <Avatar size={40} />
        <div className={styles.userInfo}>
          <span className={styles.displayName}>{user.displayName}</span>
          <span className={styles.handle}>@{user.handle}</span>
        </div>
        <span className={styles.dots}>···</span>
      </div>

    </aside>
  );
}

export default LeftSidebar;