
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"
import "../styles/admin.css";

import {
  ShieldCheck, Image, MapPin, Clock,
  CheckCircle, Trash2, LogOut, RefreshCw,
  Plus, Pencil, Save, X, Landmark,
  Upload, Eye
} from "lucide-react";

const API = "http://localhost:5000";

const emptyMonument = {
   name: "",
  location: "",
  latitude: "",
  longitude: "",
  period: "",
  type: "",
  description: "",
  history: "",
  architecture: "",
  image_url: "",
  sketchfab_url: ""
};

function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({});
  const [photos, setPhotos] = useState([]);
  const [places, setPlaces] = useState([]);
  const [monuments, setMonuments] = useState([]);

  const [tab, setTab] = useState("photos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyMonument);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [coverFiles, setCoverFiles] = useState({});
const [galleryFiles, setGalleryFiles] = useState({});
const [galleryImages, setGalleryImages] = useState({});
const [mediaLoading, setMediaLoading] = useState({});
const request = async (url, options = {}) => {
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(API + url, {
    ...options,
    credentials: "include",
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    navigate("/admin/login");
    throw new Error("Admin session expired. Please login again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
};
  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboard, photoData, placeData, monumentData] =
        await Promise.all([
          request("/api/admin/dashboard"),
          request("/api/admin/visitor-photos"),
          request("/api/admin/nearby-places"),
          request("/api/monuments")
        ]);

      setStats(dashboard);
      setPhotos(
        Array.isArray(photoData) ? photoData : photoData.photos || []
      );
      setPlaces(
        Array.isArray(placeData) ? placeData : placeData.places || []
      );
      setMonuments(
        Array.isArray(monumentData)
          ? monumentData
          : monumentData.monuments || []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const updatePhoto = async (id, status) => {
    try {
      await request(`/api/admin/visitor-photos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePhoto = async (id) => {
    if (!window.confirm("Delete this photo permanently?")) return;

    try {
      await request(`/api/admin/visitor-photos/${id}`, {
        method: "DELETE"
      });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const updatePlace = async (id, status) => {
    try {
      await request(`/api/admin/nearby-places/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePlace = async (id) => {
    if (!window.confirm("Delete this place suggestion permanently?")) return;

    try {
      await request(`/api/admin/nearby-places/${id}`, {
        method: "DELETE"
      });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const openAddForm = () => {
    setForm({ ...emptyMonument });
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = (monument) => {
    setForm({
      name: monument.name || "",
      location: monument.location || "",
      period: monument.period || "",
      type: monument.type || monument.monument_type || "",
      description: monument.description || "",
      history: monument.history || "",
      architecture: monument.architecture || "",
      image_url: monument.image_url || "",
      sketchfab_url: monument.sketchfab_url || "",
      latitude: monument.latitude ?? "",
      longitude: monument.longitude ?? "",
    });

    setEditingId(monument.id);
    setShowForm(true);
    setError("");
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const saveMonument = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingId
        ? `/api/admin/monuments/${editingId}`
        : "/api/admin/monuments";

      await request(url, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form)
      });

      setShowForm(false);
      setForm({ ...emptyMonument });
      setEditingId(null);

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (monumentId) => {
  const file = coverFiles[monumentId];

  if (!file) {
    setError("Please select a cover image first.");
    return;
  }

  const formData = new FormData();
  formData.append("image", file);

  setMediaLoading(prev => ({ ...prev, [monumentId]: true }));
  setError("");

  try {
    await request(`/api/admin/monuments/${monumentId}/cover`, {
      method: "POST",
      body: formData
    });

    setCoverFiles(prev => ({ ...prev, [monumentId]: null }));
    await loadDashboard();
    alert("Cover image uploaded successfully!");
  } catch (err) {
    setError(err.message);
  } finally {
    setMediaLoading(prev => ({ ...prev, [monumentId]: false }));
  }
};

const uploadGallery = async (monumentId) => {
  const files = Array.from(galleryFiles[monumentId] || []);

  if (files.length === 0) {
    setError("Please select at least one gallery image.");
    return;
  }

  setMediaLoading(prev => ({ ...prev, [monumentId]: true }));
  setError("");

  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append("image", file);

      await request(`/api/admin/monuments/${monumentId}/gallery`, {
        method: "POST",
        body: formData
      });
    }

    setGalleryFiles(prev => ({ ...prev, [monumentId]: [] }));
    await loadGallery(monumentId);

    alert("Gallery images uploaded successfully!");
  } catch (err) {
    setError(err.message);
  } finally {
    setMediaLoading(prev => ({ ...prev, [monumentId]: false }));
  }
};

const loadGallery = async (monumentId) => {
  try {
    const data = await request(`/api/monuments/${monumentId}/gallery`);

    setGalleryImages(prev => ({
      ...prev,
      [monumentId]: data.images || []
    }));
  } catch (err) {
    setError(err.message);
  }
};

const deleteGalleryImage = async (imageId, monumentId) => {
  if (!window.confirm("Delete this gallery image permanently?")) return;

  try {
    await request(`/api/admin/monuments/gallery/${imageId}`, {
      method: "DELETE"
    });

    await loadGallery(monumentId);
  } catch (err) {
    setError(err.message);
  }
};

  const deleteMonument = async (id) => {
    if (
      !window.confirm(
        "Delete this monument permanently? Related visitor data may prevent deletion."
      )
    ) return;

    try {
      await request(`/api/admin/monuments/${id}`, {
        method: "DELETE"
      });

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = async () => {
    try {
      await request("/api/admin/logout", { method: "POST" });
    } catch (err) {
      console.error(err);
    }

    navigate("/admin/login");
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <h1><ShieldCheck /> HeritageLens Admin</h1>
          <p>Manage community contributions and monuments</p>
        </div>

        <button onClick={logout} className="admin-logout">
          <LogOut size={17} /> Logout
        </button>
      </header>

      <main className="admin-content">
        {error && <p className="admin-error">{error}</p>}

        <div className="admin-stats">
          <div className="admin-stat-card">
            <Image />
            <span>Total Photos</span>
            <strong>{stats.total_photos ?? 0}</strong>
          </div>

          <div className="admin-stat-card">
            <Clock />
            <span>Pending Photos</span>
            <strong>{stats.pending_photos ?? 0}</strong>
          </div>

          <div className="admin-stat-card">
            <MapPin />
            <span>Total Places</span>
            <strong>{stats.total_places ?? 0}</strong>
          </div>

          <div className="admin-stat-card">
            <Clock />
            <span>Pending Places</span>
            <strong>{stats.pending_places ?? 0}</strong>
          </div>

          <div className="admin-stat-card">
            <Landmark />
            <span>Total Monuments</span>
            <strong>{monuments.length}</strong>
          </div>
        </div>

        <div className="admin-toolbar">
          <div className="admin-tabs">
            <button
              className={tab === "photos" ? "active" : ""}
              onClick={() => setTab("photos")}
            >
              Visitor Photos
            </button>

            <button
              className={tab === "places" ? "active" : ""}
              onClick={() => setTab("places")}
            >
              Nearby Places
            </button>

            <button
              className={tab === "monuments" ? "active" : ""}
              onClick={() => {
                setTab("monuments");
                setShowForm(false);
              }}
            >
              Monuments
            </button>
          </div>

          <button onClick={loadDashboard} className="admin-refresh">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading admin data...</p>
        ) : tab === "photos" ? (
          <section className="admin-list">
            <h2>Visitor Photo Management</h2>

            {photos.length === 0 ? (
              <p>No visitor photos found.</p>
            ) : photos.map(photo => (
              <article className="admin-item" key={photo.id}>
                <img
                  src={`${API}/uploads/visitor_photos/${encodeURIComponent(
                    photo.photo_path?.split(/[\\/]/).pop() || ""
                  )}`}
                  alt={photo.caption || "Visitor upload"}
                />

                <div className="admin-item-info">
                  <h3>{photo.visitor_name || "Visitor"}</h3>
                  <p>{photo.caption || "No caption"}</p>
                  <p>
                    Status: {photo.approval_status || photo.status || "Unknown"}
                  </p>
                  <p>Monument ID: {photo.monument_id}</p>

                  <div className="admin-actions">
                    {(photo.approval_status || photo.status) !== "approved" && (
                      <button onClick={() => updatePhoto(photo.id, "approved")}>
                        <CheckCircle size={15} /> Approve
                      </button>
                    )}

                    {(photo.approval_status || photo.status) !== "rejected" && (
                      <button onClick={() => updatePhoto(photo.id, "rejected")}>
                        Reject
                      </button>
                    )}

                    <button
                      className="delete"
                      onClick={() => deletePhoto(photo.id)}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : tab === "places" ? (
          <section className="admin-list">
            <h2>Nearby Place Suggestions</h2>

            {places.length === 0 ? (
              <p>No nearby place suggestions found.</p>
            ) : places.map(place => (
              <article className="admin-place-item" key={place.id}>
                <div>
                  <h3>{place.place_name}</h3>
                  <p>Visitor: {place.visitor_name || "Anonymous"}</p>
                  <p>Location: {place.location}</p>
                  <p>{place.description}</p>
                  <p>
                    Status: {place.approval_status || place.status || "Pending"}
                  </p>
                </div>

                <div className="admin-actions">
                  <button onClick={() => updatePlace(place.id, "approved")}>
                    <CheckCircle size={15} /> Approve
                  </button>

                  <button onClick={() => updatePlace(place.id, "rejected")}>
                    Reject
                  </button>

                  <button
                    className="delete"
                    onClick={() => deletePlace(place.id)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="admin-list">
            <div className="admin-toolbar">
              <h2>Monument Management</h2>

              <button className="admin-refresh" onClick={openAddForm}>
                <Plus size={16} /> Add Monument
              </button>
            </div>

            {showForm && (
              <form className="admin-monument-form" onSubmit={saveMonument}>
                <h3>{editingId ? "Edit Monument" : "Add New Monument"}</h3>

                <label>Monument Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                />

                <label>Location</label>
                <input
                  name="location"
                  value={form.location}
                  onChange={handleFormChange}
                />
                <label>Latitude *</label>
<input
  type="number"
  name="latitude"
  value={form.latitude}
  onChange={handleFormChange}
  step="any"
  min="-90"
  max="90"
  placeholder="Example: 21.8380"
  required
/>

<label>Longitude *</label>
<input
  type="number"
  name="longitude"
  value={form.longitude}
  onChange={handleFormChange}
  step="any"
  min="-180"
  max="180"
  placeholder="Example: 73.7191"
  required
/>

                <label>Historical Period</label>
                <input
                  name="period"
                  value={form.period}
                  onChange={handleFormChange}
                />

                <label>Monument Type</label>
                <input
                  name="type"
                  value={form.type}
                  onChange={handleFormChange}
                />

                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows="3"
                />

                <label>History</label>
                <textarea
                  name="history"
                  value={form.history}
                  onChange={handleFormChange}
                  rows="4"
                />

                <label>Architecture</label>
                <textarea
                  name="architecture"
                  value={form.architecture}
                  onChange={handleFormChange}
                  rows="4"
                />

                <label>Image URL</label>
                <input
                  name="image_url"
                  value={form.image_url}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />

                <label>Sketchfab 3D Model URL</label>
                <input
                  name="sketchfab_url"
                  value={form.sketchfab_url}
                  onChange={handleFormChange}
                  placeholder="https://sketchfab.com/..."
                />

                <div className="admin-actions">
                  <button type="submit" disabled={saving}>
                    <Save size={15} />
                    {saving ? "Saving..." : "Save Monument"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    <X size={15} /> Cancel
                  </button>
                </div>
              </form>
            )}

            {monuments.length === 0 ? (
              <p>No monuments found.</p>
            ) : monuments.map(monument => (
              <article className="admin-place-item" key={monument.id}>
                <div>
                  <h3>{monument.name}</h3>
                  <p>Location: {monument.location || "Not specified"}</p>
                  <p>Period: {monument.period || "Not specified"}</p>
                  <p>Type: {monument.type || monument.monument_type || "Not specified"}</p>
                  <p>{monument.description || "No description"}</p>

                  {monument.sketchfab_url && (
                    <p>3D Model: Available</p>
                  )}
                </div>
                <div className="monument-media-manager">
  <h4><Image size={17} /> Cover Image</h4>

  {monument.image_url && (
    <img
      src={monument.image_url.startsWith("http")
        ? monument.image_url
        : `${API}${monument.image_url}`}
      alt={monument.name}
      className="admin-cover-preview"
    />
  )}

  <input
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={e =>
      setCoverFiles(prev => ({
        ...prev,
        [monument.id]: e.target.files[0]
      }))
    }
  />

  <button
    onClick={() => uploadCover(monument.id)}
    disabled={!!mediaLoading[monument.id]}
  >
    <Upload size={15} />
    Upload Cover
  </button>

  <hr />

  <h4><Image size={17} /> 2D Gallery Images</h4>

  <input
    type="file"
    accept="image/png,image/jpeg,image/webp"
    multiple
    onChange={e =>
      setGalleryFiles(prev => ({
        ...prev,
        [monument.id]: e.target.files
      }))
    }
  />

  <button
    onClick={() => uploadGallery(monument.id)}
    disabled={!!mediaLoading[monument.id]}
  >
    <Upload size={15} />
    Upload Gallery Images
  </button>

  <button
    onClick={() => loadGallery(monument.id)}
  >
    <Eye size={15} />
    View Gallery
  </button>

  <div className="admin-gallery-grid">
    {(galleryImages[monument.id] || []).map(image => (
      <div key={image.id} className="admin-gallery-image">
        <img
          src={image.image_url}
          alt="Monument gallery"
        />

        <button
          className="delete"
          onClick={() => deleteGalleryImage(image.id, monument.id)}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    ))}
  </div>
</div>

                <div className="admin-actions">
                  <button onClick={() => openEditForm(monument)}>
                    <Pencil size={15} /> Edit
                  </button>

                  <button
                    className="delete"
                    onClick={() => deleteMonument(monument.id)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
    </main>   
    </div>
  );
}

export default AdminDashboard;
