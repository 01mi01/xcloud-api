import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { User, Tweet, RawTweet } from "../types";
import { apiFetch } from "../api/client";
import { hydrateTweets } from "../api/hydrate";
import { useAuth } from "../context/AuthContext";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import TweetCard from "../components/tweet/TweetCard";
import Avatar from "../components/common/Avatar";
import styles from "./Search.module.css";

type Tab = "tweets" | "users";

const TRENDING = [
  { category: "Technology · Trending", topic: "#TypeScript", posts: "24.5K posts" },
  { category: "Sports · Trending", topic: "#Champions", posts: "118K posts" },
  { category: "Today's news", topic: "Trending in Bolivia", posts: "8,240 posts" },
  { category: "Music · Trending", topic: "#NewMusic", posts: "52.1K posts" },
  { category: "Technology · Trending", topic: "#AI", posts: "310K posts" },
];

function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { identity } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [tweetResults, setTweetResults] = useState<Tweet[]>([]);
  const [userResults, setUserResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [submitted, setSubmitted] = useState(initialQ.length > 0);
  const [activeTab, setActiveTab] = useState<Tab>("tweets");

  useEffect(() => {
    if (!initialQ) inputRef.current?.focus();
  }, []);

  const handleCancel = () => {
    setQuery("");
    setFocused(false);
    setSubmitted(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim().length >= 1) {
      setSubmitted(true);
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setTweetResults([]);
      setUserResults([]);
      setSubmitted(false);
      return;
    }
    setSearching(true);

    // Busca usuarios y tweets en paralelo.
    // Para tweets: combina resultados del search-service (full-text en contenido)
    // con tweets de los autores que coinciden con la búsqueda (by-author).
    Promise.all([
      // 1. Usuarios que coinciden con el query
      apiFetch<{ users: User[] }>(`/v1/users/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.users ?? [])
        .catch(() => [] as User[]),

      // 2. Tweets por contenido (search-service / Elasticsearch)
      apiFetch<{ results: RawTweet[] }>(`/v1/search?q=${encodeURIComponent(q)}&type=tweets`)
        .then((res) => res.results ?? [])
        .catch(() => [] as RawTweet[]),
    ]).then(async ([users, contentTweets]) => {
      setUserResults(users);

      // 3. Tweets de los autores encontrados (posts de esas personas)
      const authorTweetsRaw = await Promise.all(
        users.slice(0, 5).map((u) =>
          apiFetch<{ tweets: RawTweet[] }>(`/v1/tweets/by-author/${encodeURIComponent(u.userId)}`)
            .then((r) => r.tweets ?? [])
            .catch(() => [] as RawTweet[])
        )
      );
      const authorTweets = authorTweetsRaw.flat();

      // 4. Combinar y deduplicar por tweetId
      const seen = new Set<string>();
      const combined: RawTweet[] = [];
      for (const t of [...authorTweets, ...contentTweets]) {
        if (!seen.has(t.tweetId)) { seen.add(t.tweetId); combined.push(t); }
      }

      const hydrated = await hydrateTweets(combined, identity?.userId);
      setTweetResults(hydrated);
    }).finally(() => setSearching(false));
  }, [query, identity?.userId]);

  const hasQuery = query.trim().length >= 1;

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>
        {/* Search bar + dropdown flotante */}
        <div className={styles.searchBarContainer}>
          <div className={`${styles.searchBar} ${focused || submitted ? styles.searchBarFocused : ""}`}>
            {(focused || submitted) && (
              <button className={styles.backBtn} onClick={handleCancel}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div className={styles.searchInputWrapper}>
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
                onChange={(e) => { setQuery(e.target.value); setSubmitted(false); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
              />
              {query && (
                <button className={styles.clearBtn} onMouseDown={(e) => { e.preventDefault(); setQuery(""); setSubmitted(false); }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Dropdown flotante — solo mientras está enfocado (escribiendo), no después de Enter */}
          {focused && (
            <div className={styles.searchDropdown}>
              {!hasQuery && (
                <p className={styles.dropdownHint}>Prueba a buscar personas, listas o palabras clave.</p>
              )}

              {hasQuery && searching && (
                <p className={styles.dropdownHint}>Buscando…</p>
              )}

              {hasQuery && !searching && userResults.length === 0 && (
                <p className={styles.dropdownHint}>Sin personas para "{query}".</p>
              )}

              {hasQuery && !searching && userResults.length > 0 && (
                <div className={styles.dropdownSection}>
                  <p className={styles.dropdownSectionTitle}>Personas</p>
                  {userResults.slice(0, 4).map((user) => (
                    <div
                      key={user.userId}
                      className={styles.dropdownUserRow}
                      onMouseDown={() => { setFocused(false); navigate(`/profile/${user.handle}`); }}
                    >
                      <Avatar size={36} />
                      <div className={styles.dropdownUserInfo}>
                        <span className={styles.dropdownUserName}>{user.displayName}</span>
                        <span className={styles.dropdownUserHandle}>@{user.handle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Vista de resultados completa — solo después de Enter */}
        {submitted && hasQuery && (
          <>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${activeTab === "tweets" ? styles.tabActive : ""}`} onClick={() => setActiveTab("tweets")}>Posts</button>
              <button className={`${styles.tab} ${activeTab === "users" ? styles.tabActive : ""}`} onClick={() => setActiveTab("users")}>People</button>
            </div>

            {activeTab === "tweets" && (
              <>
                {searching && <p className={styles.hint}>Buscando…</p>}
                {!searching && tweetResults.length === 0 && <p className={styles.empty}>Sin posts para "{query}".</p>}
                {tweetResults.map((tweet) => (
                  <TweetCard key={tweet.tweetId} tweet={tweet} />
                ))}
              </>
            )}

            {activeTab === "users" && (
              <div className={styles.userList}>
                {searching && <p className={styles.hint}>Buscando…</p>}
                {!searching && userResults.length === 0 && <p className={styles.empty}>Sin personas para "{query}".</p>}
                {userResults.map((user) => (
                  <div key={user.userId} className={styles.userCard} onClick={() => navigate(`/profile/${user.handle}`)}>
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
          </>
        )}

        {/* Trending — visible cuando no hay búsqueda enviada */}
        {!submitted && (
          <div className={styles.trending}>
            <h2 className={styles.trendingTitle}>What's happening</h2>
            {TRENDING.map((item, i) => (
              <div key={i} className={styles.trendItem}>
                <div className={styles.trendMeta}>{item.category}</div>
                <div className={styles.trendTopic}>{item.topic}</div>
                <div className={styles.trendPosts}>{item.posts}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <RightSidebar hideSearch />
    </div>
  );
}

export default Search;
