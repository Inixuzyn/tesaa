from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import requests
import time
from functools import lru_cache
from typing import Dict, Any
import os

app = Flask(__name__, static_folder='../public', static_url_path='')
CORS(app)  # Enable CORS untuk semua route

BASE_URL = "https://api.shngm.io"
session = requests.Session()

# User-Agent anti-ban
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
    'Referer': 'https://shinigami.asia/',
    'Origin': 'https://shinigami.asia'
}

# Cache untuk mengurangi request
CACHE_DURATION = 300  # 5 menit
cache_store = {}

def get_cached_data(key, fetch_func, *args, **kwargs):
    """Simple cache implementation"""
    current_time = time.time()
    if key in cache_store:
        data, timestamp = cache_store[key]
        if current_time - timestamp < CACHE_DURATION:
            return data
    
    data = fetch_func(*args, **kwargs)
    cache_store[key] = (data, current_time)
    return data

def api_call(endpoint: str, params: Dict[str, Any] = None):
    """Universal API caller dengan error handling"""
    try:
        url = f"{BASE_URL}/{endpoint}"
        # Clean endpoint
        if endpoint.startswith('/'):
            endpoint = endpoint[1:]
        
        print(f"📡 API Call: {url}")
        
        resp = session.get(
            url, 
            headers=HEADERS, 
            params=params, 
            timeout=15,
            verify=True
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return {"error": "Timeout", "message": "API request timeout"}
    except requests.exceptions.ConnectionError:
        return {"error": "Connection Error", "message": "Cannot connect to API"}
    except requests.exceptions.HTTPError as e:
        return {"error": f"HTTP Error: {e.response.status_code}", "message": str(e)}
    except Exception as e:
        return {"error": "Unknown Error", "message": str(e)}

@app.route('/')
def serve_frontend():
    """Serve frontend index.html"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/')
def api_home():
    """Multiple home endpoints"""
    cache_key = "home_data"
    
    def fetch_home_data():
        return {
            "new": api_call("v1/manga/list", {
                "type": "project", "page": 1, "page_size": 30, 
                "is_update": "true", "sort": "latest", "sort_order": "desc"
            }),
            "top": api_call("v1/manga/list", {
                "type": "project", "page": 1, "page_size": 24,
                "is_update": "true", "sort": "latest", "sort_order": "desc"
            }),
            "recommend": api_call("v1/manga/list", {
                "type": "mirror", "page": 1, "page_size": 24,
                "is_update": "true", "sort": "latest", "sort_order": "desc"
            }),
            "timestamp": time.time()
        }
    
    data = get_cached_data(cache_key, fetch_home_data)
    return jsonify(data)

@app.route('/api/v1/manga/list')
def manga_list():
    """Full manga list endpoint"""
    params = {
        "type": request.args.get('type', 'project'),
        "page": request.args.get('page', 1, type=int),
        "page_size": request.args.get('page_size', 30, type=int),
        "is_update": request.args.get('is_update', 'true'),
        "sort": request.args.get('sort', 'latest'),
        "sort_order": request.args.get('sort_order', 'desc'),
        "q": request.args.get('q', '')
    }
    
    cache_key = f"manga_list_{params}"
    data = get_cached_data(cache_key, api_call, "v1/manga/list", params)
    return jsonify(data)

@app.route('/api/v1/manga/detail/<manhwa_id>')
def manga_detail(manhwa_id: str):
    """Detail manga"""
    cache_key = f"manga_detail_{manhwa_id}"
    data = get_cached_data(cache_key, api_call, f"v1/manga/detail/{manhwa_id}")
    return jsonify(data)

@app.route('/api/v1/chapter/<manhwa_id>/list')
def chapter_list(manhwa_id: str):
    """Chapter list pagination"""
    params = {
        "page": request.args.get('page', 1, type=int),
        "page_size": request.args.get('page_size', 24, type=int),
        "sort_by": request.args.get('sort_by', 'chapter_number'),
        "sort_order": request.args.get('sort_order', 'desc')
    }
    
    cache_key = f"chapter_list_{manhwa_id}_{params}"
    data = get_cached_data(cache_key, api_call, f"v1/chapter/{manhwa_id}/list", params)
    return jsonify(data)

@app.route('/api/v1/chapter/detail/<chapter_id>')
def chapter_detail(chapter_id: str):
    """Chapter detail + images"""
    cache_key = f"chapter_detail_{chapter_id}"
    data = get_cached_data(cache_key, api_call, f"v1/chapter/detail/{chapter_id}")
    return jsonify(data)

@app.route('/api/search')
def search():
    """Search endpoint"""
    keyword = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)
    
    params = {
        "page": page, 
        "page_size": 5, 
        "q": keyword
    }
    
    cache_key = f"search_{keyword}_{page}"
    data = get_cached_data(cache_key, api_call, "v1/manga/list", params)
    return jsonify(data)

# Legacy endpoints support
@app.route('/api/api/home')
def legacy_api_home():
    data = api_call("api/home")
    return jsonify(data)

@app.route('/api/api/manhwa-detail/<manhwa_id>')
def legacy_api_manhwa_detail(manhwa_id: str):
    data = api_call(f"api/manhwa-detail/{manhwa_id}")
    return jsonify(data)

@app.route('/api/api/chapter/<chapter_id>')
def legacy_api_chapter(chapter_id: str):
    data = api_call(f"api/chapter/{chapter_id}")
    return jsonify(data)

@app.route('/api/api/genres')
def legacy_api_genres():
    data = api_call("api/genres")
    return jsonify(data)

@app.route('/api/health')
def health_check():
    """Health check endpoint untuk Vercel"""
    return jsonify({
        "status": "healthy",
        "service": "Shinigami Manga API",
        "timestamp": time.time(),
        "base_url": BASE_URL
    })

@app.route('/api/ping')
def ping():
    """Status check dengan detail"""
    try:
        test_resp = session.get(f"{BASE_URL}/", headers=HEADERS, timeout=5)
        api_status = "connected" if test_resp.status_code == 200 else "disconnected"
    except:
        api_status = "error"
    
    return jsonify({
        "status": "OK",
        "api_status": api_status,
        "base_url": BASE_URL,
        "endpoints": [
            "/api/",
            "/api/search?q=solo",
            "/api/v1/manga/list",
            "/api/v1/manga/detail/[ID]",
            "/api/v1/chapter/[ID]/list",
            "/api/v1/chapter/detail/[ID]"
        ]
    })

# Serve static files
@app.route('/<path:path>')
def serve_static(path):
    """Serve static files dari public folder"""
    return send_from_directory(app.static_folder, path)

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found", "message": "Endpoint tidak ditemukan"}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({"error": "Server error", "message": "Terjadi kesalahan internal"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False)
else:
    # Untuk production di Vercel
    gunicorn_app = app
