import { Routes, Route, Navigate } from "react-router";
import "./App.css";
import Register from "./pages/Register/Register";
import AdminPage from "./pages/Admin/AdminPage";
import UserPage from "./pages/UserPages/UserPage";
import EditUserPage from "./pages/UserPages/EditUserPage";
import EditAdminPage from "./pages/Admin/EditAdminPage";
import Login from "./pages/Login/Login";
import AllAdmins from "./pages/AllAdmins";
import PrivateRoute from "./Components/PrivateRoute";

function App() {
  return (
    <div className="bg-[#1e1e20] w-screen h-screen overflow-x-hidden">
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/register" />} />
        <Route
          path="/admin/:admin_id"
          element={
            <PrivateRoute>
              <AdminPage />
            </PrivateRoute>
          }
        />
        <Route path="/user/:user_id" element={<UserPage />} />
        <Route
          path="/user/edit/:user_id"
          element={
            <PrivateRoute>
              <EditUserPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admins"
          element={
            <PrivateRoute>
              <AllAdmins />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/edit/:adminId"
          element={
            <PrivateRoute>
              <EditAdminPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
