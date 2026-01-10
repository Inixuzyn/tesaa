/**
 * Shinigami API Service - FIXED FOR V1 API
 */

class ShinigamiAPI {
    constructor() {
        this.baseUrl = '/api';
        this.cache = new Map();
    }

    async request(endpoint, params = {}) {
        try {
            // Build URL
            let url = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
            
            // Add query parameters
            if (Object.keys(params).length > 0) {
                const queryString = new URLSearchParams(params).toString();
                url += `?${queryString}`;
            }
            
            console.log(`[API] Fetching: ${url}`);
            
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check retcode (Shinigami API style)
            if (data.retcode !== undefined && data.retcode !== 0) {
                throw new Error(data.message || `API error ${data.retcode}`);
            }
            
            return data;
            
        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error);
            
            // Return fallback structure yang match dengan API
            return {
                retcode: 500,
                message: error.message,
                data: this.getFallbackData(endpoint)
            };
        }
    }

    getFallbackData(endpoint) {
        // Fallback data dengan struktur yang sama
        if (endpoint.includes('manga/list')) {
            return [
                {
                    manga_id: "demo-1",
                    title: "Demo Manga",
                    cover_image_url: "https://via.placeholder.com/300x400/4a00e0/ffffff?text=Demo",
                    description: "This is demo data",
                    view_count: 1000,
                    user_rate: 8.5
                }
            ];
        }
        
        if (endpoint.includes('manga/detail')) {
            return {
                title: "Demo Manga Detail",
                cover_image_url: "https://via.placeholder.com/400x600/4a00e0/ffffff?text=Cover",
                description: "Demo description",
                view_count: 10000,
                user_rate: 9.0,
                taxonomy: {
                    Genre: [{name: "Action"}, {name: "Adventure"}],
                    Format: [{name: "Manhwa"}]
                }
            };
        }
        
        return null;
    }

    // ==================== MAIN ENDPOINTS ====================

    async getHome() {
        const data = await this.request('home');
        
        // Format response untuk frontend
        return {
            new: { data: data.new?.data || [] },
            top: { data: data.top?.data || [] },
            recommend: { data: data.recommend?.data || [] }
        };
    }

    async getMangaList(params = {}) {
        const data = await this.request('v1/manga/list', params);
        return data;
    }

    async getMangaDetail(mangaId) {
        // HANYA gunakan v1 endpoint!
        const data = await this.request(`v1/manga/detail/${mangaId}`);
        
        if (data.retcode !== 0) {
            throw new Error(data.message || "Manga not found");
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
        const data = await this.request(`v1/chapter/detail/${chapterId}`);
        
        // Build full image URLs
        if (data.retcode === 0 && data.data) {
            const chapter = data.data;
            if (chapter.chapter) {
                const baseUrl = chapter.base_url || 'https://assets.shngm.id';
                const path = chapter.chapter.path;
                const images = chapter.chapter.data.map(img => `${baseUrl}${path}${img}`);
                chapter.images = images;
            }
        }
        
        return data;
    }

    async search(query) {
        return this.request('search', { q: query });
    }

    // ==================== UTILITIES ====================

    static getImageUrl(imagePath) {
        if (!imagePath) {
            return 'https://via.placeholder.com/300x400/1a1a2e/ffffff?text=No+Image';
        }
        
        // Jika sudah full URL
        if (imagePath.startsWith('http')) {
            return imagePath;
        }
        
        // Jika relative, tambahkan base URL
        if (imagePath.startsWith('/')) {
            return `https://api.shngm.io${imagePath}`;
        }
        
        return imagePath;
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/ping`);
            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Export instance
window.ShinigamiAPI = new ShinigamiAPI();
