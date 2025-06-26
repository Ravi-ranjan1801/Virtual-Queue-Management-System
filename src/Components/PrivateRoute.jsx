
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('adminToken'); // Check if the token exists in localStorage

  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
