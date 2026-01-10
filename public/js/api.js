/**
 * Shinigami API Service - COMPLETE FIXED FOR V1 API
 */

class ShinigamiAPI {
    constructor() {
        this.baseUrl = '/api';
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes cache
    }

    async request(endpoint, params = {}) {
        try {
            // Build cache key
            const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
            
            // Check cache first
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                console.log(`[API] Cache hit: ${endpoint}`);
                return cached.data;
            }
            
            // Build URL
            let url = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
            
            // Add query parameters
            if (Object.keys(params).length > 0) {
                const queryString = new URLSearchParams(params).toString();
                url += `?${queryString}`;
            }
            
            console.log(`[API] Fetching: ${url}`);
            
            const response = await fetch(url, {
                headers: { 
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                signal: AbortSignal.timeout(15000) // 15 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache successful response
            if (data.retcode === 0 || data.data) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }
            
            return data;
            
        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error);
            
            // Return fallback structure yang match dengan API
            return {
                retcode: 500,
                message: error.message || 'Network error',
                data: null
            };
        }
    }

    clearCache() {
        this.cache.clear();
        console.log('[API] Cache cleared');
    }

    // ==================== MAIN ENDPOINTS ====================

    async getHome() {
        const data = await this.request('home');
        
        // Format response untuk frontend
        return {
            new: { 
                data: data.new?.data || [],
                meta: data.new?.meta || {}
            },
            top: { 
                data: data.top?.data || [],
                meta: data.top?.meta || {}
            },
            recommend: { 
                data: data.recommend?.data || [],
                meta: data.recommend?.meta || {}
            }
        };
    }

    async getMangaList(params = {}) {
        // Default parameters
        const defaultParams = {
            type: 'project',
            page: 1,
            page_size: 30,
            sort: 'latest',
            sort_order: 'desc',
            is_update: 'true'
        };
        
        const finalParams = { ...defaultParams, ...params };
        return await this.request('v1/manga/list', finalParams);
    }

    async getMangaDetail(mangaId) {
        console.log(`[API] Getting manga detail: ${mangaId}`);
        
        // HANYA gunakan v1 endpoint!
        const data = await this.request(`v1/manga/detail/${mangaId}`);
        
        if (data.retcode !== 0) {
            throw new Error(data.message || "Manga not found");
        }
        
        return data;
    }

    async getChapterList(mangaId, page = 1, pageSize = 100) {
        console.log(`[API] Getting chapters for: ${mangaId}, page: ${page}`);
        
        return await this.request(`v1/chapter/${mangaId}/list`, {
            page: page,
            page_size: pageSize,
            sort_by: 'chapter_number',
            sort_order: 'desc'
        });
    }

    async getChapterDetail(chapterId) {
        console.log(`[API] Getting chapter detail: ${chapterId}`);
        
        const data = await this.request(`v1/chapter/detail/${chapterId}`);
        
        // Build full image URLs jika tidak ada images field
        if (data.retcode === 0 && data.data && !data.data.images) {
            const chapter = data.data;
            if (chapter.chapter) {
                const baseUrl = chapter.base_url || 'https://assets.shngm.id';
                const path = chapter.chapter.path;
                
                // Filter out non-image files (like 999-*.jpg)
                const imageFiles = chapter.chapter.data.filter(img => !img.startsWith('999-'));
                const images = imageFiles.map(img => `${baseUrl}${path}${img}`);
                
                chapter.images = images;
                console.log(`[API] Built ${images.length} image URLs`);
            }
        }
        
        return data;
    }

    async search(query) {
        if (!query || query.trim() === '') {
            return {
                retcode: 400,
                message: "Search query is required",
                data: []
            };
        }
        
        console.log(`[API] Searching for: "${query}"`);
        return await this.request('search', { q: query });
    }

    // ==================== DIRECT API CALLS ====================

