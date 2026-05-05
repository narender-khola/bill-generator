import React, { useState } from "react";
import "./Login.css";
import { login } from "./auth";

export default function Login({ onAuth }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const ok = await login(username.trim(), password);
    setBusy(false);
    if (ok) onAuth();
    else setError("Invalid username or password");
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <img src={process.env.PUBLIC_URL + "/favicon.svg"} alt="" className="login-logo" />
        <h1 className="login-title">Bill Generator</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <label className="login-field">
          <span>Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button type="submit" className="login-btn" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
