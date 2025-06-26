import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Clock,
  UserCog,
  LogOut,
  Edit,
  Trash2,
  Power,
  ChevronDown,
  EllipsisVertical,
  Calendar,
  Timer,
  CircleUserRound,
} from "lucide-react";
import io from "socket.io-client";
import { FormatTime } from "/src/Components/FormatTime";
import { Button } from "/src/Components/ui/button";
import { Input } from "/src/Components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "/src/Components/ui/card";
import { Badge } from "/src/Components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "/src/Components/ui/dropdown-menu.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "/src/Components/ui/dialog";

const socket = io("http://localhost:3000");

function AdminPage() {
  const { admin_id } = useParams();
  const navigate = useNavigate();
  const [response, setResponse] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [delay, setDelay] = useState(0);
  const [time, setTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetch(`http://localhost:3000/admin/${admin_id}`);
        const result = await data.json();
        setResponse(result.user || []);
        setAdmin(result.data);
        setDelay(result.data.delay || 0);
      } catch (error) {
        console.log("Error fetching data:", error);
      }
    };
    fetchData();

    socket.on("time-updated", (users) => setResponse(users));
    socket.on("user-updated", (user) => setResponse((prev) => [...prev, user]));
    socket.on("user-deleted", (deletedUser) =>
      setResponse((prev) => prev.filter((user) => user._id !== deletedUser._id))
    );

    return () => {
      socket.off("time-updated");
      socket.off("user-updated");
      socket.off("user-deleted");
    };
  }, [admin_id]);

  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:3000/user/${id}`, { method: "DELETE" });
    } catch (error) {
      console.log("Error deleting user:", error);
    }
  };

  const deleteAdmin = async (id) => {
    try {
      await fetch(`http://localhost:3000/admin/${id}`, { method: "DELETE" });

      navigate("/login");
    } catch (error) {
      console.log("Error deleting admin:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/login");
  };

  const handleSetTime = async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/users/set-time/${admin_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ time }),
        }
      );
      const result = await res.json();
      setResponse(result.data);
    } catch (error) {
      console.log("Error setting time:", error);
    }
  };

  const handleStartCron = async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/start-process/${admin_id}`,
        { method: "POST" }
      );
      const result = await res.json();
      setAdmin(result.admin);
    } catch (error) {
      console.log("Error starting/stopping queue:", error);
    }
  };

  const filteredUsers = response.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const timeRemaining = (index) => {
    const finalDelay = (index + 1) * delay;
    let hours = 0;
    let minutes = finalDelay;
    let seconds = 0;

    if (minutes >= 60) {
      hours = Math.floor(minutes / 60);
      minutes %= 60;
    }
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const arrivalTime = (inputTime) => {
    const time = inputTime.split("T")[1];
    let hours = parseInt(time.split(":")[0]) + 6;
    let minutes = parseInt(time.split(":")[1]) - 30;
    const seconds = parseInt(time.split(":")[2].split(".")[0]);

    if (hours >= 24) hours %= 24;
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const meetingTime = (inputTime, index) => {
    const arrival = arrivalTime(inputTime);
    const [arrivalHours, arrivalMinutes, arrivalSeconds] = arrival
      .split(/[hms\s]+/)
      .filter(Boolean);
    const finalDelay = (index + 1) * delay;
    let totalHours = parseInt(arrivalHours);
    let totalMinutes = parseInt(arrivalMinutes) + finalDelay;
    let totalSeconds = parseInt(arrivalSeconds);

    if (totalSeconds >= 60) {
      totalMinutes += Math.floor(totalSeconds / 60);
      totalSeconds %= 60;
    }
    if (totalMinutes >= 60) {
      totalHours += Math.floor(totalMinutes / 60);
      totalMinutes %= 60;
    }
    if (totalHours >= 24) totalHours %= 24;

    return `${totalHours}h ${totalMinutes}m ${totalSeconds}s`;
  };

  if (!admin) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-white bg-zinc-900">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900  text-gray-100">
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
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" className="flex items-center gap-2">
                    <div className="flex flex-col items-start text-sm">
                      <div className="flex items-end gap-1">
                        <span>
                          <CircleUserRound />
                        </span>
                        <span className="font-medium">{admin.fullName}</span>
                      </div>
                      <span className="text-xs text-gray-400 mt-1">
                        Administrator
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-zinc-900 border-zinc-800"
                >
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => navigate(`/admin/edit/${admin._id}`)}
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-red-500"
                    onClick={() => {
                      setDialogAction("deleteAccount");
                      setShowConfirmDialog(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border border-emerald-800/50">
          <div className="absolute inset-0 bg-[url('/placeholder.svg?height=200&width=1200')] opacity-10 bg-center bg-cover"></div>
          <div className="relative p-6 sm:p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Welcome back, {admin.fullName}
              </h1>
              <p className="text-emerald-200/80 max-w-xl">
                Manage your users, monitor queue times, and control access
                settings from your dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 text-white gap-2"
                onClick={() => navigate(`/admin/edit/${admin._id}`)}
              >
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        <Card className="bg-zinc-800/50  border border-zinc-800/50 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Clock className="h-5 w-5 text-emerald-400" />
              <span>Set Time for Users</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Specify the duration in minutes for user access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative w-full max-w-xs">
                <Input
                  type="number"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-zinc-800/50 border-zinc-700 text-white pr-12"
                  min="0"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  mins
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  className="bg-emerald-700  hover:bg-emerald-800  text-white border-0 gap-2"
                  onClick={handleSetTime}
                >
                  <Clock className="h-4 w-4" />
                  Set Time
                </Button>
                <Button
                  variant={admin.start ? "destructive" : "normal"}
                  className={admin.start ? "bg-red-500 hover:bg-red-600" : ""}
                  onClick={handleStartCron}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {admin.start ? "Stop Queue" : "Start Queue"}
                </Button>
              </div>
              <div className="ml-auto w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    className="bg-zinc-800/50 border-zinc-700 text-white pl-10 w-full sm:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-zinc-800 bg-gray-900/20 px-6 py-3">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full ${
                    admin.start ? "bg-emerald-500" : "bg-gray-500"
                  }`}
                ></div>
                <span>{admin.start ? "Queue Active" : "Queue Inactive"}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                <span>{filteredUsers.length} Users</span>
              </div>
            </div>
          </CardFooter>
        </Card>

        <Card className="bg-zinc-800/20 backdrop-blur-sm border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UserCog className="h-5 w-5 text-emerald-400" />
                  <span>User Management</span>
                </CardTitle>
                <CardDescription className="text-gray-400 mt-1">
                  Manage user access, roles, and permissions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-gray-400 font-medium">
                    User
                  </th>
                  <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-gray-400 font-medium">
                    Contact
                  </th>
                  <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-gray-400 font-medium">
                    Role
                  </th>
                  <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-gray-400 font-medium">
                    Time Info
                  </th>
                  <th className="text-right py-4 px-6 text-xs uppercase tracking-wider text-gray-400 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredUsers.map((user, index) => (
                  <tr
                    key={user._id}
                    className="group hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="text-sm">{user.email}</p>
                        <p className="text-sm text-gray-400">{user.phone}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-500 border-blue-500/50"
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">
                            Arrival: {arrivalTime(user.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Timer className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">
                            Remaining:{" "}
                            {!user.timeRemaining
                              ? timeRemaining(index)
                              : FormatTime(user.timeRemaining)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">
                            Meeting: {meetingTime(user.createdAt, index)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
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
                          <DropdownMenuContent
                            align="end"
                            className="w-48 bg-zinc-900 border-zinc-800"
                          >
                            <DropdownMenuItem
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => navigate(`/user/edit/${user._id}`)}
                            >
                              <Edit className="h-4 w-4" />
                              <span>Edit User</span>
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
                              <span>Delete User</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "delete" ? "Delete User" : "Delete Account"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {dialogAction === "delete"
                ? "Are you sure you want to delete this user? This action cannot be undone."
                : "Are you sure you want to delete your account? All your data will be permanently removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
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
