import { Routes, Route, Navigate } from "react-router";
import "./App.css";
import Register from "./pages/Register/Register";
import AdminPage from "./pages/Admin/AdminPage";
import UserPage from "./pages/UserPages/UserPage";
import EditAdminPage from "./pages/Admin/EditAdminPage";
import Login from "./pages/Login/Login";
import AllAdmins from "./pages/AllAdmins";
import PrivateRoute from "./Components/PrivateRoute";

function App() {
  return (
    <div className="bg-[#1e1e20] w-screen h-screen overflow-x-hidden">
      <Routes>
        {/* Public routes */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/register" />} />

        {/* User protected route */}
        <Route
          path="/user/:user_id"
          element={
            <PrivateRoute role="user">
              <UserPage />
            </PrivateRoute>
          }
        />

        {/* Admin protected routes */}
        <Route
          path="/admin/:admin_id"
          element={
            <PrivateRoute role="admin">
              <AdminPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/edit/:adminId"
          element={
            <PrivateRoute role="admin">
              <EditAdminPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admins"
          element={
            <PrivateRoute role="admin">
              <AllAdmins />
            </PrivateRoute>
          }
        />

        {/* Catch all — redirect to register */}
        <Route path="*" element={<Navigate to="/register" />} />
      </Routes>
    </div>
  );
}

export default App;