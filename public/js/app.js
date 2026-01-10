/**
 * Manga App - FIXED FOR SHINIGAMI V1 API
 */

class MangaApp {
    constructor() {
        this.api = window.ShinigamiAPI;
        this.init();
    }

    init() {
        console.log('🚀 Initializing with Shinigami V1 API');
        this.bindEvents();
        this.loadHomeData();
        this.checkAPIStatus();
    }

    async loadHomeData() {
        console.log('📥 Loading home data...');
        
        try {
            const data = await this.api.getHome();
            console.log('Home data:', data);
            
            // Pastikan kita akses data.data (karena response {data: [...]})
            if (data.new && data.new.data) {
                this.displayMangaGrid(data.new.data, 'new-manga');
            } else {
                this.showError('new-manga', 'No new manga data');
            }
            
            if (data.top && data.top.data) {
                this.displayMangaGrid(data.top.data, 'top-manga');
            } else {
                this.showError('top-manga', 'No top manga data');
            }
            
            if (data.recommend && data.recommend.data) {
                this.displayMangaGrid(data.recommend.data, 'recommend-manga');
            } else {
                this.showError('recommend-manga', 'No recommendations');
            }
            
        } catch (error) {
            console.error('Error loading home:', error);
            this.showNotification('Failed to load home data', 'error');
        }
    }

    displayMangaGrid(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="loading">No data found</div>';
            return;
        }
        
