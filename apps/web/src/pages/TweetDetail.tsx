import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as tweetsApi from "../api/tweets";
import { hydrateTweets } from "../api/hydrate";
import { useAuth } from "../context/AuthContext";
import type { Tweet } from "../types";
import { mockCurrentUser } from "../data/mockData";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import TweetCard from "../components/tweet/TweetCard";
import Avatar from "../components/common/Avatar";
import styles from "./TweetDetail.module.css";

const MAX_CHARS = 280;

function formatTimeFull(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function TweetDetail() {
  const { tweetId } = useParams<{ tweetId: string }>();
  const navigate = useNavigate();
  const { identity } = useAuth();

  const [tweet, setTweet] = useState<Tweet | null>(null);
  const [replies, setReplies] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const remaining = MAX_CHARS - replyContent.length;
  const isEmpty = replyContent.trim().length === 0;

  useEffect(() => {
    if (!tweetId) return;
    setLoading(true);
    tweetsApi
      .getTweet(tweetId)
      .then(async (res) => {
        const hydrated = await hydrateTweets([res.tweet], identity?.userId);
        setTweet(hydrated[0] ?? null);
      })
      .catch(() => setTweet(null))
      .finally(() => setLoading(false));
  }, [tweetId, identity?.userId]);

  const handleReply = () => {
    if (!tweet || isEmpty || submitting) return;
    setSubmitting(true);

    // Optimistic reply — in production this calls POST /v1/tweets with replyToTweetId
    const newReply: Tweet = {
      tweetId: `reply-${Date.now()}`,
      content: replyContent,
      author: mockCurrentUser,
      mediaUrls: [],
      likesCount: 0,
      retweetCount: 0,
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      replyToTweetId: tweet.tweetId,
      liked: false,
      retweeted: false,
    };

    setReplies((prev) => [newReply, ...prev]);
    setReplyContent("");
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className={styles.layout}>
        <LeftSidebar />
        <main className={styles.feed}>
          <p className={styles.empty}>Loading…</p>
        </main>
        <RightSidebar />
      </div>
    );
  }

  if (!tweet) {
    return (
      <div className={styles.layout}>
        <LeftSidebar />
        <main className={styles.feed}>
          <p className={styles.empty}>Tweet not found.</p>
        </main>
        <RightSidebar />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <LeftSidebar />

      <main className={styles.feed}>

        {/* Top bar with back arrow */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <span className={styles.topBarTitle}>Post</span>
        </div>

        {/* Main tweet — expanded view */}
        <div className={styles.mainTweet}>

          <div className={styles.authorRow}>
            <Avatar size={48} />
            <div className={styles.authorInfo}>
              <span className={styles.displayName}>{tweet.author.displayName}</span>
              <span className={styles.handle}>@{tweet.author.handle}</span>
            </div>
          </div>

          <p className={styles.content}>{tweet.content}</p>

          <p className={styles.timestamp}>{formatTimeFull(tweet.createdAt)}</p>

          <div className={styles.stats}>
            <span>
              <strong>{formatCount(tweet.retweetCount)}</strong>{" "}
              <span className={styles.statLabel}>Reposts</span>
            </span>
            <span>
              <strong>{formatCount(tweet.likesCount)}</strong>{" "}
              <span className={styles.statLabel}>Likes</span>
            </span>
            <span>
              <strong>{formatCount(tweet.repliesCount)}</strong>{" "}
              <span className={styles.statLabel}>Replies</span>
            </span>
          </div>

          <div className={styles.actions}>
            <button className={`${styles.actionBtn} ${styles.replyBtn}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
            <button className={`${styles.actionBtn} ${styles.retweetBtn}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            </button>
            <button className={`${styles.actionBtn} ${styles.likeBtn}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button className={`${styles.actionBtn} ${styles.bookmarkBtn}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
            </button>
          </div>

        </div>

        {/* Reply composer */}
        <div className={styles.replyComposer}>
          <Avatar size={40} />
          <div className={styles.composerRight}>
            <textarea
              className={styles.textarea}
              placeholder="Post your reply"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={2}
            />
            <div className={styles.composerFooter}>
              {remaining < 20 && (
                <span className={`${styles.charCount} ${remaining < 0 ? styles.charOver : styles.charWarn}`}>
                  {remaining}
                </span>
              )}
              <button
                className={styles.replySubmitBtn}
                onClick={handleReply}
                disabled={isEmpty || remaining < 0 || submitting}
              >
                {submitting ? "Posting…" : "Reply"}
              </button>
            </div>
          </div>
        </div>

        {/* Replies list */}
        <div className={styles.repliesSection}>
          {replies.length === 0 && (
            <p className={styles.empty}>No replies yet. Be the first!</p>
          )}
          {replies.map((reply) => (
            <TweetCard key={reply.tweetId} tweet={reply} />
          ))}
        </div>

      </main>

      <RightSidebar />
    </div>
  );
}

export default TweetDetail;