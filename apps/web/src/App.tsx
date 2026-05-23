import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Placeholder from "./pages/Placeholder";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/home" element={<Home />} />
      {/* Pages not yet built — show placeholder instead of redirecting */}
      <Route path="/search" element={<Placeholder title="Search" />} />
      <Route path="/notifications" element={<Placeholder title="Notifications" />} />
      <Route path="/bookmarks" element={<Placeholder title="Bookmarks" />} />
      <Route path="/following" element={<Placeholder title="Following" />} />
      <Route path="/profile" element={<Placeholder title="Profile" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;