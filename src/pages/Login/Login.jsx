import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API_URL from "../../config/api";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("User");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    // Basic validation
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (role === "Admin" && !password.trim()) {
      setError("Please enter your password");
      return;
    }

    const url = role === "User" ? "/user/login" : "/admin/login";
    const payload = {
      email,
      ...(role === "Admin" && { password }),
    };

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        if (role === "User") {
  localStorage.setItem("userToken", result.token);
  window.open(`/user/${result.data._id}`, "_blank");
} else {
  localStorage.setItem("adminToken", result.token);
  window.open(`/admin/${result.data._id}`, "_blank");
}
// Reset form after opening new tab
setEmail("");
setPassword("");
setError("");
      } else {
        // Show exact server error message
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (e) {
      console.error("Login error:", e);
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Allow Enter key to submit
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900">
      <div className="bg-zinc-800 p-8 rounded-lg shadow-lg w-full max-w-md">

        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          Log In
        </h2>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Email */}
        <input
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          onKeyDown={handleKeyDown}
          className="w-full p-3 mb-4 border rounded-lg bg-zinc-700 text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 border-zinc-600"
        />

        {/* Role selector */}
        <div className="flex items-center text-white justify-around mb-4">
          {["User", "Admin"].map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={(e) => { setRole(e.target.value); setError(""); }}
              />
              {r}
            </label>
          ))}
        </div>

        {/* Password — admin only */}
        {role === "Admin" && (
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={handleKeyDown}
            className="w-full p-3 mb-4 border rounded-lg bg-zinc-700 text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 border-zinc-600"
          />
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700
            transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <div className="mt-4 text-center">
          <Link to="/register" className="text-white text-sm">
            Don&apos;t have an account?{" "}
            <span className="text-blue-400 hover:underline">Register Now</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;