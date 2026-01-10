/**
 * Manga Reader Controller
 */

class MangaReader {
    constructor() {
        this.images = [];
        this.currentImageIndex = 0;
        this.zoomLevel = 1;
        this.isDarkMode = false;
        this.loadMode = 'lazy';
        this.imageQuality = 'medium';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
    }

    bindEvents() {
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(0.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(-0.2));
        
        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => this.toggleDarkMode());
        
        // Fullscreen
        document.getElementById('fullscreen').addEventListener('click', () => this.toggleFullscreen());
        
        // Chapter navigation
        document.getElementById('prevChapter').addEventListener('click', () => this.navigateChapter(-1));
        document.getElementById('nextChapter').addEventListener('click', () => this.navigateChapter(1));
        
        // Settings
        document.getElementById('loadMode').addEventListener('change', (e) => {
            this.loadMode = e.target.value;
            this.saveSettings();
            this.reloadImages();
        });
        
        document.getElementById('imageQuality').addEventListener('change', (e) => {
            this.imageQuality = e.target.value;
            this.saveSettings();
            this.reloadImages();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Scroll handling
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    }

    async loadChapter(chapterData) {
        this.images = chapterData.images || chapterData.pages || [];
        this.currentImageIndex = 0;
        
        if (this.images.length === 0) {
            this.showMessage('Tidak ada gambar ditemukan di chapter ini');
            return;
        }
        
        this.updateImageCounter();
        await this.displayImages();
    }

    async displayImages() {
        const container = document.getElementById('image-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.loadMode === 'all') {
            // Load semua gambar sekaligus
            await this.loadAllImages();
        } else {
            // Lazy load
            this.setupLazyLoading();
        }
    }

    async loadAllImages() {
        const container = document.getElementById('image-container');
        let loadedCount = 0;
        
        for (let i = 0; i < this.images.length; i++) {
            const imgUrl = this.getImageUrl(this.images[i]);
            const imgElement = await this.createImageElement(imgUrl, i);
            container.appendChild(imgElement);
            loadedCount++;
            
            // Update counter setiap 5 gambar
            if (loadedCount % 5 === 0) {
                this.updateLoadedCounter(loadedCount);
            }
        }
        
        this.updateLoadedCounter(loadedCount);
    }

    setupLazyLoading() {
        const container = document.getElementById('image-container');
        
        // Buat placeholder untuk semua gambar
        this.images.forEach((imgUrl, index) => {
            const placeholder = document.createElement('div');
            placeholder.className = 'image-placeholder';
            placeholder.dataset.index = index;
            placeholder.dataset.src = this.getImageUrl(imgUrl);
            placeholder.style.minHeight = '500px';
            placeholder.innerHTML = `<div class="loading">Memuat gambar ${index + 1}...</div>`;
            container.appendChild(placeholder);
        });
        
        // Start lazy loading
        this.lazyLoadImages();
    }

    async lazyLoadImages() {
        const placeholders = document.querySelectorAll('.image-placeholder');
        const viewportHeight = window.innerHeight;
        
        let loadedCount = 0;
        
        const loadVisibleImages = () => {
            placeholders.forEach(async (placeholder, index) => {
                const rect = placeholder.getBoundingClientRect();
                
                // Jika element dalam viewport
                if (rect.top < viewportHeight + 500 && !placeholder.dataset.loaded) {
                    placeholder.dataset.loaded = true;
                    
                    try {
                        const imgElement = await this.createImageElement(
                            placeholder.dataset.src, 
                            index
                        );
                        
                        placeholder.innerHTML = '';
                        placeholder.appendChild(imgElement);
                        placeholder.classList.remove('image-placeholder');
                        
                        loadedCount++;
                        this.updateLoadedCounter(loadedCount);
                    } catch (error) {
                        console.error('Error loading image:', error);
                        placeholder.innerHTML = '<div class="error">Gagal memuat gambar</div>';
                    }
                }
            });
        };
        
        // Load gambar yang terlihat
        loadVisibleImages();
        
        // Event listener untuk scroll
        const scrollHandler = () => {
            loadVisibleImages();
            
            // Hapus event listener jika semua gambar sudah dimuat
            if (loadedCount >= this.images.length) {
                window.removeEventListener('scroll', scrollHandler);
            }
        };
        
        window.addEventListener('scroll', scrollHandler, { passive: true });
    }

    async createImageElement(imgUrl, index) {
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.alt = `Page ${index + 1}`;
            img.className = 'manga-page';
            img.dataset.index = index;
            
            // Tambah data-src untuk lazy loading
            img.dataset.src = imgUrl;
            
            // Terapkan quality setting
            const finalUrl = this.applyQualitySetting(imgUrl);
            img.src = finalUrl;
            
            img.onload = () => {
                img.classList.add('loaded');
                resolve(img);
            };
            
            img.onerror = () => {
                // Fallback ke URL asli jika ada error
                if (finalUrl !== imgUrl) {
                    img.src = imgUrl;
                } else {
                    img.alt = 'Gambar tidak dapat dimuat';
                    img.classList.add('error');
                }
                resolve(img);
            };
            
            // Click untuk zoom
            img.addEventListener('click', () => this.zoomImage(img));
        });
    }

    applyQualitySetting(url) {
        if (this.imageQuality === 'high' || !url.includes('?')) {
            return url;
        }
        
        try {
            const urlObj = new URL(url);
            
            switch(this.imageQuality) {
                case 'medium':
                    urlObj.searchParams.set('quality', '80');
                    urlObj.searchParams.set('width', '1200');
                    break;
                case 'low':
                    urlObj.searchParams.set('quality', '60');
                    urlObj.searchParams.set('width', '800');
                    break;
            }
            
            return urlObj.toString();
        } catch {
            return url;
        }
    }

    getImageUrl(imageData) {
        if (typeof imageData === 'string') {
            return imageData;
        } else if (imageData.url) {
            return imageData.url;
        } else if (imageData.image_url) {
            return imageData.image_url;
        }
        return '';
    }

    zoom(delta) {
        this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel + delta));
        this.applyZoom();
        this.showZoomLevel();
    }

    applyZoom() {
        document.querySelectorAll('.manga-page').forEach(img => {
            img.style.transform = `scale(${this.zoomLevel})`;
            img.style.transformOrigin = 'top center';
        });
    }

    showZoomLevel() {
        let zoomDisplay = document.getElementById('zoomDisplay');
        
        if (!zoomDisplay) {
            zoomDisplay = document.createElement('div');
            zoomDisplay.id = 'zoomDisplay';
            zoomDisplay.className = 'zoom-level';
            document.body.appendChild(zoomDisplay);
        }
        
        zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        zoomDisplay.classList.add('show');
        
        setTimeout(() => {
            zoomDisplay.classList.remove('show');
        }, 2000);
    }

    zoomImage(img) {
        if (this.zoomLevel === 1) {
            this.zoomLevel = 2;
            img.style.transform = `scale(${this.zoomLevel})`;
            img.style.transformOrigin = 'center center';
            img.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            this.zoomLevel = 1;
            this.applyZoom();
        }
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-mode', this.isDarkMode);
        
        const icon = document.querySelector('#darkModeToggle i');
        icon.className = this.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
        
        this.saveSettings();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    navigateChapter(direction) {
        // Implementasi navigasi ke chapter berikutnya/sebelumnya
        // Perlu data list chapter dari manga detail
        console.log(`Navigate chapter: ${direction}`);
        // Akan diintegrasikan dengan chapter list
    }

    updateImageCounter() {
        document.getElementById('loaded-count').textContent = '0';
        document.getElementById('total-count').textContent = this.images.length;
    }

    updateLoadedCounter(count) {
        document.getElementById('loaded-count').textContent = count;
    }

    handleKeyPress(e) {
        switch(e.key) {
            case 'ArrowLeft':
                this.navigateChapter(-1);
                break;
            case 'ArrowRight':
                this.navigateChapter(1);
                break;
            case '+':
            case '=':
                if (e.ctrlKey) this.zoom(0.2);
                break;
            case '-':
                if (e.ctrlKey) this.zoom(-0.2);
                break;
            case 'd':
            case 'D':
                if (e.ctrlKey) this.toggleDarkMode();
                break;
            case 'f':
            case 'F':
                if (e.ctrlKey) this.toggleFullscreen();
                break;
        }
    }

    handleScroll() {
        // Update current image index berdasarkan scroll position
        const images = document.querySelectorAll('.manga-page');
        if (images.length === 0) return;
        
        const viewportCenter = window.scrollY + (window.innerHeight / 2);
        
        let closestImage = null;
        let closestDistance = Infinity;
        
        images.forEach(img => {
            const rect = img.getBoundingClientRect();
            const imgCenter = window.scrollY + rect.top + (rect.height / 2);
            const distance = Math.abs(viewportCenter - imgCenter);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestImage = img;
            }
        });
        
        if (closestImage) {
            this.currentImageIndex = parseInt(closestImage.dataset.index);
        }
    }

    showMessage(message) {
        const container = document.getElementById('image-container');
        if (container) {
            container.innerHTML = `<div class="empty-state">${message}</div>`;
        }
    }

    reloadImages() {
        if (this.images.length > 0) {
            this.displayImages();
        }
    }

    loadSettings() {
        const saved = JSON.parse(localStorage.getItem('reader_settings') || '{}');
        
        this.loadMode = saved.loadMode || 'lazy';
        this.imageQuality = saved.imageQuality || 'medium';
        this.isDarkMode = saved.isDarkMode || false;
        this.zoomLevel = saved.zoomLevel || 1;
        
        // Apply settings
        document.getElementById('loadMode').value = this.loadMode;
        document.getElementById('imageQuality').value = this.imageQuality;
        
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
            const icon = document.querySelector('#darkModeToggle i');
            if (icon) icon.className = 'fas fa-sun';
        }
    }

    saveSettings() {
        const settings = {
            loadMode: this.loadMode,
            imageQuality: this.imageQuality,
            isDarkMode: this.isDarkMode,
            zoomLevel: this.zoomLevel
        };
        
        localStorage.setItem('reader_settings', JSON.stringify(settings));
    }
}

// Inisialisasi reader
document.addEventListener('DOMContentLoaded', () => {
    window.MangaReader = new MangaReader();
});
