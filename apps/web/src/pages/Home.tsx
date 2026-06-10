import { useCallback, useEffect, useState } from "react";
import * as feedApi from "../api/feed";
import { hydrateTweets } from "../api/hydrate";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { RawTweet, Tweet } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import TweetComposer from "../components/tweet/TweetComposer";
import TweetCard from "../components/tweet/TweetCard";
import styles from "./Home.module.css";

type Tab = "foryou" | "following";

function Home() {
  const { identity, profile } = useAuth();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("foryou");

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  feedApi
    .getFeed()
    .then(async (res) => {
      const hydrated = await hydrateTweets(res.tweets, identity?.userId);
      if (!cancelled) setTweets(hydrated);
    })
    .catch((err: unknown) => {
      if (cancelled) return;
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load feed.");
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });
  return () => { cancelled = true; };
}, [identity?.userId]);

  const handleTweetCreated = useCallback(
    (raw: RawTweet) => {
      const author = profile ?? {
        userId: identity?.userId ?? raw.authorId,
        handle: identity?.handle ?? "you",
        displayName: identity?.handle ?? "You",
        bio: "",
        avatarUrl: "",
        followersCount: 0,
        followingCount: 0,
        createdAt: new Date().toISOString(),
      };
      const optimistic: Tweet = {
        tweetId: raw.tweetId,
        content: raw.content,
        author,
        mediaUrls: raw.mediaUrls ?? [],
        likesCount: raw.likesCount ?? 0,
        retweetCount: raw.retweetCount ?? 0,
        repliesCount: raw.repliesCount ?? 0,
        createdAt: raw.createdAt,
        replyToTweetId: raw.replyToTweetId ?? null,
        liked: false,
        retweeted: false,
      };
      setTweets((prev) => [optimistic, ...prev]);
    },
    [identity?.handle, identity?.userId, profile],
  );

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>
        {/* Sticky header with tabs */}
        <div className={styles.feedHeader}>
          <button
            className={`${styles.tab} ${activeTab === "foryou" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("foryou")}
          >
            For you
          </button>
          <button
            className={`${styles.tab} ${activeTab === "following" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("following")}
          >
            Following
          </button>
        </div>

        <TweetComposer onTweetCreated={handleTweetCreated} />

        {activeTab === "foryou" && (
          <>
            {loading && <p className={styles.emptyMsg}>Loading…</p>}
            {error && !loading && <p className={styles.emptyMsg}>{error}</p>}
            {!loading && !error && tweets.length === 0 && (
              <p className={styles.emptyMsg}>
                No tweets yet. Be the first to post!
              </p>
            )}
            {!loading &&
              !error &&
              tweets.map((tweet) => (
                <TweetCard key={tweet.tweetId} tweet={tweet} />
              ))}
          </>
        )}

        {activeTab === "following" && (
          <p className={styles.emptyMsg}>
            Follow some accounts to see their tweets here.
          </p>
        )}
      </main>

      <RightSidebar />
    </div>
  );
}

export default Home;
