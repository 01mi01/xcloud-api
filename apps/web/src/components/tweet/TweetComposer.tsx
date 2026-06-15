import { useState, useRef } from "react";
import * as tweetsApi from "../../api/tweets";
import { uploadImage } from "../../api/media";
import { ApiError } from "../../api/client";
import type { RawTweet } from "../../types";
import Avatar from "../common/Avatar";
import styles from "./TweetComposer.module.css";

const MAX_CHARS = 280;

// Common emojis for the picker
const EMOJIS = ["😀","😂","😍","🔥","👍","❤️","🎉","😎","🤔","😢","🚀","✨","💯","🙌","😅","👀","💀","🥹","😭","🫡"];

interface Props {
  onTweetCreated?: (tweet: RawTweet) => void;
}

function TweetComposer({ onTweetCreated }: Props) {
  const [content, setContent] = useState("");
  // Holds the uploaded media URLs (returned by media-service), sent as mediaUrls.
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_CHARS - content.length;
  const isOverLimit = remaining < 0;
  const isEmpty = content.trim().length === 0 && images.length === 0;

  const handlePost = async () => {
    if (isEmpty || isOverLimit || submitting || uploading) return;
    setSubmitting(true);
    setError(null);
    try {
      const { tweet } = await tweetsApi.createTweet({
        content,
        mediaUrls: images.length ? images : undefined,
      });
      onTweetCreated?.(tweet);
      setContent("");
      setImages([]);
      setShowEmoji(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to post.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmoji(false);
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadImage(file);
        setImages((prev) => [...prev, url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.composer}>

      <Avatar size={40} />

      <div className={styles.right}>

        <textarea
          className={`${styles.textarea} ${focused || content.length > 0 ? styles.textareaExpanded : ""}`}
          placeholder="What is happening?!"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { if (!content && images.length === 0) setFocused(false); }}
          rows={3}
        />

        {/* Image previews */}
        {images.length > 0 && (
          <div className={styles.imagePreviews}>
            {images.map((src, i) => (
              <div key={i} className={styles.imageWrapper}>
                <img src={src} className={styles.imagePreview} alt="attachment" />
                <button className={styles.removeImage} onClick={() => removeImage(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

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

        <div className={`${styles.divider} ${focused || content.length > 0 || images.length > 0 ? styles.dividerActive : ""}`} />

        <div className={styles.footer}>
            <div className={styles.tools}>
              <button className={styles.toolBtn} onClick={() => fileRef.current?.click()}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImage} />
              <button className={styles.toolBtn} onClick={() => setShowEmoji((prev) => !prev)}>
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
                <span className={`${styles.charCount} ${remaining < 0 ? styles.charOver : styles.charWarn}`}>
                  {remaining}
                </span>
              )}
              <button className={styles.postBtn} onClick={handlePost} disabled={isEmpty || isOverLimit || submitting || uploading}>
                {uploading ? "Uploading…" : submitting ? "Posting…" : "Post"}
              </button>
            </div>
        </div>

        {error && <p style={{ color: "#f4212e", fontSize: 14, marginTop: 8 }}>{error}</p>}

      </div>
    </div>
  );
}

export default TweetComposer;
