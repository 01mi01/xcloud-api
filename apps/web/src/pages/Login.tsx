import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Login.module.css";

const X_PATH = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Fake login — navigate to home with no real auth yet
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/home");
  };

  return (
    <div className={styles.container}>

      {/* Left side — login form */}
      <div className={styles.left}>

        <h1 className={styles.title}>Happening now.</h1>

        <form className={styles.inputGroup} onSubmit={handleLogin}>

          <div className={styles.inputWrapper}>
            <input
              className={styles.input}
              type="text"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className={styles.inputLabel}>Email or username</label>
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

          <button className={styles.btnPrimary} type="submit">
            Sign in
          </button>

        </form>

        <div className={styles.divider}>or</div>

        <p className={styles.registerText}>
          Don't have an account?{" "}
          <Link className={styles.registerLink} to="/register">
            Sign up
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

export default Login;