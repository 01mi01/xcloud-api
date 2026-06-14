import { useRef, useState } from "react";
import type { User } from "../../types";
import Avatar from "../common/Avatar";
import * as usersApi from "../../api/users";
import styles from "./EditProfileModal.module.css";

interface Props {
  user: User;
  onClose: () => void;
  onSave: (updated: Partial<User>) => void;
}

// ─── S3 upload (descomentar cuando media-service esté activo en AWS) ──────────
// async function uploadToS3(file: File, type: "avatar" | "banner"): Promise<string> {
//   const form = new FormData();
//   form.append("file", file);
//   form.append("type", type);
//   const res = await fetch("/api/v1/media/upload", { method: "POST", body: form });
//   if (!res.ok) throw new Error("Upload failed");
//   const { url } = await res.json();
//   return url as string;
// }
// ─────────────────────────────────────────────────────────────────────────────

function EditProfileModal({ user, onClose, onSave }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview local — se reemplazará con la URL de S3 al subir
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatarUrl ?? "");
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const nameOver = displayName.length > 50;
  const bioOver = bio.length > 160;
  const invalid = nameOver || bioOver || displayName.trim().length === 0;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (invalid || saving) return;
    setSaving(true);
    setError(null);
    try {
      let finalAvatarUrl = user.avatarUrl ?? "";

      // ── Subida a S3 (descomentar en AWS) ────────────────────────────────
      // if (avatarFile) finalAvatarUrl = await uploadToS3(avatarFile, "avatar");
      // if (bannerFile) await uploadToS3(bannerFile, "banner"); // guardar en user también si el modelo lo soporta
      // ────────────────────────────────────────────────────────────────────

      // Por ahora el avatar queda como preview local (no persiste tras recargar)
      void avatarFile;
      void bannerFile;

      await usersApi.updateMe({
        displayName,
        bio: bio || undefined,
        avatarUrl: finalAvatarUrl || undefined,
      });

      onSave({ displayName, bio, avatarUrl: avatarPreview || finalAvatarUrl });
      onClose();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
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
          <button className={styles.saveBtn} onClick={handleSave} disabled={invalid || saving}>
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

        {/* Avatar */}
        <div className={styles.avatarWrapper}>
          {avatarPreview
            ? <img src={avatarPreview} alt="avatar" className={styles.avatarImg} />
            : <Avatar size={80} />
          }
          <button className={styles.avatarOverlay} onClick={() => avatarInputRef.current?.click()} title="Cambiar foto de perfil">
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
