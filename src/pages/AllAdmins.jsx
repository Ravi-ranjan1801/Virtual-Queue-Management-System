import { useState, useEffect } from "react";
import { Search, UserCog } from "lucide-react";
import io from "socket.io-client";

const socket = io("http://localhost:3000");

const AllAdmins = () => {
  const [admin, setAdmin] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetch("http://localhost:3000/admins");
        const result = await data.json();
        console.log("Fetched data:", result);
        setAdmin(result.data);
      } catch (error) {
        console.log("Error fetching data:", error);
      }
    };
    fetchData();

    socket.on("admin-updated", (admin) => {
      setAdmin((prevResponse) => [...prevResponse, admin]);
    });

    socket.on("admin-deleted", (deletedAdmin) => {
      setAdmin((prevResponse) =>
        prevResponse.filter((admin) => admin._id !== deletedAdmin._id)
      );
    });

    return () => {
      socket.off("admin-updated");
      socket.off("admin-deleted");
    };
  }, []);

  const filteredUsers = admin.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-3xl font-bold text-emerald-400">
            <span>Here are all admins in the system</span>
          </h1>

          <div className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700">
            <Search className="w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search admins..."
              className="bg-transparent border-none text-zinc-100 outline-none w-64"
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
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left p-3 text-zinc-400 font-medium">
                      Username
                    </th>
                    <th className="text-left p-3 text-zinc-400 font-medium">
                      Email
                    </th>
                    <th className="text-left p-3 text-zinc-400 font-medium">
                      Phone
                    </th>
                    <th className="text-left p-3 text-zinc-400 font-medium">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((admin) => (
                    <tr key={admin._id} className="border-b border-zinc-700">
                      <td className="p-3 text-zinc-100">{admin.fullName}</td>
                      <td className="p-3 text-zinc-100">{admin.email}</td>
                      <td className="p-3 text-zinc-100">{admin.phone}</td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-500 border-emerald-500/50">
                          {admin.role}
                        </span>
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllAdmins;
