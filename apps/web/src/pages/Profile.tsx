import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as usersApi from "../api/users";
import { getTweetsByAuthor, getLikedByUser } from "../api/tweets";
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

  type ProfileTab = "posts" | "replies" | "media" | "likes";
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [user, setUser] = useState<User | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [likedTweets, setLikedTweets] = useState<Tweet[]>([]);
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
      .then(async (u) => {
        setUser(u);
        // Reflect whether the viewer already follows this user.
        if (u.handle !== identity?.handle) {
          const status = await usersApi.getFollowingStatus([u.userId]).catch((): string[] => []);
          setFollowing(status.includes(u.userId));
        } else {
          setFollowing(false);
        }
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
    let cancelled = false;
    setActiveTab("posts");
    setLoadingTweets(true);
    // The user's own tweets (split into Posts/Replies/Media client-side) and the
    // tweets they liked (Likes tab) — fetched together.
    Promise.all([
      getTweetsByAuthor(user.userId).then(({ tweets: raw }) => hydrateTweets(raw, identity?.userId)),
      getLikedByUser(user.userId).then(({ tweets: raw }) => hydrateTweets(raw, identity?.userId)),
    ])
      .then(([authored, liked]) => {
        if (cancelled) return;
        setTweets(authored);
        setLikedTweets(liked);
      })
      .catch(() => { if (!cancelled) { setTweets([]); setLikedTweets([]); } })
      .finally(() => { if (!cancelled) setLoadingTweets(false); });
    return () => { cancelled = true; };
  }, [user, identity?.userId]);

  // Tweets shown for the active tab.
  const visibleTweets =
    activeTab === "posts"   ? tweets.filter((t) => !t.replyToTweetId)
    : activeTab === "replies" ? tweets.filter((t) => t.replyToTweetId)
    : activeTab === "media"   ? tweets.filter((t) => t.mediaUrls.length > 0)
    : likedTweets;

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
    } catch (err) {
      // Si ya sigue (estado desincronizado), corregir el estado local
      if (err instanceof ApiError && err.status === 409) {
        setFollowing(true);
      }
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
              {tweets.length.toLocaleString()} {activeTab === "posts" ? "posts" : "likes"}
            </span>
          </div>
        </div>

        {/* Banner — solid color placeholder (no banner upload yet) */}
        <div className={styles.banner} />

        {/* Avatar row */}
        <div className={styles.avatarRow}>
          <Avatar size={120} src={user.avatarUrl || undefined} />
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
            <span
              className={styles.statLink}
              onClick={() => navigate(`/profile/${user.handle}/following`)}
              style={{ cursor: "pointer" }}
            >
              <strong>{user.followingCount.toLocaleString()}</strong>{" "}
              <span className={styles.statLabel}>Following</span>
            </span>
            <span
              className={styles.statLink}
              onClick={() => navigate(`/profile/${user.handle}/followers`)}
              style={{ cursor: "pointer" }}
            >
              <strong>{user.followersCount.toLocaleString()}</strong>{" "}
              <span className={styles.statLabel}>Followers</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(["posts", "replies", "media", "likes"] as const).map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tweet list (per active tab) */}
        {loadingTweets && <p className={styles.msg}>Loading…</p>}
        {!loadingTweets && visibleTweets.length === 0 && (
          <p className={styles.msg}>
            {activeTab === "posts"   ? "No posts yet."
              : activeTab === "replies" ? "No replies yet."
              : activeTab === "media"   ? "No media yet."
              : "No likes yet."}
          </p>
        )}
        {visibleTweets.map((tweet) => (
          <TweetCard key={tweet.tweetId} tweet={tweet} />
        ))}

        {/* Edit profile modal */}
        {showEditModal && (
          <EditProfileModal
            user={user}
            onClose={() => setShowEditModal(false)}
            onSave={(updated) => {
              setUser((u) => (u ? { ...u, ...updated } : u));
              setShowEditModal(false);
              // Refresh auth so the sidebar (own avatar/name) reflects the change.
              if (isOwnProfile) refresh().catch(() => {});
            }}
          />
        )}
      </main>

      <RightSidebar />
    </div>
  );
}

export default Profile;
