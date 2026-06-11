import { useState } from "react";
import type { User } from "../../types";
import Avatar from "../common/Avatar";
import styles from "./EditProfileModal.module.css";

interface Props {
  user: User;
  onClose: () => void;
  onSave: (updated: Partial<User>) => void;
}

function EditProfileModal({ user, onClose, onSave }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);

  const nameOver = displayName.length > 50;
  const bioOver = bio.length > 160;
  const invalid = nameOver || bioOver || displayName.trim().length === 0;

  const handleSave = async () => {
    if (invalid || saving) return;
    setSaving(true);
    // In production this calls PUT /v1/users/me
    // For now we just pass the updated fields up to the parent
    await new Promise((r) => setTimeout(r, 400));
    onSave({ displayName, bio, avatarUrl });
    setSaving(false);
    onClose();
  };

  // Close when clicking the backdrop
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>

        {/* Modal header */}
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className={styles.title}>Edit profile</span>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={invalid || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Banner placeholder */}
        <div className={styles.banner}>
          <button className={styles.mediaOverlay}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        {/* Avatar with camera overlay */}
        <div className={styles.avatarWrapper}>
          <Avatar size={80} />
          <button className={styles.avatarOverlay}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        {/* Form fields */}
        <div className={styles.form}>

          {/* Display name */}
          <div className={`${styles.field} ${nameOver ? styles.fieldError : ""}`}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
            />
            <span className={`${styles.counter} ${nameOver ? styles.counterOver : ""}`}>
              {displayName.length} / 50
            </span>
          </div>

          {/* Bio */}
          <div className={`${styles.field} ${bioOver ? styles.fieldError : ""}`}>
            <label className={styles.label}>Bio</label>
            <textarea
              className={styles.textarea}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={180}
            />
            <span className={`${styles.counter} ${bioOver ? styles.counterOver : ""}`}>
              {bio.length} / 160
            </span>
          </div>

          {/* Avatar URL */}
          <div className={styles.field}>
            <label className={styles.label}>Avatar URL</label>
            <input
              className={styles.input}
              type="url"
              placeholder="https://example.com/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

export default EditProfileModal;