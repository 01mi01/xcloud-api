import { useRef, useState } from "react";
import type { User } from "../../types";
import * as usersApi from "../../api/users";
import { uploadImage } from "../../api/media";
import { ApiError } from "../../api/client";
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar persists via media-service upload; banner is preview-only for now.
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl ?? "");
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const nameOver = displayName.length > 50;
  const bioOver = bio.length > 160;
  const invalid = nameOver || bioOver || displayName.trim().length === 0;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      // media-service returns a relative URL; make it absolute so it passes the
      // user-service avatarUrl validation (^https?://) and renders as <img>.
      const path = await uploadImage(file);
      setAvatarUrl(path.startsWith("http") ? path : `${window.location.origin}${path}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (invalid || saving || uploading) return;
    setSaving(true);
    setError(null);
    try {
      // Banner preview is local-only for now (no persistence until media-service
      // banner support lands on AWS).
      void bannerFile;

      // Persist via PUT /v1/users/me (only send avatarUrl if set).
      const updated = await usersApi.updateMe({
        displayName,
        bio: bio || undefined,
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      onSave(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
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
          <span className={styles.title}>Edit profile</span>
          <button className={styles.saveBtn} onClick={handleSave} disabled={invalid || saving || uploading}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Banner */}
        <div
          className={styles.banner}
          style={bannerPreview ? { backgroundImage: `url(${bannerPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <button className={styles.mediaOverlay} onClick={() => bannerInputRef.current?.click()} title="Cambiar portada">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={handleBannerChange}
          />
        </div>

        {/* Avatar with camera overlay → uploads a new profile picture */}
        <div className={styles.avatarWrapper}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className={styles.avatarImg} />
            : <Avatar size={80} />
          }
          <button
            className={styles.avatarOverlay}
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploading}
            title="Upload a profile picture"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={handleAvatarChange}
          />
        </div>
        {uploading && <p style={{ textAlign: "center", color: "var(--color-text-secondary)", fontSize: 14, margin: "4px 0 0" }}>Uploading…</p>}
        {error && <p style={{ textAlign: "center", color: "#f4212e", fontSize: 14, margin: "4px 0 0" }}>{error}</p>}

        {/* Formulario */}
        <div className={styles.form}>

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

          {error && <p className={styles.errorMsg}>{error}</p>}

        </div>
      </div>
    </div>
  );
}

export default EditProfileModal;
