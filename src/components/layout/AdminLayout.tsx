import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AdminLayout() {
  const session = localStorage.getItem("bookmeet_session");

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
