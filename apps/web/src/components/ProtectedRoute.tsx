import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface Props {
  children: ReactNode;
}

function ProtectedRoute({ children }: Props) {
  const { status } = useAuth();

  if (status === "loading") return null;
  //if (status === "anon") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default ProtectedRoute;
