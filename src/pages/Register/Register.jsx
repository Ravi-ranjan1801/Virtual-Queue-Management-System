import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API_URL from "../../config/api";

const validate = (fields, role) => {
  const errors = {};
  if (!fields.fullName.trim()) errors.fullName = "Full name is required";
  if (!fields.email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errors.email = "Enter a valid email address";
  if (!fields.phone.trim()) errors.phone = "Phone number is required";
  else if (!/^\d{10}$/.test(fields.phone))
    errors.phone = "Phone must be exactly 10 digits";
  if (role === "Admin") {
    if (!fields.password.trim()) errors.password = "Password is required";
    else if (fields.password.length < 6)
      errors.password = "Minimum 6 characters";
    if (!fields.adminSecret.trim())
      errors.adminSecret = "Admin secret code is required";
  }
  if (role === "User" && !fields.selectedAdmin)
    errors.selectedAdmin = "Please select a queue to join";
  return errors;
};

// ── Defined OUTSIDE component — never recreated on render ─────────────────
const InputField = ({ label, name, type = "text", placeholder, autoComplete, fields, errors, onChange }) => (
  <div>
    <label className="text-white block mb-1 text-sm font-medium">{label}</label>
    <input
      type={type}
      name={name}
      value={fields[name]}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={`w-full p-3 bg-zinc-700 text-white rounded-lg focus:outline-none focus:ring-2
        ${errors[name]
          ? "border border-red-500 focus:ring-red-500"
          : "border border-zinc-600 focus:ring-blue-500"
        }`}
    />
    {errors[name] && (
      <p className="text-red-400 text-xs mt-1">{errors[name]}</p>
    )}
  </div>
);

const Register = () => {
  const navigate = useNavigate();

  const [fields, setFields] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    adminSecret: "",
    selectedAdmin: "",
  });
  const [role, setRole] = useState("User");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      if (!/^\d*$/.test(value)) return;
      if (value.length > 10) return;
    }
    setFields((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setServerError("");
    const validationErrors = validate(fields, role);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      fullName: fields.fullName,
      email: fields.email,
      phone: fields.phone,
      role,
      ...(role === "Admin" && {
        password: fields.password,
        adminSecret: fields.adminSecret,
      }),
      ...(role === "User" && { admin: fields.selectedAdmin }),
    };

    const url = role === "User" ? "/user/register" : "/admin/register";

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok) {
       if (role === "User") {
  localStorage.setItem("userToken", result.token);
  window.open(`/user/${result.data._id}`, "_blank");
} else {
  localStorage.setItem("adminToken", result.token);
  window.open(`/admin/${result.data._id}`, "_blank");
}
// Reset form after opening new tab
setFields({
  fullName: "",
  email: "",
  phone: "",
  password: "",
  adminSecret: "",
  selectedAdmin: "",
});
setRole("User");
setErrors({});
setServerError("");
      } else {
        setServerError(result.error || "Registration failed. Please try again.");
      }
    } catch {
      setServerError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const res = await fetch(`${API_URL}/admins`);
        const result = await res.json();
        setAdmins(result.data || []);
      } catch {
        console.error("Failed to fetch admins");
      }
    };
    fetchAdmins();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center py-8">
      <div className="bg-zinc-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-white text-2xl font-bold mb-1 text-center">
          Create an Account
        </h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
          Enter your information to join a queue
        </p>

        {serverError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm text-center">{serverError}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Pass fields, errors, onChange as props — InputField is stable outside */}
          <InputField
            label="Full Name"
            name="fullName"
            placeholder="Enter your full name"
            autoComplete="name"
            fields={fields}
            errors={errors}
            onChange={handleChange}
          />
          <InputField
            label="Email"
            name="email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            fields={fields}
            errors={errors}
            onChange={handleChange}
          />
          <InputField
            label="Mobile Number (10 digits)"
            name="phone"
            type="tel"
            placeholder="Enter your 10-digit mobile number"
            autoComplete="tel"
            fields={fields}
            errors={errors}
            onChange={handleChange}
          />

          <div>
            <label className="text-white block mb-2 text-sm font-medium">
              Account Type
            </label>
            <div className="flex space-x-6">
              {["User", "Admin"].map((r) => (
                <label key={r} className="flex items-center text-white cursor-pointer">
                  <input
                    type="radio"
                    name="accountType"
                    value={r}
                    checked={role === r}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setErrors({});
                      setServerError("");
                    }}
                    className="mr-2"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {role === "Admin" && (
            <>
              <InputField
                label="Password"
                name="password"
                type="password"
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                fields={fields}
                errors={errors}
                onChange={handleChange}
              />
              <InputField
                label="Admin Secret Code"
                name="adminSecret"
                type="password"
                placeholder="Enter the admin registration code"
                fields={fields}
                errors={errors}
                onChange={handleChange}
              />
            </>
          )}

          {role === "User" && (
            <div>
              <label className="text-white block mb-1 text-sm font-medium">
                Select Queue to Join
              </label>
              <select
                name="selectedAdmin"
                value={fields.selectedAdmin}
                onChange={handleChange}
                className={`w-full p-3 bg-zinc-700 text-white rounded-lg focus:outline-none focus:ring-2
                  ${errors.selectedAdmin
                    ? "border border-red-500 focus:ring-red-500"
                    : "border border-zinc-600 focus:ring-blue-500"
                  }`}
              >
                <option value="" disabled>Select a queue</option>
                {admins.map((admin) => (
                  <option key={admin._id} value={admin._id}>
                    {admin.fullName}
                  </option>
                ))}
              </select>
              {errors.selectedAdmin && (
                <p className="text-red-400 text-xs mt-1">{errors.selectedAdmin}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700
              transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-white text-sm">
            Already have an account?{" "}
            <span className="text-blue-400 hover:underline">Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;