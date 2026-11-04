
import { useState } from "react";
import {
  Landmark,
  ArrowLeft,
  FileText,
  Search,
  ScanText,
  BookOpen,
  Upload,
  LoaderCircle
} from "lucide-react";
import "../styles/archive.css";

const records = [
  {
    id: 1,
    title: "Historical Manuscript",
    period: "Historical Archive",
    language: "English",
    text: "Upload a document image and click Extract Text to see its OCR transcription here."
  },
  {
    id: 2,
    title: "Ancient Inscription",
    period: "Historical Archive",
    language: "English",
    text: "This is a sample archive record. Upload an image to extract its text."
  }
];

function Archive() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(records[0]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = records.filter((record) =>
    record.title.toLowerCase().includes(search.toLowerCase())
  );

  function handleFileChange(event) {
    const selectedFile = event.target.files[0];

    if (!selectedFile) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/tiff"
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please select a PNG, JPG, JPEG or TIFF image.");
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setExtractedText("");
    setError("");
  }

  async function handleExtract() {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }

    setLoading(true);
    setError("");
    setExtractedText("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/ocr",
        {
          method: "POST",
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "OCR processing failed.");
      }

      setExtractedText(
        data.extracted_text || "No text detected in this image."
      );
    } catch (err) {
      setError(
        err.message || "Could not connect to the OCR backend."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="archive-page">
      <header className="archive-header">
        <a href="/" className="archive-brand">
          <Landmark size={25} />
          <span>HERITAGE<span>LENS</span></span>
        </a>

        <a href="/" className="archive-back">
          <ArrowLeft size={16} /> Back to Home
        </a>
      </header>

      <section className="archive-heading">
        <span>DOCUMENTATION & DIGITAL PRESERVATION</span>
        <h1>Digital <em>Archive.</em></h1>
        <p>
          Upload historical documents and extract their text
          using optical character recognition.
        </p>
      </section>

      <main className="archive-layout">
        <aside className="archive-sidebar">
          <h2><BookOpen size={20} /> Archive Records</h2>

          <div className="archive-search">
            <Search size={17} />
            <input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.map((record) => (
            <button
              key={record.id}
              className={`archive-record ${
                selected.id === record.id ? "active" : ""
              }`}
              onClick={() => setSelected(record)}
            >
              <FileText size={20} />
              <span>
                <strong>{record.title}</strong>
                <small>{record.period}</small>
              </span>
            </button>
          ))}

          {filtered.length === 0 && (
            <p>No matching records found.</p>
          )}
        </aside>

        <section className="archive-content">
          <div className="archive-toolbar">
            <div>
              <span>DOCUMENT OCR WORKSPACE</span>
              <h2>{selected.title}</h2>
            </div>
            <span className="archive-tag">OCR ENABLED</span>
          </div>

          <div className="upload-area">
            <Upload size={28} />
            <h3>Upload Historical Document</h3>
            <p>Select a clear JPG, PNG or TIFF image.</p>

            <label className="upload-button">
              Choose Image
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.tif,.tiff,image/*"
                onChange={handleFileChange}
                hidden
              />
            </label>

            {file && <p className="selected-file">{file.name}</p>}
          </div>

          <div className="document-grid">
            <div className="document-preview">
              <div className="preview-label">
                <FileText size={17} /> ORIGINAL DOCUMENT
              </div>

              <div className="paper-placeholder">
                {preview ? (
                  <img
                    src={preview}
                    alt="Uploaded document preview"
                    className="uploaded-document"
                  />
                ) : (
                  <>
                    <FileText size={42} />
                    <h3>Document Preview</h3>
                    <p>Your uploaded image will appear here.</p>
                  </>
                )}
              </div>
            </div>

            <div className="transcription-panel">
              <div className="preview-label">
                <ScanText size={17} /> EXTRACTED TEXT
              </div>

              <div className="transcription-body">
                <span>OCR TRANSCRIPTION</span>
                <h3>{file ? file.name : selected.title}</h3>

                <p className="extracted-text">
                  {extractedText || selected.text}
                </p>

                {error && (
                  <p className="ocr-error">{error}</p>
                )}

                <button
                  className="extract-button"
                  onClick={handleExtract}
                  disabled={!file || loading}
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={17} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ScanText size={17} />
                      Extract Text
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="archive-note">
            OCR uses Tesseract English language recognition.
            Always review extracted text for accuracy.
          </p>
        </section>
      </main>

      <footer className="archive-footer">
        HERITAGELENS · DIGITAL HERITAGE ARCHIVE
      </footer>
    </div>
  );
}

export default Archive;
