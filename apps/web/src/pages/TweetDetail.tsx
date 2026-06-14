import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as tweetsApi from "../api/tweets";
import { hydrateTweets } from "../api/hydrate";
import { useAuth } from "../context/AuthContext";
import type { Tweet } from "../types";
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
  const [parent, setParent] = useState<Tweet | null>(null);
  const [replies, setReplies] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Per-viewer action state for the main tweet, seeded from the loaded tweet.
  const [liked, setLiked] = useState(false);
  const [retweeted, setRetweeted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [retweetCount, setRetweetCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = MAX_CHARS - replyContent.length;
  const isEmpty = replyContent.trim().length === 0;

  // Sync action state when a different tweet loads (not on reply-count updates).
  useEffect(() => {
    if (!tweet) return;
    setLiked(tweet.liked);
    setRetweeted(tweet.retweeted);
    setLikesCount(tweet.likesCount);
    setRetweetCount(tweet.retweetCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweet?.tweetId]);

  const handleLike = async () => {
    if (!tweet) return;
    const was = liked;
    setLiked(!was);
    setLikesCount((p) => (was ? p - 1 : p + 1));
    try {
      if (was) await tweetsApi.unlikeTweet(tweet.tweetId);
      else await tweetsApi.likeTweet(tweet.tweetId);
    } catch {
      setLiked(was);
      setLikesCount((p) => (was ? p + 1 : p - 1));
    }
  };

  const handleRetweet = async () => {
    if (!tweet) return;
    const was = retweeted;
    setRetweeted(!was);
    setRetweetCount((p) => (was ? p - 1 : p + 1));
    try {
      if (was) await tweetsApi.unretweetTweet(tweet.tweetId);
      else await tweetsApi.retweetTweet(tweet.tweetId);
    } catch {
      setRetweeted(was);
      setRetweetCount((p) => (was ? p + 1 : p - 1));
    }
  };

  const handleBookmark = () => setBookmarked((b) => !b);
  const focusReply = () => textareaRef.current?.focus();

  useEffect(() => {
    if (!tweetId) return;
    let cancelled = false;
    setLoading(true);
    setParent(null);
    Promise.all([tweetsApi.getTweet(tweetId), tweetsApi.getReplies(tweetId)])
      .then(async ([res, rawReplies]) => {
        const [hydratedTweet, hydratedReplies] = await Promise.all([
          hydrateTweets([res.tweet], identity?.userId),
          hydrateTweets(rawReplies, identity?.userId),
        ]);
        if (cancelled) return;
        const main = hydratedTweet[0] ?? null;
        setTweet(main);
        setReplies(hydratedReplies);

        // If this tweet is a reply, load the parent for context.
        if (main?.replyToTweetId) {
          tweetsApi
            .getTweet(main.replyToTweetId)
            .then((p) => hydrateTweets([p.tweet], identity?.userId))
            .then((ph) => { if (!cancelled) setParent(ph[0] ?? null); })
            .catch(() => { /* parent may be deleted */ });
        }
      })
      .catch(() => { if (!cancelled) setTweet(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tweetId, identity?.userId]);

  const handleReply = async () => {
    if (!tweet || isEmpty || submitting) return;
    setSubmitting(true);
    try {
      // Persist the reply, then show the real hydrated tweet at the top.
      const { tweet: raw } = await tweetsApi.createTweet({
        content: replyContent,
        replyToTweetId: tweet.tweetId,
      });
      const [hydrated] = await hydrateTweets([raw], identity?.userId);
      setReplies((prev) => [hydrated, ...prev]);
      setTweet((t) => (t ? { ...t, repliesCount: t.repliesCount + 1 } : t));
      setReplyContent("");
    } catch {
      /* surfaced minimally; keep the composer content for retry */
    } finally {
      setSubmitting(false);
    }
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

        {/* Parent tweet context — shown when viewing a reply */}
        {parent && (
          <div
            onClick={() => navigate(`/tweet/${parent.tweetId}`)}
            style={{ padding: "12px 16px 4px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Avatar size={24} src={parent.author.avatarUrl || undefined} />
              <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{parent.author.displayName}</span>
              <span style={{ color: "var(--color-text-secondary)" }}>@{parent.author.handle}</span>
            </div>
            <p style={{ margin: "4px 0 0 32px", color: "var(--color-text-primary)" }}>{parent.content}</p>
            <div style={{ margin: "8px 0 0 11px", width: 2, height: 16, background: "var(--color-border)" }} />
          </div>
        )}

        {/* Main tweet — expanded view */}
        <div className={styles.mainTweet}>

          <div className={styles.authorRow}>
            <Avatar size={48} src={tweet.author.avatarUrl || undefined} />
            <div className={styles.authorInfo}>
              <span className={styles.displayName}>{tweet.author.displayName}</span>
              <span className={styles.handle}>@{tweet.author.handle}</span>
            </div>
          </div>

          {parent && (
            <p style={{ margin: "4px 0 0", color: "var(--color-text-secondary)", fontSize: 14 }}>
              Replying to{" "}
              <span style={{ color: "var(--color-accent)" }}>@{parent.author.handle}</span>
            </p>
          )}

          <p className={styles.content}>{tweet.content}</p>

          {tweet.mediaUrls && tweet.mediaUrls.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 4,
                gridTemplateColumns: tweet.mediaUrls.length > 1 ? "1fr 1fr" : "1fr",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {tweet.mediaUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  style={{
                    width: "100%",
                    maxHeight: 400,
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                  }}
                />
              ))}
            </div>
          )}

          <p className={styles.timestamp}>{formatTimeFull(tweet.createdAt)}</p>

          <div className={styles.stats}>
            <span>
              <strong>{formatCount(retweetCount)}</strong>{" "}
              <span className={styles.statLabel}>Reposts</span>
            </span>
            <span>
              <strong>{formatCount(likesCount)}</strong>{" "}
              <span className={styles.statLabel}>Likes</span>
            </span>
            <span>
              <strong>{formatCount(tweet.repliesCount)}</strong>{" "}
              <span className={styles.statLabel}>Replies</span>
            </span>
          </div>

          <div className={styles.actions}>
            <button className={`${styles.actionBtn} ${styles.replyBtn}`} onClick={focusReply} aria-label="Reply">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
            <button
              className={`${styles.actionBtn} ${styles.retweetBtn} ${retweeted ? styles.retweeted : ""}`}
              onClick={handleRetweet}
              aria-label="Repost"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            </button>
            <button
              className={`${styles.actionBtn} ${styles.likeBtn} ${liked ? styles.liked : ""}`}
              onClick={handleLike}
              aria-label="Like"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button
              className={`${styles.actionBtn} ${styles.bookmarkBtn}`}
              onClick={handleBookmark}
              aria-label="Bookmark"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75}>
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
              ref={textareaRef}
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