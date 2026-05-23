import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Mail, Phone, Clock, LogOut, Hash, AlertCircle, CheckCircle, SkipForward, Loader } from "lucide-react";
import io from "socket.io-client";

const API_URL = "http://localhost:5000";

// ─── Status config — one place to update colors/labels ────────────────────
// LLD: Open/Closed — add new status here, nothing else changes
const STATUS_CONFIG = {
  waiting:   { label: "Waiting",    color: "text-yellow-400",  bg: "bg-yellow-400/10", icon: Clock },
  called:    { label: "You're Next!", color: "text-blue-400",  bg: "bg-blue-400/10",   icon: AlertCircle },
  inService: { label: "In Service", color: "text-green-400",   bg: "bg-green-400/10",  icon: CheckCircle },
  skipped:   { label: "Skipped",    color: "text-red-400",     bg: "bg-red-400/10",    icon: SkipForward },
  completed: { label: "Completed",  color: "text-emerald-400", bg: "bg-emerald-400/10",icon: CheckCircle },
  expired:   { label: "Expired",    color: "text-gray-400",    bg: "bg-gray-400/10",   icon: AlertCircle },
};

const QUEUE_STATUS_CONFIG = {
  notStarted: { label: "Queue Not Started Yet", color: "text-gray-400",   dot: "bg-gray-500" },
  active:     { label: "Queue Active",           color: "text-green-400",  dot: "bg-green-500" },
  paused:     { label: "Queue Paused",           color: "text-yellow-400", dot: "bg-yellow-500" },
};

const FormatTime = (seconds) => {
  if (!seconds || seconds <= 0) return "0h 0m 0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
};

