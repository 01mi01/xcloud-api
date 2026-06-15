import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as usersApi from "../api/users";
import type { User } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import Avatar from "../components/common/Avatar";
import styles from "./Following.module.css";

type Tab = "following" | "followers";

/**
 * Connections page — lists who a user follows / is followed by.
 * Routes: /following (current user) and /profile/:handle/{following,followers}.
 */
function Following() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handle: handleParam } = useParams<{ handle: string }>();
  const { identity } = useAuth();

  const targetHandle = handleParam ?? identity?.handle ?? null;
  const [activeTab, setActiveTab] = useState<Tab>(
    location.pathname.endsWith("/followers") ? "followers" : "following",
  );

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [following, setFollowingList] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetHandle) return;
    let cancelled = false;
    setLoading(true);
    usersApi
      .getUser(targetHandle)
      .then((u) => {
        if (!cancelled) setProfileUser(u);
        return Promise.all([usersApi.getFollowing(u.userId), usersApi.getFollowers(u.userId)]);
      })
      .then(async ([flw, fwr]) => {
        if (cancelled) return;
        setFollowingList(flw);
        setFollowers(fwr);
        // Which of these users does the current viewer already follow?
        const ids = Array.from(new Set([...flw, ...fwr].map((u) => u.userId)));
        const status = await usersApi.getFollowingStatus(ids).catch((): string[] => []);
        if (!cancelled) setFollowedSet(new Set(status));
      })
      .catch(() => { if (!cancelled) { setFollowingList([]); setFollowers([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [targetHandle]);

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
            <span className={styles.displayName}>{profileUser?.displayName ?? targetHandle ?? ""}</span>
            <span className={styles.handle}>{targetHandle ? `@${targetHandle}` : ""}</span>
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
        {loading && <p className={styles.empty}>Loading…</p>}

        {!loading && list.length === 0 && (
          <p className={styles.empty}>
            {activeTab === "following" ? "Not following anyone yet." : "No followers yet."}
          </p>
        )}

        {!loading && list.map((user) => (
          <UserRow
            key={user.userId}
            user={user}
            initialFollowing={followedSet.has(user.userId)}
            onProfile={() => navigate(`/profile/${user.handle}`)}
          />
        ))}
      </main>

      <RightSidebar />
    </div>
  );
}

// Real follow/unfollow toggle reflecting the viewer's actual state.
function UserRow({
  user,
  initialFollowing,
  onProfile,
}: {
  user: User;
  initialFollowing: boolean;
  onProfile: () => void;
}) {
  const { identity } = useAuth();
  const isOwnProfile = identity?.userId === user.userId;
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  // Re-sync if the resolved status arrives after first render.
  useEffect(() => { setIsFollowing(initialFollowing); }, [initialFollowing]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    const was = isFollowing;
    setIsFollowing(!was);
    setLoading(true);
    try {
      if (was) await usersApi.unfollowUser(user.userId);
      else await usersApi.followUser(user.userId);
    } catch {
      // revert on error
      setIsFollowing(was);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.userRow}>
      <div className={styles.avatarCol} onClick={onProfile} style={{ cursor: "pointer" }}>
        <Avatar size={48} src={user.avatarUrl || undefined} />
      </div>
      <div className={styles.userInfo} onClick={onProfile} style={{ cursor: "pointer" }}>
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
