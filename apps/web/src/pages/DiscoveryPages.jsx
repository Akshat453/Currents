import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import {
  ArrowLeft,
  Clock,
  Heart,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  Star,
  X
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, dataOf } from "../lib/api.js";
import { StationCard } from "../components/StationCard.jsx";
import { useSocket } from "../hooks/useSocket.js";

function MapWatcher({ onMove }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onMove([c.lat, c.lng]);
    }
  });
  return null;
}
function RecommendationDialog({ location, vehicles, onClose }) {
  const [battery, setBattery] = useState(35);
  const [priority, setPriority] = useState("balanced");
  const [vehicleId, setVehicleId] = useState(
    vehicles.find((v) => v.isPrimary)?.id || vehicles[0]?.id || ""
  );
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const mutation = useMutation({
    mutationFn: () =>
      dataOf(
        api.post("/ai/recommend-station", {
          lat: location[0],
          lng: location[1],
          connectorType: vehicle.connectorType,
          batteryPercent: Number(battery),
          batteryCapacityKwh: vehicle.batteryCapacityKwh
            ? Number(vehicle.batteryCapacityKwh)
            : undefined,
          priority
        })
      )
  });
  return (
    <div className="dialog-backdrop">
      <section className="dialog" aria-modal="true" role="dialog">
        <div className="dialog-head">
          <div>
            <span className="eyebrow">Currents AI</span>
            <h2>Recommend for me</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        {!mutation.data ? (
          <div className="form-stack">
            <label className="field">
              Vehicle
              <select
                className="input"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} · {v.connectorType}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Current battery — <strong className="tabular">{battery}%</strong>
              <input
                type="range"
                min="5"
                max="79"
                value={battery}
                onChange={(e) => setBattery(e.target.value)}
                style={{ accentColor: "var(--copper-500)" }}
              />
            </label>
            <div className="field">
              <label>Priority</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
                {["fastest", "balanced", "cheapest"].map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`btn ${priority === p ? "btn-primary" : "btn-secondary"}`}
                  >
                    {p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {mutation.isError && (
              <p className="error">
                {mutation.error.response?.data?.error?.message ||
                  "Could not calculate recommendations"}
              </p>
            )}
            <button
              className="btn btn-primary"
              disabled={!vehicle || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              <Sparkles size={16} />
              {mutation.isPending ? "Comparing the network…" : "Show my best options"}
            </button>
          </div>
        ) : (
          <div className="list" style={{ marginTop: 22 }}>
            {mutation.data.map((item) => (
              <article
                className="recommend-card"
                style={{ border: "1px solid var(--border)" }}
                key={item.id}
              >
                <span className="rank">
                  0{item.rank} · {item.rank === 1 ? "BEST MATCH" : "ALTERNATIVE"}
                </span>
                <small className="muted">
                  {item.explanationSource === "groq"
                    ? "Explained by Groq AI"
                    : "Currents local explanation"}
                </small>
                <h3>{item.name}</h3>
                <p>{item.why}</p>
                <div className="metric-row">
                  <div className="metric">
                    <strong>{Math.round(item.totalMinutes)}m</strong>
                    <small>road to ready</small>
                  </div>
                  <div className="metric">
                    <strong>₹{Math.round(item.estimatedCost)}</strong>
                    <small>estimate</small>
                  </div>
                  <div className="metric">
                    <strong>{Number(item.rate).toFixed(1)}</strong>
                    <small>₹/kWh</small>
                  </div>
                </div>
                <Link
                  className="btn btn-primary"
                  style={{ marginTop: 16, width: "100%" }}
                  to={`/app/stations/${item.id}?charger=${item.bestChargerId}`}
                >
                  Book this
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
export function HomePage() {
  const [location, setLocation] = useState([12.9716, 77.5946]);
  const [searchAt, setSearchAt] = useState(location);
  const [filters, setFilters] = useState({ connector_type: "", sort: "distance" });
  const [recommend, setRecommend] = useState(false);
  useEffect(
    () =>
      navigator.geolocation?.getCurrentPosition(
        (p) => {
          const next = [p.coords.latitude, p.coords.longitude];
          setLocation(next);
          setSearchAt(next);
        },
        () => {}
      ),
    []
  );
  const params = new URLSearchParams({
    lat: searchAt[0],
    lng: searchAt[1],
    radius_km: 15,
    sort: filters.sort,
    ...(filters.connector_type && { connector_type: filters.connector_type })
  });
  const {
    data: stations = [],
    isLoading,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ["stations", searchAt, filters],
    queryFn: () => dataOf(api.get(`/stations?${params}`))
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => dataOf(api.get("/vehicles"))
  });
  const areaChanged =
    Math.abs(location[0] - searchAt[0]) > 0.0001 || Math.abs(location[1] - searchAt[1]) > 0.0001;
  const searchArea = () => {
    if (areaChanged) setSearchAt([...location]);
    else refetch();
  };
  return (
    <section className="map-layout">
      <MapContainer className="map" center={location} zoom={12} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapWatcher onMove={setLocation} />
        {stations.map((s) => (
          <CircleMarker
            key={s.id}
            center={[Number(s.latitude), Number(s.longitude)]}
            radius={10}
            pathOptions={{
              color: "#fff",
              weight: 3,
              fillColor: s.availableChargers ? "#C9622F" : "#A9A497",
              fillOpacity: 1
            }}
          >
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {s.availableChargers}/{s.totalChargers} available
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <aside className="station-panel">
        <div className="map-search">
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={searchArea}
            disabled={isFetching}
          >
            {isFetching ? "Searching…" : areaChanged ? "Search this area" : "Refresh this area"}
          </button>
          <button className="icon-btn" aria-label="Filters">
            <SlidersHorizontal size={17} />
          </button>
        </div>
        <button
          className="btn btn-secondary"
          style={{ width: "100%", marginBottom: 12, borderColor: "var(--copper-500)" }}
          onClick={() => setRecommend(true)}
        >
          <Sparkles size={16} />
          Recommend for me
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <select
            className="input"
            aria-label="Connector filter"
            value={filters.connector_type}
            onChange={(e) => setFilters({ ...filters, connector_type: e.target.value })}
          >
            <option value="">Any connector</option>
            {["CCS", "Type2", "CHAdeMO", "Type1", "Tesla"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Sort stations"
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          >
            <option value="distance">Nearest</option>
            <option value="price">Lowest price</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
        <p className="muted" style={{ fontSize: 12 }} aria-live="polite">
          {isFetching
            ? "Reading the live network…"
            : `${stations.length} compatible places near ${searchAt[0].toFixed(3)}, ${searchAt[1].toFixed(3)}`}
        </p>
        <div className="list">
          {stations.map((s) => (
            <StationCard key={s.id} station={s} />
          ))}
          {!isLoading && !stations.length && (
            <div className="empty">
              No stations match this area. Move the map or clear a filter.
            </div>
          )}
        </div>
      </aside>
      {recommend && (
        <RecommendationDialog
          location={searchAt}
          vehicles={vehicles}
          onClose={() => setRecommend(false)}
        />
      )}
    </section>
  );
}

export function StationDetailPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const socket = useSocket();
  const [booking, setBooking] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const { data: station, isLoading } = useQuery({
    queryKey: ["station", id],
    queryFn: () => dataOf(api.get(`/stations/${id}`))
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => dataOf(api.get("/vehicles"))
  });
  useEffect(() => {
    if (!socket) return;
    socket.emit("join_station", id);
    const h = (event) =>
      qc.setQueryData(["station", id], (old) =>
        old
          ? {
              ...old,
              chargers: old.chargers.map((c) =>
                c.id === event.chargerId ? { ...c, status: event.status } : c
              )
            }
          : old
      );
    socket.on("charger_status_update", h);
    return () => {
      socket.emit("leave_station", id);
      socket.off("charger_status_update", h);
    };
  }, [socket, id, qc]);
  if (isLoading || !station) return <div className="app-content">Loading station…</div>;
  return (
    <div className="app-content">
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} />
        Back to map
      </button>
      <div className="page-title" style={{ marginTop: 20 }}>
        <div>
          <span className="eyebrow">{station.city} · LIVE NETWORK</span>
          <h1 style={{ marginTop: 9 }}>{station.name}</h1>
          <p className="muted">
            <MapPin size={14} style={{ display: "inline" }} /> {station.address}
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label="Favorite"
          onClick={() => {
            setFavorite(!favorite);
            api[favorite ? "delete" : "post"](
              favorite ? `/favorites/${id}` : "/favorites",
              favorite ? undefined : { stationId: id }
            ).catch(() => {});
          }}
        >
          <Heart size={19} fill={favorite ? "var(--copper-500)" : "none"} />
        </button>
      </div>
      <div className="split">
        <section>
          <div className="card">
            <div className="metric-row">
              <div className="metric">
                <strong>
                  ₹{(Number(station.basePricePerKwh) * Number(station.activeMultiplier)).toFixed(1)}
                </strong>
                <small>live ₹/kWh</small>
              </div>
              <div className="metric">
                <strong>
                  {station.chargers.filter((c) => c.status === "available").length}/
                  {station.chargers.length}
                </strong>
                <small>available</small>
              </div>
              <div className="metric">
                <strong>{Number(station.rating).toFixed(1)}</strong>
                <small>
                  <Star size={11} /> {station.totalReviews} reviews
                </small>
              </div>
            </div>
          </div>
          <h2 style={{ marginTop: 30 }}>Choose a plug</h2>
          <div className="list">
            {station.chargers.map((charger) => (
              <article
                key={charger.id}
                className={`station-card ${charger.status === "in_use" ? "live-edge" : ""}`}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <h3>
                      {charger.connectorType} · {Number(charger.maxPowerKw)} kW
                    </h3>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {charger.chargerIdentifier}
                    </span>
                  </div>
                  {charger.status === "in_use" ? (
                    <span className="live-pill">Charging now</span>
                  ) : (
                    <span
                      className={`status ${charger.status === "available" ? "success" : charger.status === "faulted" ? "error" : "warn"}`}
                    >
                      {charger.status.replace("_", " ")}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside>
          <div className="card">
            <h3 style={{ fontSize: 24, marginTop: 0 }}>Plan this stop</h3>
            <p className="muted">
              Reserve a compatible plug in a 15-minute window. Your estimate updates before
              confirmation.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() => setBooking(true)}
            >
              Book a charger
            </button>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <h3>What’s here</h3>
            <p className="muted">
              {station.amenities?.length ? station.amenities.join(" · ") : "24/7 access"}
            </p>
            <p className="muted">
              <Clock size={13} style={{ display: "inline" }} />{" "}
              {station.is24x7 ? "Open all day" : "See station hours"}
            </p>
          </div>
        </aside>
      </div>
      {booking && (
        <BookingDialog
          station={station}
          vehicles={vehicles}
          preferred={search.get("charger")}
          onClose={() => setBooking(false)}
        />
      )}
    </div>
  );
}

function BookingDialog({ station, vehicles, preferred, onClose }) {
  const navigate = useNavigate();
  const available = station.chargers.filter((c) => c.status === "available");
  const [chargerId, setCharger] = useState(preferred || available[0]?.id || "");
  const [vehicleId, setVehicle] = useState(
    vehicles.find((v) => v.isPrimary)?.id || vehicles[0]?.id || ""
  );
  const defaultTime = useMemo(() => {
    const d = new Date(Date.now() + 30 * 60e3);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d;
  }, []);
  const [start, setStart] = useState(defaultTime.toISOString().slice(0, 16));
  const [duration, setDuration] = useState(45);
  const charger = station.chargers.find((c) => c.id === chargerId);
  const estimate = charger
    ? Number(charger.maxPowerKw) *
      (duration / 60) *
      Number(station.basePricePerKwh) *
      Number(station.activeMultiplier)
    : 0;
  const mutation = useMutation({
    mutationFn: () =>
      dataOf(
        api.post("/bookings", {
          stationId: station.id,
          chargerId,
          vehicleId,
          startTime: new Date(start).toISOString(),
          endTime: new Date(new Date(start).getTime() + duration * 60e3).toISOString()
        })
      ),
    onSuccess: () => navigate("/app/bookings")
  });
  return (
    <div className="dialog-backdrop">
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="dialog-head">
          <h2>Reserve your plug</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="form-stack">
          <label className="field">
            Charger
            <select
              className="input"
              value={chargerId}
              onChange={(e) => setCharger(e.target.value)}
            >
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.connectorType} · {Number(c.maxPowerKw)} kW
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Vehicle
            <select
              className="input"
              value={vehicleId}
              onChange={(e) => setVehicle(e.target.value)}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Start time
            <input
              className="input"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              step="900"
            />
          </label>
          <label className="field">
            Duration
            <select
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[30, 45, 60, 90, 120].map((v) => (
                <option value={v} key={v}>
                  {v} minutes
                </option>
              ))}
            </select>
          </label>
          <div className="card">
            <span className="muted">Conservative energy estimate</span>
            <strong className="display tabular" style={{ display: "block", fontSize: 32 }}>
              up to ₹{Math.round(estimate)}
            </strong>
          </div>
          {mutation.isError && (
            <p className="error">
              {mutation.error.response?.data?.error?.message || "Could not reserve this charger"}
            </p>
          )}
          <button
            className="btn btn-primary"
            disabled={!chargerId || !vehicleId || mutation.isPending}
          >
            {mutation.isPending ? "Checking availability…" : "Confirm booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
