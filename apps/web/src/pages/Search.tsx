import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Tweet, User } from "../types";
import { searchTweets as apiSearchTweets, searchUsers as apiSearchUsers } from "../api/search";
import { hydrateTweets } from "../api/hydrate";
import LeftSidebar from "../components/layout/LeftSidebar";
import TweetCard from "../components/tweet/TweetCard";
import Avatar from "../components/common/Avatar";
import styles from "./Search.module.css";

type Tab = "tweets" | "users";

function Search() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("tweets");
  const [tweetResults, setTweetResults] = useState<Tweet[]>([]);
  const [userResults, setUserResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-focus the search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced live search against search-service (tweets + users) whenever the
  // query changes. Minimum 2 chars (the service rejects shorter queries).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setTweetResults([]);
      setUserResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [rawTweets, users] = await Promise.all([
          apiSearchTweets(q),
          apiSearchUsers(q),
        ]);
        const tweets = await hydrateTweets(rawTweets);
        if (!cancelled) {
          setTweetResults(tweets);
          setUserResults(users);
        }
      } catch {
        if (!cancelled) {
          setTweetResults([]);
          setUserResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const hasQuery = query.trim().length >= 2;
  const noTweetResults = hasQuery && !loading && tweetResults.length === 0;
  const noUserResults = hasQuery && !loading && userResults.length === 0;

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>

        {/* Search input bar */}
        <div className={styles.searchBar}>
          <div className={styles.searchIcon}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery("")}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs — only shown when there is a query */}
        {hasQuery && (
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "tweets" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("tweets")}
            >
              Tweets
            </button>
            <button
              className={`${styles.tab} ${activeTab === "users" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("users")}
            >
              People
            </button>
          </div>
        )}

        {/* Empty state — no query yet */}
        {!hasQuery && (
          <p className={styles.hint}>Try searching for a keyword, hashtag, or person.</p>
        )}

        {/* Loading */}
        {hasQuery && loading && (
          <p className={styles.hint}>Searching…</p>
        )}

        {/* Tweet results */}
        {hasQuery && activeTab === "tweets" && (
          <>
            {noTweetResults && (
              <p className={styles.empty}>No tweets found for "{query}".</p>
            )}
            {tweetResults.map((tweet) => (
              <TweetCard key={tweet.tweetId} tweet={tweet} />
            ))}
          </>
        )}

        {/* User results */}
        {hasQuery && activeTab === "users" && (
          <div className={styles.userList}>
            {noUserResults && (
              <p className={styles.empty}>No people found for "{query}".</p>
            )}
            {userResults.map((user) => (
              <div
                key={user.userId}
                className={styles.userCard}
                onClick={() => navigate(`/profile/${user.handle}`)}
              >
                <Avatar size={48} />
                <div className={styles.userInfo}>
                  <span className={styles.displayName}>{user.displayName}</span>
                  <span className={styles.handle}>@{user.handle}</span>
                  {user.bio && <p className={styles.bio}>{user.bio}</p>}
                </div>
                <div className={styles.followCount}>
                  <span>{user.followersCount.toLocaleString()}</span>
                  <span className={styles.followLabel}>followers</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* No right sidebar on search — matches X behavior */}
    </div>
  );
}

export default Search;