const UserPage = () => {
  const { user_id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [queueStatus, setQueueStatus] = useState("notStarted");
  const [pauseReason, setPauseReason] = useState("");
  const [alert, setAlert] = useState(null);         // { type, message }
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [presenceConfirmed, setPresenceConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  // useRef for socket — prevents recreation on every render
  // LLD: stable reference, no memory leaks
  const socketRef = useRef(null);

  // ─── Show alert banner ─────────────────────────────────────────────────
  const showAlert = useCallback((type, message, duration = 5000) => {
    setAlert({ type, message });
    if (duration) setTimeout(() => setAlert(null), duration);
  }, []);

  // ─── Fetch user data ───────────────────────────────────────────────────
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/user/${user_id}`);
      const result = await res.json();
      if (!res.ok) {
        navigate("/login");
        return;
      }
      setUser(result.data);
      // Admin data is populated in getUser
      if (result.data.admin) {
        setQueueStatus(result.data.admin.queueStatus || "notStarted");
      }
    } catch (e) {
      console.error("Error fetching user:", e);
    } finally {
      setLoading(false);
    }
  }, [user_id, navigate]);

  // ─── Socket setup ──────────────────────────────────────────────────────
  useEffect(() => {
    fetchUser();

    // Create socket once
    socketRef.current = io(API_URL);
    const socket = socketRef.current;

    socket.on("connect", () => {
      // Join this user's queue room
      // We need adminId — fetch it first then join
      fetch(`${API_URL}/user/${user_id}`)
        .then((r) => r.json())
        .then((result) => {
          const adminId = result.data?.admin?._id || result.data?.admin;
          if (adminId) {
            socket.emit("join-queue", adminId);
          }
        });
    });

    // Queue-wide timer update — find this user in the list
    socket.on("time-updated", (users) => {
      const me = users.find((u) => u._id === user_id);
      if (me) setUser((prev) => ({ ...prev, ...me }));
    });

    // Full queue update — recalculated positions/times
    socket.on("queue-updated", (users) => {
      const me = users.find((u) => u._id === user_id);
      if (me) setUser((prev) => ({ ...prev, ...me }));
    });

    // Admin called THIS user specifically
    socket.on("user-called", ({ userId }) => {
      if (userId === user_id) {
        setUser((prev) => ({ ...prev, status: "called" }));
        showAlert(
          "called",
          "Your turn is next! Please confirm your presence within 60 seconds.",
          0 // don't auto-dismiss
        );
      }
    });

    // This user was skipped
    socket.on("user-skipped", ({ userId }) => {
      if (userId === user_id) {
        setUser((prev) => ({ ...prev, status: "skipped" }));
        showAlert("error", "You were skipped for not responding in time.");
      }
    });

    // This user expired
    socket.on("user-expired", ({ userId }) => {
      if (userId === user_id) {
        setUser((prev) => ({ ...prev, status: "expired" }));
        showAlert("error", "Your queue time has expired.");
      }
    });

    // Queue status changed by admin
    socket.on("queue-status-changed", ({ queueStatus, pauseReason }) => {
      setQueueStatus(queueStatus);
      setPauseReason(pauseReason || "");
      if (queueStatus === "paused") {
        showAlert("warning", `Queue paused${pauseReason ? `: ${pauseReason}` : ""}`);
      } else if (queueStatus === "active") {
        showAlert("success", "Queue is now active!");
      }
    });

    // Cleanup on unmount — critical to prevent memory leaks
    return () => {
      socket.off("connect");
      socket.off("time-updated");
      socket.off("queue-updated");
      socket.off("user-called");
      socket.off("user-skipped");
      socket.off("user-expired");
      socket.off("queue-status-changed");
      socket.disconnect();
    };
  }, [user_id, fetchUser, showAlert]);

  // ─── Confirm presence ──────────────────────────────────────────────────
  const handleConfirmPresence = async () => {
    try {
      await fetch(`${API_URL}/user/${user_id}/confirm-presence`, {
        method: "POST",
      });
      setPresenceConfirmed(true);
      setAlert(null);
      showAlert("success", "Presence confirmed! Please proceed to the counter.");
    } catch (e) {
      console.error("Presence confirm failed:", e);
    }
  };

  // ─── Leave queue ───────────────────────────────────────────────────────
  const handleLeaveQueue = async () => {
    try {
      await fetch(`${API_URL}/user/${user_id}/leave`, {
        method: "DELETE",
      });
      localStorage.removeItem("userToken");
      navigate("/register");
    } catch (e) {
      console.error("Leave queue failed:", e);
    }
  };

  // ─── Logout ────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem("userToken");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-900">
        <Loader className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-white bg-zinc-900">
        User not found.{" "}
        <span
          className="text-blue-400 cursor-pointer ml-1"
          onClick={() => navigate("/login")}
        >
          Go back
        </span>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[user.status] || STATUS_CONFIG.waiting;
  const StatusIcon = statusConfig.icon;
  const queueConfig = QUEUE_STATUS_CONFIG[queueStatus] || QUEUE_STATUS_CONFIG.notStarted;

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="bg-zinc-800 p-8 rounded-xl shadow-lg w-full max-w-md space-y-6">

        {/* ── Alert Banner ────────────────────────────────────────────── */}
        {alert && (
          <div
            className={`p-3 rounded-lg text-sm font-medium text-center border
              ${alert.type === "called"
                ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                : alert.type === "success"
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : alert.type === "warning"
                ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                : "bg-red-500/20 border-red-500/50 text-red-300"
              }`}
          >
            {alert.message}

            {/* Confirm presence button shown only when called */}
            {alert.type === "called" && !presenceConfirmed && (
              <button
                onClick={handleConfirmPresence}
                className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white
                  py-2 px-4 rounded-lg text-sm font-medium transition"
              >
                ✓ I am here
              </button>
            )}
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <h2 className="text-2xl font-bold text-center text-white">
          Your Queue Details
        </h2>

        {/* ── Queue Status ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-3 bg-zinc-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${queueConfig.dot}`} />
            <span className={`text-sm font-medium ${queueConfig.color}`}>
              {queueConfig.label}
            </span>
          </div>
          {queueStatus === "paused" && pauseReason && (
            <span className="text-xs text-gray-400 italic">
              {pauseReason}
            </span>
          )}
        </div>

        {/* ── User Status Badge ─────────────────────────────────────────── */}
        <div className={`flex items-center gap-3 p-3 rounded-lg ${statusConfig.bg}`}>
          <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
          <div>
            <p className="text-xs text-gray-400">Your Status</p>
            <p className={`font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </p>
          </div>
        </div>

        {/* ── Ticket + Position ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Ticket No.</p>
            <p className="text-xl font-bold text-emerald-400">
              {user.ticketNumber || "—"}
            </p>
          </div>
          <div className="bg-zinc-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Position</p>
            <p className="text-xl font-bold text-white">
              #{user.position || "—"}
            </p>
          </div>
        </div>

        {/* ── User Details ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          {[
            { icon: User,  label: "Full Name", value: user.fullName },
            { icon: Mail,  label: "Email",     value: user.email },
            { icon: Phone, label: "Phone",     value: user.phone },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-400">{label}:</p>
                <p className="text-white font-medium">{value}</p>
              </div>
            </div>
          ))}

          {/* Time remaining — only show when queue is active */}
          {queueStatus === "active" && user.status === "waiting" && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-400">Est. Wait:</p>
                <p className="text-orange-400 font-medium">
                  {FormatTime(user.timeRemaining)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <div className="space-y-2 pt-2">
          {/* Leave Queue button — not shown if completed/expired */}
          {!["completed", "expired"].includes(user.status) && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full bg-orange-500/20 border border-orange-500/30
                text-orange-400 hover:bg-orange-500/30 py-2 px-4 rounded-lg
                text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <Hash className="w-4 h-4" />
              Leave Queue Voluntarily
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full bg-red-500/20 border border-red-500/30
              text-red-400 hover:bg-red-500/30 py-2 px-4 rounded-lg
              text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </div>

      {/* ── Leave Queue Confirmation Modal ───────────────────────────────── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4 border border-zinc-700">
            <h3 className="text-white font-bold text-lg">Leave Queue?</h3>
            <p className="text-gray-400 text-sm">
              Are you sure you want to leave the queue? Your ticket{" "}
              <span className="text-emerald-400 font-medium">
                {user.ticketNumber}
              </span>{" "}
              will be cancelled and all positions will update automatically.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-zinc-600
                  text-white hover:bg-zinc-700 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveQueue}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600
                  text-white transition text-sm font-medium"
              >
                Yes, Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPage;