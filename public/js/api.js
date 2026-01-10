/**
 * API Service untuk Shinigami Reader
 * Base URL: /api
 */

class ShinigamiAPI {
    constructor() {
        this.baseUrl = window.location.origin + '/api';
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 menit
    }

    async request(endpoint, params = {}) {
        try {
            const url = new URL(`${this.baseUrl}/${endpoint}`);
            
            // Tambahkan parameter
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== '') {
                    url.searchParams.append(key, params[key]);
                }
            });

            const cacheKey = url.toString();
            const cached = this.cache.get(cacheKey);
            
            // Cek cache
            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                console.log(`[Cache] ${endpoint}`);
                return cached.data;
            }

            console.log(`[API] Fetching: ${endpoint}`);
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                },
                timeout: 15000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Simpan ke cache
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Home endpoints
    async getHome() {
        return this.request('');
    }

    // Manga list
    async getMangaList(params = {}) {
        return this.request('v1/manga/list', params);
    }

    // Manga detail
    async getMangaDetail(manhwaId) {
        return this.request(`v1/manga/detail/${manhwaId}`);
    }

    // Chapter list
    async getChapterList(manhwaId, page = 1, pageSize = 24) {
        return this.request(`v1/chapter/${manhwaId}/list`, {
            page,
            page_size: pageSize,
            sort_by: 'chapter_number',
            sort_order: 'desc'
        });
    }

    // Chapter detail dengan gambar
    async getChapterDetail(chapterId) {
        return this.request(`v1/chapter/detail/${chapterId}`);
    }

    // Search
    async search(query, page = 1) {
        return this.request('search', { q: query, page });
    }

    // Legacy endpoints
    async getLegacyHome() {
        return this.request('api/home');
    }

    async getLegacyMangaDetail(manhwaId) {
        return this.request(`api/manhwa-detail/${manhwaId}`);
    }

    async getLegacyChapter(chapterId) {
        return this.request(`api/chapter/${chapterId}`);
    }

    async getGenres() {
        return this.request('api/genres');
    }

    // Health check
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/ping`);
            return await response.json();
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        console.log('[API] Cache cleared');
    }

    // Preload images
    async preloadImages(urls) {
        const promises = urls.map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ url, status: 'loaded' });
                img.onerror = () => resolve({ url, status: 'error' });
                img.src = url;
            });
        });
        
        return Promise.all(promises);
    }
}

// Export singleton instance
window.ShinigamiAPI = new ShinigamiAPI();
