
import { useEffect, useState } from "react";
import {
  Search,
  MapPin,
  ArrowLeft,
  Landmark,
  ArrowUpRight
} from "lucide-react";


import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/explorer.css";
import { Link,useNavigate } from "react-router-dom";

const API = "http://localhost:5000";



const monumentIcon = new L.DivIcon({
  className: "heritage-marker",
  html: '<div class="marker-dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function MapController({ selected }) {
  const map = useMap();

  useEffect(() => {
    if (selected?.position) {
      map.flyTo(selected.position, 12, {
        duration: 1.5
      });
    }
  }, [selected, map]);

  return null;
}

function Explorer() {
  const [monuments, setMonuments] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadMonuments = async () => {
      try {
        const response = await fetch(`${API}/api/monuments`);

        if (!response.ok) {
          throw new Error("Unable to load monuments.");
        }

        const data = await response.json();

        const records = Array.isArray(data)
          ? data
          : data.monuments || [];

       const formatted = records.map((item) => {
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);

  const validCoordinates =
    item.latitude !== null &&
    item.latitude !== "" &&
    item.longitude !== null &&
    item.longitude !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  return {
    ...item,
    category: item.type || item.monument_type || "Heritage Site",
    region: item.location || "Location not available",
    position: validCoordinates ? [latitude, longitude] : null,
    sketchfabId: item.sketchfab_url?.trim() || ""
  };
});

        setMonuments(formatted);
        setSelected(formatted[0] || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMonuments();
  }, []);

  const filtered = monuments.filter((item) =>
    `${item.name} ${item.region} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const mapMonuments = monuments.filter((item) => item.position);

  const handleSelect = (item) => {
    setSelected(item);
  };

  return (
    <div className="explorer-page">

      <header className="explorer-header">
        <a href="/" className="explorer-brand">
          <Landmark size={25} />
          <span>HERITAGE<span>LENS</span></span>
        </a>

        <a href="/" className="back-home">
          <ArrowLeft size={16} /> Back to Home
        </a>
      </header>

      <section className="explorer-heading">
        <span className="explorer-eyebrow">
          HERITAGE DISCOVERY PLATFORM
        </span>

        <h1>Explore <em>heritage.</em></h1>

        <p>
          Discover monuments, explore their geographical
          context and connect with India's architectural legacy.
        </p>
      </section>

      <div className="explorer-workspace">

        <aside className="monument-sidebar">

          <div className="sidebar-title">
            <div>
              <span>COLLECTION</span>
              <h2>Places & Records</h2>
            </div>

            <span className="record-count">
              {filtered.length} Records
            </span>
          </div>

          <div className="explorer-search">
            <Search size={18} />

            <input
            onChange={(e) => {
  const value = e.target.value;
  setSearch(value);

  const matching = monuments.filter((item) =>
    `${item.name} ${item.region} ${item.category}`
      .toLowerCase()
      .includes(value.toLowerCase())
  );

  if (matching.length > 0) {
    setSelected(matching[0]);
  }
}}
              
            />
          </div>

          <div className="monument-list">
            {loading ? (
              <p>Loading monuments...</p>
            ) : error ? (
              <p className="empty-records">{error}</p>
            ) : filtered.length > 0 ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  className={`monument-item ${
                    selected?.id === item.id ? "active" : ""
                  }`}
                  onClick={() => handleSelect(item)}
                >
                  <div className="monument-number">
                    {String(item.id).padStart(2, "0")}
                  </div>

                  <div className="monument-info">
                    <span>{item.category}</span>
                    <h3>{item.name}</h3>

                    <p>
                      <MapPin size={13} />
                      {item.region}
                    </p>
                  </div>

                  <ArrowUpRight size={18} />
                </button>
              ))
            ) : (
              <p className="empty-records">
                No matching monuments found.
              </p>
            )}
          </div>

          <div className="selected-record">
            <span>SELECTED RECORD</span>

            {selected ? (
              <>
                <h3>{selected.name}</h3>

                <p>
                  {selected.description || "No description available."}
                </p>

                <div className="selected-location">

                  {selected.sketchfabId?.trim() && (
                    <a
                      href={`/viewer3d?id=${selected.id}`}
                      className="view-3d-button"
                    >
                      <span>Explore in 3D</span>
                      <ArrowUpRight size={18} />
                    </a>
                  )}

                  <Link
                    to={`/monument/${selected.id}`}
                    className="view-details-button"
                  >
                    View Full Details
                    <ArrowUpRight size={18} />
                  </Link>

                  <MapPin size={15} />
                  {selected.region}
                </div>
              </>
            ) : (
              <p>Select a monument to view its details.</p>
            )}

            <small>
              Heritage records · Digital archive
            </small>
          </div>
        </aside>

        <section className="map-panel">

          <div className="map-topbar">
            <div>
              <span>GEOGRAPHICAL EXPLORER</span>
              <h2>Discover on map</h2>
            </div>

            <span className="map-region">
              India
            </span>
          </div>

          <div className="map-container">
            {mapMonuments.length > 0 ?(
              <MapContainer
              
                key={selected?.id || mapMonuments[0].id}
                center={selected?.position || mapMonuments[0].position}
                scrollWheelZoom={true}
                className="heritage-map"
              >
                <MapController selected={selected} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {mapMonuments.map((item) => (
                  <Marker
                    key={item.id}
                    position={item.position}
                    icon={monumentIcon}
                    eventHandlers={{
  click: () => {
    handleSelect(item);
    navigate(`/monument/${item.id}`);
  }
}}
                  >
                    <Popup>
                      <strong>{item.name}</strong>
                      <br />
                      {item.region}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="empty-records">
                Map coordinates are not available for this monument yet.
              </div>
            )}
          </div>

          <div className="map-footer">
            <div>
              <span className="legend-dot"></span>
              Heritage locations
            </div>

            <span>
              Select a marker to view its record
            </span>
          </div>

        </section>
      </div>

      <footer className="explorer-footer">
        HERITAGELENS · DIGITAL HERITAGE ARCHIVE
      </footer>

    </div>
  );
}

export default Explorer;
