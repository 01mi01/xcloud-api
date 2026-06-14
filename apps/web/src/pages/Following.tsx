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
      .then((u) =>
        Promise.all([usersApi.getFollowing(u.userId), usersApi.getFollowers(u.userId)]),
      )
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
        {/* Sticky top bar */}
        <div className={styles.topBar}>
          <div className={styles.topBarInfo}>
            <span className={styles.displayName}>{targetHandle ?? ""}</span>
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
          <div
            key={user.userId}
            className={styles.userRow}
            onClick={() => navigate(`/profile/${user.handle}`)}
            style={{ cursor: "pointer" }}
          >
            <div className={styles.avatarCol}>
              <Avatar size={48} src={user.avatarUrl || undefined} />
            </div>
            <div className={styles.userInfo}>
              <span className={styles.name}>{user.displayName}</span>
              <span className={styles.handle}>@{user.handle}</span>
              {user.bio && <p className={styles.bio}>{user.bio}</p>}
            </div>
            {/* Don't show a follow button on your own row. */}
            {user.userId !== identity?.userId && (
              <FollowButton userId={user.userId} initialFollowing={followedSet.has(user.userId)} />
            )}
          </div>
        ))}
      </main>

      <RightSidebar />
    </div>
  );
}

// Real follow/unfollow toggle reflecting the viewer's actual state.
function FollowButton({ userId, initialFollowing }: { userId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  // Re-sync if the resolved status arrives after first render.
  useEffect(() => { setFollowing(initialFollowing); }, [initialFollowing]);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    const was = following;
    setFollowing(!was);
    setBusy(true);
    try {
      if (was) await usersApi.unfollowUser(userId);
      else await usersApi.followUser(userId);
    } catch {
      setFollowing(was);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`${styles.followBtn} ${following ? styles.followingBtn : ""}`}
      onClick={toggle}
      disabled={busy}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

export default Following;