    async directRequest(method, endpoint, body = null) {
        try {
            const url = `https://api.shngm.io/${endpoint.replace(/^\/+/, '')}`;
            
            console.log(`[API] Direct request to: ${url}`);
            
            const options = {
                method: method,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://shinigami.asia/'
                }
            };
            
            if (body) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
            
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`❌ Direct API Error:`, error);
            throw error;
        }
    }

    // ==================== IMAGE PROXY ====================

    static getImageUrl(imagePath) {
        if (!imagePath || imagePath === '') {
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

    getProxyUrl(imageUrl) {
        if (!imageUrl) return '';
        
        // Skip proxy untuk placeholder images
        if (imageUrl.includes('via.placeholder.com')) {
            return imageUrl;
        }
        
        return `/api/proxy/image?url=${encodeURIComponent(imageUrl)}`;
    }

    // ==================== HEALTH & STATUS ====================

    async testConnection() {
        try {
            const response = await this.request('health');
            
            return { 
                success: response.status === 'healthy',
                data: response,
                message: `API Status: ${response.api || 'unknown'}`
            };
            
        } catch (error) {
            return { 
                success: false, 
                error: error.message,
                message: 'Connection failed'
            };
        }
    }

    async ping() {
        try {
            const start = Date.now();
            const response = await fetch(`${this.baseUrl}/ping`);
            const data = await response.json();
            const latency = Date.now() - start;
            
            return { 
                success: true, 
                latency: latency,
                data: data 
            };
            
        } catch (error) {
            return { 
                success: false, 
                error: error.message,
                latency: 0
            };
        }
    }

    // ==================== BATCH REQUESTS ====================

    async getMultipleMangaDetails(mangaIds) {
        if (!Array.isArray(mangaIds) || mangaIds.length === 0) {
            return [];
        }
        
        const results = [];
        
        for (const mangaId of mangaIds.slice(0, 10)) { // Max 10 at a time
            try {
                const data = await this.getMangaDetail(mangaId);
                if (data.retcode === 0) {
                    results.push(data.data);
                }
            } catch (error) {
                console.error(`Failed to fetch manga ${mangaId}:`, error);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return results;
    }

    // ==================== PAGINATION HELPERS ====================

    async getAllChapters(mangaId, maxPages = 10) {
        const allChapters = [];
        let currentPage = 1;
        let hasMore = true;
        
        while (hasMore && currentPage <= maxPages) {
            try {
                const response = await this.getChapterList(mangaId, currentPage, 100);
                
                if (response.retcode === 0 && response.data) {
                    allChapters.push(...response.data);
                    
                    const meta = response.meta || {};
                    const totalPages = meta.total_page || 1;
                    
                    if (currentPage >= totalPages) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error(`Error loading page ${currentPage}:`, error);
                hasMore = false;
            }
            
            currentPage++;
            
            // Small delay between pages
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`[API] Loaded ${allChapters.length} total chapters for ${mangaId}`);
        return allChapters;
    }

    // ==================== ERROR HANDLING ====================

    handleApiError(error, endpoint) {
        const errorMessage = error.message || 'Unknown error';
        console.error(`[API] Error in ${endpoint}:`, errorMessage);
        
        // You could add error tracking/reporting here
        // Example: send to error logging service
        
        return {
            retcode: 500,
            message: `Service temporarily unavailable: ${errorMessage}`,
            data: null
        };
    }

    // ==================== VALIDATION ====================

    isValidMangaId(id) {
        return id && typeof id === 'string' && id.trim().length > 0;
    }

    isValidChapterId(id) {
        return id && typeof id === 'string' && id.trim().length > 0;
    }
}

// Export instance
window.ShinigamiAPI = new ShinigamiAPI();

// Add some utility functions to window object
window.APIUtils = {
    formatChapterNumber: function(chapter) {
        if (!chapter) return '?';
        const num = parseFloat(chapter);
        return isNaN(num) ? chapter : num.toString();
    },
    
    formatMangaTitle: function(title) {
        if (!title) return 'Untitled';
        return title.length > 50 ? title.substring(0, 50) + '...' : title;
    },
    
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

console.log('🚀 Shinigami API Service loaded successfully');
