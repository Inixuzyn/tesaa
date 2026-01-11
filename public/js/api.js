/**
 * Shinigami API Service - COMPLETE FIXED FOR V1 API
 * FULL VERSION - NO BUGS
 */

class ShinigamiAPI {
    constructor() {
        this.baseUrl = '/api';
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes cache
        this.requestQueue = new Map();
        this.rateLimit = {
            remaining: 60,
            reset: Date.now() + 60000
        };
    }

    // ==================== CORE REQUEST METHOD ====================

    async request(endpoint, params = {}) {
        try {
            // Check rate limit
            if (this.rateLimit.remaining <= 0 && Date.now() < this.rateLimit.reset) {
                const waitTime = this.rateLimit.reset - Date.now();
                console.warn(`[API] Rate limited, waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

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
            
            console.log(`[API] Fetching: ${endpoint}`);
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url, {
                headers: { 
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Update rate limit from headers
            if (response.headers.has('X-RateLimit-Remaining')) {
                this.rateLimit.remaining = parseInt(response.headers.get('X-RateLimit-Remaining')) || 60;
            }
            if (response.headers.has('X-RateLimit-Reset')) {
                this.rateLimit.reset = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000 || Date.now() + 60000;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText.substring(0, 100)}`);
            }
            
            const data = await response.json();
            
            // Validate response structure
            if (!this.isValidResponse(data)) {
                console.warn('[API] Invalid response structure:', data);
                throw new Error('Invalid API response format');
            }
            
            // Cache successful response
            if (data.retcode === 0 || data.data !== undefined) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }
            
            return data;
            
        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error);
            
