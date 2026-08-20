import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Car, Check, Plus, Star, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, dataOf } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";
import { StationCard } from "../components/StationCard.jsx";
import { useSocket } from "../hooks/useSocket.js";
import { StripePaymentDialog } from "../components/StripePaymentDialog.jsx";
const Empty = ({ children }) => <div className="empty">{children}</div>;

export function BookingsPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => dataOf(api.get("/bookings"))
  });
  const start = useMutation({
    mutationFn: (b) => dataOf(api.post("/sessions", { bookingId: b.id, batteryPercent: 35 })),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      location.href = `/app/sessions/${s.id}`;
    }
  });
  const cancel = useMutation({
    mutationFn: (id) => dataOf(api.patch(`/bookings/${id}/cancel`, { reason: "Plans changed" })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] })
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Your route plan</span>
          <h1>Bookings</h1>
        </div>
      </div>
      <div className="list">
        {items.map((b) => (
          <article className="card" key={b.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                alignItems: "center"
              }}
            >
              <div>
                <span className={`status ${b.status === "confirmed" ? "success" : ""}`}>
                  {b.status}
                </span>
                <h3 style={{ fontSize: 22, margin: "10px 0 4px" }}>{b.station.name}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {new Date(b.startTime).toLocaleString()} · {b.charger?.connectorType}{" "}
                  {Number(b.charger?.maxPowerKw)} kW
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {b.status === "confirmed" &&
                  Math.abs(new Date(b.startTime) - Date.now()) < 45 * 60e3 && (
                    <button className="btn btn-primary" onClick={() => start.mutate(b)}>
                      Start charge
                    </button>
                  )}
                {b.status === "confirmed" && new Date(b.startTime) - Date.now() > 30 * 60e3 && (
                  <button className="btn btn-secondary" onClick={() => cancel.mutate(b.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {!isLoading && !items.length && (
          <Empty>No bookings yet. Pick a station from the map to reserve a plug.</Empty>
        )}
      </div>
    </div>
  );
}

export function SessionsPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => dataOf(api.get("/sessions"))
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Energy history</span>
          <h1>Charging sessions</h1>
        </div>
      </div>
      <div className="list">
        {items.map((s) => (
          <Link
            className={`station-card ${s.status === "charging" ? "live-edge" : ""}`}
            to={`/app/sessions/${s.id}`}
            key={s.id}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                {s.status === "charging" ? (
                  <span className="live-pill">Charging now</span>
                ) : (
                  <span className="status">{s.status}</span>
                )}
                <h3 style={{ marginTop: 10 }}>{s.charger?.station.name || "Charging session"}</h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {new Date(s.startTime).toLocaleString()}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong className="display tabular" style={{ fontSize: 26 }}>
                  {Number(s.energyDeliveredKwh).toFixed(1)} kWh
                </strong>
                <br />
                <small className="muted">
                  {s.totalCost ? `₹${Number(s.totalCost).toFixed(2)}` : "In progress"}
                </small>
              </div>
            </div>
          </Link>
        ))}
        {!isLoading && !items.length && (
          <Empty>Your completed and active charges will appear here.</Empty>
        )}
      </div>
    </div>
  );
}

export function ActiveSessionPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const socket = useSocket();
  const navigate = useNavigate();
  const [paymentFlow, setPaymentFlow] = useState(null);
  const { data: session } = useQuery({
    queryKey: ["session", id],
    queryFn: () => dataOf(api.get(`/sessions/${id}`)),
    refetchInterval: (s) => (s.state.data?.status === "charging" ? false : 30000)
  });
  const stop = useMutation({
    mutationFn: () => dataOf(api.patch(`/sessions/${id}/stop`)),
    onSuccess: (s) => qc.setQueryData(["session", id], (old) => ({ ...old, ...s }))
  });
  const pay = useMutation({
    mutationFn: () =>
      dataOf(api.post("/payments/initiate", { sessionId: id, paymentMethod: "card" })),
    onSuccess: setPaymentFlow
  });
  const confirmPayment = async (paymentIntentId, fake = false) => {
    await api.post("/payments/verify", {
      paymentId: paymentFlow.payment.id,
      paymentIntentId,
      confirmation: fake ? "fake_verified" : undefined
    });
    setPaymentFlow(null);
    qc.invalidateQueries({ queryKey: ["session", id] });
  };
  const wallet = useMutation({
    mutationFn: () => dataOf(api.post("/wallet/pay", { sessionId: id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", id] })
  });
  useEffect(() => {
    if (!socket) return undefined;
    socket.emit("join_session", id);
    const onUpdate = (event) => {
      if (event.sessionId === id)
        qc.setQueryData(["session", id], (old) =>
          old
            ? {
                ...old,
                ...event,
                endBatteryPercent: event.batteryPercent,
                averagePowerKw: event.powerKw
              }
            : old
        );
    };
    socket.on("session_update", onUpdate);
    return () => socket.off("session_update", onUpdate);
  }, [socket, id, qc]);
  if (!session) return <div className="app-content">Connecting to your charger…</div>;
  const battery = session.endBatteryPercent ?? session.startBatteryPercent ?? 20;
  const paid =
    session.paymentStatus === "completed" ||
    session.payments?.some((p) => p.status === "completed");
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {session.status === "charging" ? "LIVE SESSION" : "SESSION RECEIPT"}
          </span>
          <h1>{session.charger?.station.name}</h1>
        </div>
        {session.status === "charging" && <span className="live-pill">Power flowing</span>}
      </div>
      <div className="split">
        <section className="card" style={{ background: "var(--ink-900)" }}>
          <div className="progress-wrap">
            <div className="progress-ring" style={{ "--progress": `${battery}%` }}>
              <div className="progress-copy">
                <strong className="tabular">{battery}%</strong>
                <span className="tabular">{Number(session.averagePowerKw || 0).toFixed(1)} kW</span>
              </div>
            </div>
          </div>
          <div className="metric-row" style={{ color: "var(--canvas)" }}>
            <div className="metric" style={{ borderColor: "var(--ink-700)" }}>
              <strong>{Number(session.energyDeliveredKwh).toFixed(2)}</strong>
              <small style={{ color: "var(--ink-300)" }}>kWh delivered</small>
            </div>
            <div className="metric" style={{ borderColor: "var(--ink-700)" }}>
              <strong>
                {Math.max(
                  0,
                  Math.round(
                    ((80 - battery) /
                      ((Math.max(1, Number(session.averagePowerKw)) /
                        Number(session.vehicle?.batteryCapacityKwh || 60)) *
                        100)) *
                      60
                  )
                )}
                m
              </strong>
              <small style={{ color: "var(--ink-300)" }}>estimated left</small>
            </div>
            <div className="metric" style={{ borderColor: "var(--ink-700)" }}>
              <strong>₹{Number(session.totalCost || 0).toFixed(0)}</strong>
              <small style={{ color: "var(--ink-300)" }}>running total</small>
            </div>
          </div>
        </section>
        <aside>
          <div className="card">
            <h3 style={{ fontSize: 24, marginTop: 0 }}>
              {session.status === "charging" ? "Charging controls" : "Payment"}
            </h3>
            {session.status === "charging" ? (
              <>
                <p className="muted">
                  Stop when you have enough range. You’ll pay only for energy delivered.
                </p>
                <button
                  className="btn btn-danger"
                  style={{ width: "100%" }}
                  onClick={() => confirm("Stop charging now?") && stop.mutate()}
                >
                  Stop charging
                </button>
              </>
            ) : paid ? (
              <>
                <p>
                  <Check size={18} color="var(--success)" style={{ display: "inline" }} /> Payment
                  complete
                </p>
                <strong className="display" style={{ fontSize: 34 }}>
                  ₹{Number(session.totalCost).toFixed(2)}
                </strong>
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%", marginTop: 16 }}
                  onClick={() => navigate("/app/sessions")}
                >
                  Back to history
                </button>
              </>
            ) : (
              <>
                <p className="muted">
                  {Number(session.energyDeliveredKwh).toFixed(2)} kWh × station rate
                </p>
                <strong className="display" style={{ fontSize: 38 }}>
                  ₹{Number(session.totalCost).toFixed(2)}
                </strong>
                <div className="form-stack">
                  <button
                    className="btn btn-primary"
                    onClick={() => pay.mutate()}
                    disabled={pay.isPending}
                  >
                    Pay by UPI / card
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => wallet.mutate()}
                    disabled={wallet.isPending}
                  >
                    Pay from wallet
                  </button>
                </div>
              </>
            )}
          </div>
          {session.status === "completed" && paid && <ReviewCard session={session} />}
        </aside>
      </div>
      {paymentFlow && (
        <StripePaymentDialog
          title={`Pay ₹${Number(session.totalCost).toFixed(2)}`}
          intent={paymentFlow.intent}
          onClose={() => setPaymentFlow(null)}
          onConfirmed={confirmPayment}
        />
      )}
    </div>
  );
}
function ReviewCard({ session }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const mutation = useMutation({
    mutationFn: () => dataOf(api.post("/reviews", { sessionId: session.id, rating, comment }))
  });
  if (mutation.isSuccess)
    return (
      <div className="card" style={{ marginTop: 12 }}>
        Thanks—your review helps the next driver.
      </div>
    );
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>How was this stop?</h3>
      <div>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className="btn-ghost"
            style={{ border: 0, padding: 3 }}
            onClick={() => setRating(n)}
          >
            <Star
              size={22}
              fill={n <= rating ? "var(--copper-500)" : "none"}
              color="var(--copper-500)"
            />
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows="3"
        placeholder="Optional note"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        className="btn btn-primary"
        style={{ marginTop: 10 }}
        onClick={() => mutation.mutate()}
      >
        Share review
      </button>
    </div>
  );
}

export function WalletPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(500);
  const [topUpIntent, setTopUpIntent] = useState(null);
  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => dataOf(api.get("/wallet"))
  });
  const { data: transactions = [] } = useQuery({
    queryKey: ["wallet-transactions"],
    queryFn: () => dataOf(api.get("/wallet/transactions"))
  });
  const add = useMutation({
    mutationFn: () => dataOf(api.post("/wallet/add-money", { amount })),
    onSuccess: setTopUpIntent
  });
  const confirmTopUp = async (paymentIntentId, fake = false) => {
    await api.post("/wallet/add-money/verify", {
      paymentIntentId,
      confirmation: fake ? "fake_verified" : undefined,
      amount
    });
    setTopUpIntent(null);
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
  };
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Currents wallet</span>
          <h1>Balance & activity</h1>
        </div>
      </div>
      <div className="split">
        <section
          className="card"
          style={{ background: "var(--ink-900)", color: "var(--canvas)", minHeight: 250 }}
        >
          <span style={{ color: "var(--ink-300)" }}>Available balance</span>
          <strong
            className="display tabular"
            style={{ display: "block", fontSize: 58, margin: "20px 0" }}
          >
            ₹{Number(wallet?.balance || 0).toFixed(2)}
          </strong>
          <div style={{ display: "flex", gap: 8 }}>
            {[500, 1000, 2000].map((v) => (
              <button key={v} className="btn btn-secondary" onClick={() => setAmount(v)}>
                ₹{v}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            onClick={() => add.mutate()}
          >
            <Plus size={15} />
            Add ₹{amount}
          </button>
        </section>
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Recent transactions</h3>
          {transactions.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "13px 0",
                borderBottom: "1px solid var(--border)"
              }}
            >
              <div>
                <strong>{t.description}</strong>
                <br />
                <small className="muted">{new Date(t.createdAt).toLocaleDateString()}</small>
              </div>
              <strong style={{ color: t.type === "credit" ? "var(--success)" : "var(--ink-900)" }}>
                {t.type === "credit" ? "+" : "−"}₹{Number(t.amount).toFixed(2)}
              </strong>
            </div>
          ))}
          {!transactions.length && <Empty>No wallet activity yet.</Empty>}
        </section>
      </div>
      {topUpIntent && (
        <StripePaymentDialog
          title={`Add ₹${amount} to wallet`}
          intent={topUpIntent}
          onClose={() => setTopUpIntent(null)}
          onConfirmed={confirmTopUp}
        />
      )}
    </div>
  );
}

