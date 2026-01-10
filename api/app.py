from flask import Flask, jsonify, request, send_from_directory
import requests
import os
import time
import json

app = Flask(__name__)

# Manual CORS
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

BASE_URL = "https://api.shngm.io"
session = requests.Session()

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://shinigami.asia/'
}

# Cache sederhana
cache = {}
CACHE_DURATION = 300  # 5 menit

def get_cached(key):
    """Get from cache if not expired"""
    if key in cache:
        data, timestamp = cache[key]
        if time.time() - timestamp < CACHE_DURATION:
            return data
    return None

def set_cached(key, data):
    """Set cache"""
    cache[key] = (data, time.time())

# ==================== API PROXY ====================
def fetch_from_shinigami(endpoint, params=None):
    """Universal fetcher dengan retry"""
    url = f"{BASE_URL}/{endpoint}"
    
    try:
        response = session.get(
            url, 
            headers=HEADERS, 
            params=params, 
            timeout=15
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "error": True,
                "status_code": response.status_code,
                "message": f"API returned {response.status_code}"
            }
            
    except Exception as e:
        return {
            "error": True,
            "message": str(e),
            "endpoint": endpoint
        }

# ==================== ENDPOINTS ====================
@app.route('/api/ping')
def ping():
    return jsonify({"status": "pong", "timestamp": int(time.time())})

@app.route('/api/health')
def health():
    try:
        test = session.get(BASE_URL, timeout=5)
        return jsonify({
            "status": "healthy",
            "upstream": "connected" if test.status_code == 200 else "disconnected",
            "region": os.environ.get('VERCEL_REGION', 'local')
        })
    except:
        return jsonify({"status": "healthy", "upstream": "error"})

@app.route('/api/')
def api_root():
    return jsonify({
        "name": "Shinigami Manga API Proxy",
        "version": "1.0",
        "endpoints": [
            "/api/v1/manga/list",
            "/api/v1/manga/detail/<id>",
            "/api/v1/chapter/<manga_id>/list",
            "/api/v1/chapter/detail/<chapter_id>",
            "/api/search?q=query"
        ]
    })

# ==================== V1 ENDPOINTS ====================
@app.route('/api/v1/manga/list')
def manga_list():
    """GET manga list - versi v1"""
    cache_key = f"manga_list_{request.query_string.decode()}"
    cached = get_cached(cache_key)
    
    if cached:
        return jsonify(cached)
    
    params = {
        'type': request.args.get('type', 'project'),
        'page': request.args.get('page', 1, type=int),
        'page_size': request.args.get('page_size', 30, type=int),
        'q': request.args.get('q', ''),
        'sort': request.args.get('sort', 'latest'),
        'sort_order': request.args.get('sort_order', 'desc'),
        'is_update': request.args.get('is_update', 'true')
    }
    
    data = fetch_from_shinigami("v1/manga/list", params)
    set_cached(cache_key, data)
    return jsonify(data)

@app.route('/api/v1/manga/detail/<manga_id>')
def manga_detail_v1(manga_id):
    """GET manga detail - versi v1"""
    cache_key = f"manga_detail_v1_{manga_id}"
    cached = get_cached(cache_key)
    
    if cached:
        return jsonify(cached)
    
    # Coba endpoint v1 dulu
    data = fetch_from_shinigami(f"v1/manga/detail/{manga_id}")
    
    # Jika v1 gagal, coba legacy
    if data.get('error'):
        data = fetch_from_shinigami(f"api/manhwa-detail/{manga_id}")
    
    set_cached(cache_key, data)
    return jsonify(data)

