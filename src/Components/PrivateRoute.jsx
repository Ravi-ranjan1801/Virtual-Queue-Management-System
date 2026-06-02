import { Navigate } from "react-router-dom";

// Checks correct token based on route type
// LLD: Single Responsibility — one component handles all auth guards
const PrivateRoute = ({ children, role = "admin" }) => {
  const token =
    role === "admin"
      ? localStorage.getItem("adminToken")
      : localStorage.getItem("userToken");

  return token ? children : <Navigate to="/login" />;
};

export default PrivateRoute;