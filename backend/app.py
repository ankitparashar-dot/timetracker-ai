from flask import Flask
from flask_cors import CORS
from auth import auth_bp
from routes import routes_bp
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

CORS(app, origins=[
    "http://localhost:5173",
    "https://timetracker-etharaaidhiraj.vercel.app"
], supports_credentials=True)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(routes_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=False, port=5000)