@app.route('/api/v1/chapter/<manga_id>/list')
def chapter_list(manga_id):
    """GET chapter list"""
    cache_key = f"chapter_list_{manga_id}_{request.query_string.decode()}"
    cached = get_cached(cache_key)
    
    if cached:
        return jsonify(cached)
    
    params = {
        'page': request.args.get('page', 1, type=int),
        'page_size': request.args.get('page_size', 50, type=int),
        'sort_by': request.args.get('sort_by', 'chapter_number'),
        'sort_order': request.args.get('sort_order', 'desc')
    }
    
    # Coba endpoint v1
    data = fetch_from_shinigami(f"v1/chapter/{manga_id}/list", params)
    
    # Jika v1 tidak ada data, coba format lain
    if data.get('error') or (isinstance(data, dict) and not data.get('data')):
        # Alternatif endpoint
        data = fetch_from_shinigami(f"api/chapter/list/{manga_id}")
    
    set_cached(cache_key, data)
    return jsonify(data)

@app.route('/api/v1/chapter/detail/<chapter_id>')
def chapter_detail(chapter_id):
    """GET chapter detail dengan gambar"""
    cache_key = f"chapter_detail_{chapter_id}"
    cached = get_cached(cache_key)
    
    if cached:
        return jsonify(cached)
    
    # Coba endpoint v1
    data = fetch_from_shinigami(f"v1/chapter/detail/{chapter_id}")
    
    # Jika v1 gagal, coba legacy
    if data.get('error'):
        data = fetch_from_shinigami(f"api/chapter/{chapter_id}")
    
    set_cached(cache_key, data)
    return jsonify(data)

# ==================== LEGACY ENDPOINTS ====================
@app.route('/api/manhwa-detail/<manga_id>')
def manga_detail_legacy(manga_id):
    """Legacy endpoint support"""
    return manga_detail_v1(manga_id)

@app.route('/api/chapter/<chapter_id>')
def chapter_legacy(chapter_id):
    """Legacy endpoint support"""
    return chapter_detail(chapter_id)

# ==================== SEARCH ====================
@app.route('/api/search')
def search():
    """Search endpoint"""
    query = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)
    
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400
    
    cache_key = f"search_{query}_{page}"
    cached = get_cached(cache_key)
    
    if cached:
        return jsonify(cached)
    
    params = {
        'q': query,
        'page': page,
        'page_size': 20,
        'type': 'project'
    }
    
    data = fetch_from_shinigami("v1/manga/list", params)
    set_cached(cache_key, data)
    return jsonify(data)

# ==================== HOME DATA ====================
@app.route('/api/home')
def home_data():
    """Homepage data - semua dalam satu endpoint"""
    cache_key = "home_data"
    cached = get_cached(cache_key)
    
    if cached:
        return jsonify(cached)
    
    # Fetch data paralel (simulasi)
    new_params = {'type': 'project', 'page': 1, 'page_size': 12, 'sort': 'latest'}
    top_params = {'type': 'project', 'page': 1, 'page_size': 12, 'sort': 'popular'}
    rec_params = {'type': 'mirror', 'page': 1, 'page_size': 12}
    
    new_data = fetch_from_shinigami("v1/manga/list", new_params)
    top_data = fetch_from_shinigami("v1/manga/list", top_params)
    rec_data = fetch_from_shinigami("v1/manga/list", rec_params)
    
    result = {
        "new": new_data,
        "top": top_data,
        "recommend": rec_data,
        "timestamp": int(time.time())
    }
    
    set_cached(cache_key, result)
    return jsonify(result)

# ==================== STATIC FILES ====================
@app.route('/')
def serve_frontend():
    return send_from_directory('../public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(f"../public/{path}"):
        return send_from_directory('../public', path)
    return jsonify({"error": "Not found", "path": path}), 404

# ==================== ERROR HANDLING ====================
@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Endpoint not found",
        "available_endpoints": [
            "/api/ping",
            "/api/health", 
            "/api/home",
            "/api/v1/manga/list",
            "/api/v1/manga/detail/{id}",
            "/api/search?q=query"
        ]
    }), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error", "message": str(e)}), 500

# ==================== VERCEL ENTRY ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)
