import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search, Clock, UserCog, LogOut, Edit, Trash2, Power,
  ChevronDown, BarChart2, Timer, CircleUserRound,
  SkipForward, Eye, X, Phone, Mail, Hash, Users,
  CheckCircle,
} from "lucide-react";
import io from "socket.io-client";
import { Button } from "/src/Components/ui/button";
import { Input } from "/src/Components/ui/input";
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle, CardFooter,
} from "/src/Components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "/src/Components/ui/dropdown-menu.jsx";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "/src/Components/ui/dialog";

const API_URL = "http://localhost:5000";

const formatTime = (sec) => {
  if (!sec || sec <= 0) return "0h 0m 0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
};

const formatArrival = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
};

const getMeetingTime = (timeRemaining) => {
  if (!timeRemaining || timeRemaining <= 0) return "Soon";
  const t = new Date(Date.now() + timeRemaining * 1000);
  return t.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

function AdminPage() {
  const { admin_id } = useParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [time, setTime] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [popping, setPopping] = useState(false);
  const [alert, setAlert] = useState(null);
  const [pauseReason, setPauseReason] = useState("");
  const [showPauseInput, setShowPauseInput] = useState(false);

  // Dialogs
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
  const [showDeleteAdminDialog, setShowDeleteAdminDialog] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const socketRef = useRef(null);

  const showAlert = useCallback((type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  }, []);

  // ── Fetch dashboard ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/${admin_id}`);
      const result = await res.json();
      setUsers(result.user || []);
      setAdmin(result.data);
      setTime(result.data?.delay || 10);
    } catch (e) {
      console.error("Fetch error:", e);
    }
  }, [admin_id]);

  // ── Socket setup — fix: join room INSIDE connect event ──────────────────
  useEffect(() => {
    fetchData();

    // Create socket
    socketRef.current = io(API_URL, {
      transports: ["websocket", "polling"],
    });
    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Admin socket connected:", socket.id);
      // Join room immediately on connect — this was the timing bug
      socket.emit("join-admin", admin_id);
    });

    // Fix: replace entire users list, don't append
    socket.on("queue-updated", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on("time-updated", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on("queue-status-changed", ({ queueStatus, pauseReason }) => {
      setAdmin((prev) => ({ ...prev, queueStatus, pauseReason, start: queueStatus === "active" }));
    });

    socket.on("disconnect", () => {
      console.log("Admin socket disconnected");
    });

    return () => {
      socket.off("connect");
      socket.off("queue-updated");
      socket.off("time-updated");
      socket.off("queue-status-changed");
      socket.off("disconnect");
      socket.disconnect();
    };
  }, [admin_id, fetchData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSetTime = async () => {
    const val = Number(time);
    if (isNaN(val) || val < 1) {
      showAlert("error", "Enter a valid time (min 1 minute)");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/users/set-time/${admin_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: val }),
      });
      const result = await res.json();
      setUsers(result.data || []);
      setAdmin((prev) => ({ ...prev, delay: val }));
      showAlert("success", `Serving time set to ${val} min per user`);
    } catch (e) {
      console.error("Set time error:", e);
    }
  };

 const handleToggleQueue = async () => {
  // Stopping active queue — ask for pause reason first
  if (admin?.start && !showPauseInput) {
    setShowPauseInput(true);
    return;
  }

  try {
    await fetch(`${API_URL}/start-process/${admin_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pauseReason }),
    });

    // Re-fetch fresh complete state — avoids all partial merge issues
    // This is why resume was broken: partial merge missed some fields
    await fetchData();

    setShowPauseInput(false);
    setPauseReason("");

  } catch (e) {
    console.error("Toggle queue error:", e);
    showAlert("error", "Failed to toggle queue. Please try again.");
  }
};

  // ── Pop current user — core admin action ─────────────────────────────────
  const handlePopUser = async () => {
    if (users.length === 0) {
      showAlert("error", "Queue is empty");
      return;
    }
    setPopping(true);
    try {
      const res = await fetch(`${API_URL}/admin/${admin_id}/pop`, {
        method: "POST",
      });
      const result = await res.json();
      if (res.ok) {
        showAlert("success", result.message);
        // Socket will update the list via queue-updated event
      } else {
        showAlert("error", result.error);
      }
    } catch (e) {
      console.error("Pop error:", e);
    } finally {
      setPopping(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await fetch(`${API_URL}/user/${selectedUser._id}`, { method: "DELETE" });
      setShowDeleteUserDialog(false);
      setSelectedUser(null);
    } catch (e) {
      console.error("Delete user error:", e);
    }
  };

  const handleDeleteAdmin = async () => {
    try {
      await fetch(`${API_URL}/admin/${admin._id}`, { method: "DELETE" });
      navigate("/login");
    } catch (e) {
      console.error("Delete admin error:", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/login");
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/${admin_id}/analytics`);
      const result = await res.json();
      setAnalytics(result.data);
      setShowAnalytics((prev) => !prev);
    } catch (e) {
      console.error("Analytics error:", e);
    }
  };

  // Only show active waiting users — those currently in the queue
  const activeUsers = users.filter((u) =>
    searchQuery
      ? u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  if (!admin) {
    return (
      <div className="h-screen flex items-center justify-center text-white bg-zinc-900">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-gray-100">

      {/* ── Toast alert ───────────────────────────────────────────────── */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm
          font-medium shadow-lg border max-w-sm
          ${alert.type === "success"
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
            : "bg-red-500/20 border-red-500/50 text-red-300"
          }`}
        >
          {alert.message}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 sticky top-0 z-10 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-emerald-400">
              Admin Dashboard
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              onClick={fetchAnalytics}
            >
              <BarChart2 className="h-4 w-4" />
              Analytics
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <CircleUserRound className="h-5 w-5 text-zinc-400" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{admin.fullName}</p>
                    <p className="text-xs text-gray-400">Administrator</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => navigate(`/admin/edit/${admin._id}`)}
                >
                  <Edit className="h-4 w-4" /> Edit Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-red-400"
                  onClick={() => setShowDeleteAdminDialog(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete Account
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Welcome ───────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-gradient-to-r from-emerald-900/40 to-teal-900/40
          border border-emerald-800/40 p-6">
          <h1 className="text-2xl font-bold text-white">
            Welcome, {admin.fullName}
          </h1>
          <p className="text-emerald-300/70 text-sm mt-1">
            {admin.start ? "Queue is running" : "Queue is stopped"} ·{" "}
            {activeUsers.length} user{activeUsers.length !== 1 ? "s" : ""} waiting ·{" "}
            {admin.delay} min per user
          </p>
        </div>

        {/* ── Analytics ─────────────────────────────────────────────────── */}
        {showAnalytics && analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Served",     value: analytics.totalServed,         color: "text-emerald-400" },
              { label: "Joined Today",     value: analytics.totalToday,          color: "text-blue-400" },
              { label: "Currently Waiting",value: analytics.currentlyWaiting,    color: "text-yellow-400" },
              { label: "Avg Wait (min)",   value: analytics.avgWaitTimeMinutes,  color: "text-orange-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Queue Controls ─────────────────────────────────────────────── */}
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              Queue Controls
            </CardTitle>
            <CardDescription className="text-gray-400 text-sm">
              Default serving time is {admin.delay} min. Change below and click Set.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Time input */}
              <div className="relative w-36">
                <Input
                  type="number"
                  value={time}
                  min="1"
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-zinc-700 border-zinc-600 text-white pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  min
                </span>
              </div>

              <Button
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
                onClick={handleSetTime}
              >
                Set Time
              </Button>

              <Button
                size="sm"
                className={admin.start
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"}
                onClick={handleToggleQueue}
              >
                <Power className="h-4 w-4 mr-1.5" />
                {admin.start ? "Stop Queue" : "Start Queue"}
              </Button>

              {/* Done → Next — only when queue running */}
              {admin.start && (
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handlePopUser}
                  disabled={popping || users.length === 0}
                >
                  <SkipForward className="h-4 w-4 mr-1.5" />
                  {popping ? "Processing..." : "Done → Next"}
                </Button>
              )}

              {/* Search */}
              <div className="relative ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  className="bg-zinc-700 border-zinc-600 text-white pl-9 w-56"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Pause reason input */}
            {showPauseInput && (
              <div className="flex gap-3 items-center pt-1">
                <Input
                  placeholder="Reason for stopping (e.g. Lunch break)"
                  className="bg-zinc-700 border-zinc-600 text-white"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                />
                <Button
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white shrink-0"
                  onClick={handleToggleQueue}
                >
                  Confirm Stop
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => { setShowPauseInput(false); setPauseReason(""); }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-zinc-700 py-2 px-6">
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${admin.start ? "bg-emerald-500" : "bg-gray-500"}`} />
                {admin.start ? "Queue Active" : "Queue Inactive"}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                {activeUsers.length} in queue
              </span>
            </div>
          </CardFooter>
        </Card>

        {/* ── User Table ─────────────────────────────────────────────────── */}
        <Card className="bg-zinc-800/20 border-zinc-800">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCog className="h-4 w-4 text-emerald-400" />
              Active Queue Members
            </CardTitle>
            <CardDescription className="text-gray-400 text-sm">
              Click "View" to see user details. Use "Done → Next" to serve and remove the first user.
            </CardDescription>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase text-gray-500">
                  <th className="text-left py-3 px-4">Position</th>
                  <th className="text-left py-3 px-4">Ticket</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Wait Time</th>
                  <th className="text-left py-3 px-4">Est. Meeting</th>
                  <th className="text-left py-3 px-4">Joined At</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {activeUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-500">
                      No users in queue
                    </td>
                  </tr>
                ) : (
                  activeUsers.map((user, index) => (
                    <tr
                      key={user._id}
                      className={`hover:bg-zinc-800/40 transition-colors
                        ${index === 0 ? "bg-emerald-900/10 border-l-2 border-l-emerald-500" : ""}`}
                    >
                      {/* Position — highlight first user (being served) */}
                      <td className="py-3 px-4">
                        <span className={`font-mono font-bold
                          ${index === 0 ? "text-emerald-400" : "text-gray-400"}`}>
                          #{user.position}
                          {index === 0 && (
                            <span className="ml-2 text-xs font-normal bg-emerald-500/20
                              text-emerald-400 px-1.5 py-0.5 rounded">
                              Serving
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Ticket */}
                      <td className="py-3 px-4">
                        <span className="text-emerald-400 font-mono">
                          {user.ticketNumber}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-medium text-white">
                        {user.fullName}
                      </td>

                      {/* Wait time — live countdown */}
                      <td className="py-3 px-4">
                        <span className="text-orange-400 font-mono">
                          {admin.start
                            ? formatTime(user.timeRemaining)
                            : "Paused"}
                        </span>
                      </td>

                      {/* Estimated meeting time */}
                      <td className="py-3 px-4 text-gray-300">
                        {admin.start
                          ? getMeetingTime(user.timeRemaining)
                          : "—"}
                      </td>

                      {/* Joined at */}
                      <td className="py-3 px-4 text-gray-400">
                        {formatArrival(user.createdAt)}
                      </td>

                      {/* Actions — View Details + Delete only */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserDetailModal(true);
                            }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5
                              rounded border border-zinc-600 text-gray-300
                              hover:bg-zinc-700 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteUserDialog(true);
                            }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5
                              rounded border border-red-500/30 text-red-400
                              hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* ── User Detail Modal (read-only) ─────────────────────────────────── */}
      {showUserDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-xl w-full max-w-sm border border-zinc-700">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-700">
              <h3 className="text-white font-bold">User Details</h3>
              <button
                onClick={() => setShowUserDetailModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {/* Ticket + Position */}
              <div className="flex justify-around text-center pb-3 border-b border-zinc-700">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Ticket</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono">
                    {selectedUser.ticketNumber}
                  </p>
                </div>
                <div className="w-px bg-zinc-600" />
                <div>
                  <p className="text-xs text-gray-400 mb-1">Position</p>
                  <p className="text-2xl font-bold text-white">
                    #{selectedUser.position}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3 text-sm">
                {[
                  { icon: CircleUserRound, label: "Name",  value: selectedUser.fullName },
                  { icon: Mail,            label: "Email", value: selectedUser.email },
                  { icon: Phone,           label: "Phone", value: selectedUser.phone },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="text-gray-400 w-12 shrink-0">{label}</span>
                    <span className="text-white">{value}</span>
                  </div>
                ))}

                {/* Timer info */}
                <div className="flex items-center gap-3">
                  <Timer className="h-4 w-4 text-gray-500 shrink-0" />
                  <span className="text-gray-400 w-12 shrink-0">Wait</span>
                  <span className="text-orange-400 font-mono">
                    {admin.start ? formatTime(selectedUser.timeRemaining) : "Paused"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-500 shrink-0" />
                  <span className="text-gray-400 w-12 shrink-0">Joined</span>
                  <span className="text-white">{formatArrival(selectedUser.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Modal footer — remove button */}
            <div className="p-5 border-t border-zinc-700">
              <button
                onClick={() => {
                  setShowUserDetailModal(false);
                  setShowDeleteUserDialog(true);
                }}
                className="w-full py-2 rounded-lg bg-red-500/20 border border-red-500/40
                  text-red-400 hover:bg-red-500/30 text-sm transition"
              >
                Remove from Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete User Confirm ───────────────────────────────────────────── */}
      <Dialog open={showDeleteUserDialog} onOpenChange={setShowDeleteUserDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Remove User?</DialogTitle>
            <DialogDescription className="text-gray-400">
              Remove <span className="text-white font-medium">{selectedUser?.fullName}</span>{" "}
              ({selectedUser?.ticketNumber}) from the queue?
              All positions will update automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteUserDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Admin Confirm ──────────────────────────────────────────── */}
      <Dialog open={showDeleteAdminDialog} onOpenChange={setShowDeleteAdminDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Delete Account?</DialogTitle>
            <DialogDescription className="text-gray-400">
              This permanently deletes your admin account and removes all users in your queue.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAdminDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAdmin}>
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPage;