import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const EditUserPage = () => {
  const { user_id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState({
    fullName: "",
    email: "",
    phone: "",
  });

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
  }, [user_id]);

  const handleUpdate = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`http://localhost:3000/user/${user_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });

      if (response.ok) {
        navigate(-1);
      } else {
        console.log("Error updating user");
      }
    } catch (error) {
      console.log("Error updating user:", error);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setUser((prevUser) => ({
      ...prevUser,
      [name]: value,
    }));
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900">
      <div className="bg-zinc-800 p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          Edit User
        </h2>
        <form onSubmit={handleUpdate} className="flex flex-col gap-4 ">
          <div className="space-y-2">
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-300"
            >
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={user.fullName}
              onChange={handleChange}
              placeholder="Full Name"
              className="w-full p-2 border rounded bg-zinc-700 text-white border-gray-600"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={user.email}
              onChange={handleChange}
              placeholder="Email"
              className="w-full p-2 border rounded bg-zinc-700 text-white border-gray-600"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-300"
            >
              Mobile Number
            </label>
            <input
              type="tel"
              name="phone"
              id="phone"
              value={user.phone}
              onChange={handleChange}
              placeholder="Phone"
              className="w-full p-2 border rounded bg-zinc-700 text-white border-gray-600"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="time"
              className="block text-sm font-medium text-gray-300"
            >
              Time Remaining
            </label>
            <input
              type="number"
              name="timeRemaining"
              id="time"
              value={user.timeRemaining}
              onChange={handleChange}
              placeholder="Time"
              className="w-full p-2 border rounded bg-zinc-700 text-white border-gray-600"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 mt-8"
          >
            Update
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditUserPage;
