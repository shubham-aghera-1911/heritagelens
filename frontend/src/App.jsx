import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  ArrowUpRight,
  Menu,
  X,
  Compass,
  Landmark,
  BookOpen,
  Camera,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import "./styles/index.css";

const API = "http://localhost:5000";

const fallbackImages = {
  "Taj Mahal":
    "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=900",
  
  "Red Fort":
    "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=900"
};

function App() {
  

  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [heritageSites, setHeritageSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  useEffect(() => {
    const loadMonuments = async () => {
      try {
        const response = await fetch(`${API}/api/monuments`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error("Unable to load monuments");
        }

        const records = data.monuments || [];

        setHeritageSites(records.map(item => ({
          id: item.id,
          name: item.name,
          location: item.location || "Location not available",
          period: item.period || item.type || "Historical Monument",
          image: item.image_url
            ? (item.image_url.startsWith("http")
                ? item.image_url
                : `${API}${item.image_url}`)
            : fallbackImages[item.name] ||
              "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=900"
        })));
      } catch (error) {
        console.error("Monument loading error:", error);
      } finally {
        setSitesLoading(false);
      }
    };

    loadMonuments();
  }, []);

  const filteredSites = heritageSites.filter((site) =>
    `${site.name} ${site.location} ${site.period}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="website">

      {/* NAVBAR */}
      <nav className="navbar">
        <a href="#home" className="brand">
          <span className="brand-icon">
            <Landmark size={23} />
          </span>
          <span>
            HERITAGE<span className="brand-light">LENS</span>
            <small>DISCOVER THE PAST</small>
          </span>
        </a>

        <div className={`nav-links ${menuOpen ? "show-menu" : ""}`}>
          <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="/explore" onClick={() => setMenuOpen(false)}>Explore</a>
          <a href="/archive" onClick={() => setMenuOpen(false)}>Archive</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>

         
        </div>

        <a href="/explore" className="nav-button">
          Start Exploring <ArrowUpRight size={16} />
        </a>

        <button
          className="menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* HERO */}
      <main>
        <section className="hero" id="home">
          <div className="hero-overlay"></div>

          <div className="hero-content">
            <div className="eyebrow">
              <span></span>
              PRESERVING OUR CULTURAL LEGACY
            </div>

            <h1>
              Every monument
              <br />
              holds a <em>story.</em>
            </h1>

            <p>
              Journey through centuries of history.
              Discover remarkable monuments, forgotten
              stories and the cultural treasures of India.
            </p>

            <div className="hero-actions">
              <a href="/explore" className="primary-button">
                Explore Heritage <ArrowRight size={17} />
              </a>

              <a href="/archive" className="secondary-button">
                Discover Archive
              </a>
            </div>
          </div>

          <div className="hero-bottom">
            <span>01 — EXPLORE THE EXTRAORDINARY</span>
            <span>INDIA · CULTURE · HISTORY</span>
          </div>

          <div className="hero-index">01 / 03</div>
        </section>

        {/* INTRODUCTION */}
        <section className="intro-section" id="about">
          <div className="section-label">
            <span>01</span> OUR MISSION
          </div>

          <div className="intro-content">
            <h2>
              History is not just
              <br />
              something we <em>remember.</em>
            </h2>

            <p>
              HeritageLens is a digital heritage platform
              bringing monuments, historical documents,
              photographs and interactive 3D experiences
              together in one place.
            </p>
          </div>

          <div className="intro-stats">
            <div>
              <strong>01</strong>
              <span>Discover</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Preserve</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Experience</span>
            </div>
          </div>
        </section>

        {/* FEATURED HERITAGE */}
        <section className="explore-section" id="explore">
          <div className="section-label">
            <span>02</span> THE COLLECTION
          </div>

          <div className="section-heading">
            <div>
              <h2>Explore the <em>heritage.</em></h2>
              <p>Discover India's remarkable architectural legacy.</p>
            </div>
            <a href="/archive" className="text-link">
              View Archive <ArrowUpRight size={17} />
            </a>
          </div>

          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search monuments, locations or historical periods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>SEARCH</span>
          </div>

          <div className="heritage-grid">
            {sitesLoading ? (
  <p className="no-results">Loading monuments...</p>
) : filteredSites.length > 0 ? (
  filteredSites.map((site, index) => (
    <article className="heritage-card" key={site.id}>
      <div className="card-image">
        <img src={site.image} alt={site.name} />

        <span className="card-number">
          {String(index + 1).padStart(2, "0")}
        </span>

        <button
          className="card-arrow"
          aria-label={`Explore ${site.name}`}
          onClick={() => navigate(`/monument/${site.id}`)}
        >
          <ArrowUpRight size={20} />
        </button>
      </div>

      <div className="card-info">
        <span className="card-period">{site.period}</span>
        <h3>{site.name}</h3>
        <p>
          <MapPin size={14} /> {site.location}
        </p>
      </div>
    </article>
  ))
) : (
  <p className="no-results">
    No monuments found. Try another search.
  </p>
)}
          </div>
        </section>

        {/* DISCOVER */}
        <section className="discover-section" id="archive">
          <div className="discover-content">
            <div className="section-label">
              <span>03</span> BEYOND THE PHOTOGRAPHS
            </div>

            <h2>
              History deserves
              <br />
              to be <em>experienced.</em>
            </h2>

            <p>
              Explore geographical locations, historical
              archives and immersive three-dimensional
              monument experiences.
            </p>

            <div className="discover-features">
              <div><Compass /> Interactive Maps</div>
              <div><BookOpen /> Digital Archives</div>
              <div><Camera /> Historical Documents</div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <a href="#home" className="brand footer-brand">
          <Landmark size={23} />
          HERITAGE<span className="brand-light">LENS</span>
        </a>

        <p>Preserving the past. Inspiring the future.</p>
        <span>© 2026 HERITAGELENS · DIGITAL HERITAGE ARCHIVE</span>
      </footer>
    </div>
  );
}

export default App;
