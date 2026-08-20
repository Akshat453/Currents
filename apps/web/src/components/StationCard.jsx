import { MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
export function StationCard({ station, onClick }) {
  const available =
    station.availableChargers ??
    station.chargers?.filter((c) => c.status === "available").length ??
    0;
  const total = station.totalChargers ?? station.chargers?.length ?? 0;
  return (
    <Link to={`/app/stations/${station.id}`} onClick={onClick} className="station-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h3>{station.name}</h3>
          <span className="muted" style={{ fontSize: 12 }}>
            <MapPin size={12} style={{ display: "inline" }} /> {station.address}
          </span>
        </div>
        <strong className="display">
          ₹{Number(station.basePricePerKwh).toFixed(1)}
          <small className="muted" style={{ font: "400 10px Public Sans" }}>
            /kWh
          </small>
        </strong>
      </div>
      <div className="station-meta">
        <span>
          {station.distanceKm != null
            ? `${Number(station.distanceKm).toFixed(1)} km`
            : station.city}
        </span>
        <span>
          {available}/{total} available
        </span>
        <span>
          <Star size={12} style={{ display: "inline" }} /> {Number(station.rating || 0).toFixed(1)}
        </span>
      </div>
    </Link>
  );
}
