/**
 * Manga App - COMPLETE VERSION
 * Includes: Single page chapter list, Big reader images, No zoom, Toggle button
 */

class MangaApp {
    constructor() {
        this.api = window.ShinigamiAPI;
        this.currentManga = null;
        this.currentChapter = null;
        this.chapters = [];
        this.chapterSortOrder = 'desc'; // 'asc' or 'desc'
        this.init();
    }

    init() {
        console.log('🚀 Initializing Manga App...');
        this.bindEvents();
        this.loadHomeData();
        this.checkAPIStatus();
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        const menuToggle = document.getElementById('mobileMenuToggle');
        const navMenu = document.querySelector('.nav-menu');
        
        if (menuToggle && navMenu) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                navMenu.classList.toggle('mobile-show');
            });
            
            document.addEventListener('click', (e) => {
                if (!menuToggle.contains(e.target) && !navMenu.contains(e.target)) {
                    navMenu.classList.remove('mobile-show');
                }
            });
        }
    }

    async loadHomeData() {
        console.log('📥 Loading home data...');
        
        try {
            const data = await this.api.getHome();
            
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
                         onerror="this.src='https://via.placeholder.com/300x400/1a1a2e/ffffff?text=No+Image'">
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
        
        container.querySelectorAll('.manga-card').forEach(card => {
            card.addEventListener('click', () => {
                const mangaId = card.dataset.id;
                const mangaTitle = card.dataset.title;
                this.showMangaDetail(mangaId, mangaTitle);
                document.querySelector('.nav-menu').classList.remove('mobile-show');
            });
        });
    }

    async showMangaDetail(mangaId, mangaTitle = '') {
        console.log(`📖 Loading detail for: ${mangaId}`);
        
        this.showSection('detail');
        this.showLoading('manga-detail-container', 'Loading manga details...');
        
        try {
            const response = await this.api.getMangaDetail(mangaId);
            
            if (response.retcode !== 0) {
                throw new Error(response.message || 'Manga not found');
            }
            
            const data = response.data;
            
            if (!data) {
                throw new Error('No data received from API');
            }
            
            this.currentManga = data;
            this.renderMangaDetail(data);
            
            // Load SEMUA chapters dalam satu page
            await this.loadAllChapters(mangaId);
            
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
        
        const coverUrl = this.api.constructor.getImageUrl(data.cover_image_url);
        const title = data.title || 'Untitled';
        const description = data.description || 'No description';
        const viewCount = this.formatNumber(data.view_count || 0);
        const rating = data.user_rate || 'N/A';
        
        let genres = [];
        if (data.taxonomy && data.taxonomy.Genre) {
            genres = data.taxonomy.Genre.map(g => g.name);
        }
        
        container.innerHTML = `
            <div class="detail-container">
                <div class="detail-cover">
                    <img src="${coverUrl}" 
                         alt="${title}"
                         onerror="this.src='https://via.placeholder.com/400x600/1a1a2e/ffffff?text=Cover'">
                </div>
                
                <div class="detail-content">
                    <div class="detail-header">
                        <h1 class="detail-title">${title}</h1>
                        <button class="back-btn-bottom" onclick="window.MangaApp.showSection('home')">
                            <i class="fas fa-arrow-left"></i> Back to Home
                        </button>
                    </div>
                    
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
                        <h3><i class="fas fa-align-left"></i> Description</h3>
                        <p>${description}</p>
                    </div>
                </div>
            </div>
            
            <div class="chapter-list-section">
                <div class="chapter-list-header">
                    <h3><i class="fas fa-list"></i> All Chapters</h3>
                    <div class="chapter-controls">
                        <div class="chapter-search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="chapterSearch" 
                                   placeholder="Search chapter number or title..."
                                   onkeyup="window.MangaApp.searchChapter(this.value)">
                        </div>
                        <button class="chapter-filter-btn ${this.chapterSortOrder === 'desc' ? 'active' : ''}" 
                                onclick="window.MangaApp.toggleChapterSort('desc')">
                            <i class="fas fa-sort-numeric-down"></i> Newest
                        </button>
                        <button class="chapter-filter-btn ${this.chapterSortOrder === 'asc' ? 'active' : ''}" 
                                onclick="window.MangaApp.toggleChapterSort('asc')">
                            <i class="fas fa-sort-numeric-up"></i> Oldest
                        </button>
                    </div>
                </div>
                
                <div class="chapter-stats">
                    <div class="stat-item">
                        <i class="fas fa-book"></i>
                        <span id="totalChaptersCount">0</span> Chapters
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-eye"></i>
                        <span id="totalViewsCount">0</span> Total Views
                    </div>
                </div>
                
                <div id="chapter-list-container" class="chapter-grid-container">
                    <div class="loading">Loading all chapters...</div>
                </div>
            </div>
        `;
    }

    async loadAllChapters(mangaId) {
        console.log(`📚 Loading ALL chapters for manga: ${mangaId}`);
        
        const container = document.getElementById('chapter-list-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading-chapters">
                <div class="spinner"></div>
                <p>Loading all chapters...</p>
                <p class="loading-info">Please wait, loading all chapters in one page</p>
            </div>
        `;
        
        try {
            // Load SEMUA chapters tanpa pagination
            let allChapters = [];
            let page = 1;
            let hasMore = true;
            
            while (hasMore) {
                console.log(`Loading chapter page ${page}...`);
                
                const response = await this.api.request(`v1/chapter/${mangaId}/list`, {
                    page: page,
                    page_size: 100, // Load 100 per page
                    sort_by: 'chapter_number',
                    sort_order: 'desc'
                });
                
                if (response.retcode !== 0) {
                    throw new Error(response.message || 'Failed to load chapters');
                }
                
                const chapters = response.data || [];
                allChapters = [...allChapters, ...chapters];
                
                // Check if there are more pages
                const meta = response.meta || {};
                const totalPages = meta.total_page || 1;
                
                if (page >= totalPages || chapters.length === 0) {
                    hasMore = false;
                } else {
                    page++;
                    // Update loading text
                    const loadingInfo = container.querySelector('.loading-info');
                    if (loadingInfo) {
                        loadingInfo.textContent = `Loaded ${allChapters.length} chapters...`;
                    }
                }
                
                // Safety limit: max 10 pages (1000 chapters)
                if (page > 10) {
                    console.log('⚠️ Safety limit: Loaded max 10 pages (1000 chapters)');
                    hasMore = false;
                }
            }
            
            console.log(`✅ Loaded ${allChapters.length} total chapters`);
            
            this.chapters = allChapters;
            this.displayAllChapters(allChapters);
            
        } catch (error) {
            console.error('Error loading chapters:', error);
            container.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load chapters: ${error.message}</p>
                    <button onclick="window.MangaApp.loadAllChapters('${mangaId}')" class="retry-btn">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    displayAllChapters(chapters) {
        const container = document.getElementById('chapter-list-container');
        if (!container) return;
        
        if (!chapters || chapters.length === 0) {
            container.innerHTML = '<div class="no-chapters">No chapters available</div>';
            return;
        }
        
        // Update stats
        const totalChapters = chapters.length;
        const totalViews = chapters.reduce((sum, chapter) => sum + (chapter.view_count || 0), 0);
        
        document.getElementById('totalChaptersCount').textContent = this.formatNumber(totalChapters);
        document.getElementById('totalViewsCount').textContent = this.formatNumber(totalViews);
        
        // Sort chapters berdasarkan current sort order
        const sortedChapters = [...chapters].sort((a, b) => {
            const aNum = a.chapter_number || 0;
            const bNum = b.chapter_number || 0;
            
            if (this.chapterSortOrder === 'desc') {
                return bNum - aNum; // Newest first
            } else {
                return aNum - bNum; // Oldest first
            }
        });
        
        // Group by 100s untuk organize
        const groupedChapters = this.groupChapters(sortedChapters);
        
        let chaptersHTML = '';
        
        // Jika banyak chapter, buat groups
        if (Object.keys(groupedChapters).length > 1) {
            Object.entries(groupedChapters).forEach(([range, chaps]) => {
                chaptersHTML += `
                    <div class="chapter-group">
                        <div class="group-title">
                            <i class="fas fa-folder"></i>
                            Chapters ${range}
                            <span class="stat-item" style="margin-left: auto; font-size: 0.8rem;">
                                ${chaps.length} chapters
                            </span>
                        </div>
                        <div class="chapter-grid">
                            ${chaps.map(chapter => this.renderChapterItem(chapter)).join('')}
                        </div>
                    </div>
                `;
            });
        } else {
            // Jika sedikit, langsung tampilkan tanpa grouping
            chaptersHTML = `
                <div class="chapter-grid">
                    ${sortedChapters.map(chapter => this.renderChapterItem(chapter)).join('')}
                </div>
            `;
        }
        
        container.innerHTML = chaptersHTML;
        
        // Add click events
        this.bindChapterEvents();
    }

    groupChapters(chapters) {
        const groups = {};
        
        chapters.forEach(chapter => {
            const chapNum = chapter.chapter_number || 0;
            const groupKey = Math.floor(chapNum / 100) * 100;
            const groupName = `${groupKey + 1}-${groupKey + 100}`;
            
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(chapter);
        });
        
        // Sort groups by range
        const sortedGroups = {};
        Object.keys(groups).sort((a, b) => {
            const aStart = parseInt(a.split('-')[0]);
            const bStart = parseInt(b.split('-')[0]);
            
            if (this.chapterSortOrder === 'desc') {
                return bStart - aStart; // Newest first
            } else {
                return aStart - bStart; // Oldest first
            }
        }).forEach(key => {
            sortedGroups[key] = groups[key];
        });
        
        return sortedGroups;
    }

    renderChapterItem(chapter) {
        const chapterId = chapter.chapter_id;
        const chapterNum = chapter.chapter_number || '?';
        const title = chapter.chapter_title || `Chapter ${chapterNum}`;
        const date = this.formatDate(chapter.release_date);
        const views = this.formatNumber(chapter.view_count || 0);
        
        // Check if chapter is new (released within last 7 days)
        const isNew = this.isNewChapter(chapter.release_date);
        const chapterClass = isNew ? 'chapter-item new' : 'chapter-item';
        
        return `
            <div class="${chapterClass}" data-id="${chapterId}" data-number="${chapterNum}">
                <div class="chapter-info">
                    <div class="chapter-title">${title}</div>
                    ${chapter.chapter_subtitle ? `
                        <div class="chapter-subtitle">${chapter.chapter_subtitle}</div>
                    ` : ''}
                    <div class="chapter-meta">
                        <span class="chapter-date">📅 ${date}</span>
                        <span class="chapter-views">👁️ ${views}</span>
                        ${isNew ? '<span class="new-badge" style="color: #ff416c; font-size: 0.8rem;">NEW</span>' : ''}
                    </div>
                </div>
                <div class="chapter-action">
                    <i class="fas fa-book-open"></i>
                </div>
            </div>
        `;
    }

    isNewChapter(dateString) {
        if (!dateString) return false;
        
        const chapterDate = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - chapterDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays <= 7; // New if within 7 days
    }

    toggleChapterSort(order) {
        this.chapterSortOrder = order;
        
        // Update active button
        document.querySelectorAll('.chapter-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`.chapter-filter-btn[onclick*="${order}"]`).classList.add('active');
        
        // Re-render chapters dengan sort baru
        if (this.chapters.length > 0) {
            this.displayAllChapters(this.chapters);
        }
    }

    searchChapter(query) {
        const searchTerm = query.toLowerCase().trim();
        const allItems = document.querySelectorAll('.chapter-item');
        
        if (!searchTerm) {
            // Show all jika search kosong
            allItems.forEach(item => {
                item.style.display = 'flex';
            });
            return;
        }
        
        allItems.forEach(item => {
            const chapterNum = item.dataset.number || '';
            const title = item.querySelector('.chapter-title').textContent.toLowerCase();
            
            if (chapterNum.includes(searchTerm) || title.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    bindChapterEvents() {
        document.querySelectorAll('.chapter-item').forEach(item => {
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
            
            if (!chapterData.images || chapterData.images.length === 0) {
                if (chapterData.chapter) {
                    const baseUrl = chapterData.base_url || 'https://assets.shngm.id';
                    const path = chapterData.chapter.path;
                    const imageFiles = chapterData.chapter.data.filter(img => !img.startsWith('999-'));
                    chapterData.images = imageFiles.map(img => `${baseUrl}${path}${img}`);
                }
            }
            
            if (!chapterData.images || chapterData.images.length === 0) {
                alert('No images found in this chapter');
                return;
            }
            
            this.currentChapter = chapterData;
            this.showChapterReader(chapterData);
            
        } catch (error) {
            console.error('Error reading chapter:', error);
            alert(`Failed to load chapter: ${error.message}`);
        }
    }

    showChapterReader(chapterData) {
        const existingReader = document.getElementById('manga-reader');
        if (existingReader) {
            existingReader.remove();
        }
        
        const isMobile = window.innerWidth <= 768;
        
        const readerHTML = `
            <div id="manga-reader" class="manga-reader-container">
                <!-- TOGGLE BUTTON -->
                <button class="reader-toggle-btn" id="toggleUIButton" title="Show/Hide Controls">
                    <i class="fas fa-eye"></i>
                </button>
                
                <!-- HEADER -->
                <div class="reader-header" id="readerHeader">
                    <div class="reader-header-left">
                        <button id="closeReaderBtn" class="close-reader-btn">
                            <i class="fas fa-times"></i> ${isMobile ? 'Close' : 'Close Reader'}
                        </button>
                        <span class="reader-chapter-title">
                            Chapter ${chapterData.chapter_number || ''}
                        </span>
                    </div>
                    
                    <div class="reader-header-right">
                        ${chapterData.prev_chapter_id ? `
                            <button id="prevChapterBtn" class="reader-nav-btn">
                                <i class="fas fa-chevron-left"></i> ${isMobile ? '' : 'Prev'}
                            </button>
                        ` : ''}
                        
                        ${chapterData.next_chapter_id ? `
                            <button id="nextChapterBtn" class="reader-nav-btn">
                                ${isMobile ? '' : 'Next '}<i class="fas fa-chevron-right"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- FOOTER -->
                <div class="reader-footer" id="readerFooter">
                    <div class="reader-footer-info">
                        ${chapterData.images ? chapterData.images.length : 0} pages
                    </div>
                    <button id="backToTopBtn" class="back-to-top-btn">
                        <i class="fas fa-arrow-up"></i> Back to Top
                    </button>
                </div>
                
                <!-- Progress Bar -->
                <div class="reader-progress-bar">
                    <div class="reader-progress-fill" id="readerProgress"></div>
                </div>
                
                <!-- Images Container -->
                <div class="reader-images-container" id="readerImages">
                    <!-- Images akan diload -->
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Loading chapter images...</p>
                    </div>
                </div>
            </div>
        `;
        
        const readerDiv = document.createElement('div');
        readerDiv.innerHTML = readerHTML;
        document.body.appendChild(readerDiv);
        
        // SETUP TOGGLE BUTTON LOGIC
        this.setupReaderToggle();
        
        // LOAD IMAGES
        this.loadReaderImages(chapterData.images);
        
        // Setup event listeners
        this.setupReaderEvents(chapterData);
        
        // Update progress bar on scroll
        const readerContainer = document.getElementById('manga-reader');
        if (readerContainer) {
            readerContainer.addEventListener('scroll', () => {
                this.updateReaderProgress();
            });
        }
    }

    async loadReaderImages(imageUrls) {
        const imagesContainer = document.getElementById('readerImages');
        if (!imagesContainer || !imageUrls || imageUrls.length === 0) {
            imagesContainer.innerHTML = '<div class="error">No images found</div>';
            return;
        }
        
        let imagesHTML = '';
        const totalImages = imageUrls.length;
        
        // Load semua gambar sekaligus
        for (let i = 0; i < totalImages; i++) {
            const imgUrl = imageUrls[i];
            const pageNum = i + 1;
            
            imagesHTML += `
                <div class="reader-page" id="page-${pageNum}">
                    <img src="${imgUrl}" 
                         alt="Page ${pageNum}"
                         class="reader-image loading-img"
                         loading="${i < 3 ? 'eager' : 'lazy'}"
                         data-page="${pageNum}"
                         onload="window.MangaApp.handleImageLoad(this)"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/800x1200/333/ccc?text=Page+${pageNum}'">
                    <div class="page-number">Page ${pageNum}</div>
                </div>
            `;
        }
        
        imagesContainer.innerHTML = imagesHTML;
        
        // Preload first 3 images immediately
        for (let i = 0; i < Math.min(3, totalImages); i++) {
            const img = new Image();
            img.src = imageUrls[i];
        }
    }

    handleImageLoad(imgElement) {
        imgElement.classList.remove('loading-img');
        
        // Deteksi orientation untuk styling
        const width = imgElement.naturalWidth || imgElement.width;
        const height = imgElement.naturalHeight || imgElement.height;
        
        if (width > height) {
            // Landscape
            imgElement.classList.add('landscape');
        } else {
            // Portrait
            imgElement.classList.add('portrait');
        }
    }

    setupReaderToggle() {
        const toggleBtn = document.getElementById('toggleUIButton');
        const readerHeader = document.getElementById('readerHeader');
        const readerFooter = document.getElementById('readerFooter');
        
        if (!toggleBtn || !readerHeader) return;
        
        let isUIVisible = true;
        
        // Toggle function
        const toggleUI = () => {
            isUIVisible = !isUIVisible;
            
            if (isUIVisible) {
                // Show UI
                readerHeader.classList.remove('hidden');
                readerFooter.classList.remove('hidden');
                toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                toggleBtn.title = "Hide Controls";
            } else {
                // Hide UI
                readerHeader.classList.add('hidden');
                readerFooter.classList.add('hidden');
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
                toggleBtn.title = "Show Controls";
            }
        };
        
        // Click toggle button
        toggleBtn.addEventListener('click', toggleUI);
        
        // ESC key untuk toggle
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
                toggleUI();
            }
        });
        
        // Auto-hide setelah 5 detik
        setTimeout(() => {
            if (isUIVisible) {
                toggleUI();
            }
        }, 5000);
    }

    setupReaderEvents(chapterData) {
        // Close button
        const closeBtn = document.getElementById('closeReaderBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const reader = document.getElementById('manga-reader');
                if (reader) {
                    reader.remove();
                    this.showSection('detail');
                    window.scrollTo(0, 0);
                }
            });
        }
        
        // Navigation buttons
        const prevBtn = document.getElementById('prevChapterBtn');
        const nextBtn = document.getElementById('nextChapterBtn');
        
        if (prevBtn && chapterData.prev_chapter_id) {
            prevBtn.addEventListener('click', async () => {
                await this.readChapter(chapterData.prev_chapter_id);
            });
        } else if (prevBtn) {
            prevBtn.disabled = true;
            prevBtn.style.opacity = '0.5';
        }
        
        if (nextBtn && chapterData.next_chapter_id) {
            nextBtn.addEventListener('click', async () => {
                await this.readChapter(chapterData.next_chapter_id);
            });
        } else if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.5';
        }
        
        // Back to top button
        const backToTopBtn = document.getElementById('backToTopBtn');
        if (backToTopBtn) {
            backToTopBtn.addEventListener('click', () => {
                const reader = document.getElementById('manga-reader');
                if (reader) {
                    reader.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
            });
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            // ESC untuk close reader
            if (e.key === 'Escape') {
                const reader = document.getElementById('manga-reader');
                if (reader) {
                    reader.remove();
                    this.showSection('detail');
                }
            }
            
            // Arrow keys untuk navigation
            if (e.key === 'ArrowRight') {
                const nextBtn = document.getElementById('nextChapterBtn');
                if (nextBtn && !nextBtn.disabled) {
                    nextBtn.click();
                }
            }
            
            if (e.key === 'ArrowLeft') {
                const prevBtn = document.getElementById('prevChapterBtn');
                if (prevBtn && !prevBtn.disabled) {
                    prevBtn.click();
                }
            }
            
            // Space untuk scroll down
            if (e.key === ' ' || e.key === 'PageDown') {
                e.preventDefault();
                const reader = document.getElementById('manga-reader');
                if (reader) {
                    reader.scrollBy({
                        top: window.innerHeight * 0.8,
                        behavior: 'smooth'
                    });
                }
            }
            
            // Shift+Space atau PageUp untuk scroll up
            if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
                e.preventDefault();
                const reader = document.getElementById('manga-reader');
                if (reader) {
                    reader.scrollBy({
                        top: -window.innerHeight * 0.8,
                        behavior: 'smooth'
                    });
                }
            }
        });
        
        // Double click untuk fullscreen
        const readerDiv = document.getElementById('manga-reader');
        if (readerDiv) {
            readerDiv.addEventListener('dblclick', () => {
                if (!document.fullscreenElement) {
                    readerDiv.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            });
        }
    }

    updateReaderProgress() {
        const readerContainer = document.getElementById('manga-reader');
        const progressBar = document.getElementById('readerProgress');
        
        if (!readerContainer || !progressBar) return;
        
        const scrollTop = readerContainer.scrollTop;
        const scrollHeight = readerContainer.scrollHeight - readerContainer.clientHeight;
        const progress = (scrollTop / scrollHeight) * 100;
        
        progressBar.style.width = `${progress}%`;
    }

    // ==================== UTILITIES ====================

    showSection(sectionId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });
        
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const target = document.getElementById(`${sectionId}-section`);
        if (target) {
            target.classList.add('active');
            window.scrollTo(0, 0);
        }
        
        document.querySelector('.nav-menu').classList.remove('mobile-show');
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
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        if (type === 'error') {
            alert(`Error: ${message}`);
        }
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
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });
        
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
        
        const apiTestBtn = document.getElementById('apiTestBtn');
        if (apiTestBtn) {
            apiTestBtn.addEventListener('click', () => this.checkAPIStatus(true));
        }
        
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    handleResize() {
        // Handle responsive changes jika perlu
        const reader = document.getElementById('manga-reader');
        if (reader && this.currentChapter) {
            // Re-init reader pada resize
            reader.remove();
            this.showChapterReader(this.currentChapter);
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.MangaApp = new MangaApp();
});
