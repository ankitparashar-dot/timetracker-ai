from flask import Flask
from flask_cors import CORS
from auth import auth_bp
from routes import routes_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'

CORS(app, origins=["http://localhost:5173"], supports_credentials=True)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(routes_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True, port=5000)