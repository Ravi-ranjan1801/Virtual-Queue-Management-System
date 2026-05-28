import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";

const API_URL = "http://localhost:5000";

// Format seconds → "2h 5m 30s"
const formatTime = (sec) => {
  if (!sec || sec <= 0) return "0h 0m 0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
};

// Estimated meeting time = now + timeRemaining
// This stays roughly stable as both advance together
const getMeetingTime = (timeRemaining) => {
  if (!timeRemaining || timeRemaining <= 0) return "Soon";
  const meeting = new Date(Date.now() + timeRemaining * 1000);
  return meeting.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const getArrivalTime = (createdAt) => {
  if (!createdAt) return "—";
  return new Date(createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const QUEUE_STATUS = {
  notStarted: { label: "Not Started",  dot: "bg-gray-500",   text: "text-gray-400" },
  active:     { label: "Active",       dot: "bg-green-500",  text: "text-green-400" },
  paused:     { label: "Paused",       dot: "bg-yellow-500", text: "text-yellow-400" },
};

const UserPage = () => {
  const { user_id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [queueStatus, setQueueStatus] = useState("notStarted");
  const [pauseReason, setPauseReason] = useState("");
  const [notification, setNotification] = useState(""); // "nearly-called" alert
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/user/${user_id}`);
      const result = await res.json();
      if (!res.ok) { navigate("/login"); return; }
      setUser(result.data);
      if (result.data?.admin) {
        setQueueStatus(result.data.admin.queueStatus || "notStarted");
        setPauseReason(result.data.admin.pauseReason || "");
      }
    } catch (e) {
      console.error("Fetch user error:", e);
    } finally {
      setLoading(false);
    }
  }, [user_id, navigate]);

  useEffect(() => {
    fetchUser();

    socketRef.current = io(API_URL);
    const socket = socketRef.current;

    socket.on("connect", () => {
      fetch(`${API_URL}/user/${user_id}`)
        .then(r => r.json())
        .then(result => {
          const adminId = result.data?.admin?._id || result.data?.admin;
          if (adminId) socket.emit("join-queue", adminId);
        });
    });

    // Live timer update — find this user in the list
    socket.on("time-updated", (users) => {
      const me = users.find(u => u._id === user_id);
      if (me) setUser(prev => ({ ...prev, ...me }));
    });

    // After any queue change (join/delete/pop) — fresh positions + times
    socket.on("queue-updated", (users) => {
      const me = users.find(u => u._id === user_id);
      if (me) setUser(prev => ({ ...prev, ...me }));
    });

    // Admin popped someone — this user is now position 2 (nearly called)
    socket.on("user-nearly-called", ({ userId }) => {
      if (userId === user_id) {
        setNotification("🔔 You're next! Please make your way to the counter.");
      }
    });

    // Queue paused or resumed by admin
    socket.on("queue-status-changed", ({ queueStatus, pauseReason }) => {
      setQueueStatus(queueStatus);
      setPauseReason(pauseReason || "");
    });

    return () => {
      socket.off("connect");
      socket.off("time-updated");
      socket.off("queue-updated");
      socket.off("user-nearly-called");
      socket.off("queue-status-changed");
      socket.disconnect();
    };
  }, [user_id, fetchUser]);

  const handleLeaveQueue = async () => {
    try {
      await fetch(`${API_URL}/user/${user_id}/leave`, { method: "DELETE" });
      localStorage.removeItem("userToken");
      navigate("/register");
    } catch (e) {
      console.error("Leave failed:", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900 text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900 text-white">
        User not found.{" "}
        <span className="text-blue-400 ml-1 cursor-pointer" onClick={() => navigate("/login")}>
          Go back
        </span>
      </div>
    );
  }

  const qs = QUEUE_STATUS[queueStatus] || QUEUE_STATUS.notStarted;
  const isQueueActive = queueStatus === "active";

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="bg-zinc-800 rounded-xl w-full max-w-sm p-6 space-y-5">

        {/* Notification banner — shown when nearly called */}
        {notification && (
          <div className="bg-blue-500/20 border border-blue-500/40 rounded-lg p-3 text-blue-300 text-sm text-center">
            {notification}
            <button
              className="block w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium"
              onClick={() => setNotification("")}
            >
              Got it
            </button>
          </div>
        )}

        {/* Queue name + status */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Queue</p>
          <div className="flex items-center justify-between">
            <p className="text-white font-medium">
              {user.admin?.fullName || "Your Queue"}
            </p>
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${qs.dot}`} />
              <span className={`text-xs ${qs.text}`}>{qs.label}</span>
            </div>
          </div>
          {queueStatus === "paused" && pauseReason && (
            <p className="text-yellow-400/70 text-xs mt-1 italic">
              Reason: {pauseReason}
            </p>
          )}
        </div>

        <hr className="border-zinc-700" />

        {/* Ticket + Position — the key info */}
        <div className="flex items-center justify-around text-center">
          <div>
            <p className="text-gray-400 text-xs mb-1">Your Ticket</p>
            <p className="text-3xl font-bold text-emerald-400 font-mono">
              {user.ticketNumber || "—"}
            </p>
          </div>
          <div className="w-px h-12 bg-zinc-600" />
          <div>
            <p className="text-gray-400 text-xs mb-1">Position</p>
            <p className="text-3xl font-bold text-white">
              #{user.position || "—"}
            </p>
          </div>
        </div>

        <hr className="border-zinc-700" />

        {/* Timing info */}
        {isQueueActive ? (
          <div className="space-y-3">
            <div className="bg-zinc-700/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Estimated Wait Time</p>
              <p className="text-2xl font-bold text-orange-400 font-mono">
                {user.timeRemaining > 0 ? formatTime(user.timeRemaining) : "Your turn!"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-700/50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Joined At</p>
                <p className="text-white text-sm font-medium">
                  {getArrivalTime(user.createdAt)}
                </p>
              </div>
              <div className="bg-zinc-700/50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Est. Meeting</p>
                <p className="text-white text-sm font-medium">
                  {getMeetingTime(user.timeRemaining)}
                </p>
              </div>
            </div>
            <p className="text-gray-500 text-xs text-center">
              You can leave and return before your estimated meeting time
            </p>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-gray-400 text-sm">
              {queueStatus === "paused"
                ? "Queue is paused. Timer will resume when admin restarts."
                : "Waiting for admin to start the queue. Timer will appear here."}
            </p>
          </div>
        )}

        <hr className="border-zinc-700" />

        {/* User details */}
        <div className="space-y-2 text-sm">
          {[
            ["Name",  user.fullName],
            ["Email", user.email],
            ["Phone", user.phone],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-400">{label}</span>
              <span className="text-white">{value}</span>
            </div>
          ))}
        </div>

        <hr className="border-zinc-700" />

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full py-2 rounded-lg border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-sm transition"
          >
            Leave Queue
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-lg border border-zinc-600 text-gray-400 hover:bg-zinc-700 text-sm transition"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-xl p-6 w-full max-w-sm border border-zinc-700 space-y-4">
            <h3 className="text-white font-bold">Leave Queue?</h3>
            <p className="text-gray-400 text-sm">
              Your ticket{" "}
              <span className="text-emerald-400 font-medium">{user.ticketNumber}</span>{" "}
              will be cancelled. All positions update automatically.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-zinc-600 text-white hover:bg-zinc-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveQueue}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm"
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