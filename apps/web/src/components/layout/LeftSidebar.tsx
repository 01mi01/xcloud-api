import { useState, useEffect, useRef } from "react";
import ComposeTweetModal from "../tweet/ComposeTweetModal";
import type { RawTweet } from "../../types";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationsContext";
import Avatar from "../common/Avatar";
import styles from "./LeftSidebar.module.css";

const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

const HomeIcon = ({ filled }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
  >
    <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h4a1 1 0 001-1v-4h3v4a1 1 0 001 1h4c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696z" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BellIcon = ({ filled }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
  >
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const UserIcon = ({ filled }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
  >
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
  </svg>
);

const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);

const UsersIcon = ({ filled }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
  >
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const navItems = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/search", label: "Search", icon: SearchIcon },
  { to: "/notifications", label: "Notifications", icon: BellIcon },
  { to: "/bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { to: "/following", label: "Following", icon: UsersIcon },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

// Live unread badge — accent pill with a ring in the page bg so it lifts off the bell.
const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -5,
  left: 13,
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  borderRadius: 999,
  background: "var(--color-accent)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  border: "2px solid var(--color-bg-primary)",
  boxSizing: "content-box",
};

function LeftSidebar() {
  const navigate = useNavigate();
  const { identity, profile, logout } = useAuth();
  const { unreadCount } = useNotifications();

  // Replay the pulse only when the count goes UP (a new notification arrived),
  // not on initial load or when marking read. Bumping the key remounts the
  // badge span so the CSS animation restarts.
  const prevUnread = useRef(unreadCount);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (unreadCount > prevUnread.current) setPulseKey((k) => k + 1);
    prevUnread.current = unreadCount;
  }, [unreadCount]);
  const displayName =
    profile?.displayName ?? identity?.handle ?? identity?.email ?? "You";
  const handle = profile?.handle ?? identity?.handle ?? "";
  const [showCompose, setShowCompose] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

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
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <Icon filled={isActive} />
                  {to === "/notifications" && unreadCount > 0 && (
                    <span key={pulseKey} className={styles.badgePulse} style={badgeStyle}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className={styles.navLabel}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button className={styles.postBtn} onClick={() => setShowCompose(true)}>
        <span className={styles.postBtnText}>Post</span>
        <span className={styles.postBtnIcon}>+</span>
      </button>

      <div className={styles.userPill} onClick={() => setShowMenu((p) => !p)}>
        <Avatar size={40} src={profile?.avatarUrl || undefined} />
        <div className={styles.userInfo}>
          <span className={styles.displayName}>{displayName}</span>
          <span className={styles.handle}>{handle ? `@${handle}` : ""}</span>
        </div>
        <span className={styles.dots}>···</span>
      </div>
      {/* Compose tweet modal */}
      {showCompose && (
        <ComposeTweetModal
          onClose={() => setShowCompose(false)}
          onTweetCreated={(_tweet: RawTweet) => setShowCompose(false)}
        />
      )}

      {showMenu && (
        <div className={styles.pillMenu}>
          <button
            className={styles.pillMenuItem}
            onClick={() => {
              navigate("/profile");
              setShowMenu(false);
            }}
          >
            View profile
          </button>
          <button className={styles.pillMenuItem} onClick={handleLogout}>
            Log out @{handle}
          </button>
        </div>
      )}
    </aside>
  );
}

export default LeftSidebar;
