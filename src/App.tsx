import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import CreateLink from "./pages/admin/CreateLink";
import BookingPage from "./pages/booking/BookingPage";
import Confirmation from "./pages/booking/Confirmation";
import AdminLayout from "./components/layout/AdminLayout";

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="create" element={<CreateLink />} />
      </Route>
      <Route path="/book/:linkId" element={<BookingPage />} />
      <Route path="/book/:linkId/confirmed" element={<Confirmation />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
