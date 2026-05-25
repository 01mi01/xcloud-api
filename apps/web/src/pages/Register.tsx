import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import styles from "./Login.module.css";

const X_PATH = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await register(handle, email, password);
      navigate("/home", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Unable to create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>

      {/* Left side — register form */}
      <div className={styles.left}>

        <h1 className={styles.title}>Sign up</h1>

        <form className={styles.inputGroup} onSubmit={handleRegister}>

          <div className={styles.inputWrapper}>
            <input
              className={styles.input}
              type="text"
              placeholder=" "
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />
            <label className={styles.inputLabel}>Username</label>
          </div>

          <div className={styles.inputWrapper}>
            <input
              className={styles.input}
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className={styles.inputLabel}>Email</label>
          </div>

          <div className={styles.inputWrapper}>
            <input
              className={styles.input}
              type="password"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label className={styles.inputLabel}>Password</label>
          </div>

          <div className={styles.inputWrapper}>
            <input
              className={styles.input}
              type="password"
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <label className={styles.inputLabel}>Confirm password</label>
          </div>

          {/* Inline error message */}
          {error && <p className={styles.errorText}>{error}</p>}

          <button className={styles.btnPrimary} type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>

        </form>

        <div className={styles.divider}>or</div>

        <p className={styles.registerText}>
          Already have an account?{" "}
          <Link className={styles.registerLink} to="/login">
            Sign in
          </Link>
        </p>

      </div>

      {/* Right side — big X logo */}
      <div className={styles.right}>
        <svg className={styles.rightLogo} viewBox="0 0 24 24">
          <path d={X_PATH} />
        </svg>
      </div>

    </div>
  );
}

export default Register;