export function PaymentsPage() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => dataOf(api.get("/payments"))
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Receipts</span>
          <h1>Payments</h1>
        </div>
      </div>
      <div className="list">
        {payments.map((payment) => (
          <article
            className="card"
            key={payment.id}
            style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
          >
            <div>
              <strong>{payment.session?.charger?.station?.name || "Currents payment"}</strong>
              <br />
              <small className="muted">
                {new Date(payment.createdAt).toLocaleString()} · {payment.paymentMethod}
              </small>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong className="tabular">₹{Number(payment.amount).toFixed(2)}</strong>
              <br />
              <span className={`status ${payment.status === "completed" ? "success" : ""}`}>
                {payment.status}
              </span>
            </div>
          </article>
        ))}
        {!isLoading && !payments.length && <Empty>No payments or receipts yet.</Empty>}
      </div>
    </div>
  );
}

export function VehiclesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    make: "",
    model: "",
    year: 2025,
    batteryCapacityKwh: 45,
    connectorType: "CCS"
  });
  const { data: items = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => dataOf(api.get("/vehicles"))
  });
  const add = useMutation({
    mutationFn: () => dataOf(api.post("/vehicles", form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setOpen(false);
    }
  });
  const primary = useMutation({
    mutationFn: (id) => dataOf(api.patch(`/vehicles/${id}/set-primary`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] })
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Your garage</span>
          <h1>Vehicles</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Add vehicle
        </button>
      </div>
      <div className="feature-grid">
        {items.map((v) => (
          <article className="card" key={v.id}>
            <Car color="var(--copper-500)" />
            <h3 style={{ fontSize: 24, marginBottom: 5 }}>
              {v.make} {v.model}
            </h3>
            <p className="muted">
              {v.year} · {v.connectorType} · {Number(v.batteryCapacityKwh)} kWh
            </p>
            {v.isPrimary ? (
              <span className="status success">Primary vehicle</span>
            ) : (
              <button className="btn btn-secondary" onClick={() => primary.mutate(v.id)}>
                Make primary
              </button>
            )}
          </article>
        ))}
      </div>
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
              <h2>Add a vehicle</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="form-stack">
              {[
                ["make", "Make"],
                ["model", "Model"],
                ["year", "Year"],
                ["batteryCapacityKwh", "Battery capacity (kWh)"]
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    className="input"
                    type={["year", "batteryCapacityKwh"].includes(key) ? "number" : "text"}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="field">
                Connector
                <select
                  className="input"
                  value={form.connectorType}
                  onChange={(e) => setForm({ ...form, connectorType: e.target.value })}
                >
                  {["CCS", "Type2", "CHAdeMO", "Type1", "Tesla"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary">Save vehicle</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function FavoritesPage() {
  const { data: items = [] } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => dataOf(api.get("/favorites"))
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Saved places</span>
          <h1>Favorites</h1>
        </div>
      </div>
      <div className="list">
        {items.map((f) => (
          <StationCard key={f.id} station={f.station} />
        ))}
        {!items.length && <Empty>Tap the heart on a station to keep it close.</Empty>}
      </div>
    </div>
  );
}
export function NotificationsPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => dataOf(api.get("/notifications"))
  });
  const read = async () => {
    await api.patch("/notifications/read-all");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Updates</span>
          <h1>Notifications</h1>
        </div>
        <button className="btn btn-secondary" onClick={read}>
          Mark all read
        </button>
      </div>
      <div className="list">
        {items.map((n) => (
          <article className="card" key={n.id} style={{ opacity: n.isRead ? 0.7 : 1 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <Bell size={18} color="var(--copper-500)" />
              <div>
                <strong>{n.title}</strong>
                <p className="muted" style={{ margin: "5px 0" }}>
                  {n.message}
                </p>
                <small className="muted">{new Date(n.createdAt).toLocaleString()}</small>
              </div>
            </div>
          </article>
        ))}
        {!items.length && <Empty>You’re all caught up.</Empty>}
      </div>
    </div>
  );
}
export function ProfilePage() {
  const authUser = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.accessToken);
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => dataOf(api.get("/users/me")),
    initialData: authUser
  });
  const [form, setForm] = useState({ fullName: user.fullName, phone: user.phone || "" });
  const save = useMutation({
    mutationFn: () => dataOf(api.patch("/users/me", form)),
    onSuccess: (u) => setSession({ user: u, accessToken: token })
  });
  return (
    <div className="app-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Profile</h1>
        </div>
      </div>
      <section className="card" style={{ maxWidth: 650 }}>
        <div className="form-stack">
          <label className="field">
            Full name
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </label>
          <label className="field">
            Phone
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="field">
            Email
            <input className="input" value={user.email} disabled />
          </label>
          <button className="btn btn-primary" onClick={() => save.mutate()}>
            Save changes
          </button>
        </div>
      </section>
    </div>
  );
}
