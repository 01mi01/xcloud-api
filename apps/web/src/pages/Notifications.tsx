import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";
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
  if (type === "mention" || type === "reply") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} className={styles.iconMention}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    );
  }
  return null;
}

// Human-readable label per notification type
function notifText(type: string): string {
  if (type === "like") return `liked your tweet`;
  if (type === "retweet") return `retweeted your tweet`;
  if (type === "follow") return `followed you`;
  if (type === "reply") return `replied to your tweet`;
  if (type === "mention") return `mentioned you`;
  return `interacted with you`;
}

function Notifications() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  // Live list shared with the sidebar badge; seeded from REST + WebSocket push.
  const { notifications, unreadCount, actorProfiles, tweetPreviews, markRead, markAllRead } = useNotifications();

  const filtered =
    activeTab === "mentions"
      ? notifications.filter((n) => n.type === "mention")
      : notifications;

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

        {filtered.map((notif) => {
          const actor = actorProfiles[notif.actorId];
          const actorName = actor?.displayName || actor?.handle || notif.actorId;
          const actorHandle = actor?.handle;
          // Show the tweet's content for tweet-related notifications (not the UUID).
          const excerpt = notif.targetId ? tweetPreviews[notif.targetId] : undefined;

          const handleClick = () => {
            markRead(notif.id);
            if (notif.targetId) navigate(`/tweet/${notif.targetId}`);
            else if (actorHandle) navigate(`/profile/${actorHandle}`);
          };

          return (
            <div
              key={notif.id}
              className={`${styles.notifRow} ${!notif.read ? styles.unread : ""}`}
              onClick={handleClick}
            >
              {/* Unread dot */}
              {!notif.read && <span className={styles.dot} />}

              {/* Type icon */}
              <div className={styles.iconCol}>
                <NotifIcon type={notif.type} />
              </div>

              {/* Content */}
              <div className={styles.content}>
                <Avatar size={36} src={actor?.avatarUrl || undefined} />
                <div className={styles.text}>
                  <span className={styles.actorName}>{actorName}</span>
                  {actorHandle && (
                    <span style={{ color: "var(--color-text-secondary)" }}> @{actorHandle}</span>
                  )}
                  <span className={styles.action}> {notifText(notif.type)}</span>
                  {excerpt && (
                    <p className={styles.excerpt}>{excerpt}</p>
                  )}
                  <span className={styles.time}>{formatTime(notif.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}

      </main>

      <RightSidebar />
    </div>
  );
}

export default Notifications;
