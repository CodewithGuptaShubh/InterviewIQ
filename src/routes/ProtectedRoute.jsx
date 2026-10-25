import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useApp } from "../state/AppContext.jsx";

export function ProtectedRoute({ children }) {
  const { user, authLoading } = useApp();
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-foreground" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}
