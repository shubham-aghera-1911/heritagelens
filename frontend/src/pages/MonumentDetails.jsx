
import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  MapPin,
  Landmark,
  CalendarDays,
  Box,
  Trash2,
  ShieldCheck,
  LogOut
} from "lucide-react";

import "../styles/monument-details.css";

const API = "http://127.0.0.1:5000";

export default function MonumentDetails() {
  const { id } = useParams();

  const [monument, setMonument] = useState(null);
  const [monumentLoading, setMonumentLoading] = useState(true);
  const [monumentError, setMonumentError] = useState("");

  const [visitorName, setVisitorName] = useState("");
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [visitorPhotos, setVisitorPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  // Admin uploaded monument gallery
const [monumentGallery, setMonumentGallery] = useState([]);
const [monumentGalleryLoading, setMonumentGalleryLoading] = useState(true);


  // Admin states
  const [adminKey, setAdminKey] = useState("");
  const [deletingPhoto, setDeletingPhoto] = useState(null);

  const [placeName, setPlaceName] = useState("");
  const [placeLocation, setPlaceLocation] = useState("");
  const [placeDescription, setPlaceDescription] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  // Nearby Places states
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState("");

  // Fetch monument details from database
  useEffect(() => {
    const fetchMonument = async () => {
      try {
        setMonumentLoading(true);
        setMonumentError("");

        const response = await fetch(`${API}/api/monuments/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "Monument not found.");
        }

        const record = data.monument || data.data || data;

        setMonument({
          ...record,
          type: record.type || record.monument_type || "Heritage Site",
          location: record.location || "Location not available"
        });
      } catch (err) {
        console.error("Monument loading error:", err);
        setMonument(null);
        setMonumentError(err.message || "Unable to load monument details.");
      } finally {
        setMonumentLoading(false);
      }
    };

    fetchMonument();
  }, [id]);



  // Fetch admin-uploaded monument gallery
const fetchMonumentGallery = async () => {
  try {
    setMonumentGalleryLoading(true);

    const response = await fetch(
      `${API}/api/monuments/${id}/gallery`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Monument gallery could not be loaded.");
    }

    setMonumentGallery(data.images || []);
  } catch (err) {
    console.error("Monument gallery loading error:", err);
    setMonumentGallery([]);
  } finally {
    setMonumentGalleryLoading(false);
  }
};

  // Fetch visitor gallery
  const fetchVisitorPhotos = async () => {
    try {
      const response = await fetch(
        `${API}/api/visitor-photos/${id}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Gallery could not be loaded.");
      }

      setVisitorPhotos(data.photos || []);
    } catch (err) {
      console.error("Gallery loading error:", err);
      setError("Unable to load visitor photos. Please try again.");
    } finally {
      setGalleryLoading(false);
    }
  };

  // Fetch approved nearby places
  const fetchNearbyPlaces = async () => {
    try {
      setNearbyLoading(true);
      setNearbyError("");

      const response = await fetch(
        `${API}/api/nearby-places/${id}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Nearby places could not be loaded.");
      }

      setNearbyPlaces(data.places || []);
    } catch (err) {
      console.error("Nearby places loading error:", err);
      setNearbyError("Unable to load nearby places.");
    } finally {
      setNearbyLoading(false);
    }
  };

  useEffect(() => {
    setGalleryLoading(true);
    fetchVisitorPhotos();
  }, [id]);

  useEffect(() => {
  fetchMonumentGallery();
  }, [id]); 

  useEffect(() => {
    fetchNearbyPlaces();
  }, [id]);

  // Admin login
  const handleAdminLogin = () => {
    const enteredKey = window.prompt("Enter Admin Password:");

    if (enteredKey === null) return;

    if (!enteredKey.trim()) {
      setError("Admin password cannot be empty.");
      return;
    }

    setAdminKey(enteredKey);
    setError("");
    setMessage("Admin mode enabled. Password will be verified by the server when deleting.");
  };

  // Admin logout
  const handleAdminLogout = () => {
    setAdminKey("");
    setMessage("Admin logged out.");
    setError("");
  };

  // Delete visitor photo
  const handleDeletePhoto = async (photoId) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this photo?"
    );

    if (!confirmed) return;

    try {
      setDeletingPhoto(photoId);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API}/api/admin/visitor-photos/${photoId}`,
        {
          method: "DELETE",
          headers: {
            "X-Admin-Key": adminKey
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Photo deletion failed.");
      }

      setMessage("Photo deleted successfully!");
      await fetchVisitorPhotos();

    } catch (err) {
      setError(err.message);

      if (err.message.includes("Unauthorized")) {
        setAdminKey("");
      }
    } finally {
      setDeletingPhoto(null);
    }
  };

  // Upload visitor photo
  const handlePhotoUpload = async (e) => {
    e.preventDefault();

    if (!visitorName.trim() || !photo) {
      setError("Please enter your name and select a photo.");
      return;
    }

    const formData = new FormData();

    formData.append("visitor_name", visitorName.trim());
    formData.append("monument_id", id);
    formData.append("caption", caption.trim());
    formData.append("photo", photo);

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API}/api/visitor-photos`,
        {
          method: "POST",
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Photo upload failed.");
      }

      setMessage("Photo added to gallery successfully!");

      await fetchVisitorPhotos();

      setVisitorName("");
      setCaption("");
      setPhoto(null);
      e.target.reset();

    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Submit nearby place suggestion
  const handlePlaceSuggestion = async (e) => {
    e.preventDefault();

    if (!visitorName.trim() || !placeName.trim() || !placeLocation.trim()) {
      setError("Please fill all required place details.");
      return;
    }

    try {
      setSuggesting(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API}/api/nearby-places`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            visitor_name: visitorName.trim(),
            monument_id: Number(id),
            place_name: placeName.trim(),
            location: placeLocation.trim(),
            description: placeDescription.trim()
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Suggestion submission failed.");
      }

      setMessage("Place suggestion submitted! Waiting for admin approval.");

      setPlaceName("");
      setPlaceLocation("");
      setPlaceDescription("");

      e.target.reset();

    } catch (err) {
      setError(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  if (monumentLoading) {
    return (
      <main className="details-page">
        <h2>Loading monument details...</h2>
      </main>
    );
  }

  if (monumentError || !monument) {
    return (
      <main className="details-page">
        <h2>{monumentError || "Monument not found"}</h2>
        <Link to="/explore">Back to Explorer</Link>
      </main>
    );
  }

  return (
    <main className="details-page">

      <Link to="/explore" className="details-back">
        <ArrowLeft size={18} />
        Back to Explorer
      </Link>

      {/* Monument Hero */}
<section className="details-hero">
  {monument.image_url && (
    <img
      src={monument.image_url}
      alt={monument.name}
      className="details-hero-cover"
    />
  )}

  <div className="details-hero-content">
    <span className="details-label">HERITAGE DISCOVERY</span>
    <h1>{monument.name}</h1>
    <p>{monument.description}</p>

    <div className="details-location">
      <MapPin size={18} />
      {monument.location}
    </div>

    <Link
      to={`/viewer3d?id=${id}`}
      className="details-3d-button"
    >
      <Box size={19} />
      Explore in 3D
    </Link>
  </div>
</section>

      {/* Monument Information */}
      <section className="details-info-grid">
        <article className="details-info-card">
          <CalendarDays />
          <h3>Historical Period</h3>
          <p>{monument.period}</p>
        </article>

        <article className="details-info-card">
          <Landmark />
          <h3>Monument Type</h3>
          <p>{monument.type}</p>
        </article>

        <article className="details-info-card">
          <MapPin />
          <h3>Location</h3>
          <p>{monument.location}</p>
        </article>
      </section>

      {/* History */}
      <section className="details-section">
        <span className="details-label">THE STORY</span>
        <h2>History</h2>
        <p>{monument.history}</p>
      </section>

      {/* Architecture */}
      <section className="details-section">
        <span className="details-label">DESIGN & CRAFT</span>
        <h2>Architecture</h2>
        <p>{monument.architecture}</p>
      </section>

      {/* Admin Uploaded Monument Gallery */}
<section className="visitor-gallery-section">
  <span className="details-label">MONUMENT PHOTOGRAPHS</span>

  <h2>Explore the Monument</h2>

  <p>
    Discover photographs and architectural details of this monument.
  </p>

  {monumentGalleryLoading ? (
    <p>Loading monument gallery...</p>
  ) : monumentGallery.length > 0 ? (
    <div className="visitor-gallery-grid">
      {monumentGallery.map((item) => (
        <article className="visitor-photo-card" key={item.id}>
          <img
            src={item.image_url}
            alt={`${monument.name} photograph`}
            loading="lazy"
          />
        </article>
      ))}
    </div>
  ) : (
    <div className="empty-gallery">
      <p>No monument photographs have been added yet.</p>
    </div>
  )}
</section>

      {/* Visitor Photo Gallery */}
      <section className="visitor-gallery-section">
        <span className="details-label">COMMUNITY GALLERY</span>
        <h2>Visitor Photos</h2>
        <p>Explore photographs shared by other visitors.</p>

        {galleryLoading ? (
          <p>Loading photos...</p>
        ) : visitorPhotos.length > 0 ? (
          <div className="visitor-gallery-grid">
            {visitorPhotos.map((item) => (
              <article
                className="visitor-photo-card"
                key={item.id}
              >
                <img
                  src={item.photo_url}
                  alt={item.caption || "Visitor photo"}
                  loading="lazy"
                />

                <div className="visitor-photo-info">
                  <h3>{item.visitor_name}</h3>

                  {item.caption && <p>{item.caption}</p>}

                  {adminKey && (
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(item.id)}
                      disabled={deletingPhoto === item.id}
                      style={{
                        marginTop: "12px",
                        padding: "9px 14px",
                        border: "none",
                        borderRadius: "7px",
                        background: "#b42318",
                        color: "white",
                        cursor: deletingPhoto === item.id
                          ? "not-allowed"
                          : "pointer",
                        opacity: deletingPhoto === item.id ? 0.6 : 1
                      }}
                    >
                      <Trash2 size={15} style={{ verticalAlign: "middle" }} />
                      {" "}
                      {deletingPhoto === item.id
                        ? "Deleting..."
                        : "Delete Photo"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-gallery">
            <p>No visitor photos yet. Be the first to share one!</p>
          </div>
        )}
      </section>

      {/* Visitor Photo Upload */}
      <section className="visitor-upload-section">
        <span className="details-label">COMMUNITY CONTRIBUTION</span>

        <h2>Share Your Visit Photos</h2>

        <p>
          Have you visited this monument? Share your photographs
          and experience with other travellers.
        </p>

        <form
          onSubmit={handlePhotoUpload}
          className="visitor-upload-form"
        >
          <label>Your Name</label>

          <input
            type="text"
            placeholder="Enter your name"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            maxLength={100}
            required
          />

          <label>Choose Photo</label>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setPhoto(e.target.files[0])}
            required
          />

          <label>Photo Caption</label>

          <textarea
            placeholder="Describe your photo or experience..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={1000}
          />

          <button type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Submit Photo"}
          </button>

          {/* Original Admin Controls - Preserved */}
          <div style={{
            marginTop: "20px",
            paddingTop: "15px",
            borderTop: "1px solid #ddd"
          }}>
            {adminKey ? (
              <>
                <p style={{ color: "green", fontWeight: "600" }}>
                  <ShieldCheck size={16} style={{ verticalAlign: "middle" }} />
                  {" "}Admin Mode Active
                </p>

                <button
                  type="button"
                  onClick={handleAdminLogout}
                  style={{
                    padding: "10px 18px",
                    background: "#555",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  <LogOut size={16} />
                  {" "}Admin Logout
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleAdminLogin}
                style={{
                  padding: "10px 18px",
                  background: "#244c3b",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                <ShieldCheck size={16} />
                {" "}Admin Login
              </button>
            )}
          </div>

          {message && (
            <p className="upload-success">{message}</p>
          )}

          {error && (
            <p className="upload-error">{error}</p>
          )}
        </form>
      </section>

      {/* Approved Nearby Places */}
      <section className="details-section">
        <span className="details-label">COMMUNITY DISCOVERY</span>

        <h2>Nearby Places Recommended by Visitors</h2>

        {nearbyLoading ? (
          <p>Loading nearby places...</p>
        ) : nearbyError ? (
          <p>{nearbyError}</p>
        ) : nearbyPlaces.length > 0 ? (
          <div className="nearby-places-grid">
            {nearbyPlaces.map((place) => (
              <article
                className="details-info-card"
                key={place.id}
              >
                <MapPin size={22} />

                <h3>{place.place_name}</h3>

                <p>
                  <strong>Location:</strong> {place.location}
                </p>

                {place.description && (
                  <p>{place.description}</p>
                )}

                <small>
                  Suggested by {place.visitor_name}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p>No approved nearby places available yet.</p>
        )}
      </section>

      {/* Suggest Nearby Places */}
      <section className="visitor-upload-section">
        <span className="details-label">COMMUNITY DISCOVERY</span>

        <h2>Suggest a Nearby Place</h2>

        <p>
          Know an interesting place near this monument?
          Share it with other visitors.
        </p>

        <form
          onSubmit={handlePlaceSuggestion}
          className="visitor-upload-form"
        >
          <label>Your Name</label>

          <input
            type="text"
            placeholder="Enter your name"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            maxLength={100}
            required
          />

          <label>Place Name</label>

          <input
            type="text"
            placeholder="Enter nearby place name"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            maxLength={150}
            required
          />

          <label>Place Location</label>

          <input
            type="text"
            placeholder="Enter place address or location"
            value={placeLocation}
            onChange={(e) => setPlaceLocation(e.target.value)}
            maxLength={500}
            required
          />

          <label>Description</label>

          <textarea
            placeholder="Tell visitors about this place..."
            value={placeDescription}
            onChange={(e) => setPlaceDescription(e.target.value)}
            maxLength={1000}
          />

          <button type="submit" disabled={suggesting}>
            {suggesting ? "Submitting..." : "Submit Place Suggestion"}
          </button>
        </form>
      </section>

    </main>
  );
}