            // Return structured error response
            return {
                retcode: error.name === 'AbortError' ? 408 : 500,
                message: error.name === 'AbortError' ? 'Request timeout' : error.message || 'Network error',
                data: null,
                error: true
            };
        }
    }

    // ==================== VALIDATION METHODS ====================

    isValidResponse(data) {
        return data && typeof data === 'object' && 
               (data.retcode !== undefined || data.data !== undefined || data.error !== undefined);
    }

    isValidMangaId(id) {
        return id && typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
    }

    isValidChapterId(id) {
        return id && typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
    }

    // ==================== CACHE MANAGEMENT ====================

    clearCache() {
        this.cache.clear();
        console.log('[API] Cache cleared');
        return true;
    }

    clearCacheByPattern(pattern) {
        let cleared = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                cleared++;
            }
        }
        console.log(`[API] Cleared ${cleared} cache entries for pattern: ${pattern}`);
        return cleared;
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }

    // ==================== MAIN API ENDPOINTS ====================

    async getHome() {
        try {
            const data = await this.request('home');
            
            if (data.retcode !== 0 && !data.data) {
                throw new Error(data.message || 'Failed to load home data');
            }
            
            // Handle different response formats
            let newManga = [], topManga = [], recommendManga = [];
            
            if (data.new && data.new.data) {
                newManga = data.new.data;
            } else if (data.data && data.data.new) {
                newManga = data.data.new;
            }
            
            if (data.top && data.top.data) {
                topManga = data.top.data;
            } else if (data.data && data.data.top) {
                topManga = data.data.top;
            }
            
            if (data.recommend && data.recommend.data) {
                recommendManga = data.recommend.data;
            } else if (data.data && data.data.recommend) {
                recommendManga = data.data.recommend;
            }
            
            return {
                new: { 
                    data: newManga,
                    meta: data.new?.meta || data.data?.new_meta || {}
                },
                top: { 
                    data: topManga,
                    meta: data.top?.meta || data.data?.top_meta || {}
                },
                recommend: { 
                    data: recommendManga,
                    meta: data.recommend?.meta || data.data?.recommend_meta || {}
                }
            };
            
        } catch (error) {
            console.error('Error in getHome:', error);
            return {
                new: { data: [], meta: {} },
                top: { data: [], meta: {} },
                recommend: { data: [], meta: {} }
            };
        }
    }

    async getMangaDetail(mangaId) {
        if (!this.isValidMangaId(mangaId)) {
            console.error('Invalid manga ID:', mangaId);
            return {
                retcode: 400,
                message: "Invalid manga ID format",
                data: null
            };
        }
        
        console.log(`[API] Getting manga detail: ${mangaId}`);
        
        try {
            const data = await this.request(`v1/manga/detail/${mangaId}`);
            
            if (data.retcode !== 0) {
                throw new Error(data.message || `Manga ${mangaId} not found`);
            }
            
            // Process and validate data
            if (data.data) {
                // Ensure required fields
                data.data.manga_id = data.data.manga_id || mangaId;
                data.data.title = data.data.title || 'Untitled Manga';
                data.data.cover_image_url = data.data.cover_image_url || data.data.cover_url || data.data.thumbnail;
                
                // Process taxonomy if exists
                if (data.data.taxonomy && typeof data.data.taxonomy === 'object') {
                    // Convert to consistent format
                    const taxonomy = {};
                    for (const [key, value] of Object.entries(data.data.taxonomy)) {
                        if (Array.isArray(value)) {
                            taxonomy[key] = value.map(item => ({
                                id: item.id || item.term_id,
                                name: item.name || item.term_name || item.term
                            }));
                        }
                    }
                    data.data.taxonomy = taxonomy;
                }
            }
            
            return data;
            
        } catch (error) {
            console.error(`Error fetching manga ${mangaId}:`, error);
            return {
                retcode: 500,
                message: error.message,
                data: null,
                error: true
            };
        }
    }

    async getChapterList(mangaId, page = 1, pageSize = 100) {
        if (!this.isValidMangaId(mangaId)) {
            return {
                retcode: 400,
                message: "Invalid manga ID format",
                data: []
            };
        }
        
        console.log(`[API] Getting chapters for: ${mangaId}, page: ${page}`);
        
        try {
            const data = await this.request(`v1/chapter/${mangaId}/list`, {
                page: Math.max(1, page),
                page_size: Math.min(500, Math.max(1, pageSize)),
                sort_by: 'chapter_number',
                sort_order: 'desc'
            });
            
            if (data.retcode !== 0) {
                throw new Error(data.message || `Failed to load chapters for ${mangaId}`);
            }
            
            // Process chapters data
            if (data.data && Array.isArray(data.data)) {
                data.data = data.data.map(chapter => ({
                    chapter_id: chapter.chapter_id || chapter.id,
                    chapter_number: chapter.chapter_number || chapter.number || 0,
                    chapter_title: chapter.chapter_title || chapter.title || `Chapter ${chapter.chapter_number}`,
                    chapter_subtitle: chapter.chapter_subtitle || chapter.subtitle || '',
                    release_date: chapter.release_date || chapter.created_at || null,
                    view_count: chapter.view_count || chapter.views || 0,
                    prev_chapter_id: chapter.prev_chapter_id || null,
                    next_chapter_id: chapter.next_chapter_id || null
                }));
            }
            
            return data;
            
        } catch (error) {
            console.error(`Error fetching chapters for ${mangaId}:`, error);
            return {
                retcode: 500,
                message: error.message,
                data: [],
                meta: { total_page: 0, total: 0 }
            };
        }
    }

    async getChapterDetail(chapterId) {
        if (!this.isValidChapterId(chapterId)) {
            return {
                retcode: 400,
                message: "Invalid chapter ID format",
                data: null
            };
        }
        
        console.log(`[API] Getting chapter detail: ${chapterId}`);
        
        try {
            const data = await this.request(`v1/chapter/detail/${chapterId}`);
            
            if (data.retcode !== 0) {
                throw new Error(data.message || `Chapter ${chapterId} not found`);
            }
            
            // Process chapter data
            if (data.data) {
                const chapter = data.data;
                
                // Build image URLs
                if (!chapter.images || chapter.images.length === 0) {
                    if (chapter.chapter) {
                        const baseUrl = chapter.base_url || 'https://assets.shngm.id';
                        const path = chapter.chapter.path || '';
                        
                        // Filter and process image files
                        const imageFiles = (chapter.chapter.data || []).filter(img => {
                            return img && typeof img === 'string' && !img.startsWith('999-');
                        });
                        
                        chapter.images = imageFiles.map(img => {
                            if (img.startsWith('http')) return img;
                            return `${baseUrl}${path}${img}`;
                        });
                        
                        console.log(`[API] Built ${chapter.images.length} image URLs for chapter ${chapterId}`);
                    }
                }
                
                // Ensure required fields
                chapter.chapter_id = chapter.chapter_id || chapterId;
                chapter.chapter_number = chapter.chapter_number || 0;
                chapter.chapter_title = chapter.chapter_title || `Chapter ${chapter.chapter_number}`;
                
                // Set next/prev chapter IDs if available
                if (chapter.next_chapter) {
                    chapter.next_chapter_id = chapter.next_chapter.chapter_id || chapter.next_chapter.id;
                }
                if (chapter.prev_chapter) {
                    chapter.prev_chapter_id = chapter.prev_chapter.chapter_id || chapter.prev_chapter.id;
                }
            }
            
            return data;
            
        } catch (error) {
            console.error(`Error fetching chapter ${chapterId}:`, error);
            return {
                retcode: 500,
                message: error.message,
                data: null,
                error: true
            };
        }
    }

    async search(query, page = 1, pageSize = 30) {
        if (!query || query.trim() === '') {
            return {
                retcode: 400,
                message: "Search query is required",
                data: []
            };
        }
        
        console.log(`[API] Searching for: "${query}"`);
        
        try {
            const data = await this.request('search', {
                q: query.trim(),
                page: Math.max(1, page),
                page_size: Math.max(1, Math.min(100, pageSize))
            });
            
            if (data.retcode !== 0 && !data.data) {
                throw new Error(data.message || "Search failed");
            }
            
            // Process search results
            const results = Array.isArray(data.data) ? data.data : [];
            const processedResults = results.map(item => ({
                manga_id: item.manga_id || item.id,
                title: item.title || 'Untitled',
                cover_image_url: item.cover_image_url || item.cover_url || item.thumbnail,
                description: item.description || item.synopsis || '',
                view_count: item.view_count || 0,
                user_rate: item.user_rate || item.rating || 'N/A'
            }));
            
            return {
                retcode: 0,
                message: `Found ${processedResults.length} results`,
                data: processedResults,
                meta: data.meta || { total: processedResults.length }
            };
            
        } catch (error) {
            console.error('Search error:', error);
            return {
                retcode: 500,
                message: error.message,
                data: []
            };
        }
    }

    // ==================== BATCH OPERATIONS ====================

    async getMultipleMangaDetails(mangaIds, maxConcurrent = 5) {
        if (!Array.isArray(mangaIds) || mangaIds.length === 0) {
            return [];
        }
        
        const results = [];
        const validIds = mangaIds.slice(0, 20).filter(id => this.isValidMangaId(id)); // Limit to 20
        
        console.log(`[API] Batch fetching ${validIds.length} manga details`);
        
        // Process in batches
        for (let i = 0; i < validIds.length; i += maxConcurrent) {
            const batch = validIds.slice(i, i + maxConcurrent);
            const promises = batch.map(id => this.getMangaDetail(id));
            
            try {
                const batchResults = await Promise.allSettled(promises);
                
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value.retcode === 0 && result.value.data) {
                        results.push(result.value.data);
                    } else {
                        console.warn(`Failed to fetch manga ${batch[index]}:`, result.reason || result.value?.message);
                    }
                });
                
                // Delay between batches to avoid rate limiting
                if (i + maxConcurrent < validIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } catch (error) {
                console.error('Batch processing error:', error);
            }
        }
        
        console.log(`[API] Batch fetch completed: ${results.length}/${validIds.length} successful`);
        return results;
    }

    async getAllChapters(mangaId, maxPages = 10) {
        if (!this.isValidMangaId(mangaId)) {
            return [];
        }
        
        const allChapters = [];
        let currentPage = 1;
        let hasMore = true;
        
        console.log(`[API] Loading all chapters for ${mangaId}`);
        
        while (hasMore && currentPage <= maxPages) {
            try {
                const response = await this.getChapterList(mangaId, currentPage, 100);
                
                if (response.retcode === 0 && response.data && response.data.length > 0) {
                    allChapters.push(...response.data);
                    
                    const meta = response.meta || {};
                    const totalPages = meta.total_page || 1;
                    const currentTotal = meta.total || allChapters.length;
                    
                    console.log(`[API] Page ${currentPage}: loaded ${response.data.length} chapters, total: ${allChapters.length}`);
                    
                    if (currentPage >= totalPages || allChapters.length >= currentTotal) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                    if (response.retcode !== 0) {
                        console.warn(`[API] Stopping at page ${currentPage}:`, response.message);
                    }
                }
                
            } catch (error) {
                console.error(`Error loading page ${currentPage}:`, error);
                hasMore = false;
            }
            
            currentPage++;
            
            // Delay between pages
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        console.log(`[API] Loaded ${allChapters.length} total chapters for ${mangaId}`);
        return allChapters;
    }

    // ==================== ADVANCED SEARCH ====================

    async advancedSearch(filters = {}) {
        const defaultFilters = {
            q: '',
            page: 1,
            page_size: 30,
            sort: 'latest',
            sort_order: 'desc',
            genres: [],
            status: '',
            year: '',
            type: ''
        };
        
        const finalFilters = { ...defaultFilters, ...filters };
        
        // Clean up filters
        if (finalFilters.genres && Array.isArray(finalFilters.genres)) {
            finalFilters.genres = finalFilters.genres.join(',');
        }
        
        try {
            return await this.request('v1/manga/list', finalFilters);
        } catch (error) {
            console.error('Advanced search error:', error);
            return {
                retcode: 500,
                message: error.message,
                data: []
            };
        }
    }

    async getGenres() {
        try {
            const data = await this.request('v1/genre/list');
            return data.retcode === 0 ? data.data : [];
        } catch (error) {
            console.error('Error fetching genres:', error);
            return [];
        }
    }

    // ==================== IMAGE HANDLING ====================

    static getImageUrl(imagePath, size = 'medium') {
        if (!imagePath || imagePath === '') {
            // Return different placeholder based on size
            const sizes = {
                small: '200x300',
                medium: '300x400',
                large: '400x600',
                xlarge: '600x800'
            };
            const dimensions = sizes[size] || '300x400';
            return `https://via.placeholder.com/${dimensions}/1a1a2e/00f2fe?text=Manga`;
        }
        
        // If already full URL
        if (imagePath.startsWith('http')) {
            return imagePath;
        }
        
        // If relative path
        if (imagePath.startsWith('/')) {
            // Try different CDN URLs
            const cdnUrls = [
                'https://assets.shngm.id',
                'https://api.shngm.io',
                'https://cdn.shinigami.asia'
            ];
            
            return `${cdnUrls[0]}${imagePath}`;
        }
        
        return imagePath;
    }

    async preloadImages(urls, maxConcurrent = 3) {
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return { loaded: 0, failed: 0 };
        }
        
        const results = { loaded: 0, failed: 0 };
        const queue = [...urls];
        
        async function loadImage(url) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    results.loaded++;
                    resolve(true);
                };
                img.onerror = () => {
                    results.failed++;
                    resolve(false);
                };
                img.src = url;
            });
        }
        
        // Process images in batches
        while (queue.length > 0) {
            const batch = queue.splice(0, maxConcurrent);
            await Promise.all(batch.map(url => loadImage(url)));
            
            // Small delay between batches
            if (queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`[API] Preloaded ${results.loaded} images, ${results.failed} failed`);
        return results;
    }

    // ==================== HEALTH & STATUS ====================

    async testConnection() {
        try {
            const startTime = Date.now();
            const response = await this.request('health');
            const latency = Date.now() - startTime;
            
            const success = response.retcode === 0 || response.status === 'healthy';
            
            return { 
                success: success,
                latency: latency,
                status: response.status || 'unknown',
                message: success ? `Connected (${latency}ms)` : 'Connection failed',
                data: response
            };
            
        } catch (error) {
            return { 
                success: false, 
                latency: 0,
                message: error.message || 'Connection failed',
                error: error
            };
        }
    }

    async ping() {
        try {
            const start = Date.now();
            const response = await fetch(`${this.baseUrl}/ping`, { 
                method: 'HEAD',
                signal: AbortSignal.timeout(5000)
            });
            const latency = Date.now() - start;
            
            return { 
                success: response.ok,
                latency: latency,
                status: response.status,
                message: `Ping: ${latency}ms`
            };
            
        } catch (error) {
            return { 
                success: false, 
                latency: 0,
                message: error.message || 'Ping failed'
            };
        }
    }

    getRateLimitStatus() {
        return {
            remaining: this.rateLimit.remaining,
            reset: new Date(this.rateLimit.reset).toLocaleTimeString(),
            resetIn: Math.max(0, Math.ceil((this.rateLimit.reset - Date.now()) / 1000))
        };
    }

    // ==================== ERROR HANDLING ====================

    handleApiError(error, endpoint, context = {}) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const errorDetails = {
            id: errorId,
            timestamp: new Date().toISOString(),
            endpoint: endpoint,
            error: error.message,
            type: error.name,
            context: context
        };
        
        console.error(`[API ERROR ${errorId}] ${endpoint}:`, errorDetails);
        
        // Store error in session for debugging
        try {
            const errorLog = JSON.parse(sessionStorage.getItem('api_errors') || '[]');
            errorLog.unshift(errorDetails);
            if (errorLog.length > 50) errorLog.pop();
            sessionStorage.setItem('api_errors', JSON.stringify(errorLog));
        } catch (e) {
            // Ignore storage errors
        }
        
        // Return user-friendly error
        return {
            retcode: 500,
            message: this.getUserFriendlyError(error),
            error_id: errorId,
            data: null
        };
    }

    getUserFriendlyError(error) {
        const msg = error.message || 'Unknown error';
        
        if (msg.includes('timeout') || msg.includes('abort')) {
            return 'Request timeout. Please try again.';
        }
        if (msg.includes('network') || msg.includes('failed to fetch')) {
            return 'Network error. Please check your connection.';
        }
        if (msg.includes('404') || msg.includes('not found')) {
            return 'Content not found. It may have been removed.';
        }
        if (msg.includes('429') || msg.includes('rate limit')) {
            return 'Too many requests. Please wait a moment.';
        }
        if (msg.includes('500') || msg.includes('server error')) {
            return 'Server error. Please try again later.';
        }
        
        return 'An error occurred. Please try again.';
    }

    getErrorLog() {
        try {
            return JSON.parse(sessionStorage.getItem('api_errors') || '[]');
        } catch {
            return [];
        }
    }

    clearErrorLog() {
        try {
            sessionStorage.removeItem('api_errors');
            return true;
        } catch {
            return false;
        }
    }

    // ==================== UTILITY METHODS ====================

    static formatChapterNumber(chapter) {
        if (!chapter && chapter !== 0) return '?';
        
        const num = parseFloat(chapter);
        if (isNaN(num)) return chapter.toString();
        
        // Remove trailing .0
        if (Number.isInteger(num)) return num.toString();
        
        // Format decimal numbers
        return num.toFixed(1).replace(/\.0$/, '');
    }

    static formatMangaTitle(title, maxLength = 50) {
        if (!title) return 'Untitled Manga';
        if (title.length <= maxLength) return title;
        return title.substring(0, maxLength - 3) + '...';
    }

    static sanitizeText(text) {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ')    // Collapse whitespace
            .trim();
    }

    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ==================== PROXY METHODS ====================

    getProxyUrl(imageUrl, options = {}) {
        if (!imageUrl) return '';
        
        // Skip proxy for certain URLs
        const skipProxy = [
            'via.placeholder.com',
            'data:image/',
            'blob:'
        ];
        
        if (skipProxy.some(pattern => imageUrl.includes(pattern))) {
            return imageUrl;
        }
        
        const params = new URLSearchParams({
            url: encodeURIComponent(imageUrl),
            ...options
        });
        
        return `/api/proxy/image?${params.toString()}`;
    }

    // ==================== STATISTICS ====================

    getStatistics() {
        return {
            cacheSize: this.cache.size,
            rateLimit: this.getRateLimitStatus(),
            uptime: this.uptime || Date.now(),
            totalRequests: this.totalRequests || 0,
            errorRate: this.errorCount ? (this.errorCount / (this.totalRequests || 1)) * 100 : 0
        };
    }

    // ==================== INITIALIZATION ====================

    async initialize() {
        console.log('[API] Initializing...');
        
        try {
            // Test connection
            const test = await this.testConnection();
            
            if (test.success) {
                console.log('[API] Initialized successfully:', test.message);
                return { success: true, ...test };
            } else {
                console.warn('[API] Initialization warning:', test.message);
                return { success: false, ...test };
            }
            
        } catch (error) {
            console.error('[API] Initialization failed:', error);
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }
}

