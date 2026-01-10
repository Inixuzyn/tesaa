from flask import Flask, jsonify, request, send_from_directory
import requests
import os
import time
import json

app = Flask(__name__)

BASE_URL = "https://api.shngm.io"
SESSION = requests.Session()

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://shinigami.asia/',
}

# ==================== CORS ====================
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    return response

# ==================== HELPER ====================
def fetch_shinigami(endpoint, params=None):
    """Fetch dari Shinigami API dengan format yang benar"""
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    
    try:
        response = SESSION.get(url, headers=HEADERS, params=params, timeout=15)
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "retcode": response.status_code,
                "message": f"HTTP {response.status_code}",
                "data": None
            }
    except Exception as e:
        return {
            "retcode": 500,
            "message": str(e),
            "data": None
        }

# ==================== V1 ENDPOINTS ====================
@app.route('/api/ping')
def ping():
    return jsonify({"status": "pong", "timestamp": int(time.time())})

@app.route('/api/health')
def health():
    try:
        test = SESSION.get(BASE_URL, timeout=5)
        return jsonify({
            "status": "healthy",
            "api": "connected" if test.status_code == 200 else "disconnected"
        })
    except:
        return jsonify({"status": "error", "api": "disconnected"})

# ==================== HOME ====================
@app.route('/api/home')
def home():
    """Home endpoint - gabungkan new, top, recommend"""
    result = {}
    
    # New manga
    new_params = {
        'type': 'project',
        'page': 1,
        'page_size': 12,
        'is_update': 'true',
        'sort': 'latest',
        'sort_order': 'desc'
    }
    new_data = fetch_shinigami('/v1/manga/list', new_params)
    result['new'] = new_data
    
    # Top manga (gunakan type=project, sort=latest karena ga ada sort=popular)
    top_params = {
        'type': 'project',
        'page': 1,
        'page_size': 12,
        'is_update': 'true',
        'sort': 'latest',  # NOTE: API mungkin tidak support 'popular'
        'sort_order': 'desc'
    }
    top_data = fetch_shinigami('/v1/manga/list', top_params)
    result['top'] = top_data
    
    # Recommendations (type=mirror)
    rec_params = {
        'type': 'mirror',
        'page': 1,
        'page_size': 12,
        'is_update': 'true',
        'sort': 'latest',
        'sort_order': 'desc'
    }
    rec_data = fetch_shinigami('/v1/manga/list', rec_params)
    result['recommend'] = rec_data
    
    return jsonify(result)

# ==================== MANGA LIST ====================
@app.route('/api/v1/manga/list')
def manga_list():
    """Get manga list dengan berbagai filter"""
    params = {
        'type': request.args.get('type', 'project'),
        'page': request.args.get('page', 1, type=int),
        'page_size': request.args.get('page_size', 30, type=int),
        'q': request.args.get('q', ''),
        'sort': request.args.get('sort', 'latest'),
        'sort_order': request.args.get('sort_order', 'desc'),
        'is_update': request.args.get('is_update', 'true')
    }
    
    data = fetch_shinigami('/v1/manga/list', params)
    return jsonify(data)

# ==================== MANGA DETAIL ====================
@app.route('/api/v1/manga/detail/<manga_id>')
def manga_detail(manga_id):
    """Get manga detail - HANYA V1 YANG BEKERJA!"""
    data = fetch_shinigami(f'/v1/manga/detail/{manga_id}')
    
    # Jika error, beri fallback
    if data.get('retcode') != 0:
        # Legacy endpoint sudah mati, jadi return error
        return jsonify({
            "retcode": 404,
            "message": "Manga not found or legacy API is deprecated",
            "data": None
        })
    
    return jsonify(data)

# ==================== CHAPTER LIST ====================
@app.route('/api/v1/chapter/<manga_id>/list')
def chapter_list(manga_id):
    """Get chapter list untuk manga"""
    params = {
        'page': request.args.get('page', 1, type=int),
        'page_size': request.args.get('page_size', 24, type=int),
        'sort_by': request.args.get('sort_by', 'chapter_number'),
        'sort_order': request.args.get('sort_order', 'desc')
    }
    
    data = fetch_shinigami(f'/v1/chapter/{manga_id}/list', params)
    return jsonify(data)

# ==================== CHAPTER DETAIL ====================
@app.route('/api/v1/chapter/detail/<chapter_id>')
def chapter_detail(chapter_id):
    """Get chapter detail dengan gambar"""
    data = fetch_shinigami(f'/v1/chapter/detail/{chapter_id}')
    
    # Format ulang images jika perlu
    if data.get('retcode') == 0 and data.get('data'):
        chapter_data = data['data']
        if 'chapter' in chapter_data:
            # Build full image URLs
            base_url = chapter_data.get('base_url', 'https://assets.shngm.id')
            chapter_path = chapter_data['chapter']['path']
            image_files = chapter_data['chapter']['data']
            
            images = [f"{base_url}{chapter_path}{img}" for img in image_files]
            chapter_data['images'] = images
    
    return jsonify(data)

# ==================== SEARCH ====================
@app.route('/api/search')
def search():
    """Search manga"""
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify({
            "retcode": 400,
            "message": "Query parameter 'q' is required",
            "data": []
        })
    
    params = {
        'q': query,
        'page': 1,
        'page_size': 20,
        'type': 'project'
    }
    
    data = fetch_shinigami('/v1/manga/list', params)
    return jsonify(data)

# ==================== IMAGE PROXY ====================
@app.route('/api/proxy/image')
def proxy_image():
    """Proxy untuk bypass hotlink protection"""
    url = request.args.get('url', '')
    
    if not url:
        return jsonify({"error": "Missing url parameter"}), 400
    
    try:
        # Tambahkan referer header
        headers = HEADERS.copy()
        response = requests.get(url, headers=headers, stream=True, timeout=10)
        
        if response.status_code == 200:
            from flask import Response
            return Response(
                response.iter_content(chunk_size=8192),
                content_type=response.headers.get('Content-Type', 'image/jpeg')
            )
        else:
            return jsonify({"error": f"Failed to fetch image: {response.status_code}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== STATIC FILES ====================
@app.route('/')
def index():
    return send_from_directory('../public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../public', path)

# ==================== ERROR HANDLERS ====================
@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "retcode": 404,
        "message": f"Endpoint not found: {request.path}",
        "data": None
    }), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port)
