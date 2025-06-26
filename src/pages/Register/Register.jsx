import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Register = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("User");
  const [isError, setIsError] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [admins, setAdmins] = useState([]);

  const handleRegister = async (event) => {
    event.preventDefault();
    const data = {
      fullName: fullName,
      email: email,
      phone: phone,
      role: role,
      ...(role === "Admin" && { password: password }),
      ...(role === "User" && { admin: selectedAdmin }),
    };

    const url = role === "User" ? "/user/register" : "/admin/register";

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
        console.log("Registration successful, user ID:", result.data._id);
        if (role === "User") {
          window.open(`/user/${result.data._id}`);
        }
        if (role === "Admin") {
          window.open(`/admin/${result.data._id}`);
        }
        setFullName("");
        setEmail("");
        setPhone("");
        setSelectedAdmin("");
        setPassword("");
        setIsError(false);
      } else {
        console.log("Error registering user");
        setIsError(true);
      }
    } catch (error) {
      console.log("Error registering user:", error);
      setIsError(true);
    }
  };

  const getAlladmins = async () => {
    try {
      const response = await fetch("http://localhost:3000/admins");
      if (response.ok) {
        const result = await response.json();
        setAdmins(result.data);
      } else {
        console.log("Error fetching all admins");
      }
    } catch (error) {
      console.log("Error fetching all admins:", error);
    }
  };

  useEffect(() => {
    getAlladmins();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="bg-zinc-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-white text-2xl font-bold mb-2 text-center">
          Create an Account
        </h2>
        <p className="text-gray-400 text-center mb-6">
          Enter your information to create an account
        </p>

        <form onSubmit={handleRegister} className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="text-white block mb-2">Full Name</label>
            <input
              type="text"
              name="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className={`w-full p-3 bg-zinc-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isError ? "border-red-500" : "border-zinc-600"
              }`}
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-white block mb-2">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className={`w-full p-3 bg-zinc-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isError ? "border-red-500" : "border-zinc-600"
              }`}
            />
          </div>

          {/* Mobile Number */}
          <div>
            <label className="text-white block mb-2">Mobile Number</label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your mobile number"
              className={`w-full p-3 bg-zinc-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isError ? "border-red-500" : "border-zinc-600"
              }`}
            />
          </div>

          {/* Account Type */}
          <div>
            <label className="text-white block mb-2">Account Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center text-white">
                <input
                  type="radio"
                  id="user"
                  name="accountType"
                  value="User"
                  checked={role === "User"}
                  onChange={(e) => setRole(e.target.value)}
                  className="mr-2"
                />
                User
              </label>
              <label className="flex items-center text-white">
                <input
                  type="radio"
                  id="admin"
                  name="accountType"
                  value="Admin"
                  checked={role === "Admin"}
                  onChange={(e) => setRole(e.target.value)}
                  className="mr-2"
                />
                Admin
              </label>
            </div>
          </div>
          {role === "Admin" && (
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                placeholder="Enter password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full p-2 border rounded bg-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isError ? "border-red-500" : "border-zinc-600"
                }`}
              />
            </div>
          )}

          {role === "User" && (
            <div className="space-y-2">
              <label
                htmlFor="selectedAdmin"
                className="block text-sm font-medium text-gray-300 "
              >
                User Type
              </label>
              <select
                id="selectedAdmin"
                value={selectedAdmin}
                onChange={(e) => setSelectedAdmin(e.target.value)}
                className={`w-full p-2 border rounded bg-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isError ? "border-red-500" : "border-gray-600"
                }`}
              >
                <option disabled value="">
                  Select Admin
                </option>
                {admins.map((admin) => (
                  <option key={admin._id} value={admin._id}>
                    {admin.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Register
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/login" target="blank" className="text-white">
            Already have an account?{" "}
            <span className="text-blue-400 hover:underline">Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
