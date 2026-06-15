import { useState } from "react";
import type { Tweet, RawTweet } from "../../types";
import * as tweetsApi from "../../api/tweets";
import { ApiError } from "../../api/client";
import Avatar from "../common/Avatar";
import styles from "./ReplyModal.module.css";

const MAX_CHARS = 280;

interface Props {
  tweet: Tweet;
  onClose: () => void;
  onReply: (reply: RawTweet) => void;
}

function ReplyModal({ tweet, onClose, onReply }: Props) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_CHARS - content.length;
  const isEmpty = content.trim().length === 0;
  const isOver = remaining < 0;

  const handleReply = async () => {
    if (isEmpty || isOver || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Persist the reply as a tweet with replyToTweetId.
      const { tweet: reply } = await tweetsApi.createTweet({
        content,
        replyToTweetId: tweet.tweetId,
      });
      onReply(reply);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reply.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Original tweet preview */}
        <div className={styles.originalTweet}>
          <div className={styles.threadLine}>
            <Avatar size={40} />
            <div className={styles.line} />
          </div>
          <div className={styles.originalContent}>
            <div className={styles.originalHeader}>
              <span className={styles.displayName}>{tweet.author.displayName}</span>
              <span className={styles.handle}>@{tweet.author.handle}</span>
            </div>
            <p className={styles.originalText}>{tweet.content}</p>
            <p className={styles.replyingTo}>
              Replying to <span className={styles.replyHandle}>@{tweet.author.handle}</span>
            </p>
          </div>
        </div>

        {/* Reply composer */}
        <div className={styles.replyBody}>
          <Avatar size={40} />
          <div className={styles.right}>
            <textarea
              className={styles.textarea}
              placeholder="Post your reply"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              autoFocus
            />
            {error && <p style={{ color: "#f4212e", fontSize: 14, margin: "4px 0 0" }}>{error}</p>}
            <div className={styles.footer}>
              <div />
              <div className={styles.right2}>
                {remaining < 20 && (
                  <span className={`${styles.charCount} ${isOver ? styles.charOver : styles.charWarn}`}>
                    {remaining}
                  </span>
                )}
                <button
                  className={styles.replyBtn}
                  onClick={handleReply}
                  disabled={isEmpty || isOver || submitting}
                >
                  {submitting ? "Posting…" : "Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ReplyModal;