import { useState, useEffect, useRef } from "react";
import { Search, UserCog } from "lucide-react";
import io from "socket.io-client";

const API_URL = "http://localhost:5000";

const AllAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const socketRef = useRef(null);           // fix: socket in ref not module level

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/admins`);
        const result = await res.json();
        setAdmins(result.data || []);
      } catch (e) {
        console.error("Error fetching admins:", e);
      }
    };
    fetchData();

    socketRef.current = io(API_URL);
    const socket = socketRef.current;

    socket.on("admin-updated", (admin) => {
      setAdmins((prev) => {
        const exists = prev.find((a) => a._id === admin._id);
        if (exists) return prev.map((a) => a._id === admin._id ? admin : a);
        return [...prev, admin];
      });
    });

    socket.on("admin-deleted", (deletedAdmin) => {
      setAdmins((prev) => prev.filter((a) => a._id !== deletedAdmin._id));
    });

    return () => {
      socket.off("admin-updated");
      socket.off("admin-deleted");
      socket.disconnect();               // fix: always disconnect on unmount
    };
  }, []);

  const filtered = admins.filter(
    (a) =>
      a.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-3xl font-bold text-emerald-400">
            All Admins
          </h1>
          <div className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700">
            <Search className="w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search admins..."
              className="bg-transparent text-zinc-100 outline-none w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
          <div className="p-6 border-b border-zinc-700">
            <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Admin Management
            </h2>
          </div>
          <div className="p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  {["Name", "Email", "Phone", "Role"].map((h) => (
                    <th key={h} className="text-left p-3 text-zinc-400 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((admin) => (
                  <tr key={admin._id} className="border-b border-zinc-700">
                    <td className="p-3 text-zinc-100">{admin.fullName}</td>
                    <td className="p-3 text-zinc-100">{admin.email}</td>
                    <td className="p-3 text-zinc-100">{admin.phone}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium
                        bg-emerald-500/20 text-emerald-500 border border-emerald-500/50">
                        {admin.role}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-zinc-500">
                      No admins found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllAdmins;