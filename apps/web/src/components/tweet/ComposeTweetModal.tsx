import { useState } from "react";
import type { RawTweet } from "../../types";
import Avatar from "../common/Avatar";
import styles from "./ComposeTweetModal.module.css";

const MAX_CHARS = 280;

const EMOJIS = ["😀","😂","😍","🔥","👍","❤️","🎉","😎","🤔","😢","🚀","✨","💯","🙌","😅","👀","💀","🥹","😭","🫡"];

interface Props {
  onClose: () => void;
  onTweetCreated: (tweet: RawTweet) => void;
}

function ComposeTweetModal({ onClose, onTweetCreated }: Props) {
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const remaining = MAX_CHARS - content.length;
  const isEmpty = content.trim().length === 0;
  const isOver = remaining < 0;

  const handlePost = async () => {
    if (isEmpty || isOver || submitting) return;
    setSubmitting(true);

    // Optimistic tweet — in production this calls POST /v1/tweets
    await new Promise((r) => setTimeout(r, 300));

    const newTweet: RawTweet = {
      tweetId: `mock-${Date.now()}`,
      content,
      authorId: "1",
      mediaUrls: [],
      likesCount: 0,
      retweetCount: 0,
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      replyToTweetId: null,
    };

    onTweetCreated(newTweet);
    setSubmitting(false);
    onClose();
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmoji(false);
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Composer body */}
        <div className={styles.body}>
          <Avatar size={40} />
          <div className={styles.right}>
            <textarea
              className={styles.textarea}
              placeholder="What is happening?!"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              autoFocus
            />

            {/* Emoji picker */}
            {showEmoji && (
              <div className={styles.emojiPicker}>
                {EMOJIS.map((emoji) => (
                  <button key={emoji} className={styles.emojiBtn} onClick={() => handleEmoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Footer toolbar */}
            <div className={styles.footer}>
              <div className={styles.tools}>
                <button className={styles.toolBtn} onClick={() => setShowEmoji((p) => !p)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 13s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth={3} strokeLinecap="round" />
                    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth={3} strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className={styles.right2}>
                {remaining < 20 && (
                  <span className={`${styles.charCount} ${isOver ? styles.charOver : styles.charWarn}`}>
                    {remaining}
                  </span>
                )}
                <button
                  className={styles.postBtn}
                  onClick={handlePost}
                  disabled={isEmpty || isOver || submitting}
                >
                  {submitting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default ComposeTweetModal;