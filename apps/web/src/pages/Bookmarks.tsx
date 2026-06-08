import { useState } from "react";
import { mockTweets } from "../data/mockData";
import type { Tweet } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import TweetCard from "../components/tweet/TweetCard";
import styles from "./Bookmarks.module.css";

function Bookmarks() {
  // Bookmarks are local state only — no backend endpoint exists yet
  // Pre-populated with a few mock tweets so the page looks real
  const [bookmarks, setBookmarks] = useState<Tweet[]>([
    mockTweets[0],
    mockTweets[2],
    mockTweets[4],
    mockTweets[6],
  ]);

  const clearAll = () => setBookmarks([]);

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>

        {/* Sticky top bar */}
        <div className={styles.topBar}>
          <span className={styles.title}>Bookmarks</span>
          {bookmarks.length > 0 && (
            <button className={styles.clearBtn} onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>

        {/* Empty state */}
        {bookmarks.length === 0 && (
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

        {/* Bookmarked tweets */}
        {bookmarks.map((tweet) => (
          <TweetCard key={tweet.tweetId} tweet={tweet} />
        ))}

      </main>

      <RightSidebar />
    </div>
  );
}

export default Bookmarks;