        container.innerHTML = items.map(item => {
            // PERHATIAN: Field yang benar dari API adalah:
            // - manga_id (bukan id)
            // - cover_image_url (bukan cover_url)
            // - title
            
            const mangaId = item.manga_id || item.id;
            const coverUrl = this.api.constructor.getImageUrl(
                item.cover_image_url || item.cover_url || item.thumbnail
            );
            const title = item.title || 'Untitled';
            const viewCount = item.view_count ? this.formatNumber(item.view_count) : '';
            
            return `
                <div class="manga-card" data-id="${mangaId}" data-title="${title}">
                    <img src="${coverUrl}" 
                         alt="${title}"
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/300x400/1a1a2e/ffffff?text=Image+Error'">
                    <div class="manga-info">
                        <div class="manga-title">${title}</div>
                        <div class="manga-meta">
                            <span>${viewCount} views</span>
                            <span class="manga-rating">⭐ ${item.user_rate || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click events
        container.querySelectorAll('.manga-card').forEach(card => {
            card.addEventListener('click', () => {
                const mangaId = card.dataset.id;
                const mangaTitle = card.dataset.title;
                this.showMangaDetail(mangaId, mangaTitle);
            });
        });
    }

    async showMangaDetail(mangaId, mangaTitle = '') {
        console.log(`📖 Loading detail for: ${mangaId}`);
        
        this.showSection('detail');
        this.showLoading('manga-detail-container', 'Loading manga details...');
        
        try {
            // HANYA gunakan v1 endpoint!
            const response = await this.api.getMangaDetail(mangaId);
            
            // Check retcode
            if (response.retcode !== 0) {
                throw new Error(response.message || 'Manga not found');
            }
            
            const data = response.data;
            
            if (!data) {
                throw new Error('No data received from API');
            }
            
            this.renderMangaDetail(data);
            
            // Load chapters
            this.loadChapters(mangaId);
            
        } catch (error) {
            console.error('❌ Error loading manga detail:', error);
            
            document.getElementById('manga-detail-container').innerHTML = `
                <div class="error-container">
                    <h3>Failed to load manga</h3>
                    <p>${error.message}</p>
                    <p><small>Manga ID: ${mangaId}</small></p>
                    <button onclick="window.MangaApp.showSection('home')">
                        Back to Home
                    </button>
                </div>
            `;
        }
    }

    renderMangaDetail(data) {
        const container = document.getElementById('manga-detail-container');
        
        // PERHATIAN: Field yang benar dari API V1:
        const coverUrl = this.api.constructor.getImageUrl(data.cover_image_url);
        const title = data.title || 'Untitled';
        const description = data.description || 'No description';
        const viewCount = this.formatNumber(data.view_count || 0);
        const rating = data.user_rate || 'N/A';
        
        // Extract genres dari taxonomy
        let genres = [];
        if (data.taxonomy && data.taxonomy.Genre) {
            genres = data.taxonomy.Genre.map(g => g.name);
        }
        
        container.innerHTML = `
            <button class="back-btn" onclick="window.MangaApp.showSection('home')">
                <i class="fas fa-arrow-left"></i> Back
            </button>
            
            <div class="detail-container">
                <div class="detail-cover">
                    <img src="${coverUrl}" 
                         alt="${title}"
                         onerror="this.src='https://via.placeholder.com/400x600/1a1a2e/ffffff?text=Cover'">
                </div>
                
                <div class="detail-content">
                    <h1 class="detail-title">${title}</h1>
                    
                    <div class="detail-stats">
                        <span>👁️ ${viewCount} views</span>
                        <span>⭐ ${rating}/10</span>
                        <span>📅 ${data.release_year || 'N/A'}</span>
                    </div>
                    
                    <div class="detail-meta">
                        ${genres.map(genre => `
                            <span class="meta-tag">${genre}</span>
                        `).join('')}
                    </div>
                    
                    <div class="detail-description">
                        <h3>Description</h3>
                        <p>${description}</p>
                    </div>
                    
                    <div class="chapter-list">
                        <h3>Chapters</h3>
                        <div id="chapter-list-container" class="chapter-grid">
                            <div class="loading">Loading chapters...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadChapters(mangaId) {
        try {
            const response = await this.api.getChapterList(mangaId);
            
            if (response.retcode !== 0) {
                throw new Error(response.message || 'Failed to load chapters');
            }
            
            const chapters = response.data || [];
            this.displayChapters(chapters);
            
        } catch (error) {
            console.error('Error loading chapters:', error);
            document.getElementById('chapter-list-container').innerHTML = `
                <div class="error">Failed to load chapters: ${error.message}</div>
            `;
        }
    }

    displayChapters(chapters) {
        const container = document.getElementById('chapter-list-container');
        if (!container) return;
        
        if (!chapters || chapters.length === 0) {
            container.innerHTML = '<div class="no-chapters">No chapters available</div>';
            return;
        }
        
        container.innerHTML = chapters.map(chapter => {
            const chapterId = chapter.chapter_id;
            const chapterNum = chapter.chapter_number || '?';
            const title = chapter.chapter_title || `Chapter ${chapterNum}`;
            const date = this.formatDate(chapter.release_date);
            
            return `
                <div class="chapter-item" data-id="${chapterId}">
                    <div class="chapter-info">
                        <div class="chapter-title">${title}</div>
                        <div class="chapter-meta">
                            <span class="chapter-date">${date}</span>
                            <span class="chapter-views">👁️ ${this.formatNumber(chapter.view_count || 0)}</span>
                        </div>
                    </div>
                    <div class="chapter-action">
                        <i class="fas fa-book-open"></i>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click events
        container.querySelectorAll('.chapter-item').forEach(item => {
            item.addEventListener('click', async () => {
                const chapterId = item.dataset.id;
                await this.readChapter(chapterId);
            });
        });
    }

    async readChapter(chapterId) {
        console.log(`📄 Reading chapter: ${chapterId}`);
        
        try {
            const response = await this.api.getChapterDetail(chapterId);
            
            if (response.retcode !== 0) {
                throw new Error(response.message || 'Chapter not found');
            }
            
            const chapterData = response.data;
            const images = chapterData.images || [];
            
            if (images.length === 0) {
                alert('No images found in this chapter');
                return;
            }
            
            this.showChapterReader(chapterData);
            
        } catch (error) {
            console.error('Error reading chapter:', error);
            alert(`Failed to load chapter: ${error.message}`);
        }
    }

    showChapterReader(chapterData) {
        // Simple reader untuk testing
        const readerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: black; z-index: 10000; overflow: auto;">
                <div style="position: sticky; top: 0; background: rgba(0,0,0,0.9); padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <button onclick="this.closest('div').remove()" style="background: #ff416c; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        Close Reader
                    </button>
                    <span style="color: white; font-weight: bold;">Chapter ${chapterData.chapter_number || ''}</span>
                </div>
                <div style="padding: 20px; text-align: center;">
                    ${(chapterData.images || []).map((img, idx) => `
                        <img src="${img}" 
                             alt="Page ${idx + 1}"
                             style="max-width: 100%; margin-bottom: 20px; border-radius: 5px;"
                             loading="lazy">
                    `).join('')}
                </div>
            </div>
        `;
        
        const readerDiv = document.createElement('div');
        readerDiv.innerHTML = readerHTML;
        document.body.appendChild(readerDiv);
    }

    // ==================== UTILITIES ====================

    showSection(sectionId) {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const target = document.getElementById(`${sectionId}-section`);
        if (target) {
            target.classList.add('active');
            window.scrollTo(0, 0);
        }
    }

    showLoading(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification
        alert(`[${type.toUpperCase()}] ${message}`);
    }

    async checkAPIStatus() {
        const statusDot = document.getElementById('apiStatusDot');
        const statusText = document.getElementById('apiStatusText');
        
        if (!statusDot || !statusText) return;
        
        try {
            const result = await this.api.testConnection();
            
            if (result.success) {
                statusDot.classList.add('connected');
                statusText.textContent = 'API Connected';
                statusText.style.color = '#00C853';
            } else {
                statusDot.classList.remove('connected');
                statusText.textContent = 'API Error';
                statusText.style.color = '#F44336';
            }
        } catch (error) {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Connection Failed';
            statusText.style.color = '#F44336';
        }
    }

    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });
        
        // Search
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
        }
    }

    async performSearch() {
        const input = document.getElementById('searchInput');
        const query = input.value.trim();
        
        if (!query) {
            this.showNotification('Please enter search keyword', 'warning');
            return;
        }
        
        this.showSection('search');
        this.showLoading('search-results', `Searching for "${query}"...`);
        
        try {
            const response = await this.api.search(query);
            
            const container = document.getElementById('search-results');
            if (!container) return;
            
            if (response.retcode !== 0 || !response.data) {
                container.innerHTML = '<div class="error">Search failed</div>';
                return;
            }
            
            const items = response.data;
            
            if (items.length === 0) {
                container.innerHTML = `<div class="no-data">No results for "${query}"</div>`;
            } else {
                this.displayMangaGrid(items, 'search-results');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showNotification('Search failed', 'error');
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.MangaApp = new MangaApp();
});
