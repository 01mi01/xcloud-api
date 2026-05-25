import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Placeholder from "./pages/Placeholder";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

function FallbackRoute() {
  const { status } = useAuth();
  if (status === "loading") return null;
  return <Navigate to={status === "authed" ? "/home" : "/login"} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      {/* Pages not yet built — show placeholder instead of redirecting */}
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <Placeholder title="Search" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Placeholder title="Notifications" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute>
            <Placeholder title="Bookmarks" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/following"
        element={
          <ProtectedRoute>
            <Placeholder title="Following" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Placeholder title="Profile" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<FallbackRoute />} />
    </Routes>
  );
}

export default App;
