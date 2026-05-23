import { mockNews, mockTrends, mockUsers } from "../../data/mockData";
import Avatar from "../common/Avatar";
import styles from "./RightSidebar.module.css";

function RightSidebar() {
  return (
    <aside className={styles.sidebar}>

      {/* Search bar */}
      <div className={styles.searchWrapper}>
        <div className={styles.searchIcon}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input className={styles.searchInput} type="text" placeholder="Search" />
      </div>

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
          <div key={i} className={styles.trendItem}>
            <span className={styles.trendCategory}>{trend.category}</span>
            <span className={styles.trendTopic}>{trend.topic}</span>
            <span className={styles.trendCount}>{trend.tweetCount} posts</span>
          </div>
        ))}
        <span className={styles.showMore}>Show more</span>
      </div>

      {/* Who to follow */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Who to follow</h2>
        {mockUsers.slice(0, 3).map((user) => (
          <div key={user.userId} className={styles.followItem}>
            <Avatar size={40} />
            <div className={styles.followInfo}>
              <span className={styles.followName}>{user.displayName}</span>
              <span className={styles.followHandle}>@{user.handle}</span>
            </div>
            <button className={styles.followBtn}>Follow</button>
          </div>
        ))}
        <span className={styles.showMore}>Show more</span>
      </div>

    </aside>
  );
}

export default RightSidebar;