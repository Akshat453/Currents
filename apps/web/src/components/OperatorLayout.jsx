import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { BarChart3, Cable, Command, LogOut, Radio, Tags } from "lucide-react";
import { Brand } from "./Brand.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";
const actions = [
  ["/operator", BarChart3, "Overview"],
  ["/operator/stations", Cable, "Stations & chargers"],
  ["/operator/sessions", Radio, "Live sessions"],
  ["/operator/pricing", Tags, "Pricing rules"]
];
export function OperatorLayout() {
  const [palette, setPalette] = useState(false);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    clear();
    navigate("/");
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <small className="muted" style={{ marginTop: 8 }}>
          OPERATOR CONSOLE
        </small>
        <nav className="side-nav">
          {actions.map(([to, Icon, label], i) => (
            <NavLink end={i === 0} className="side-link" to={to} key={to}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <button className="side-link" onClick={logout} style={{ border: 0, background: "none" }}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-top">
          <span className="muted" style={{ fontSize: 13 }}>
            Network operations
          </span>
          <button className="btn btn-secondary" onClick={() => setPalette(true)}>
            <Command size={15} />
            Search <kbd>⌘K</kbd>
          </button>
        </header>
        <Outlet />
      </main>
      {palette && (
        <div className="command" onClick={() => setPalette(false)}>
          <div className="command-box" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              placeholder="Search stations, chargers, or actions…"
              aria-label="Command search"
            />
            <div className="command-list">
              {actions.map(([to, , label]) => (
                <Link key={to} to={to} onClick={() => setPalette(false)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
