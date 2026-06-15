import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReplyModal from "./ReplyModal";
import * as tweetsApi from "../../api/tweets";
import { STORAGE_KEY } from "../../pages/Bookmarks";
import { useAuth } from "../../context/AuthContext";
import type { Tweet } from "../../types";
import Avatar from "../common/Avatar";
import styles from "./TweetCard.module.css";

function isBookmarked(tweetId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(tweetId);
  } catch { return false; }
}

function toggleBookmark(tweetId: string, add: boolean): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = add ? [...new Set([...ids, tweetId])] : ids.filter((id) => id !== tweetId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

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
  onDeleted?: (tweetId: string) => void;
  onReplyCreated?: (parentId: string) => void;
}

function TweetCard({ tweet, onDeleted, onReplyCreated }: Props) {
  const navigate = useNavigate();
  const { identity } = useAuth();
  const isOwner = identity?.userId === tweet.author.userId;

  const [liked, setLiked] = useState(tweet.liked);
  const [likesCount, setLikesCount] = useState(tweet.likesCount);
  const [retweeted, setRetweeted] = useState(tweet.retweeted);
  const [retweetCount, setRetweetCount] = useState(tweet.retweetCount);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [repliesCount, setRepliesCount] = useState(tweet.repliesCount);
  const [bookmarked, setBookmarked] = useState(tweet.bookmarked ?? isBookmarked(tweet.tweetId));

  // Menú de tres puntos
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modo edición inline
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(tweet.content);
  const [displayContent, setDisplayContent] = useState(tweet.content);
  const [deleted, setDeleted] = useState(false);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));
    try {
      if (wasLiked) await tweetsApi.unlikeTweet(tweet.tweetId);
      else await tweetsApi.likeTweet(tweet.tweetId);
    } catch {
      setLiked(wasLiked);
      setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    }
  };

  const handleRetweet = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasRetweeted = retweeted;
    // Optimistic update
    setRetweeted(!wasRetweeted);
    setRetweetCount((prev) => (wasRetweeted ? prev - 1 : prev + 1));
    try {
      if (wasRetweeted) await tweetsApi.unretweetTweet(tweet.tweetId);
      else await tweetsApi.retweetTweet(tweet.tweetId);
    } catch (err) {
      // Revert on failure
      console.error("Retweet error:", err);
      setRetweeted(wasRetweeted);
      setRetweetCount((prev) => (wasRetweeted ? prev + 1 : prev - 1));
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
    try {
      await tweetsApi.deleteTweet(tweet.tweetId);
      setDeleted(true);
      onDeleted?.(tweet.tweetId);
    } catch { /* silencioso — el tweet sigue visible si falla */ }
  };

  const handleEditSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO AWS: llamar PUT /v1/tweets/:id cuando el endpoint exista
    // await tweetsApi.updateTweet(tweet.tweetId, { content: editContent });
    setDisplayContent(editContent);
    setEditing(false);
  };

  if (deleted) return null;

  return (
    <article
      className={styles.card}
      onClick={() => !editing && navigate(`/tweet/${tweet.tweetId}`)}
    >
      <div className={styles.avatarCol}>
        <Avatar size={40} src={tweet.author.avatarUrl || undefined} />
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.displayName}>{tweet.author.displayName}</span>
          <span className={styles.handle}>@{tweet.author.handle}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.time}>{formatTime(tweet.createdAt)}</span>

          {/* Menú tres puntos — solo para el autor */}
          {isOwner && (
            <div className={styles.menuWrapper} ref={menuRef}>
              <button
                className={styles.menuTrigger}
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                title="Más opciones"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>

              {menuOpen && (
                <div className={styles.menu}>
                  {tweet.repliesCount === 0 && (
                    <button
                      className={styles.menuItem}
                      onClick={(e) => { e.stopPropagation(); setEditing(true); setMenuOpen(false); }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Editar
                    </button>
                  )}
                  <button
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowDeleteConfirm(true); }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {tweet.replyToAuthorHandle && (
          <p className={styles.replyingTo}>
            Replying to <span className={styles.replyHandle}>@{tweet.replyToAuthorHandle}</span>
          </p>
        )}

        {/* Contenido — normal o modo edición */}
        {editing ? (
          <div className={styles.editBox} onClick={(e) => e.stopPropagation()}>
            <textarea
              className={styles.editTextarea}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={280}
              autoFocus
              rows={3}
            />
            <div className={styles.editActions}>
              <button className={styles.editCancel} onClick={(e) => { e.stopPropagation(); setEditing(false); setEditContent(displayContent); }}>
                Cancelar
              </button>
              <button
                className={styles.editSave}
                onClick={handleEditSave}
                disabled={editContent.trim().length === 0}
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <p className={styles.text}>{displayContent}</p>
        )}

        {tweet.mediaUrls && tweet.mediaUrls.length > 0 && (
          <div
            style={{
              marginTop: 8,
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
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                }}
              />
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${styles.replyBtn}`}
            onClick={(e) => { e.stopPropagation(); setShowReplyModal(true); }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>{formatCount(repliesCount)}</span>
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

          <button
            className={`${styles.actionBtn} ${styles.bookmarkBtn} ${bookmarked ? styles.bookmarked : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              const next = !bookmarked;
              setBookmarked(next);
              toggleBookmark(tweet.tweetId, next);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>
        </div>
      </div>

      {showReplyModal && (
        <ReplyModal
          tweet={tweet}
          onClose={() => setShowReplyModal(false)}
          onReply={() => {
            setRepliesCount((prev) => prev + 1);
            setShowReplyModal(false);
            onReplyCreated?.(tweet.tweetId);
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className={styles.confirmBackdrop} onClick={(e) => e.stopPropagation()}>
          <div className={styles.confirmModal}>
            <h2 className={styles.confirmTitle}>¿Eliminar publicación?</h2>
            <p className={styles.confirmMsg}>
              Esta acción es irreversible y la publicación se eliminará de tu perfil, de la cronología de tus seguidores y de los resultados de búsqueda.
            </p>
            <button className={styles.confirmDeleteBtn} onClick={handleDelete}>
              Eliminar
            </button>
            <button className={styles.confirmCancelBtn} onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default TweetCard;
