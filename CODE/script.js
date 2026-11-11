import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // Call POST /auth/login
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Login failed");
        }

        localStorage.setItem("zeroout_token", data.access_token);
        localStorage.setItem("zeroout_user", JSON.stringify(data.user));
        navigate("/dashboard");
      } else {
        // Call POST /auth/signup
        const res = await fetch(`${API_BASE_URL}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Signup failed");
        }

        // Automatically log the user in after successful signup
        const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();

        localStorage.setItem("zeroout_token", loginData.access_token);
        localStorage.setItem("zeroout_user", JSON.stringify(loginData.user));
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <header className="auth-navbar">
        <div className="brand-logo">ZeroOut</div>
        <div className="auth-toggle-btns">
          <button
            type="button"
            className={isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={!isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
          >
            Sign Up
          </button>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-card">
          <h1>{isLogin ? "Welcome Back" : "Create Your Account"}</h1>
          <p className="auth-subtitle">
            {isLogin
              ? "Sign in to track shared expenses and simplify group debts."
              : "Join ZeroOut to split bills with friends and hostel mates."}
          </p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Nikhil Jangid"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading
                ? "Please wait..."
                : isLogin
                ? "Sign In →"
                : "Create Account →"}
            </button>
          </form>

          <p className="switch-text">
            {isLogin ? "New here? " : "Already have an account? "}
            <span
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
            >
              {isLogin ? "Create an account" : "Sign in instead"}
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}