import { useEffect, useState } from "react";
import * as feedApi from "../api/feed";
import { hydrateTweets } from "../api/hydrate";
import { useAuth } from "../context/AuthContext";
import type { Tweet } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import TweetCard from "../components/tweet/TweetCard";
import styles from "./Bookmarks.module.css";

const STORAGE_KEY = "xcloud_bookmarks";

function loadBookmarkedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function Bookmarks() {
  const { identity } = useAuth();
  const [bookmarks, setBookmarks] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ids = loadBookmarkedIds();
    if (ids.size === 0) {
      setLoading(false);
      return;
    }
    feedApi
      .getFeed({ limit: 50 })
      .then(async (res) => {
        const matching = res.tweets.filter((t) => ids.has(t.tweetId));
        const hydrated = await hydrateTweets(matching, identity?.userId);
        if (!cancelled) setBookmarks(hydrated);
      })
      .catch(() => {
        if (!cancelled) setBookmarks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [identity?.userId]);

  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setBookmarks([]);
  };

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>
        <div className={styles.topBar}>
          <span className={styles.title}>Bookmarks</span>
          {bookmarks.length > 0 && (
            <button className={styles.clearBtn} onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>

        {loading && <p style={{ padding: "1rem", color: "var(--text-muted)" }}>Loading…</p>}

        {!loading && bookmarks.length === 0 && (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} className={styles.emptyIcon}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            <h2 className={styles.emptyTitle}>Save posts for later</h2>
            <p className={styles.emptyMsg}>
              Bookmark posts to easily find them again in the future.
            </p>
          </div>
        )}

        {bookmarks.map((tweet) => (
          <TweetCard key={tweet.tweetId} tweet={tweet} />
        ))}
      </main>

      <RightSidebar />
    </div>
  );
}

export { loadBookmarkedIds, STORAGE_KEY };
export default Bookmarks;
