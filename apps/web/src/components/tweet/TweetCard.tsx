import { useState } from "react";
import type { Tweet } from "../../types";
import Avatar from "../common/Avatar";
import styles from "./TweetCard.module.css";

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function formatTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  tweet: Tweet;
}

function TweetCard({ tweet }: Props) {
  const [liked, setLiked] = useState(tweet.liked);
  const [likesCount, setLikesCount] = useState(tweet.likesCount);
  const [retweeted, setRetweeted] = useState(tweet.retweeted);
  const [retweetCount, setRetweetCount] = useState(tweet.retweetCount);

  const handleLike = () => {
    setLiked((prev) => !prev);
    setLikesCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  const handleRetweet = () => {
    setRetweeted((prev) => !prev);
    setRetweetCount((prev) => (retweeted ? prev - 1 : prev + 1));
  };

  return (
    <article className={styles.card}>

      <div className={styles.avatarCol}>
        <Avatar size={40} />
      </div>

      <div className={styles.content}>

        <div className={styles.header}>
          <span className={styles.displayName}>{tweet.author.displayName}</span>
          <span className={styles.handle}>@{tweet.author.handle}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.time}>{formatTime(tweet.createdAt)}</span>
        </div>

        <p className={styles.text}>{tweet.content}</p>

        <div className={styles.actions}>

          <button className={`${styles.actionBtn} ${styles.replyBtn}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>{formatCount(tweet.repliesCount)}</span>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.retweetBtn} ${retweeted ? styles.retweeted : ""}`}
            onClick={handleRetweet}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            <span>{formatCount(retweetCount)}</span>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.likeBtn} ${liked ? styles.liked : ""}`}
            onClick={handleLike}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <span>{formatCount(likesCount)}</span>
          </button>

          <button className={`${styles.actionBtn} ${styles.viewBtn}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>

        </div>
      </div>

    </article>
  );
}

export default TweetCard;