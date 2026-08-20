import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Cable, CircleDollarSign, Clock3, Plus, Radio, X } from "lucide-react";
import { api, dataOf } from "../lib/api.js";
const Empty = ({ children }) => <div className="empty">{children}</div>;
export function OperatorDashboard() {
  const { data: kpi = {} } = useQuery({
    queryKey: ["operator-kpi"],
    queryFn: () => dataOf(api.get("/operator/analytics/dashboard"))
  });
  const { data: revenue = [] } = useQuery({
    queryKey: ["operator-revenue"],
    queryFn: () => dataOf(api.get("/operator/analytics/revenue?range=7d"))
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Today · network live</span>
          <h1>Operations overview</h1>
        </div>
        <span className="live-pill">Monitoring</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon={Cable} label="Sessions today" value={kpi.sessionsToday || 0} />
        <Kpi
          icon={CircleDollarSign}
          label="Revenue today"
          value={`₹${Number(kpi.revenueToday || 0).toFixed(0)}`}
        />
        <Kpi icon={Radio} label="Active chargers" value={kpi.activeChargers || 0} />
        <Kpi
          icon={Clock3}
          label="Avg session"
          value={`${Number(kpi.averageSessionMinutes || 0).toFixed(0)}m`}
        />
      </div>
      <section className="card" style={{ height: 380, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 22, margin: 0 }}>Revenue</h3>
            <p className="muted">Completed charging sessions · last 7 days</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height="78%">
          <AreaChart data={revenue}>
            <defs>
              <linearGradient id="copperFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9622F" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#C9622F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#DFD9CC" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6F6B61" }} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6F6B61" }} axisLine={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#C9622F"
              strokeWidth={2}
              fill="url(#copperFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
function Kpi({ icon: Icon, label, value }) {
  return (
    <article className="kpi">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="label">{label}</span>
        <Icon size={17} color="var(--copper-500)" />
      </div>
      <strong className="tabular">{value}</strong>
    </article>
  );
}

export function StationsManagePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    latitude: 12.9716,
    longitude: 77.5946,
    basePricePerKwh: 18,
    is24x7: true
  });
  const { data: stations = [] } = useQuery({
    queryKey: ["operator-stations"],
    queryFn: () => dataOf(api.get("/operator/stations"))
  });
  const add = useMutation({
    mutationFn: () => dataOf(api.post("/operator/stations", form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operator-stations"] });
      setOpen(false);
    }
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Network inventory</span>
          <h1>Stations & chargers</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Add station
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Station</th>
            <th>Location</th>
            <th>Chargers</th>
            <th>Availability</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.name}</strong>
                <br />
                <small className="muted">₹{Number(s.basePricePerKwh).toFixed(1)}/kWh</small>
              </td>
              <td>{s.city}</td>
              <td>{s.chargers.length}</td>
              <td>{s.chargers.filter((c) => c.status === "available").length} ready</td>
              <td>
                <span className="status success">{s.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!stations.length && <Empty>No stations assigned yet.</Empty>}
      {open && (
        <div className="dialog-backdrop">
          <form
            className="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <div className="dialog-head">
              <h2>Add station</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="form-stack">
              {[
                ["name", "Station name"],
                ["address", "Street address"],
                ["city", "City"],
                ["latitude", "Latitude"],
                ["longitude", "Longitude"],
                ["basePricePerKwh", "Base price per kWh"]
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    required
                    className="input"
                    type={
                      ["latitude", "longitude", "basePricePerKwh"].includes(key) ? "number" : "text"
                    }
                    step="any"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
              <button className="btn btn-primary">Create station</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function OperatorSessionsPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["operator-sessions"],
    queryFn: () => dataOf(api.get("/operator/sessions")),
    refetchInterval: 15000
  });
  const stop = useMutation({
    mutationFn: (id) =>
      dataOf(
        api.post(`/operator/sessions/${id}/force-stop`, { reason: "Stopped from operator console" })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator-sessions"] })
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Live floor</span>
          <h1>Active sessions</h1>
        </div>
        <span className="live-pill">{items.length} live</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Driver</th>
            <th>Station / charger</th>
            <th>Started</th>
            <th>Energy</th>
            <th>Power</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>
                {s.user.fullName}
                <br />
                <small>
                  {s.vehicle?.make} {s.vehicle?.model}
                </small>
              </td>
              <td>
                {s.charger.station.name}
                <br />
                <small>{s.charger.chargerIdentifier}</small>
              </td>
              <td>{new Date(s.startTime).toLocaleTimeString()}</td>
              <td className="tabular">{Number(s.energyDeliveredKwh).toFixed(2)} kWh</td>
              <td className="tabular">{Number(s.averagePowerKw || 0).toFixed(1)} kW</td>
              <td>
                <button
                  className="btn btn-danger"
                  onClick={() => confirm("Force stop this session?") && stop.mutate(s.id)}
                >
                  Force stop
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty>No active sessions across your network.</Empty>}
    </div>
  );
}

export function PricingRulesPage() {
  const qc = useQueryClient();
  const [stationId, setStationId] = useState("");
  const [form, setForm] = useState({
    name: "Peak hours",
    startTime: "17:00",
    endTime: "21:00",
    daysOfWeek: [1, 2, 3, 4, 5],
    priceMultiplier: 1.2
  });
  const { data: stations = [] } = useQuery({
    queryKey: ["operator-stations"],
    queryFn: () => dataOf(api.get("/operator/stations"))
  });
  const selected = stationId || stations[0]?.id;
  const { data: rules = [] } = useQuery({
    queryKey: ["pricing", selected],
    queryFn: () => dataOf(api.get(`/operator/stations/${selected}/pricing-rules`)),
    enabled: !!selected
  });
  const add = useMutation({
    mutationFn: () => dataOf(api.post(`/operator/stations/${selected}/pricing-rules`, form)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing", selected] })
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Rate control</span>
          <h1>Pricing rules</h1>
        </div>
      </div>
      <div className="split">
        <section className="card">
          <label className="field">
            Station
            <select
              className="input"
              value={selected || ""}
              onChange={(e) => setStationId(e.target.value)}
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-stack">
            <label className="field">
              Rule name
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="field">
                Start
                <input
                  className="input"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </label>
              <label className="field">
                End
                <input
                  className="input"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              Multiplier
              <input
                className="input"
                type="number"
                min="0.5"
                max="3"
                step="0.05"
                value={form.priceMultiplier}
                onChange={(e) => setForm({ ...form, priceMultiplier: Number(e.target.value) })}
              />
            </label>
            <button className="btn btn-primary" disabled={!selected} onClick={() => add.mutate()}>
              Add pricing rule
            </button>
          </div>
        </section>
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Active rules</h3>
          {rules.map((r) => (
            <div key={r.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.name}</strong>
                <span className="status">×{Number(r.priceMultiplier).toFixed(2)}</span>
              </div>
              <small className="muted">
                {new Date(r.startTime).toISOString().slice(11, 16)}–
                {new Date(r.endTime).toISOString().slice(11, 16)} · {r.daysOfWeek.length} days
              </small>
            </div>
          ))}
          {!rules.length && <Empty>No pricing rules for this station.</Empty>}
        </section>
      </div>
    </div>
  );
}
