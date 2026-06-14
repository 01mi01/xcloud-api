import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { mockNews, mockTrends } from "../../data/mockData";
import { apiFetch } from "../../api/client";
import type { User } from "../../types";
import Avatar from "../common/Avatar";
import styles from "./RightSidebar.module.css";

function RightSidebar({ hideSearch = false }: { hideSearch?: boolean }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setUsers([]); return; }
    setSearching(true);
    apiFetch<{ users: User[] }>(`/v1/users/search?q=${encodeURIComponent(q)}`)
      .then((res) => setUsers(res.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setSearching(false));
  }, [query]);

  const showDropdown = focused;

  return (
    <aside className={styles.sidebar}>

      {/* Search bar */}
      {!hideSearch && (
        <div className={styles.searchContainer}>
          <div className={styles.searchWrapper}>
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
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim().length >= 1) {
                  setFocused(false);
                  navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                }
              }}
            />
            {query && (
              <button
                className={styles.clearBtn}
                onMouseDown={(e) => { e.preventDefault(); setQuery(""); }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown flotante */}
          {showDropdown && (
            <div className={styles.dropdown}>
              {!query.trim() && (
                <p className={styles.dropdownHint}>Prueba a buscar personas.</p>
              )}
              {query.trim() && searching && (
                <p className={styles.dropdownHint}>Buscando…</p>
              )}
              {query.trim() && !searching && users.length === 0 && (
                <p className={styles.dropdownHint}>Sin resultados para "{query}".</p>
              )}
              {query.trim() && !searching && users.length > 0 && users.slice(0, 5).map((user) => (
                <div
                  key={user.userId}
                  className={styles.dropdownUserRow}
                  onMouseDown={() => { setFocused(false); setQuery(""); navigate(`/profile/${user.handle}`); }}
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

      {/* Today's news */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Today's news</h2>
        {mockNews.map((item, i) => (
          <div key={i} className={styles.newsItem}>
            <span className={styles.newsMeta}>{item.age} · {item.category} · {item.postCount} posts</span>
            <span className={styles.newsTitle}>{item.title}</span>
          </div>
        ))}
      </div>

      {/* Trends */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>What's happening</h2>
        {mockTrends.map((trend, i) => (
          <div key={i} className={styles.trendItem} onClick={() => navigate(`/search?q=${encodeURIComponent(trend.topic)}`)}>
            <span className={styles.trendCategory}>{trend.category}</span>
            <span className={styles.trendTopic}>{trend.topic}</span>
            <span className={styles.trendCount}>{trend.tweetCount} posts</span>
          </div>
        ))}
        <span className={styles.showMore}>Show more</span>
      </div>

    </aside>
  );
}

export default RightSidebar;
