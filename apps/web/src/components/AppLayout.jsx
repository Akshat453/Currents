import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  CalendarClock,
  Car,
  Gauge,
  LogOut,
  Map,
  Menu,
  ReceiptText,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { Brand } from "./Brand.jsx";
import { api, dataOf } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";
import { useSocket } from "../hooks/useSocket.js";

const links = [
  ["/app", Map, "Discover"],
  ["/app/bookings", CalendarClock, "Bookings"],
  ["/app/sessions", Gauge, "Sessions"],
  ["/app/wallet", WalletCards, "Wallet"],
  ["/app/payments", ReceiptText, "Payments"],
  ["/app/vehicles", Car, "Vehicles"],
  ["/app/favorites", Bookmark, "Favorites"],
  ["/app/profile", UserRound, "Profile"]
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [menu, setMenu] = useState(false);
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => dataOf(api.get("/notifications"))
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => dataOf(api.get("/sessions"))
  });
  const active = sessions.find((session) => session.status === "charging");

  useEffect(() => {
    if (!socket) return undefined;
    const handler = (item) =>
      queryClient.setQueryData(["notifications"], (old) => [item, ...(old || [])]);
    socket.on("notification", handler);
    return () => socket.off("notification", handler);
  }, [socket, queryClient]);

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    clear();
    navigate("/");
  };
  const navigation = (close = false) => (
    <nav className="side-nav">
      {links.map(([to, Icon, label], index) => (
        <NavLink
          end={index === 0}
          className="side-link"
          to={to}
          key={to}
          onClick={close ? () => setMenu(false) : undefined}
        >
          <Icon size={17} /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        {navigation()}
        <div className="side-bottom">
          <button className="side-link logout-link" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-top">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={18} />
          </button>
          <span className="muted top-greeting">
            Good drive, <strong>{user?.fullName?.split(" ")[0]}</strong>
          </span>
          <div className="top-actions">
            {active && (
              <Link to={`/app/sessions/${active.id}`} className="live-pill">
                Charging · {Number(active.energyDeliveredKwh).toFixed(1)} kWh
              </Link>
            )}
            <Link
              className="icon-btn notification-button"
              to="/app/notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
              {notifications.some((item) => !item.isRead) && <i />}
            </Link>
          </div>
        </header>
        {menu && (
          <div className="dialog-backdrop">
            <div className="dialog">
              <div className="dialog-head">
                <Brand />
                <button
                  className="icon-btn"
                  onClick={() => setMenu(false)}
                  aria-label="Close navigation"
                >
                  <X size={17} />
                </button>
              </div>
              {navigation(true)}
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
