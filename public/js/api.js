/**
 * API Service - FIXED ENDPOINTS
 */

class ShinigamiAPI {
    constructor() {
        this.baseUrl = '/api';
        this.cache = new Map();
        this.cacheDuration = 180000; // 3 menit
    }

    async request(endpoint, params = {}) {
        try {
            // Build URL
            let url = `${this.baseUrl}/${endpoint}`;
            
            // Add params
            if (Object.keys(params).length > 0) {
                const queryString = new URLSearchParams(params).toString();
                url += `?${queryString}`;
            }
            
            console.log(`[API] Fetching: ${url}`);
            
            // Check cache
            const cacheKey = url;
            const cached = this.cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                console.log(`[Cache] ${endpoint}`);
                return cached.data;
            }
            
            // Fetch with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Cache the response
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            return data;
            
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            
            // Return fallback untuk testing
            return this.getFallbackData(endpoint, params);
        }
    }

    getFallbackData(endpoint, params) {
        // Fallback data untuk testing
        if (endpoint.includes('manga/list')) {
            return {
                data: [
                    {
                        id: "demo-1",
                        title: "Solo Leveling",
                        cover_url: "https://via.placeholder.com/300x400/4a00e0/ffffff?text=Solo+Leveling",
                        type: "manhwa",
                        status: "ongoing",
                        description: "Demo description for testing"
                    },
                    {
                        id: "demo-2", 
                        title: "One Piece",
                        cover_url: "https://via.placeholder.com/300x400/8e2de2/ffffff?text=One+Piece",
                        type: "manga",
                        status: "ongoing"
                    }
                ]
            };
        }
        
        if (endpoint.includes('manga/detail')) {
            return {
                id: params.manga_id || "demo-1",
                title: "Demo Manga",
                cover_url: "https://via.placeholder.com/600x800/4a00e0/ffffff?text=Demo+Cover",
                description: "This is a demo manga description for testing purposes.",
                author: "Demo Author",
                status: "ongoing",
                genres: ["Action", "Adventure", "Fantasy"],
                chapters: [
                    { id: "chap-1", title: "Chapter 1", chapter_number: 1 },
                    { id: "chap-2", title: "Chapter 2", chapter_number: 2 }
                ]
            };
        }
        
        return { error: "API unavailable", endpoint: endpoint };
    }

    // ==================== MAIN ENDPOINTS ====================
    
    async getHome() {
        return this.request('home');
    }

    async getMangaList(params = {}) {
        return this.request('v1/manga/list', params);
    }

    async getMangaDetail(mangaId) {
        // Coba v1 endpoint dulu
        const data = await this.request(`v1/manga/detail/${mangaId}`);
        
        // Jika error, coba legacy
        if (data.error || !data.id) {
            console.log('Trying legacy endpoint...');
            const legacyData = await this.request(`manhwa-detail/${mangaId}`);
            return legacyData;
        }
        
        return data;
    }

    async getChapterList(mangaId, page = 1) {
        return this.request(`v1/chapter/${mangaId}/list`, {
            page: page,
            page_size: 50,
            sort_by: 'chapter_number',
            sort_order: 'desc'
        });
    }

    async getChapterDetail(chapterId) {
        // Coba v1 dulu
        const data = await this.request(`v1/chapter/detail/${chapterId}`);
        
        // Jika error, coba legacy
        if (data.error || !data.images) {
            const legacyData = await this.request(`chapter/${chapterId}`);
            return legacyData;
        }
        
        return data;
    }

    async search(query, page = 1) {
        return this.request('search', { q: query, page: page });
    }

    // ==================== UTILITIES ====================
    
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/ping`);
            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    clearCache() {
        this.cache.clear();
        console.log('[API] Cache cleared');
    }

    // Helper untuk image fallback
    static getImageUrl(imagePath) {
        if (!imagePath) {
            return 'https://via.placeholder.com/300x400/1a1a2e/ffffff?text=No+Image';
        }
        
        // Jika relative URL, convert ke absolute
        if (imagePath.startsWith('/')) {
            return `https://api.shngm.io${imagePath}`;
        }
        
        // Jika sudah absolute, return as-is
        if (imagePath.startsWith('http')) {
            return imagePath;
        }
        
        // Default fallback
        return imagePath;
    }
}

// Export instance
window.ShinigamiAPI = new ShinigamiAPI();
