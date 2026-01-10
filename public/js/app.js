class MangaApp {
    constructor() {
        this.api = window.ShinigamiAPI;
        this.currentManga = null;
        this.init();
    }

    init() {
        console.log('🚀 Initializing Manga App...');
        this.bindEvents();
        this.loadHomeData();
    }

    async loadHomeData() {
        try {
            const data = await this.api.getHome();
            console.log('Home data:', data);
            
            // Process data - handle different response formats
            if (data.new) {
                const newItems = data.new.data || data.new;
                this.displayMangaGrid(newItems, 'new-manga');
            }
            
            if (data.top) {
                const topItems = data.top.data || data.top;
                this.displayMangaGrid(topItems, 'top-manga');
            }
            
            if (data.recommend) {
                const recItems = data.recommend.data || data.recommend;
                this.displayMangaGrid(recItems, 'recommend-manga');
            }
        } catch (error) {
            console.error('Error loading home:', error);
        }
    }

    displayMangaGrid(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="loading">No data found</div>';
            return;
        }
        
        // Ambil hanya 10 item pertama untuk preview
        const displayItems = items.slice(0, 10);
        
        container.innerHTML = displayItems.map(item => {
            // Handle different response formats
            const coverUrl = item.cover_url || item.thumbnail || item.image || 
                            `https://via.placeholder.com/300x400/1a1a2e/ffffff?text=${encodeURIComponent(item.title || 'Manga')}`;
            
            const title = item.title || item.name || 'Untitled';
            const mangaId = item.id || item._id || 'unknown';
            const type = item.type || 'manga';
            
            return `
                <div class="manga-card" data-id="${mangaId}">
                    <img src="${coverUrl}" 
                         alt="${title}"
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/300x400/1a1a2e/ffffff?text=Image+Error'">
                    <div class="manga-info">
                        <div class="manga-title">${title}</div>
                        <div class="manga-meta">
                            <span>${type}</span>
                            <span class="manga-status">${item.status || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click events
        container.querySelectorAll('.manga-card').forEach(card => {
            card.addEventListener('click', () => {
                const mangaId = card.dataset.id;
                this.showMangaDetail(mangaId);
            });
        });
    }

    async showMangaDetail(mangaId) {
        console.log(`Loading detail for: ${mangaId}`);
        
        try {
            // Show loading
            this.showSection('detail');
            document.getElementById('manga-detail-container').innerHTML = 
                '<div class="loading">Loading manga details...</div>';
            
            // Fetch data
            const data = await this.api.getMangaDetail(mangaId);
            console.log('Manga detail:', data);
            
            if (data.error) {
                throw new Error(data.message || 'Failed to load manga');
            }
            
            this.currentManga = data;
            this.displayMangaDetail(data);
            
        } catch (error) {
            console.error('Error loading manga detail:', error);
            document.getElementById('manga-detail-container').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Failed to load manga</h3>
                    <p>${error.message}</p>
                    <button onclick="window.MangaApp.showSection('home')">Back to Home</button>
                </div>
            `;
        }
    }

    displayMangaDetail(data) {
        const container = document.getElementById('manga-detail-container');
        
        // Extract data with fallbacks
        const coverUrl = data.cover_url || data.thumbnail || data.image || 
                        `https://via.placeholder.com/400x600/1a1a2e/ffffff?text=${encodeURIComponent(data.title || 'Cover')}`;
        
        const title = data.title || data.name || 'Unknown Title';
        const description = data.description || data.synopsis || 'No description available.';
        const author = data.author || 'Unknown Author';
        const status = data.status || 'ongoing';
        const genres = data.genres || data.tags || [];
        
        // Get chapters (handle different formats)
        let chapters = [];
        if (data.chapters && Array.isArray(data.chapters)) {
            chapters = data.chapters;
        } else if (data.chapter_list) {
            chapters = data.chapter_list;
        }
        
        container.innerHTML = `
            <button class="back-btn" onclick="window.MangaApp.showSection('home')">
                <i class="fas fa-arrow-left"></i> Back
            </button>
            
            <div class="detail-container">
                <div class="detail-cover">
                    <img src="${coverUrl}" 
                         alt="${title}"
                         onerror="this.src='https://via.placeholder.com/400x600/1a1a2e/ffffff?text=Cover+Error'">
                </div>
                
                <div class="detail-content">
                    <h1>${title}</h1>
                    
                    <div class="detail-meta">
                        <span class="meta-tag">${author}</span>
                        <span class="meta-tag status-${status}">${status}</span>
                        ${genres.slice(0, 5).map(genre => `
                            <span class="meta-tag">${genre}</span>
                        `).join('')}
                    </div>
                    
                    <div class="detail-description">
                        ${description.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="chapter-list">
                        <h3><i class="fas fa-list"></i> Chapters (${chapters.length})</h3>
                        
                        ${chapters.length > 0 ? `
                            <div class="chapter-grid">
                                ${chapters.slice(0, 20).map((chapter, idx) => `
                                    <div class="chapter-item" data-id="${chapter.id || idx}">
                                        <div class="chapter-title">
                                            ${chapter.title || `Chapter ${chapter.chapter_number || idx + 1}`}
                                        </div>
                                        <div class="chapter-date">
                                            ${chapter.created_at || chapter.date || ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            ${chapters.length > 20 ? `
                                <p style="color: var(--text-secondary); margin-top: 10px;">
                                    ... and ${chapters.length - 20} more chapters
                                </p>
                            ` : ''}
                        ` : `
                            <div class="loading">
                                No chapters found or failed to load chapter list.
                                <button onclick="window.MangaApp.loadChapters('${data.id}')">
                                    Try Load Chapters
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
        
        // Add click events to chapters
        if (chapters.length > 0) {
            container.querySelectorAll('.chapter-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const chapterId = item.dataset.id;
                    console.log(`Reading chapter: ${chapterId}`);
                    
                    // Try to load chapter
                    try {
                        const chapterData = await this.api.getChapterDetail(chapterId);
                        
                        if (chapterData.images && chapterData.images.length > 0) {
                            this.showChapterReader(chapterData);
                        } else {
                            alert('No images found in this chapter');
                        }
                    } catch (error) {
                        console.error('Error loading chapter:', error);
                        alert('Failed to load chapter: ' + error.message);
                    }
                });
            });
        }
    }

    showChapterReader(chapterData) {
        // Simple chapter reader
        const readerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: black; z-index: 1000; overflow: auto;">
                <div style="position: sticky; top: 0; background: rgba(0,0,0,0.8); padding: 10px; display: flex; justify-content: space-between;">
                    <button onclick="window.MangaApp.closeReader()" style="background: #ff416c; color: white; border: none; padding: 8px 16px; border-radius: 4px;">
                        Close Reader
                    </button>
                    <span style="color: white;">${chapterData.title || 'Chapter'}</span>
                </div>
                
                <div style="padding: 20px; text-align: center;">
                    ${chapterData.images.map((img, idx) => `
                        <img src="${img}" 
                             alt="Page ${idx + 1}"
                             style="max-width: 100%; margin-bottom: 10px; border-radius: 5px;"
                             onerror="this.src='https://via.placeholder.com/800x1200/333/fff?text=Page+${idx + 1}'">
                    `).join('')}
                </div>
            </div>
        `;
        
        const readerDiv = document.createElement('div');
        readerDiv.innerHTML = readerHTML;
        document.body.appendChild(readerDiv);
        
        this.currentReader = readerDiv;
    }

    closeReader() {
        if (this.currentReader) {
            this.currentReader.remove();
            this.currentReader = null;
        }
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        const target = document.getElementById(`${sectionId}-section`);
        if (target) {
            target.classList.add('active');
        }
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
        
        if (!query) return;
        
        try {
            const results = await this.api.search(query);
            console.log('Search results:', results);
            
            // Show search results
            this.showSection('search');
            
            const container = document.getElementById('search-results');
            if (results.data && results.data.length > 0) {
                this.displayMangaGrid(results.data, 'search-results');
            } else {
                container.innerHTML = '<div class="loading">No results found</div>';
            }
            
        } catch (error) {
            console.error('Search error:', error);
        }
    }
}

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
    window.MangaApp = new MangaApp();
});
