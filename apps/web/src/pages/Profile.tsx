import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as usersApi from "../api/users";
import { mockCurrentUser, mockUsers, mockTweets } from "../data/mockData";
import * as tweetsApi from "../api/tweets";
import { hydrateTweets } from "../api/hydrate";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { User, Tweet } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import TweetCard from "../components/tweet/TweetCard";
import Avatar from "../components/common/Avatar";
import styles from "./Profile.module.css";
import EditProfileModal from "../components/profile/EditProfileModal";

function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { identity, refresh } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingTweets, setLoadingTweets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Resolve which handle to show — fall back to logged-in user
  const targetHandle = handle ?? identity?.handle ?? null;
  const isOwnProfile = targetHandle === identity?.handle;

  useEffect(() => {
    if (!targetHandle) return;
    setLoadingUser(true);
    setError(null);
    usersApi
      .getUser(targetHandle)
      .then((u) => {
        setUser(u);
        setFollowing(false);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404)
          setError("This account doesn't exist.");
        else setError("Could not load profile.");
      })
      .finally(() => setLoadingUser(false));
  }, [targetHandle]);

  useEffect(() => {
    if (!user) return;
    setLoadingTweets(true);
    setTweets([]);
    setLoadingTweets(false);
  }, [user]);

  const handleFollow = async () => {
    if (!user) return;
    setFollowLoading(true);
    try {
      if (following) {
        await usersApi.unfollowUser(user.userId);
        setFollowing(false);
        setUser((u) =>
          u ? { ...u, followersCount: Math.max(0, u.followersCount - 1) } : u,
        );
      } else {
        await usersApi.followUser(user.userId);
        setFollowing(true);
        setUser((u) =>
          u ? { ...u, followersCount: u.followersCount + 1 } : u,
        );
      }
      // Refresh auth context if it's our own follow graph
      await refresh();
    } catch {
      // silently ignore — the UI state will be inconsistent but not broken
    } finally {
      setFollowLoading(false);
    }
  };

  if (loadingUser) {
    return (
      <div className={styles.layout}>
        <LeftSidebar />
        <main className={styles.feed}>
          <p className={styles.msg}>Loading…</p>
        </main>
        <RightSidebar />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.layout}>
        <LeftSidebar />
        <main className={styles.feed}>
          <p className={styles.msg}>{error ?? "Profile not found."}</p>
        </main>
        <RightSidebar />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>
        {/* Sticky top bar with back arrow and name */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className={styles.topBarInfo}>
            <span className={styles.topBarName}>{user.displayName}</span>
            <span className={styles.topBarCount}>
              {user.followersCount.toLocaleString()} followers
            </span>
          </div>
        </div>

        {/* Banner — solid color placeholder (no banner upload yet) */}
        <div className={styles.banner} />

        {/* Avatar row */}
        <div className={styles.avatarRow}>
          <Avatar size={80} />
          {isOwnProfile ? (
            <button
              className={styles.editBtn}
              onClick={() => setShowEditModal(true)}
            >
              Edit profile
            </button>
          ) : (
            <button
              className={`${styles.followBtn} ${following ? styles.followingBtn : ""}`}
              onClick={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? "…" : following ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {/* User info */}
        <div className={styles.userInfo}>
          <h1 className={styles.displayName}>{user.displayName}</h1>
          <p className={styles.handle}>@{user.handle}</p>
          {user.bio && <p className={styles.bio}>{user.bio}</p>}
          <div className={styles.joined}>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span>
              Joined{" "}
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <div className={styles.followStats}>
            <span>
              <strong>{user.followingCount.toLocaleString()}</strong>{" "}
              <span className={styles.statLabel}>Following</span>
            </span>
            <span>
              <strong>{user.followersCount.toLocaleString()}</strong>{" "}
              <span className={styles.statLabel}>Followers</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${styles.tabActive}`}>Posts</button>
          <button className={styles.tab}>Replies</button>
          <button className={styles.tab}>Media</button>
          <button className={styles.tab}>Likes</button>
        </div>

        {/* Tweet list */}
        {loadingTweets && <p className={styles.msg}>Loading posts…</p>}
        {!loadingTweets && tweets.length === 0 && (
          <p className={styles.msg}>No posts yet.</p>
        )}
        {tweets.map((tweet) => (
          <TweetCard key={tweet.tweetId} tweet={tweet} />
        ))}

        {/* Edit profile modal */}
        {showEditModal && (
          <EditProfileModal
            user={user}
            onClose={() => setShowEditModal(false)}
            onSave={(updated) => setUser((u) => (u ? { ...u, ...updated } : u))}
          />
        )}
      </main>

      <RightSidebar />
    </div>
  );
}

export default Profile;
