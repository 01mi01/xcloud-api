import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { User } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import Avatar from "../components/common/Avatar";
import styles from "./Following.module.css";

type Tab = "following" | "followers";

function Following() {
  const navigate = useNavigate();
  const { identity } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("following");

  const [following, setFollowingList] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);

  useEffect(() => {
    if (!identity?.userId) return;
    // Following and followers endpoints not yet available
    // leave empty — backend team to implement GET /v1/users/:userId/following
    setFollowingList([]);
    setFollowers([]);
  }, [identity?.userId]);

  const list = activeTab === "following" ? following : followers;

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>
        {/* Sticky top bar */}
        <div className={styles.topBar}>
          <div className={styles.topBarInfo}>
            <span className={styles.displayName}>{identity?.handle ?? ""}</span>
            <span className={styles.handle}>
              {identity?.handle ? `@${identity.handle}` : ""}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "following" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("following")}
          >
            Following
          </button>
          <button
            className={`${styles.tab} ${activeTab === "followers" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("followers")}
          >
            Followers
          </button>
        </div>

        {/* User list */}
        {list.length === 0 && (
          <p className={styles.empty}>
            {activeTab === "following"
              ? "You are not following anyone yet."
              : "You have no followers yet."}
          </p>
        )}

        {list.map((user) => (
          <UserRow
            key={user.userId}
            user={user}
            onProfile={() => navigate(`/profile/${user.handle}`)}
          />
        ))}
      </main>

      <RightSidebar />
    </div>
  );
}

// Individual user row with follow/unfollow button
function UserRow({ user, onProfile }: { user: User; onProfile: () => void }) {
  const [following, setFollowing] = useState(true);

  return (
    <div className={styles.userRow}>
      {/* Clicking avatar or name goes to profile */}
      <div className={styles.avatarCol} onClick={onProfile}>
        <Avatar size={48} />
      </div>

      <div className={styles.userInfo} onClick={onProfile}>
        <span className={styles.name}>{user.displayName}</span>
        <span className={styles.handle}>@{user.handle}</span>
        {user.bio && <p className={styles.bio}>{user.bio}</p>}
      </div>

      {/* Follow / unfollow toggle */}
      <button
        className={`${styles.followBtn} ${following ? styles.followingBtn : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setFollowing((prev) => !prev);
        }}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

export default Following;