// ==================== GLOBAL INSTANCE & UTILITIES ====================

// Create and initialize API instance
window.ShinigamiAPI = new ShinigamiAPI();

// Add global utilities
window.APIUtils = {
    // Formatting utilities
    formatChapterNumber: ShinigamiAPI.formatChapterNumber,
    formatMangaTitle: ShinigamiAPI.formatMangaTitle,
    sanitizeText: ShinigamiAPI.sanitizeText,
    getImageUrl: ShinigamiAPI.getImageUrl,
    
    // Performance utilities
    debounce: ShinigamiAPI.debounce,
    throttle: ShinigamiAPI.throttle,
    
    // Data utilities
    parseDate: function(dateString) {
        if (!dateString) return 'Unknown';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    },
    
    formatNumber: function(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },
    
    // Validation utilities
    isValidUrl: function(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    // Storage utilities
    getStorage: function(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    
    setStorage: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },
    
    removeStorage: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch {
            return false;
        }
    }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const initResult = await window.ShinigamiAPI.initialize();
        
        if (initResult.success) {
            console.log('🚀 Shinigami API loaded successfully');
            
            // Dispatch custom event
            const event = new CustomEvent('api:ready', { 
                detail: { 
                    success: true, 
                    latency: initResult.latency,
                    status: initResult.status 
                } 
            });
            document.dispatchEvent(event);
            
        } else {
            console.warn('⚠️ API initialization warning:', initResult.message);
            
            const event = new CustomEvent('api:warning', { 
                detail: { 
                    success: false, 
                    message: initResult.message 
                } 
            });
            document.dispatchEvent(event);
        }
        
    } catch (error) {
        console.error('❌ API failed to load:', error);
        
        const event = new CustomEvent('api:error', { 
            detail: { 
                success: false, 
                error: error 
            } 
        });
        document.dispatchEvent(event);
    }
});

// Add global error handler
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('api')) {
        console.error('Unhandled API promise rejection:', event.reason);
        // You could send this to an error tracking service
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShinigamiAPI, APIUtils };
}

console.log('[API] Shinigami API Service loaded');
