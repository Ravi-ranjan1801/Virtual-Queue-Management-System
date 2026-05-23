import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search, Clock, UserCog, LogOut, Edit, Trash2, Power,
  ChevronDown, EllipsisVertical, Calendar, Timer,
  CircleUserRound, SkipForward, BarChart2, Users,
  CheckCircle, AlertCircle, Hash,
} from "lucide-react";
import io from "socket.io-client";
import { Button } from "/src/Components/ui/button";
import { Input } from "/src/Components/ui/input";
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle, CardFooter,
} from "/src/Components/ui/card";
import { Badge } from "/src/Components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "/src/Components/ui/dropdown-menu.jsx";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "/src/Components/ui/dialog";

const API_URL = "http://localhost:5000";

// ─── Format seconds → "0h 5m 30s" ────────────────────────────────────────
const FormatTime = (seconds) => {
  if (!seconds || seconds <= 0) return "0h 0m 0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
};

// ─── Format ISO timestamp → local time string ──────────────────────────────
// Fix: use toLocaleTimeString — no hardcoded UTC offsets
const FormatArrival = (isoString) => {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

// ─── User status badge config ──────────────────────────────────────────────
const STATUS_CONFIG = {
  waiting:   { label: "Waiting",    color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
  called:    { label: "Called",     color: "text-blue-400   border-blue-500/30   bg-blue-500/10" },
  inService: { label: "In Service", color: "text-green-400  border-green-500/30  bg-green-500/10" },
  skipped:   { label: "Skipped",    color: "text-red-400    border-red-500/30    bg-red-500/10" },
  completed: { label: "Completed",  color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  expired:   { label: "Expired",    color: "text-gray-400   border-gray-500/30   bg-gray-500/10" },
};

function AdminPage() {
  const { admin_id } = useParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [time, setTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pauseReason, setPauseReason] = useState("");
  const [showPauseInput, setShowPauseInput] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [callingNext, setCallingNext] = useState(false);
  const [alert, setAlert] = useState(null);

  // Socket in ref — stable, no recreation on render
  const socketRef = useRef(null);

  // ─── Alert helper ────────────────────────────────────────────────────
  const showAlert = useCallback((type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  }, []);

  // ─── Fetch dashboard data ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/${admin_id}`);
      const result = await res.json();
      setUsers(result.user || []);
      setAdmin(result.data);
      setTime(result.data?.delay || 10);
    } catch (e) {
      console.error("Error fetching data:", e);
    }
  }, [admin_id]);

  // ─── Fetch analytics ──────────────────────────────────────────────────
  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/${admin_id}/analytics`);
      const result = await res.json();
      setAnalytics(result.data);
      setShowAnalytics(true);
    } catch (e) {
      console.error("Analytics fetch failed:", e);
    }
  };

  // ─── Socket setup ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();

    socketRef.current = io(API_URL);
    const socket = socketRef.current;

    socket.on("connect", () => {
      // Admin joins their queue room
      socket.emit("join-admin", admin_id);
    });

    // Fix: update existing user, don't append
    socket.on("queue-updated", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on("time-updated", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    // New user joined
    socket.on("user-updated", (newUser) => {
      setUsers((prev) => {
        const exists = prev.find((u) => u._id === newUser._id);
        if (exists) {
          return prev.map((u) => u._id === newUser._id ? newUser : u);
        }
        return [...prev, newUser];
      });
    });

    // User deleted by admin or left voluntarily
    socket.on("user-deleted", (deletedUser) => {
      setUsers((prev) => prev.filter((u) => u._id !== deletedUser._id));
    });

    // User called — update their status in the list
    socket.on("user-called", ({ userId }) => {
      setUsers((prev) =>
        prev.map((u) => u._id === userId ? { ...u, status: "called" } : u)
      );
    });

    // User skipped
    socket.on("user-skipped", ({ userId }) => {
      setUsers((prev) =>
        prev.map((u) => u._id === userId ? { ...u, status: "skipped" } : u)
      );
      showAlert("warning", "User was skipped for not responding.");
    });

    // User expired
    socket.on("user-expired", ({ userId, ticketNumber }) => {
      setUsers((prev) =>
        prev.map((u) => u._id === userId ? { ...u, status: "expired" } : u)
      );
      showAlert("error", `Ticket ${ticketNumber} has expired.`);
    });

    // Presence confirmed by user
    socket.on("presence-confirmed", (updatedUser) => {
      setUsers((prev) =>
        prev.map((u) => u._id === updatedUser._id ? updatedUser : u)
      );
      showAlert("success", `${updatedUser.fullName} confirmed presence.`);
    });

    return () => {
      socket.off("connect");
      socket.off("queue-updated");
      socket.off("time-updated");
      socket.off("user-updated");
      socket.off("user-deleted");
      socket.off("user-called");
      socket.off("user-skipped");
      socket.off("user-expired");
      socket.off("presence-confirmed");
      socket.disconnect();
    };
  }, [admin_id, fetchData, showAlert]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await fetch(`${API_URL}/user/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const deleteAdmin = async (id) => {
    try {
      await fetch(`${API_URL}/admin/${id}`, { method: "DELETE" });
      navigate("/login");
    } catch (e) {
      console.error("Delete admin failed:", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/login");
  };

  const handleSetTime = async () => {
    const val = Number(time);
    if (isNaN(val) || val < 1) {
      showAlert("error", "Please enter a valid time (minimum 1 minute)");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/users/set-time/${admin_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: val }),
      });
      const result = await res.json();
      setUsers(result.data);
      showAlert("success", `Serving time updated to ${val} minutes`);
    } catch (e) {
      console.error("Set time failed:", e);
    }
  };

  const handleStartCron = async () => {
    // If active → show pause input before stopping
    if (admin?.start && !showPauseInput) {
      setShowPauseInput(true);
      return;
    }

    try {
      const body = showPauseInput ? { pauseReason } : {};
      const res = await fetch(`${API_URL}/start-process/${admin_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      setAdmin(result.admin);
      setShowPauseInput(false);
      setPauseReason("");
    } catch (e) {
      console.error("Toggle queue failed:", e);
    }
  };

  // ─── Call Next ────────────────────────────────────────────────────────
  const handleCallNext = async () => {
    setCallingNext(true);
    try {
      const res = await fetch(`${API_URL}/admin/${admin_id}/call-next`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.data) {
        showAlert(
          "success",
          `Called: ${result.data.fullName} (${result.data.ticketNumber})`
        );
      } else {
        showAlert("warning", "Queue is empty — no more users.");
      }
    } catch (e) {
      console.error("Call next failed:", e);
    } finally {
      setCallingNext(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUsers = users.filter((u) =>
    ["waiting", "called", "inService"].includes(u.status)
  ).length;

  if (!admin) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-white bg-zinc-900">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-gray-100">

      {/* ── Alert Banner ──────────────────────────────────────────────── */}
      {alert && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm
            font-medium shadow-lg border max-w-sm
            ${alert.type === "success"
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
              : alert.type === "warning"
              ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
              : "bg-red-500/20 border-red-500/50 text-red-300"
            }`}
        >
          {alert.message}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                <UserCog className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">
                Admin Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Analytics toggle */}
              <Button
                variant="outline"
                className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={fetchAnalytics}
              >
                <BarChart2 className="h-4 w-4" />
                Analytics
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" className="flex items-center gap-2">
                    <CircleUserRound className="h-4 w-4" />
                    <div className="flex flex-col items-start text-sm">
                      <span className="font-medium">{admin.fullName}</span>
                      <span className="text-xs text-gray-400">Administrator</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => navigate(`/admin/edit/${admin._id}`)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-red-500"
                    onClick={() => { setDialogAction("deleteAccount"); setShowConfirmDialog(true); }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Welcome Banner ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border border-emerald-800/50 p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Welcome back, {admin.fullName}
          </h1>
          <p className="text-emerald-200/80 text-sm">
            Manage your queue, monitor wait times, and serve users efficiently.
          </p>
        </div>

        {/* ── Analytics Panel ────────────────────────────────────────── */}
        {showAnalytics && analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Served",    value: analytics.totalServed,          icon: CheckCircle, color: "text-emerald-400" },
              { label: "Today's Users",   value: analytics.totalToday,           icon: Users,       color: "text-blue-400" },
              { label: "Currently Waiting", value: analytics.currentlyWaiting,  icon: Clock,       color: "text-yellow-400" },
              { label: "Avg Wait (min)",  value: analytics.avgWaitTimeMinutes,   icon: Timer,       color: "text-orange-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Queue Controls ─────────────────────────────────────────── */}
        <Card className="bg-zinc-800/50 border border-zinc-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Clock className="h-5 w-5 text-emerald-400" />
              Queue Controls
            </CardTitle>
            <CardDescription className="text-gray-400">
              Set serving time per user and manage queue state
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
              {/* Time input */}
              <div className="relative w-full max-w-xs">
                <Input
                  type="number"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-zinc-800/50 border-zinc-700 text-white pr-12"
                  min="1"
                  placeholder="Minutes per user"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400 text-sm">
                  mins
                </div>
              </div>

              <Button
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
                onClick={handleSetTime}
              >
                <Clock className="h-4 w-4" />
                Set Time
              </Button>

              {/* Start/Stop Queue */}
              <Button
                variant={admin.start ? "destructive" : "default"}
                className={admin.start
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-600 hover:bg-blue-700"}
                onClick={handleStartCron}
              >
                <Power className="h-4 w-4 mr-2" />
                {admin.start ? "Stop Queue" : "Start Queue"}
              </Button>

              {/* Call Next — only when queue is active */}
              {admin.start && (
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                  onClick={handleCallNext}
                  disabled={callingNext}
                >
                  <SkipForward className="h-4 w-4" />
                  {callingNext ? "Calling..." : "Call Next"}
                </Button>
              )}

              {/* Search */}
              <div className="relative ml-auto w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, ticket..."
                  className="bg-zinc-800/50 border-zinc-700 text-white pl-10 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Pause reason input — shown when stopping queue */}
            {showPauseInput && (
              <div className="flex gap-3 items-center">
                <Input
                  placeholder="Reason for pausing (e.g. Lunch break)"
                  className="bg-zinc-800/50 border-zinc-700 text-white"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  onClick={handleStartCron}
                >
                  Confirm Stop
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowPauseInput(false); setPauseReason(""); }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-zinc-800 bg-gray-900/20 px-6 py-3">
            <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
              <div className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${admin.start ? "bg-emerald-500" : "bg-gray-500"}`} />
                <span>{admin.start ? "Queue Active" : "Queue Inactive"}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span>{activeUsers} Active Users</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{admin.delay || 10} min per user</span>
              </div>
            </div>
          </CardFooter>
        </Card>

        {/* ── User Table ─────────────────────────────────────────────── */}
        <Card className="bg-zinc-800/20 backdrop-blur-sm border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserCog className="h-5 w-5 text-emerald-400" />
              User Management
            </CardTitle>
            <CardDescription className="text-gray-400 mt-1">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} in queue
            </CardDescription>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["#", "Ticket", "User", "Contact", "Status", "Time Info", "Actions"].map((h) => (
                    <th key={h} className="text-left py-4 px-4 text-xs uppercase tracking-wider text-gray-400 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No users in queue
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const sc = STATUS_CONFIG[user.status] || STATUS_CONFIG.waiting;
                    return (
                      <tr key={user._id} className="group hover:bg-zinc-800/30 transition-colors">

                        {/* Position */}
                        <td className="py-4 px-4">
                          <span className="text-gray-400 font-mono text-sm">
                            #{user.position || "—"}
                          </span>
                        </td>

                        {/* Ticket */}
                        <td className="py-4 px-4">
                          <span className="text-emerald-400 font-mono font-medium">
                            {user.ticketNumber || "—"}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-4 px-4">
                          <p className="font-medium">{user.fullName}</p>
                        </td>

                        {/* Contact */}
                        <td className="py-4 px-4">
                          <p className="text-sm">{user.email}</p>
                          <p className="text-sm text-gray-400">{user.phone}</p>
                        </td>

                        {/* Status badge */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                            {sc.label}
                          </span>
                          {user.isPresent && (
                            <span className="ml-1 text-xs text-emerald-400">✓ Here</span>
                          )}
                        </td>

                        {/* Time info */}
                        <td className="py-4 px-4">
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span>Joined: {FormatArrival(user.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Timer className="h-3 w-3 text-gray-400" />
                              <span>
                                Wait:{" "}
                                {["waiting", "called"].includes(user.status)
                                  ? FormatTime(user.timeRemaining)
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <EllipsisVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800">
                              <DropdownMenuItem
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => navigate(`/user/edit/${user._id}`)}
                              >
                                <Edit className="h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="flex items-center gap-2 cursor-pointer text-red-500"
                                onClick={() => {
                                  setSelectedUser(user._id);
                                  setDialogAction("delete");
                                  setShowConfirmDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* ── Confirm Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "delete" ? "Delete User" : "Delete Account"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {dialogAction === "delete"
                ? "Are you sure? This removes the user from the queue and updates all positions."
                : "Are you sure? Your account and all associated users will be permanently deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (dialogAction === "delete") handleDelete(selectedUser);
                else deleteAdmin(admin._id);
                setShowConfirmDialog(false);
              }}
            >
              {dialogAction === "delete" ? "Delete User" : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPage;