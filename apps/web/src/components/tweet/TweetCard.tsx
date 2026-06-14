import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReplyModal from "./ReplyModal";
import * as tweetsApi from "../../api/tweets";
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface Props {
  tweet: Tweet;
}

function TweetCard({ tweet }: Props) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(tweet.liked);
  const [likesCount, setLikesCount] = useState(tweet.likesCount);
  const [retweeted, setRetweeted] = useState(tweet.retweeted);
  const [retweetCount, setRetweetCount] = useState(tweet.retweetCount);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [repliesCount, setRepliesCount] = useState(tweet.repliesCount);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));
    try {
      if (wasLiked) await tweetsApi.unlikeTweet(tweet.tweetId);
      else await tweetsApi.likeTweet(tweet.tweetId);
    } catch {
      // Revert on failure
      setLiked(wasLiked);
      setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    }
  };

  const handleRetweet = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (retweeted) return; // retweet is not reversible from this UI
    setRetweeted(true);
    setRetweetCount((prev) => prev + 1);
    try {
      await tweetsApi.retweetTweet(tweet.tweetId);
    } catch {
      // revert on failure (e.g. 409 already retweeted handled gracefully)
      setRetweeted(false);
      setRetweetCount((prev) => prev - 1);
    }
  };

  return (
    <article
      className={styles.card}
      onClick={() => navigate(`/tweet/${tweet.tweetId}`)}
    >
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
          <button
            className={`${styles.actionBtn} ${styles.replyBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowReplyModal(true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>{formatCount(repliesCount)}</span>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.retweetBtn} ${retweeted ? styles.retweeted : ""}`}
            onClick={handleRetweet}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            <span>{formatCount(retweetCount)}</span>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.likeBtn} ${liked ? styles.liked : ""}`}
            onClick={handleLike}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <span>{formatCount(likesCount)}</span>
          </button>

          <button className={`${styles.actionBtn} ${styles.bookmarkBtn}`}>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>
        </div>
      </div>
      {/* Reply modal */}
      {showReplyModal && (
        <ReplyModal
          tweet={tweet}
          onClose={() => setShowReplyModal(false)}
          onReply={() => {
            setRepliesCount((prev) => prev + 1);
            setShowReplyModal(false);
          }}
        />
      )}
    </article>
  );
}

export default TweetCard;
