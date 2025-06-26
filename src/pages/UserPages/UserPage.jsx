import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Mail, Phone, Clock, LogOut } from "lucide-react";
import io from "socket.io-client";
import { FormatTime } from "../../Components/FormatTime";


const UserPage = () => {
  const { user_id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const socket = io(`http://localhost:3000/user/${user_id}`);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`http://localhost:3000/user/${user_id}`);
        const result = await response.json();
        setUser(result.data);
      } catch (error) {
        console.log("Error fetching user:", error);
      }
    };

    fetchUser();
    socket.on("time-updated", (users) => {
      setUser(users.filter((user) => user._id === user_id)[0]);
    });
    socket.on("user-updated", (user) => {
      setUser((prevResponse) => [...prevResponse, user]);
    });

    return () => {
      socket.off("time-updated");
      socket.off("user-updated");
    };
  }, [socket, user_id]);

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    navigate("/login");
  };

  if (!user) {
    return <div className="h-screen w-screen flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="bg-zinc-800 p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-white mb-6">
          User Details
        </h2>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-orange-500" />
              </div>
              <div className="space-y-1 flex items-center w-full">
                <p className="text-sm text-[#bbb] font-medium">Full Name :</p>
                <p className="font-medium text-[#eee] ml-4">{user.fullName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-orange-500" />
              </div>
              <div className="space-y-1 flex items-center w-full">
                <p className="text-sm text-[#bbb] font-medium">Email :</p>
                <p className="font-medium text-[#eee] ml-4">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-orange-500" />
              </div>
              <div className="space-y-1 flex items-center w-full">
                <p className="text-sm text-[#bbb] font-medium">Phone :</p>
                <p className="font-medium text-[#eee] ml-4">{user.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <div className="space-y-1 flex items-center">
                <p className="text-sm text-[#bbb] font-medium">
                  Time Remaining :
                </p>
                <p className="font-medium text-orange-500 ml-4">
                  {FormatTime(user.timeRemaining)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600 flex items-center justify-center"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserPage;
