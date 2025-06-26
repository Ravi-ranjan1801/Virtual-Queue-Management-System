import { useState } from "react";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const [isError, setIsError] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("User");
  const [password, setPassword] = useState("");

  const data = {
    email: email,
    ...(role === "Admin" && { password: password }),
  };

  const url = role === "User" ? "/user/login" : "/admin/login";

  const postLogin = async () => {
    try {
      const response = await fetch(`http://localhost:3000${url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        if (role === "User") {
          const userToken = result.token;
          localStorage.setItem("userToken", userToken);
          window.open(`/user/${result.data._id}`);
        }
        if (role === "Admin") {
          const adminToken = result.token;
          localStorage.setItem("adminToken", adminToken);
          window.open(`/admin/${result.data._id}`);
        }
        console.log("Login successful, user ID:", result.data);
        setEmail("");
        setPassword("");
        setIsError(false);
      } else {
        setIsError(true);
      }
    } catch (error) {
      console.log("Error logging in:", error);
      setIsError(true);
    }
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900">
      <div className="bg-zinc-800 p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          Log in
        </h2>
        <input
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setIsError(false);
          }}
          className={`w-full p-2 mb-4 border rounded bg-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isError ? "border-red-500" : "border-gray-600"
          }`}
        />
        <div className="flex items-center text-white justify-around mb-4">
          <label htmlFor="user" className="flex items-center">
            <input
              type="radio"
              id="user"
              name="role"
              value="User"
              checked={role === "User"}
              onChange={(e) => setRole(e.target.value)}
            />
            <p className="ml-1">User</p>
          </label>
          <label htmlFor="admin" className="flex items-center">
            <input
              type="radio"
              id="admin"
              name="role"
              value="Admin"
              checked={role === "Admin"}
              onChange={(e) => setRole(e.target.value)}
            />
            <p className="ml-1">Admin</p>
          </label>
        </div>
        {role === "Admin" && (
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setIsError(false);
            }}
            className={`w-full p-2 mb-4 border rounded bg-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isError ? "border-red-500" : "border-gray-600"
            }`}
          />
        )}
        <button
          onClick={postLogin}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Log In
        </button>
        <div className="mt-4 text-center">
          <Link to="/register" className="text-white">
            Don&apos;t have an account?{" "}
            <span className="text-blue-400 hover:underline">Register Now</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
