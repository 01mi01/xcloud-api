import { useState, useEffect } from "react";
import * as notificationsApi from "../api/notifications";
type Notification = notificationsApi.Notification & {
  actorName: string;
  actorHandle: string;
  excerpt?: string;
  read: boolean;
  createdAt: string;
};
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import Avatar from "../components/common/Avatar";
import styles from "./Notifications.module.css";

type Tab = "all" | "mentions";

// Format timestamp exactly like TweetCard does
function formatTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Icon for each notification type
function NotifIcon({ type }: { type: string }) {
  if (type === "like") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={styles.iconLike}>
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    );
  }
  if (type === "retweet") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} className={styles.iconRetweet}>
        <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    );
  }
  if (type === "follow") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={styles.iconFollow}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
      </svg>
    );
  }
  if (type === "mention") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} className={styles.iconMention}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    );
  }
  return null;
}

// Human-readable label per notification type
function notifText(type: string, actorName: string, _excerpt?: string): string {
  if (type === "like") return `${actorName} liked your tweet`;
  if (type === "retweet") return `${actorName} retweeted your tweet`;
  if (type === "follow") return `${actorName} followed you`;
  if (type === "mention") return `${actorName} mentioned you`;
  return `${actorName} interacted with you`;
}

function Notifications() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);

useEffect(() => {
  notificationsApi
    .listNotifications()
    .then((res) =>
      setNotifications(
        res.notifications.map((n) => ({
          ...n,
          actorName: n.actorId,
          actorHandle: n.actorId,
          excerpt: n.targetId ?? undefined,
        }))
      )
    )
    .catch(() => setNotifications([]));
}, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const filtered =
    activeTab === "mentions"
      ? notifications.filter((n) => n.type === "mention")
      : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>

        {/* Sticky header */}
        <div className={styles.topBar}>
          <span className={styles.title}>Notifications</span>
          {unreadCount > 0 && (
            <button className={styles.markAllBtn} onClick={markAllRead}>
              Mark all as read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "all" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All
          </button>
          <button
            className={`${styles.tab} ${activeTab === "mentions" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("mentions")}
          >
            Mentions
          </button>
        </div>

        {/* Notification list */}
        {filtered.length === 0 && (
          <p className={styles.empty}>No notifications here.</p>
        )}

        {filtered.map((notif) => (
          <div
            key={notif.id}
            className={`${styles.notifRow} ${!notif.read ? styles.unread : ""}`}
            onClick={() => markRead(notif.id)}
          >
            {/* Unread dot */}
            {!notif.read && <span className={styles.dot} />}

            {/* Type icon */}
            <div className={styles.iconCol}>
              <NotifIcon type={notif.type} />
            </div>

            {/* Content */}
            <div className={styles.content}>
              <Avatar size={36} />
              <div className={styles.text}>
                <span className={styles.actorName}>{notif.actorName}</span>
                <span className={styles.action}>
                  {" "}{notifText(notif.type, "").replace(notif.actorName, "").trim()}
                </span>
                {notif.excerpt && (
                  <p className={styles.excerpt}>{notif.excerpt}</p>
                )}
                <span className={styles.time}>{formatTime(notif.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}

      </main>

      <RightSidebar />
    </div>
  );
}

export default Notifications;