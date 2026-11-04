
from flask import Flask, request, jsonify, send_from_directory, session
from functools import wraps
from flask_cors import CORS
from PIL import Image
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash
from dotenv import load_dotenv
import psycopg2
import pytesseract
import os
import uuid
import secrets


load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY")
frontend_url = os.getenv("FRONTEND_URL", "")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]

if frontend_url:
    allowed_origins.append(frontend_url.rstrip("/"))

CORS(
    app,
    supports_credentials=True,
    origins=allowed_origins
)

app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False  # Set True when deployed with HTTPS.

app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024


# Tesseract OCR path (Windows and Linux)
tesseract_cmd = os.getenv("TESSERACT_CMD")

if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
elif os.name == "nt":
    pytesseract.pytesseract.tesseract_cmd = (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
VISITOR_FOLDER = os.path.join(UPLOAD_FOLDER, "visitor_photos")

COVER_FOLDER = os.path.join(UPLOAD_FOLDER, "monument_covers")
GALLERY_FOLDER = os.path.join(UPLOAD_FOLDER, "monument_gallery")

os.makedirs(COVER_FOLDER, exist_ok=True)
os.makedirs(GALLERY_FOLDER, exist_ok=True)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VISITOR_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


# PostgreSQL connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )


# Check image extension
def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def admin_required(function):
    @wraps(function)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return jsonify({
                "success": False,
                "error": "Admin login required"
            }), 401
        return function(*args, **kwargs)
    return decorated


# Home API
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "HeritageLens Backend is running!"
    })


