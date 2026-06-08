import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { to: "/admin/create", label: "Create Link", icon: "M12 4v16m8-8H4" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-gray-200 bg-white min-h-screen flex flex-col">
      <div className="px-6 py-6">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          BookMeet
        </h1>
        <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">
          Scheduling
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-100 text-green-800"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )
            }
          >
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={item.icon}
              />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">calvin@airops.com</p>
      </div>
    </aside>
  );
}
