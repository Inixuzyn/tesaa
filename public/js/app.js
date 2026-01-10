/**
 * Main Application Controller
 */

class MangaApp {
    constructor() {
        this.api = window.ShinigamiAPI;
        this.currentManga = null;
        this.currentChapter = null;
        this.history = JSON.parse(localStorage.getItem('manga_history') || '[]');
        this.settings = JSON.parse(localStorage.getItem('reader_settings') || '{}');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadHomeData();
        this.updateHistoryDisplay();
        this.checkAPIStatus();
        
        // Restore last read position
        this.restoreLastPosition();
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
        document.getElementById('searchBtn').addEventListener('click', () => this.performSearch());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // View all buttons
        document.querySelectorAll('.view-all').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(btn.dataset.section);
            });
        });

        // Back buttons
        document.getElementById('backFromDetail').addEventListener('click', () => {
            this.showSection('home');
        });

        document.getElementById('backFromReader').addEventListener('click', () => {
            if (this.currentManga) {
                this.showMangaDetail(this.currentManga.id);
            } else {
                this.showSection('home');
            }
        });

        // Refresh buttons
        document.getElementById('refreshNew').addEventListener('click', () => this.loadNewManga());

        // History
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());

        // API test
        document.getElementById('apiTestBtn').addEventListener('click', () => this.checkAPIStatus(true));

        // Pagination
        document.getElementById('prevNew').addEventListener('click', () => this.changePage('new', -1));
        document.getElementById('nextNew').addEventListener('click', () => this.changePage('new', 1));
    }

    showSection(sectionId) {
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });

        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Load data jika diperlukan
            switch(sectionId) {
                case 'new':
                    this.loadNewManga();
                    break;
                case 'top':
                    this.loadTopManga();
                    break;
                case 'recommend':
                    this.loadRecommendManga();
                    break;
                case 'history':
                    this.updateHistoryDisplay();
                    break;
            }
        }
    }

    async loadHomeData() {
        try {
            const data = await this.api.getHome();
            
            if (data.new && !data.error) {
                this.displayMangaGrid(data.new.data || data.new, 'new-manga');
            }
            
            if (data.top && !data.error) {
                this.displayMangaGrid(data.top.data || data.top, 'top-manga');
            }
            
            if (data.recommend && !data.error) {
                this.displayMangaGrid(data.recommend.data || data.recommend, 'recommend-manga');
            }
        } catch (error) {
            console.error('Error loading home data:', error);
            this.showError('Gagal memuat data homepage');
        }
    }

    async loadNewManga(page = 1) {
        try {
            const data = await this.api.getMangaList({
                type: 'project',
                page: page,
                page_size: 30,
                is_update: 'true',
                sort: 'latest',
                sort_order: 'desc'
            });
            
            this.displayMangaGrid(data.data || data, 'new-full-list');
            this.updatePagination('new', page, data);
        } catch (error) {
            console.error('Error loading new manga:', error);
            this.showError('Gagal memuat manga terbaru');
        }
    }

    async loadTopManga() {
        try {
            const data = await this.api.getMangaList({
                type: 'project',
                page: 1,
                page_size: 24,
                is_update: 'true',
                sort: 'latest',
                sort_order: 'desc'
            });
            
            this.displayMangaGrid(data.data || data, 'top-full-list');
        } catch (error) {
            console.error('Error loading top manga:', error);
            this.showError('Gagal memuat top manga');
        }
    }

    async loadRecommendManga() {
        try {
            const data = await this.api.getMangaList({
                type: 'mirror',
                page: 1,
                page_size: 24,
                is_update: 'true',
                sort: 'latest',
                sort_order: 'desc'
            });
            
            this.displayMangaGrid(data.data || data, 'recommend-full-list');
        } catch (error) {
            console.error('Error loading recommendations:', error);
            this.showError('Gagal memuat rekomendasi');
        }
    }

    displayMangaGrid(mangaList, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!mangaList || mangaList.length === 0) {
            container.innerHTML = '<div class="loading">Tidak ada data ditemukan</div>';
            return;
        }
        
        container.innerHTML = mangaList.map((manga, index) => {
            const cover = manga.cover_url || manga.thumbnail || '/images/placeholder.jpg';
            const title = manga.title || manga.name || 'Unknown Title';
            const id = manga.id || manga._id || index;
            const type = manga.type || 'manga';
            const status = manga.status || 'ongoing';
            
            return `
                <div class="manga-card" data-id="${id}" data-type="${type}">
                    <img src="${cover}" alt="${title}" loading="lazy" 
                         onerror="this.src='/images/placeholder.jpg'">
                    <div class="manga-info">
                        <div class="manga-title">${title}</div>
                        <div class="manga-meta">
                            <span>${type}</span>
                            <span class="manga-status status-${status}">${status}</span>
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

    async showMangaDetail(manhwaId) {
        try {
            const data = await this.api.getMangaDetail(manhwaId);
            
            if (data.error) {
                // Fallback ke legacy API
                const legacyData = await this.api.getLegacyMangaDetail(manhwaId);
                if (legacyData.error) throw new Error('Manga tidak ditemukan');
                data = legacyData;
            }
            
            this.currentManga = { id: manhwaId, ...data };
            this.displayMangaDetail(data);
            this.showSection('detail');
            
            // Load chapters
            this.loadChapters(manhwaId);
        } catch (error) {
            console.error('Error loading manga detail:', error);
            this.showError('Gagal memuat detail manga');
        }
    }

    displayMangaDetail(data) {
        const container = document.getElementById('manga-detail-container');
        if (!container) return;
        
        const cover = data.cover_url || data.thumbnail || '/images/placeholder.jpg';
        const title = data.title || data.name || 'Unknown Title';
        const description = data.description || data.synopsis || 'Tidak ada deskripsi';
        const author = data.author || 'Unknown';
        const status = data.status || 'ongoing';
        const genres = data.genres || data.tags || [];
        
        container.innerHTML = `
            <div class="detail-container">
                <div class="detail-cover">
                    <img src="${cover}" alt="${title}" 
                         onerror="this.src='/images/placeholder.jpg'">
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
                        <h3><i class="fas fa-list"></i> Daftar Chapter</h3>
                        <div id="chapter-list-container" class="chapter-grid">
                            <div class="loading">Memuat chapter...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadChapters(manhwaId, page = 1) {
        try {
            const data = await this.api.getChapterList(manhwaId, page);
            this.displayChapterList(data.data || data);
        } catch (error) {
            console.error('Error loading chapters:', error);
            document.getElementById('chapter-list-container').innerHTML = 
                '<div class="loading">Gagal memuat chapter</div>';
        }
    }

    displayChapterList(chapters) {
        const container = document.getElementById('chapter-list-container');
        if (!container) return;
        
        if (!chapters || chapters.length === 0) {
            container.innerHTML = '<div class="loading">Belum ada chapter</div>';
            return;
        }
        
        container.innerHTML = chapters.map(chapter => {
            const title = chapter.title || `Chapter ${chapter.chapter_number || ''}`;
            const id = chapter.id || chapter._id;
            const date = chapter.created_at || chapter.date || '';
            
            return `
                <div class="chapter-item" data-id="${id}">
                    <div class="chapter-title">${title}</div>
                    <div class="chapter-date">${date}</div>
                </div>
            `;
        }).join('');
        
        // Add click events
        container.querySelectorAll('.chapter-item').forEach(item => {
            item.addEventListener('click', () => {
                const chapterId = item.dataset.id;
                this.readChapter(chapterId);
            });
        });
    }

    async readChapter(chapterId) {
        try {
            const data = await this.api.getChapterDetail(chapterId);
            
            if (data.error) {
                // Fallback ke legacy API
                const legacyData = await this.api.getLegacyChapter(chapterId);
                if (legacyData.error) throw new Error('Chapter tidak ditemukan');
                data = legacyData;
            }
            
            this.currentChapter = { id: chapterId, ...data };
            this.showSection('reader');
            this.updateReaderUI();
            
            // Simpan ke history
            this.addToHistory();
            
            // Load images
            if (window.MangaReader) {
                window.MangaReader.loadChapter(data);
            }
        } catch (error) {
            console.error('Error reading chapter:', error);
            this.showError('Gagal memuat chapter');
        }
    }

    updateReaderUI() {
        if (!this.currentManga || !this.currentChapter) return;
        
        document.getElementById('chapter-title').textContent = 
            this.currentChapter.title || `Chapter ${this.currentChapter.chapter_number || ''}`;
        
        // Update chapter select (akan diisi oleh reader.js)
        this.updateChapterSelect();
    }

    updateChapterSelect() {
        // Implementasi tergantung struktur data chapter
        // Akan diisi setelah mendapatkan list semua chapter
    }

    async performSearch() {
        const input = document.getElementById('searchInput');
        const query = input.value.trim();
        
        if (!query) {
            this.showError('Masukkan kata kunci pencarian');
            return;
        }
        
        try {
            const data = await this.api.search(query);
            this.showSearchResults(query, data.data || data);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Gagal melakukan pencarian');
        }
    }

    showSearchResults(query, results) {
        document.getElementById('search-term').textContent = `"${query}"`;
        this.displayMangaGrid(results, 'search-results');
        this.showSection('search');
    }

    addToHistory() {
        if (!this.currentManga || !this.currentChapter) return;
        
        const historyItem = {
            mangaId: this.currentManga.id,
            mangaTitle: this.currentManga.title,
            mangaCover: this.currentManga.cover_url,
            chapterId: this.currentChapter.id,
            chapterTitle: this.currentChapter.title,
            timestamp: Date.now(),
            lastRead: Date.now()
        };
        
        // Hapus jika sudah ada
        this.history = this.history.filter(item => item.mangaId !== historyItem.mangaId);
        
        // Tambahkan di awal
        this.history.unshift(historyItem);
        
        // Simpan max 50 item
        this.history = this.history.slice(0, 50);
        
        // Simpan ke localStorage
        localStorage.setItem('manga_history', JSON.stringify(this.history));
        
        // Update tampilan
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        if (this.history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history fa-3x"></i>
                    <p>Belum ada riwayat baca</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.history.map(item => {
            const timeAgo = this.formatTimeAgo(item.lastRead);
            
            return `
                <div class="history-item" data-id="${item.mangaId}">
                    <div class="history-cover">
                        <img src="${item.mangaCover || '/images/placeholder.jpg'}" 
                             alt="${item.mangaTitle}"
                             onerror="this.src='/images/placeholder.jpg'">
                    </div>
                    <div class="history-info">
                        <div class="history-title">${item.mangaTitle}</div>
                        <div class="history-chapter">${item.chapterTitle}</div>
                        <div class="history-time">
                            <i class="far fa-clock"></i> ${timeAgo}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click events
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const mangaId = item.dataset.id;
                this.showMangaDetail(mangaId);
            });
        });
    }

    clearHistory() {
        if (confirm('Hapus semua riwayat baca?')) {
            this.history = [];
            localStorage.removeItem('manga_history');
            this.updateHistoryDisplay();
        }
    }

    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'baru saja';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} menit yang lalu`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam yang lalu`;
        if (seconds < 2592000) return `${Math.floor(seconds / 86400)} hari yang lalu`;
        if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} bulan yang lalu`;
        return `${Math.floor(seconds / 31536000)} tahun yang lalu`;
    }

    async checkAPIStatus(force = false) {
        const statusDot = document.getElementById('apiStatusDot');
        const statusText = document.getElementById('apiStatusText');
        
        if (force) {
            statusText.textContent = 'Memeriksa...';
            statusDot.classList.remove('connected');
        }
        
        try {
            const health = await this.api.checkHealth();
            
            if (health.status === 'OK') {
                statusDot.classList.add('connected');
                statusText.textContent = 'API Terhubung';
                statusText.style.color = 'var(--success-color)';
            } else {
                statusDot.classList.remove('connected');
                statusText.textContent = 'API Error';
                statusText.style.color = 'var(--error-color)';
            }
        } catch (error) {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Tidak Terhubung';
            statusText.style.color = 'var(--error-color)';
        }
    }

    restoreLastPosition() {
        const lastRead = this.history[0];
        if (lastRead && this.settings.autoResume) {
            // Bisa ditambahkan logika untuk melanjutkan baca
        }
    }

    showError(message) {
        // Buat notifikasi error sederhana
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        errorDiv.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: var(--error-color);
            color: white;
            padding: 1rem;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }, 3000);
    }

    changePage(section, direction) {
        // Implementasi pagination
        // Akan di-extend sesuai kebutuhan
    }

    updatePagination(section, currentPage, data) {
        // Update UI pagination
        const prevBtn = document.getElementById(`prev${section.charAt(0).toUpperCase() + section.slice(1)}`);
        const nextBtn = document.getElementById(`next${section.charAt(0).toUpperCase() + section.slice(1)}`);
        const pageInfo = document.querySelector(`#${section}-section .page-info`);
        
        if (pageInfo) {
            pageInfo.textContent = `Halaman ${currentPage}`;
        }
        
        if (prevBtn) {
            prevBtn.classList.toggle('disabled', currentPage <= 1);
        }
        
        // Asumsi ada total pages dari response API
        const totalPages = data.total_pages || data.last_page || 1;
        if (nextBtn) {
            nextBtn.classList.toggle('disabled', currentPage >= totalPages);
        }
    }
}

// Inisialisasi app saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    window.MangaApp = new MangaApp();
});
