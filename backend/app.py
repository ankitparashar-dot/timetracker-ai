from flask import Flask, send_from_directory, send_file
from flask_cors import CORS
from auth import auth_bp
from routes import routes_bp
import os

app = Flask(__name__, static_folder='dist', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

CORS(app, supports_credentials=True)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(routes_bp, url_prefix='/api')

# ── Serve React frontend from dist/ ──────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    dist_dir = os.path.join(os.path.dirname(__file__), 'dist')
    file_path = os.path.join(dist_dir, path)
    if path and os.path.exists(file_path):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)