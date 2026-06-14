import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import * as usersApi from "../api/users";
import { useAuth } from "../context/AuthContext";
import type { User } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import Avatar from "../components/common/Avatar";
import styles from "./Following.module.css";

type Tab = "following" | "followers";

function Following() {
  const navigate = useNavigate();
  const { handle, tab } = useParams<{ handle: string; tab: Tab }>();
  const [activeTab, setActiveTab] = useState<Tab>(tab === "followers" ? "followers" : "following");
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [following, setFollowingList] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Resolver userId a partir del handle
  useEffect(() => {
    if (!handle) return;
    usersApi.getUser(handle).then(setProfileUser).catch(() => {});
  }, [handle]);

  useEffect(() => {
    if (!profileUser) return;
    setLoading(true);
    Promise.all([
      apiFetch<{ users: User[] }>(`/v1/users/${profileUser.userId}/following`)
        .then((r) => setFollowingList(r.users ?? []))
        .catch(() => setFollowingList([])),
      apiFetch<{ users: User[] }>(`/v1/users/${profileUser.userId}/followers`)
        .then((r) => setFollowers(r.users ?? []))
        .catch(() => setFollowers([])),
    ]).finally(() => setLoading(false));
  }, [profileUser]);

  const list = activeTab === "following" ? following : followers;

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className={styles.topBarInfo}>
            <span className={styles.displayName}>{profileUser?.displayName ?? handle}</span>
            <span className={styles.handle}>{handle ? `@${handle}` : ""}</span>
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

        {loading && <p className={styles.empty}>Loading…</p>}

        {!loading && list.length === 0 && (
          <p className={styles.empty}>
            {activeTab === "following" ? "Not following anyone yet." : "No followers yet."}
          </p>
        )}

        {list.map((user) => (
          <UserRow key={user.userId} user={user} onProfile={() => navigate(`/profile/${user.handle}`)} />
        ))}
      </main>

      <RightSidebar />
    </div>
  );
}

function UserRow({ user, onProfile }: { user: User; onProfile: () => void }) {
  const { identity } = useAuth();
  const isOwnProfile = identity?.userId === user.userId;
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ following: boolean }>(`/v1/users/${user.userId}/follow`)
      .then((r) => setIsFollowing(r.following))
      .catch(() => {});
  }, [user.userId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await usersApi.unfollowUser(user.userId);
        setIsFollowing(false);
      } else {
        await usersApi.followUser(user.userId);
        setIsFollowing(true);
      }
    } catch {
      // revert on error
      setIsFollowing((p) => !p);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.userRow}>
      <div className={styles.avatarCol} onClick={onProfile}>
        <Avatar size={48} />
      </div>
      <div className={styles.userInfo} onClick={onProfile}>
        <span className={styles.name}>{user.displayName}</span>
        <span className={styles.handle}>@{user.handle}</span>
        {user.bio && <p className={styles.bio}>{user.bio}</p>}
      </div>
      {!isOwnProfile && (
        <button
          className={`${styles.followBtn} ${isFollowing ? styles.followingBtn : ""}`}
          onClick={handleToggle}
          disabled={loading}
          onMouseEnter={(e) => { if (isFollowing) (e.currentTarget as HTMLButtonElement).textContent = "Unfollow"; }}
          onMouseLeave={(e) => { if (isFollowing) (e.currentTarget as HTMLButtonElement).textContent = "Following"; }}
        >
          {loading ? "…" : isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}

export default Following;