# OCR API
@app.route("/api/ocr", methods=["POST"])
def extract_text():

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        image = Image.open(file.stream)
        image.verify()

        file.stream.seek(0)
        image = Image.open(file.stream).convert("RGB")

        extracted_text = pytesseract.image_to_string(
            image,
            lang="eng"
        )

        return jsonify({
            "success": True,
            "filename": file.filename,
            "extracted_text": extracted_text
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 400


# Get visitor photos - No admin approval required
@app.route("/api/visitor-photos/<int:monument_id>", methods=["GET"])
def get_visitor_photos(monument_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, visitor_name, photo_path, caption, uploaded_at
            FROM visitor_photos
            WHERE monument_id = %s
            AND approval_status = 'approved'
            ORDER BY uploaded_at DESC
            """,
            (monument_id,)
        )

        photos = cursor.fetchall()
        result = []

        for photo in photos:
            filename = os.path.basename(photo[2])

            result.append({
                "id": photo[0],
                "visitor_name": photo[1],
                "photo_url": (
                    f"http://127.0.0.1:5000/uploads/visitor_photos/{filename}"
                ),
                "caption": photo[3],
                "uploaded_at": photo[4].isoformat() if photo[4] else None
            })

        return jsonify({
            "success": True,
            "photos": result
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route("/api/admin/visitor-photos/<int:photo_id>", methods=["PATCH"])
@admin_required
def review_visitor_photo(photo_id):
    conn = None

    try:
        data = request.get_json()
        status = data.get("status")

        if status not in ["approved", "rejected"]:
            return jsonify({"message": "Invalid status"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE visitor_photos
            SET approval_status = %s
            WHERE id = %s
            RETURNING id
        """, (status, photo_id))

        updated = cursor.fetchone()
        conn.commit()
        cursor.close()

        if not updated:
            return jsonify({"message": "Photo not found"}), 404

        return jsonify({
            "success": True,
            "message": f"Photo {status} successfully"
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print("Review visitor photo error:", e)
        return jsonify({"message": "Unable to update photo status"}), 500

    finally:
        if conn:
            conn.close()



# Visitor Photo Upload API - Direct gallery upload
@app.route("/api/visitor-photos", methods=["POST"])
def upload_visitor_photo():

    visitor_name = request.form.get("visitor_name", "").strip()
    monument_id = request.form.get("monument_id", "").strip()
    caption = request.form.get("caption", "").strip()

    if not visitor_name or not monument_id:
        return jsonify({
            "success": False,
            "error": "Visitor name and monument ID are required"
        }), 400

    if len(visitor_name) > 100 or len(caption) > 1000:
        return jsonify({
            "success": False,
            "error": "Name or caption is too long"
        }), 400

    try:
        monument_id = int(monument_id)

        if monument_id not in [1, 2, 3, 4, 5]:
            return jsonify({
                "success": False,
                "error": "Invalid monument ID"
            }), 400

    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid monument ID"
        }), 400

    if "photo" not in request.files:
        return jsonify({
            "success": False,
            "error": "Please select a photo"
        }), 400

    photo = request.files["photo"]

    if photo.filename == "" or not allowed_file(photo.filename):
        return jsonify({
            "success": False,
            "error": "Please upload PNG, JPG, JPEG or WEBP image"
        }), 400

    filename = secure_filename(photo.filename)
    extension = filename.rsplit(".", 1)[1].lower()

    unique_filename = f"{uuid.uuid4().hex}.{extension}"
    photo_path = os.path.join(VISITOR_FOLDER, unique_filename)

    connection = None
    cursor = None

    try:
        image = Image.open(photo.stream)
        image.verify()

        photo.stream.seek(0)
        image = Image.open(photo.stream)

        if image.format not in ["PNG", "JPEG", "WEBP"]:
            return jsonify({
                "success": False,
                "error": "Invalid image format"
            }), 400

        image.save(photo_path)

        relative_path = f"uploads/visitor_photos/{unique_filename}"

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO visitor_photos
            (monument_id, visitor_name, photo_path, caption, approval_status)
            VALUES (%s, %s, %s, %s, 'pending')
            RETURNING id
            """,
            (monument_id, visitor_name, relative_path, caption)
        )

        photo_id = cursor.fetchone()[0]

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Photo submitted for admin approval!",
            "photo_id": photo_id,
            "approval_status": "pending"
        }), 201

    except Exception as error:

        if connection:
            connection.rollback()

        if os.path.exists(photo_path):
            os.remove(photo_path)

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
            


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    try:
        data = request.get_json()

        username = data.get("username", "")
        password = data.get("password", "")

        admin_username = os.getenv("ADMIN_USERNAME")
        admin_password_hash = os.getenv("ADMIN_PASSWORD_HASH")

        if not admin_username or not admin_password_hash:
            return jsonify({
                "message": "Admin credentials are not configured"
            }), 500

        if (
            username == admin_username
            and check_password_hash(admin_password_hash, password)
        ):
            session["admin_logged_in"] = True
            session["admin_username"] = username

            return jsonify({
                "message": "Login successful"
            }), 200

        return jsonify({
            "message": "Invalid username or password"
        }), 401

    except Exception as e:
        print("Admin login error:", e)
        return jsonify({
            "message": "Internal server error"
        }), 500


# Admin Delete Visitor Photo API
@app.route("/api/admin/visitor-photos/<int:photo_id>", methods=["DELETE"])
@admin_required
def delete_visitor_photo(photo_id):

    connection = None
    cursor = None
    photo_path = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Find photo
        cursor.execute(
            """
            SELECT photo_path
            FROM visitor_photos
            WHERE id = %s
            """,
            (photo_id,)
        )

        result = cursor.fetchone()

        if not result:
            return jsonify({
                "success": False,
                "error": "Photo not found"
            }), 404

        photo_path = result[0]

        # Delete database record
        cursor.execute(
            "DELETE FROM visitor_photos WHERE id = %s",
            (photo_id,)
        )

        connection.commit()

        # Delete image file from server
        filename = os.path.basename(photo_path)
        full_path = os.path.join(VISITOR_FOLDER, filename)

        if os.path.isfile(full_path):
            os.remove(full_path)

        return jsonify({
            "success": True,
            "message": "Photo deleted successfully!"
        }), 200

    except Exception as error:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ==========================================
# COMMUNITY SUGGESTED PLACES APIs
# ==========================================

# Visitor submits a nearby place
@app.route("/api/nearby-places", methods=["POST"])
def submit_nearby_place():
    data = request.get_json(silent=True) or {}

    visitor_name = str(data.get("visitor_name", "")).strip()
    monument_id = data.get("monument_id")
    place_name = str(data.get("place_name", "")).strip()
    location = str(data.get("location", "")).strip()
    description = str(data.get("description", "")).strip()

    if not visitor_name or not place_name or not location:
        return jsonify({
            "success": False,
            "error": "Name, place name and location are required"
        }), 400

    try:
        monument_id = int(monument_id)
        if monument_id not in [1, 2, 3, 4, 5]:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "Invalid monument ID"
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO nearby_places
            (monument_id, visitor_name, place_name, location,
             description, approval_status)
            VALUES (%s, %s, %s, %s, %s, 'pending')
            RETURNING id
        """, (
            monument_id,
            visitor_name,
            place_name,
            location,
            description
        ))

        place_id = cursor.fetchone()[0]
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Place suggestion submitted for admin approval!",
            "place_id": place_id,
            "approval_status": "pending"
        }), 201

    except Exception as error:
        if connection:
            connection.rollback()

        print("Nearby place submission error:", error)

        return jsonify({
            "success": False,
            "error": "Unable to submit place suggestion"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# Public API: Get only approved nearby places
@app.route("/api/nearby-places/<int:monument_id>", methods=["GET"])
def get_nearby_places(monument_id):

    if monument_id not in [1, 2, 3, 4, 5]:
        return jsonify({
            "success": False,
            "error": "Invalid monument ID"
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, visitor_name, place_name, location,
                   description, submitted_at
            FROM nearby_places
            WHERE monument_id = %s
            AND approval_status = 'approved'
            ORDER BY submitted_at DESC
            """,
            (monument_id,)
        )

        rows = cursor.fetchall()

        places = []

        for row in rows:
            places.append({
                "id": row[0],
                "visitor_name": row[1],
                "place_name": row[2],
                "location": row[3],
                "description": row[4],
                "submitted_at": (
                    row[5].isoformat() if row[5] else None
                )
            })

        return jsonify({
            "success": True,
            "places": places
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()



@app.route("/api/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    conn = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                COUNT(*) AS total_photos,
                COUNT(*) FILTER (
                    WHERE approval_status = 'pending'
                ) AS pending_photos
            FROM visitor_photos
        """)
        photo_data = cursor.fetchone()

        cursor.execute("""
            SELECT
                COUNT(*) AS total_places,
                COUNT(*) FILTER (
                    WHERE approval_status = 'pending'
                ) AS pending_places
            FROM nearby_places
        """)
        place_data = cursor.fetchone()

        cursor.close()

        return jsonify({
            "total_photos": photo_data[0],
            "pending_photos": photo_data[1],
            "total_places": place_data[0],
            "pending_places": place_data[1]
        }), 200

    except Exception as e:
        print("Admin dashboard error:", e)
        return jsonify({"message": "Dashboard data could not be loaded"}), 500

    finally:
        if conn:
            conn.close()



@app.route("/api/admin/visitor-photos", methods=["GET"])
@admin_required
def admin_get_visitor_photos():
    conn = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id,
                monument_id,
                visitor_name,
                photo_path,
                caption,
                approval_status,
                uploaded_at
            FROM visitor_photos
            ORDER BY uploaded_at DESC
        """)

        rows = cursor.fetchall()

        photos = []

        for row in rows:
            photos.append({
                "id": row[0],
                "monument_id": row[1],
                "visitor_name": row[2],
                "photo_path": row[3],
                "caption": row[4],
                "approval_status": row[5],
                "uploaded_at": row[6].isoformat() if row[6] else None
            })

        cursor.close()

        return jsonify(photos), 200

    except Exception as e:
        print("Admin visitor photos error:", e)
        return jsonify({
            "message": "Unable to load visitor photos"
        }), 500

    finally:
        if conn:
            conn.close()


# Admin API: View pending suggestions
@app.route("/api/admin/nearby-places", methods=["GET"])
@admin_required
def get_admin_nearby_places():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, monument_id, visitor_name, place_name,
                   location, description, approval_status, submitted_at
            FROM nearby_places
            ORDER BY submitted_at DESC
        """)

        rows = cursor.fetchall()

        places = []
        for row in rows:
            places.append({
                "id": row[0],
                "monument_id": row[1],
                "visitor_name": row[2],
                "place_name": row[3],
                "location": row[4],
                "description": row[5],
                "approval_status": row[6],
                "submitted_at": row[7].isoformat() if row[7] else None
            })

        return jsonify({
            "success": True,
            "places": places
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# Admin API: Approve or reject a suggestion
@app.route(
    "/api/admin/nearby-places/<int:place_id>",
    methods=["PATCH"]
)
@admin_required
def review_nearby_place(place_id):

    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ["approved", "rejected"]:
        return jsonify({
            "success": False,
            "error": "Status must be approved or rejected"
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE nearby_places
            SET approval_status = %s
            WHERE id = %s
            RETURNING id
            """,
            (status, place_id)
        )

        result = cursor.fetchone()

        if not result:
            return jsonify({
                "success": False,
                "error": "Place suggestion not found"
            }), 404

        connection.commit()

        return jsonify({
            "success": True,
            "message": f"Place suggestion {status} successfully!"
        })

    except Exception as error:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()




@app.route("/api/admin/nearby-places/<int:place_id>", methods=["DELETE"])
@admin_required
def delete_nearby_place(place_id):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM nearby_places WHERE id = %s RETURNING id",
            (place_id,)
        )
        result = cursor.fetchone()
        if not result:
            return jsonify({"success": False, "error": "Place not found"}), 404
        connection.commit()
        return jsonify({"success": True, "message": "Place deleted successfully"})
    except Exception as error:
        if connection:
            connection.rollback()
        return jsonify({"success": False, "error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route("/api/admin/logout", methods=["POST"])
@admin_required
def admin_logout():
    session.pop("admin_logged_in", None)
    session.pop("admin_username", None)

    return jsonify({
        "success": True,
        "message": "Admin logged out successfully"
    }), 200

# Display uploaded visitor photos
@app.route("/uploads/visitor_photos/<filename>", methods=["GET"])
def get_visitor_photo(filename):
    return send_from_directory(VISITOR_FOLDER, filename)



# ==============================
# MONUMENT MANAGEMENT APIs
# ==============================

# Public: Get all monuments
@app.route("/api/monuments", methods=["GET"])
def get_monuments():

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
            
        cursor.execute("""
          SELECT id, name, location, period, monument_type,
           description, history, architecture,
           image_url, sketchfab_url, latitude, longitude
           FROM monuments
            ORDER BY id
            """)

        rows = cursor.fetchall()

        monuments = []

        for row in rows:
            monuments.append({
                "id": row[0],
                "name": row[1],
                "location": row[2],
                "period": row[3],
                "type": row[4],
                "description": row[5],
                "history": row[6],
                "architecture": row[7],
                "image_url": row[8],
                "sketchfab_url": row[9]
            })

        return jsonify({
            "success": True,
            "monuments": monuments
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# Public: Get one monument
@app.route("/api/monuments/<int:monument_id>", methods=["GET"])
def get_monument(monument_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, name, location, period, monument_type,
                   description, history, architecture,
                   image_url, sketchfab_url
            FROM monuments
            WHERE id = %s
        """, (monument_id,))

        row = cursor.fetchone()

        if not row:
            return jsonify({
                "success": False,
                "error": "Monument not found"
            }), 404

        monument = {
            "id": row[0],
            "name": row[1],
            "location": row[2],
            "period": row[3],
            "type": row[4],
            "description": row[5],
            "history": row[6],
            "architecture": row[7],
            "image_url": row[8],
            "sketchfab_url": row[9]
        }

        return jsonify({
            "success": True,
            "monument": monument
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()



def get_coordinates(location, monument_name=None):
    if not location:
        return None, None

    search_query = f"{monument_name}, {location}" if monument_name else location

    try:
        url = "https://nominatim.openstreetmap.org/search"

        headers = {
            "User-Agent": "HeritageLens/1.0 (heritage research project)"
        }

        params = {
            "q": search_query,
            "format": "json",
            "limit": 1
        }

        response = requests.get(
            url,
            params=params,
            headers=headers,
            timeout=10
        )

        response.raise_for_status()
        results = response.json()

        if results:
            latitude = float(results[0]["lat"])
            longitude = float(results[0]["lon"])
            return latitude, longitude

        return None, None

    except Exception as error:
        print("Geocoding error:", error)
        return None, None




@app.route("/api/admin/monuments", methods=["POST"])
@admin_required
def add_monument():

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    location = (data.get("location") or "").strip()

    if not name:
        return jsonify({
            "success": False,
            "error": "Monument name is required"
        }), 400

    try:
        latitude = float(data.get("latitude"))
        longitude = float(data.get("longitude"))

        if not (-90 <= latitude <= 90):
            raise ValueError("Invalid latitude")

        if not (-180 <= longitude <= 180):
            raise ValueError("Invalid longitude")

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "Valid latitude and longitude are required"
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO monuments
            (name, location, period, monument_type, description,
             history, architecture, image_url, sketchfab_url,
             latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            name,
            location,
            data.get("period"),
            data.get("type"),
            data.get("description"),
            data.get("history"),
            data.get("architecture"),
            data.get("image_url"),
            data.get("sketchfab_url"),
            latitude,
            longitude
        ))

        monument_id = cursor.fetchone()[0]
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Monument added successfully",
            "id": monument_id
        }), 201

    except Exception as error:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# Admin: Edit monument
@app.route("/api/admin/monuments/<int:monument_id>", methods=["PUT"])
@admin_required
def update_monument(monument_id):

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({
            "success": False,
            "error": "Monument name is required"
        }), 400

    try:
        latitude = float(data.get("latitude"))
        longitude = float(data.get("longitude"))

        if not (-90 <= latitude <= 90):
            raise ValueError("Invalid latitude")

        if not (-180 <= longitude <= 180):
            raise ValueError("Invalid longitude")

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "Valid latitude and longitude are required"
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE monuments
            SET name = %s,
                location = %s,
                period = %s,
                monument_type = %s,
                description = %s,
                history = %s,
                architecture = %s,
                image_url = %s,
                sketchfab_url = %s,
                latitude = %s,
                longitude = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (
            name,
            data.get("location"),
            data.get("period"),
            data.get("type"),
            data.get("description"),
            data.get("history"),
            data.get("architecture"),
            data.get("image_url"),
            data.get("sketchfab_url"),
            latitude,
            longitude,
            monument_id
        ))

        if cursor.rowcount == 0:
            return jsonify({
                "success": False,
                "error": "Monument not found"
            }), 404

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Monument updated successfully"
        })

    except Exception as error:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# Admin: Delete monument
@app.route("/api/admin/monuments/<int:monument_id>", methods=["DELETE"])
@admin_required
def delete_monument(monument_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Prevent deleting monuments that have visitor data
        cursor.execute("""
            SELECT
                (SELECT COUNT(*) FROM visitor_photos
                 WHERE monument_id = %s) +
                (SELECT COUNT(*) FROM nearby_places
                 WHERE monument_id = %s)
        """, (monument_id, monument_id))

        related_count = cursor.fetchone()[0]

        if related_count > 0:
            return jsonify({
                "success": False,
                "error": "This monument has visitor photos or nearby places. Remove that related data first."
            }), 409

        cursor.execute(
            "DELETE FROM monuments WHERE id = %s",
            (monument_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({
                "success": False,
                "error": "Monument not found"
            }), 404

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Monument deleted successfully"
        })

    except Exception as error:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()




# ==========================================
# MONUMENT COVER AND GALLERY IMAGE APIs
# ==========================================

def validate_monument_image(file):
    if not file or not file.filename:
        return False

    if not allowed_file(file.filename):
        return False

    try:
        image = Image.open(file.stream)
        image.verify()
        file.stream.seek(0)

        image = Image.open(file.stream)

        if image.format not in ["PNG", "JPEG", "WEBP"]:
            return False

        file.stream.seek(0)
        return True

    except Exception:
        file.stream.seek(0)
        return False


# Upload or replace monument cover image
@app.route(
    "/api/admin/monuments/<int:monument_id>/cover",
    methods=["POST"]
)
@admin_required
def upload_monument_cover(monument_id):

    photo = request.files.get("image")

    if not validate_monument_image(photo):
        return jsonify({
            "success": False,
            "error": "Please upload a valid PNG, JPG, JPEG or WEBP image"
        }), 400

    connection = None
    cursor = None
    saved_path = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT image_url FROM monuments WHERE id = %s",
            (monument_id,)
        )

        old_record = cursor.fetchone()

        if not old_record:
            return jsonify({
                "success": False,
                "error": "Monument not found"
            }), 404

        extension = photo.filename.rsplit(".", 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{extension}"

        saved_path = os.path.join(COVER_FOLDER, filename)
        photo.save(saved_path)

        image_url = (
            f"http://127.0.0.1:5000/uploads/monument_covers/{filename}"
        )

        cursor.execute("""
            UPDATE monuments
            SET image_url = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (image_url, monument_id))

        connection.commit()

        # Remove previous uploaded cover, if it belongs to this folder
        old_url = old_record[0]

        if old_url and "/uploads/monument_covers/" in old_url:
            old_filename = os.path.basename(old_url)
            old_path = os.path.join(COVER_FOLDER, old_filename)

            if os.path.isfile(old_path) and old_path != saved_path:
                os.remove(old_path)

        return jsonify({
            "success": True,
            "message": "Cover image uploaded successfully",
            "image_url": image_url
        }), 201

    except Exception as error:
        if connection:
            connection.rollback()

        if saved_path and os.path.isfile(saved_path):
            os.remove(saved_path)

        print("Cover upload error:", error)

        return jsonify({
            "success": False,
            "error": "Unable to upload cover image"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# Upload one gallery image
@app.route(
    "/api/admin/monuments/<int:monument_id>/gallery",
    methods=["POST"]
)
@admin_required
def upload_monument_gallery(monument_id):

    photo = request.files.get("image")

    if not validate_monument_image(photo):
        return jsonify({
            "success": False,
            "error": "Please upload a valid image"
        }), 400

    connection = None
    cursor = None
    saved_path = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT id FROM monuments WHERE id = %s",
            (monument_id,)
        )

        if not cursor.fetchone():
            return jsonify({
                "success": False,
                "error": "Monument not found"
            }), 404

        extension = photo.filename.rsplit(".", 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{extension}"

        saved_path = os.path.join(GALLERY_FOLDER, filename)
        photo.save(saved_path)

        relative_path = f"uploads/monument_gallery/{filename}"

        cursor.execute("""
            INSERT INTO monument_gallery (monument_id, image_path)
            VALUES (%s, %s)
            RETURNING id
        """, (monument_id, relative_path))

        image_id = cursor.fetchone()[0]

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Gallery image uploaded successfully",
            "id": image_id,
            "image_url": (
                f"http://127.0.0.1:5000/{relative_path}"
            )
        }), 201

    except Exception as error:
        if connection:
            connection.rollback()

        if saved_path and os.path.isfile(saved_path):
            os.remove(saved_path)

        print("Gallery upload error:", error)

        return jsonify({
            "success": False,
            "error": "Unable to upload gallery image"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# Public: Get monument gallery images
@app.route(
    "/api/monuments/<int:monument_id>/gallery",
    methods=["GET"]
)
def get_monument_gallery(monument_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, image_path, created_at
            FROM monument_gallery
            WHERE monument_id = %s
            ORDER BY created_at DESC
        """, (monument_id,))

        rows = cursor.fetchall()

        images = []

        for row in rows:
            filename = os.path.basename(row[1])

            images.append({
                "id": row[0],
                "image_url": (
                    f"http://127.0.0.1:5000/uploads/monument_gallery/{filename}"
                ),
                "created_at": (
                    row[2].isoformat() if row[2] else None
                )
            })

        return jsonify({
            "success": True,
            "images": images
        }), 200

    except Exception as error:
        print("Gallery fetch error:", error)

        return jsonify({
            "success": False,
            "error": "Unable to load gallery"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# Admin: Delete gallery image
@app.route(
    "/api/admin/monuments/gallery/<int:image_id>",
    methods=["DELETE"]
)
@admin_required
def delete_monument_gallery_image(image_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT image_path
            FROM monument_gallery
            WHERE id = %s
        """, (image_id,))

        record = cursor.fetchone()

        if not record:
            return jsonify({
                "success": False,
                "error": "Image not found"
            }), 404

        image_path = record[0]

        cursor.execute(
            "DELETE FROM monument_gallery WHERE id = %s",
            (image_id,)
        )

        connection.commit()

        filename = os.path.basename(image_path)
        full_path = os.path.join(GALLERY_FOLDER, filename)

        if os.path.isfile(full_path):
            os.remove(full_path)

        return jsonify({
            "success": True,
            "message": "Gallery image deleted successfully"
        }), 200

    except Exception as error:
        if connection:
            connection.rollback()

        print("Gallery delete error:", error)

        return jsonify({
            "success": False,
            "error": "Unable to delete gallery image"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# Serve monument cover images
@app.route("/uploads/monument_covers/<filename>")
def serve_monument_cover(filename):
    return send_from_directory(COVER_FOLDER, filename)


# Serve monument gallery images
@app.route("/uploads/monument_gallery/<filename>")
def serve_monument_gallery(filename):
    return send_from_directory(GALLERY_FOLDER, filename)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
