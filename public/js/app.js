/**
 * Manga App - FINAL COMPLETE VERSION
 * Includes: Chapter pagination, reader close fix, single back button, Mobile responsive, Auto-hide reader header
 */

class MangaApp {
    constructor() {
        this.api = window.ShinigamiAPI;
        this.currentManga = null;
        this.currentChapter = null;
        this.chapters = [];
        this.readerState = {
            isHeaderVisible: true,
            lastScrollY: 0,
            scrollTimeout: null,
            autoHideTimeout: null
        };
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
                        <h3>Description</h3>
                        <p>${description}</p>
                    </div>
                    
                    <div class="chapter-list">
                        <h3><i class="fas fa-list"></i> Chapters</h3>
                        <div id="chapter-list-container" class="chapter-grid">
                            <div class="loading">Loading chapters...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadChapters(mangaId) {
        console.log(`📚 Loading chapters for manga: ${mangaId}`);
        
        const container = document.getElementById('chapter-list-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading-chapters">
                <div class="spinner"></div>
                <p>Loading chapters...</p>
                <p class="loading-info" id="loadingInfo">Fetching chapter list</p>
            </div>
        `;
        
        try {
            const response = await this.api.request(`v1/chapter/${mangaId}/list`, {
                page: 1,
                page_size: 100,
                sort_by: 'chapter_number',
                sort_order: 'desc'
            });
            
            if (response.retcode !== 0) {
                throw new Error(response.message || 'Failed to load chapters');
            }
            
            const chapters = response.data || [];
            const totalChapters = response.meta?.total_record || chapters.length;
            const totalPages = response.meta?.total_page || 1;
            
            console.log(`📊 Loaded ${chapters.length} of ${totalChapters} chapters (Page 1/${totalPages})`);
            
            this.chapters = chapters;
            this.displayChaptersWithPagination(chapters, totalChapters, totalPages, mangaId);
            
        } catch (error) {
            console.error('Error loading chapters:', error);
            container.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load chapters: ${error.message}</p>
                    <button onclick="window.MangaApp.loadChapters('${mangaId}')" class="retry-btn">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    displayChaptersWithPagination(chapters, totalChapters, totalPages, mangaId) {
        const container = document.getElementById('chapter-list-container');
        if (!container) return;
        
        if (chapters.length === 0) {
            container.innerHTML = '<div class="no-chapters">No chapters available</div>';
            return;
        }
        
        const groupedChapters = this.groupChapters(chapters);
        
        container.innerHTML = `
            <div class="chapter-list-header">
                <h3><i class="fas fa-list"></i> All Chapters</h3>
                <div class="chapter-stats">
                    <span class="stat-item">📚 ${totalChapters} Chapters</span>
                    <span class="stat-item">📄 ${totalPages} Pages</span>
                </div>
            </div>
            
            <div class="chapter-search-container">
                <input type="text" id="chapterSearch" 
                       placeholder="Search chapter number..." 
                       onkeyup="window.MangaApp.searchChapter(this.value)">
                <button onclick="window.MangaApp.jumpToChapter()" class="jump-btn">
                    <i class="fas fa-search"></i> Jump
                </button>
            </div>
            
            ${Object.entries(groupedChapters).map(([range, chaps]) => `
                <div class="chapter-group">
                    <h4 class="group-title">Chapters ${range}</h4>
                    <div class="chapter-grid">
                        ${chaps.map(chapter => this.renderChapterItem(chapter)).join('')}
                    </div>
                </div>
            `).join('')}
            
            ${totalPages > 1 ? `
                <div class="pagination-controls">
                    <p>Showing ${chapters.length} of ${totalChapters} chapters</p>
                    <button onclick="window.MangaApp.loadMoreChapters('${mangaId}', 2)" class="load-more-btn">
                        <i class="fas fa-plus-circle"></i> Load More Chapters
                    </button>
                </div>
            ` : ''}
        `;
        
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
        
        const sortedGroups = {};
        Object.keys(groups).sort((a, b) => {
            const aStart = parseInt(a.split('-')[0]);
            const bStart = parseInt(b.split('-')[0]);
            return bStart - aStart;
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
        
        return `
            <div class="chapter-item" data-id="${chapterId}" data-number="${chapterNum}">
                <div class="chapter-info">
                    <div class="chapter-title">${title}</div>
                    <div class="chapter-meta">
                        <span class="chapter-date">📅 ${date}</span>
                        <span class="chapter-views">👁️ ${views}</span>
                    </div>
                </div>
                <div class="chapter-action">
                    <i class="fas fa-book-open"></i>
                </div>
            </div>
        `;
    }

    async loadMoreChapters(mangaId, page) {
        console.log(`📄 Loading more chapters, page ${page}...`);
        
        try {
            const response = await this.api.request(`v1/chapter/${mangaId}/list`, {
                page: page,
                page_size: 100,
                sort_by: 'chapter_number',
                sort_order: 'desc'
            });
            
            if (response.retcode !== 0) {
                throw new Error(response.message || 'Failed to load more chapters');
            }
            
            const newChapters = response.data || [];
            console.log(`✅ Loaded ${newChapters.length} more chapters`);
            
            this.chapters = [...this.chapters, ...newChapters];
            const container = document.getElementById('chapter-list-container');
            
            const groupedNew = this.groupChapters(newChapters);
            
            Object.entries(groupedNew).forEach(([range, chaps]) => {
                const groupHTML = `
                    <div class="chapter-group">
                        <h4 class="group-title">Chapters ${range}</h4>
                        <div class="chapter-grid">
                            ${chaps.map(chapter => this.renderChapterItem(chapter)).join('')}
                        </div>
                    </div>
                `;
                
                container.insertAdjacentHTML('beforeend', groupHTML);
            });
            
            const totalPages = response.meta?.total_page || 1;
            const paginationControls = container.querySelector('.pagination-controls');
            
            if (paginationControls && page < totalPages) {
                paginationControls.innerHTML = `
                    <button onclick="window.MangaApp.loadMoreChapters('${mangaId}', ${page + 1})" 
                            class="load-more-btn">
                        <i class="fas fa-plus-circle"></i> Load More (Page ${page + 1}/${totalPages})
                    </button>
                `;
            } else if (paginationControls) {
                paginationControls.innerHTML = '<p class="completed">✅ All chapters loaded</p>';
            }
            
            this.bindChapterEvents();
            
        } catch (error) {
            console.error('Error loading more chapters:', error);
            this.showNotification(`Failed to load more chapters: ${error.message}`, 'error');
        }
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
                <!-- 🔥 AUTO-HIDE HEADER -->
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
                
                <!-- 🔥 AUTO-HIDE FOOTER -->
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
                
                <!-- Images -->
                <div class="reader-images-container" id="readerImages">
                    ${(chapterData.images || []).map((img, idx) => `
                        <div class="reader-page" id="page-${idx + 1}">
                            <img src="${img}" 
                                 alt="Page ${idx + 1}"
                                 class="reader-image"
                                 loading="lazy"
                                 data-page="${idx + 1}">
                            <div class="page-number">Page ${idx + 1}</div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Controls Overlay (Desktop only) -->
                ${!isMobile ? `
                    <div class="reader-controls-overlay" id="readerControls">
                        <button class="reader-control-btn" id="zoomInBtn" title="Zoom In">
                            <i class="fas fa-search-plus"></i>
                        </button>
                        <button class="reader-control-btn" id="zoomOutBtn" title="Zoom Out">
                            <i class="fas fa-search-minus"></i>
                        </button>
                        <button class="reader-control-btn" id="toggleDarkMode" title="Toggle Dark Mode">
                            <i class="fas fa-moon"></i>
                        </button>
                        <button class="reader-control-btn" id="fullscreenBtn" title="Fullscreen">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                ` : ''}
                
                <!-- Zoom Indicator -->
                <div class="zoom-indicator" id="zoomIndicator">
                    Zoom: 100%
                </div>
            </div>
        `;
        
        const readerDiv = document.createElement('div');
        readerDiv.innerHTML = readerHTML;
        document.body.appendChild(readerDiv);
        
        // 🔥 INITIALIZE AUTO-HIDE FUNCTIONALITY
        this.setupReaderAutoHide();
        
        // Setup event listeners
        this.setupReaderEvents(chapterData);
        
        // Preload first few images
        this.preloadImages(chapterData.images.slice(0, 3));
    }

    setupReaderAutoHide() {
    const readerContainer = document.getElementById('manga-reader');
    const readerHeader = document.getElementById('readerHeader');
    const readerFooter = document.getElementById('readerFooter');
    const readerControls = document.getElementById('readerControls');
    
    if (!readerContainer || !readerHeader) return;
    
    let isUIVisible = true;
    let hideTimeout = null;
    let lastTapTime = 0;
    
    const showUI = () => {
        readerHeader.classList.remove('hidden');
        readerFooter.classList.remove('hidden');
        if (readerControls && window.innerWidth > 768) {
            readerControls.classList.add('show');
        }
        isUIVisible = true;
        
        // Auto-hide setelah 3 detik
        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            hideUI();
        }, 3000);
    };
    
    const hideUI = () => {
        readerHeader.classList.add('hidden');
        readerFooter.classList.add('hidden');
        if (readerControls) readerControls.classList.remove('show');
        isUIVisible = false;
    };
    
    const toggleUI = () => {
        if (isUIVisible) {
            hideUI();
        } else {
            showUI();
        }
    };
    
    // 🔥 1. Single tap pada area reader (selain gambar) untuk show UI
    readerContainer.addEventListener('click', (e) => {
        // Jika klik di gambar, biarkan zoom logic handle
        if (e.target.closest('.reader-image') || e.target.closest('.page-number')) {
            return;
        }
        
        const currentTime = Date.now();
        const timeSinceLastTap = currentTime - lastTapTime;
        
        if (timeSinceLastTap < 300) {
            // 🔥 2. Double tap cepat untuk toggle UI
            toggleUI();
        } else {
            // 🔥 3. Single tap untuk show UI
            showUI();
        }
        
        lastTapTime = currentTime;
    });
    
    // 🔥 4. Mouse move untuk desktop show UI
    if (window.innerWidth > 768) {
        let mouseMoveTimer;
        readerContainer.addEventListener('mousemove', () => {
            clearTimeout(mouseMoveTimer);
            showUI();
            
            // Quick hide setelah mouse berhenti
            mouseMoveTimer = setTimeout(() => {
                if (isUIVisible) {
                    hideUI();
                }
            }, 1000);
        });
    }
    
    // 🔥 5. ESC key untuk show UI
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!isUIVisible) {
                showUI();
            } else {
                hideUI();
            }
        }
    });
    
    // 🔥 6. Auto-hide awal
    hideTimeout = setTimeout(() => {
        hideUI();
    }, 3000);
    
    // Update progress
    readerContainer.addEventListener('scroll', () => {
        this.updateReaderProgress();
    });
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
        
        // Image zoom
        document.querySelectorAll('.reader-image').forEach(img => {
            img.addEventListener('click', function() {
                const isZoomed = this.classList.contains('zoomed');
                
                // Show zoom indicator
                const zoomIndicator = document.getElementById('zoomIndicator');
                if (zoomIndicator) {
                    zoomIndicator.textContent = `Zoom: ${isZoomed ? '100%' : '150%'}`;
                    zoomIndicator.classList.add('show');
                    setTimeout(() => {
                        zoomIndicator.classList.remove('show');
                    }, 1000);
                }
                
                // Toggle zoom
                this.classList.toggle('zoomed');
            });
        });
        
        // Desktop controls
        this.setupDesktopControls();
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const reader = document.getElementById('manga-reader');
                if (reader) {
                    reader.remove();
                    this.showSection('detail');
                }
            }
            
            // Spacebar to toggle zoom
            if (e.key === ' ' && document.querySelector('.reader-image')) {
                e.preventDefault();
                const images = document.querySelectorAll('.reader-image');
                if (images.length > 0) {
                    const currentImage = this.getCurrentVisibleImage();
                    if (currentImage) {
                        currentImage.classList.toggle('zoomed');
                    }
                }
            }
        });
        
        // Fullscreen double click
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

    setupDesktopControls() {
        if (window.innerWidth <= 768) return;
        
        // Zoom in
        const zoomInBtn = document.getElementById('zoomInBtn');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                const currentImage = this.getCurrentVisibleImage();
                if (currentImage) {
                    currentImage.classList.add('zoomed');
                }
            });
        }
        
        // Zoom out
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                const currentImage = this.getCurrentVisibleImage();
                if (currentImage) {
                    currentImage.classList.remove('zoomed');
                }
            });
        }
        
        // Fullscreen
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                const reader = document.getElementById('manga-reader');
                if (!document.fullscreenElement) {
                    reader.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            });
        }
    }

    getCurrentVisibleImage() {
        const reader = document.getElementById('manga-reader');
        if (!reader) return null;
        
        const images = document.querySelectorAll('.reader-image');
        const readerRect = reader.getBoundingClientRect();
        
        for (const img of images) {
            const imgRect = img.getBoundingClientRect();
            if (imgRect.top >= readerRect.top && imgRect.bottom <= readerRect.bottom) {
                return img;
            }
        }
        
        // Return first image if none is fully visible
        return images.length > 0 ? images[0] : null;
    }

    preloadImages(imageUrls) {
        imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
        });
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

    searchChapter(query) {
        const searchTerm = query.toLowerCase();
        const allItems = document.querySelectorAll('.chapter-item');
        
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

    jumpToChapter() {
        const input = document.getElementById('chapterSearch');
        const chapterNum = parseInt(input.value);
        
        if (!isNaN(chapterNum) && chapterNum > 0) {
            const targetItem = document.querySelector(`.chapter-item[data-number="${chapterNum}"]`);
            if (targetItem) {
                targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetItem.style.animation = 'highlight 2s ease';
            } else {
                alert(`Chapter ${chapterNum} not found in current view. Try loading more chapters.`);
            }
        }
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
        const isMobile = window.innerWidth <= 768;
        
        const reader = document.getElementById('manga-reader');
        if (reader && this.currentChapter) {
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

document.addEventListener('DOMContentLoaded', () => {
    window.MangaApp = new MangaApp();
});
