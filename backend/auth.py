from flask import Blueprint, request, jsonify
import json, os, uuid, hashlib
from datetime import datetime
import base64

auth_bp = Blueprint('auth', __name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'db.json')

# ✅ Master admin credentials to unlock registration
MASTER_ADMIN_ID = "admin"
MASTER_ADMIN_PASSWORD = "admin123"

def load_db():
    if not os.path.exists(DB_PATH):
        default = {"users": [], "projects": [], "tasks": [], "members": []}
        save_db(default)
        return default
    with open(DB_PATH, 'r') as f:
        return json.load(f)

def save_db(data):
    with open(DB_PATH, 'w') as f:
        json.dump(data, f, indent=2)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token(user_id, email, role):
    payload = f"{user_id}:{email}:{role}:{datetime.utcnow().isoformat()}"
    return base64.b64encode(payload.encode()).decode()

def verify_token(token):
    try:
        decoded = base64.b64decode(token.encode()).decode()
        parts = decoded.split(':')
        if len(parts) < 3:
            return None
        return {"id": parts[0], "email": parts[1], "role": parts[2]}
    except:
        return None

def get_current_user():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return verify_token(token)

@auth_bp.route('/verify-admin', methods=['POST'])
def verify_admin():
    """✅ Step 1 of registration: verify master admin credentials"""
    data = request.get_json()
    admin_id = data.get('admin_id', '').strip()
    admin_password = data.get('admin_password', '').strip()

    if admin_id == MASTER_ADMIN_ID and admin_password == MASTER_ADMIN_PASSWORD:
        return jsonify({"success": True, "message": "Admin verified"}), 200
    return jsonify({"error": "Invalid admin ID or password"}), 401

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # ✅ Re-verify admin credentials on actual registration too (prevent bypass)
    admin_id = data.get('admin_id', '').strip()
    admin_password = data.get('admin_password', '').strip()
    if admin_id != MASTER_ADMIN_ID or admin_password != MASTER_ADMIN_PASSWORD:
        return jsonify({"error": "Admin verification required"}), 403

    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'member')

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if role not in ['admin', 'member']:
        return jsonify({"error": "Invalid role"}), 400

    db = load_db()
    if any(u['email'] == email for u in db['users']):
        return jsonify({"error": "Email already registered"}), 409

    user = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "password": hash_password(password),
        "role": role,
        "created_at": datetime.utcnow().isoformat()
    }
    db['users'].append(user)
    save_db(db)

    token = generate_token(user['id'], user['email'], user['role'])
    return jsonify({
        "token": token,
        "user": {"id": user['id'], "name": user['name'], "email": user['email'], "role": user['role']}
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    db = load_db()
    user = next((u for u in db['users'] if u['email'] == email), None)

    if not user or user['password'] != hash_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_token(user['id'], user['email'], user['role'])
    return jsonify({
        "token": token,
        "user": {"id": user['id'], "name": user['name'], "email": user['email'], "role": user['role']}
    }), 200

@auth_bp.route('/me', methods=['GET'])
def me():
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401
    db = load_db()
    user = next((u for u in db['users'] if u['id'] == current['id']), None)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": user['id'], "name": user['name'], "email": user['email'], "role": user['role']}), 200