
import { useSearchParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Landmark,
  ArrowLeft,
  Rotate3D
} from "lucide-react";

import "../styles/viewer3d.css";

const API = "http://127.0.0.1:5000";

// Previously working models — fallback
const fallbackModels = {
  1: {
    name: "Rani ki Vav",
    region: "Patan, Gujarat",
    modelId: "4c877ded197f4e0faff92c43ce8a1ced"
  },
  2: {
    name: "Sun Temple",
    region: "Modhera, Gujarat",
    modelId: "ee188fc27c744f11b0262d0357f37b23"
  },
  4: {
    name: "Taj Mahal",
    region: "Agra, Uttar Pradesh",
    modelId: "1eb09052f6cd421caeaa6cb3204cb15d"
  },
  5: {
    name: "Red Fort",
    region: "Delhi, India",
    modelId: "2ad9ae0a1b524a37a2c3ab245b0e5423"
  }
};

// Convert Sketchfab URL or ID into embed URL

function getSketchfabEmbedUrl(value) {
  if (!value || typeof value !== "string") return "";

  const input = value.trim();

  // Already an embed URL
  if (
    input.includes("sketchfab.com/models/") &&
    input.includes("/embed")
  ) {
    return input;
  }

  // Extract model ID from any Sketchfab model URL
  // Supports /3d-models/ and /models/ formats
  const urlMatch = input.match(
    /([a-f0-9]{32})(?:\/|$|\?)/i
  );

  if (urlMatch) {
    return `https://sketchfab.com/models/${urlMatch[1]}/embed`;
  }

  // Direct model ID
  if (/^[a-f0-9]{32}$/i.test(input)) {
    return `https://sketchfab.com/models/${input}/embed`;
  }

  return "";
}


function Viewer3D() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") || "1";

  const [monument, setMonument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchMonument = async () => {
      try {
        setLoading(true);
        setError("");
        setMonument(null);

        let record = null;

        try {
          const response = await fetch(
            `${API}/api/monuments/${id}`
          );

          if (response.ok) {
            const data = await response.json();
            record = data.monument || data.data || data;
          }
        } catch (apiError) {
          console.warn("Database fetch failed:", apiError);
        }

        if (cancelled) return;

        const fallback = fallbackModels[id];

        // Prefer database URL; use old model ID if unavailable
        const sketchfabValue =
          record?.sketchfab_url || fallback?.modelId || "";

        const embedUrl = getSketchfabEmbedUrl(sketchfabValue);

        if (!embedUrl) {
          throw new Error(
            "3D model is not available for this monument."
          );
        }

        setMonument({
          name: record?.name || fallback?.name || "Monument",
          region:
            record?.location ||
            fallback?.region ||
            "Location not available",
          embedUrl
        });

      } catch (err) {
        console.error("3D model loading error:", err);

        if (!cancelled) {
          setError(err.message || "Unable to load 3D model.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMonument();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="viewer-page">
        <h2>Loading 3D monument...</h2>
      </div>
    );
  }

  if (error || !monument) {
    return (
      <div className="viewer-page">
        <h2>{error || "3D model not available"}</h2>
        <Link to="/explore">Back to Explore</Link>
      </div>
    );
  }

  return (
    <div className="viewer-page">
      <header className="viewer-header">
        <Link to="/" className="viewer-brand">
          <Landmark size={25} />
          HERITAGELENS
        </Link>

        <Link to="/explore" className="viewer-back">
          <ArrowLeft size={16} />
          Back to Explore
        </Link>
      </header>

      <main className="viewer-main">
        <div className="viewer-title">
          <span>INTERACTIVE 3D HERITAGE EXPERIENCE</span>
          <h1>{monument.name}</h1>
          <p>{monument.region}</p>
        </div>

        <div className="sketchfab-container">
          <iframe
            title={`${monument.name} 3D Model`}
            src={monument.embedUrl}
            allow="autoplay; fullscreen; xr-spatial-tracking"
            allowFullScreen
          />
        </div>

        <div className="viewer-instructions">
          <div>
            <Rotate3D size={22} />
            <span>
              <strong>Explore the Monument</strong>
              <small>
                Use your mouse to rotate and zoom the model.
              </small>
            </span>
          </div>
        </div>

        <p className="viewer-credit">
          3D model hosted by Sketchfab. Credit and usage
          permissions belong to the original creator.
        </p>
      </main>
    </div>
  );
}

export default Viewer3D;
