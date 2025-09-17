document.addEventListener('DOMContentLoaded', () => {
    const API_ENABLED = false;
    const PLATFORM_TAGS = {
        'nowtv': 'NOW TV', 'showtv': 'Show TV', 'kanald': 'Kanal D', 'atv': 'ATV', 'trt': 'TRT',
        'star': 'Star TV', 'tv8': 'TV8', 'other': 'Diğer'
    };
    const VIDEOS_PER_PAGE = 6;

    class DiziTubeApp {
        constructor() {
            this.videos = [];
            this.filteredVideos = [];
            this.visibleVideoCount = VIDEOS_PER_PAGE;
            this.isSearching = false;
            this.init();
        }

        init() {
            this.loadVideosFromStorage();
            this.setupEventListeners();
            this.setTheme(localStorage.getItem('theme') || 'dark');
            this.setupInfiniteScroll();
        }

        setupEventListeners() {
            document.getElementById('menuBtn').addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));
            document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', e => this.setActiveFilter(e.currentTarget.dataset.filter));
            });
            document.getElementById('searchInput').addEventListener('input', e => this.searchVideos(e.target.value));
            document.getElementById('adminBtn').addEventListener('click', () => this.showModal('loginModal'));
            document.getElementById('statsBtn').addEventListener('click', () => this.showStatsModal());
            document.getElementById('ratingsLink').addEventListener('click', e => { e.preventDefault(); this.showModal('ratingsModal'); });
            document.querySelectorAll('.modal .close').forEach(btn => {
                btn.addEventListener('click', e => this.hideModal(e.target.closest('.modal').id));
            });
            
            document.getElementById('loginForm').addEventListener('submit', e => { e.preventDefault(); this.handleLogin(); });
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', e => this.switchTab(e.target.dataset.tab));
            });
            document.getElementById('addVideoForm').addEventListener('submit', e => { e.preventDefault(); this.handleFormSubmit(); });
            document.getElementById('videoUrl').addEventListener('input', e => this.autoFillThumbnail(e.target.value));
        }

        setupInfiniteScroll() {
            const loadingIndicator = document.getElementById('loadingIndicator');
            this.observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && this.visibleVideoCount < this.filteredVideos.length && !this.isSearching) {
                    this.loadMoreVideos();
                }
            }, { threshold: 0.1 });
            this.observer.observe(loadingIndicator);
        }

        loadVideosFromStorage() {
            this.videos = JSON.parse(localStorage.getItem('diziTubeVideos')) || this.getDemoVideos();
            this.sortVideos('date');
            this.renderAll();
        }

        saveVideosToStorage() {
            localStorage.setItem('diziTubeVideos', JSON.stringify(this.videos));
        }

        renderAll() {
            this.filteredVideos = [...this.videos];
            this.visibleVideoCount = VIDEOS_PER_PAGE;
            this.renderVideos();
        }

        renderVideos() {
            const grid = document.getElementById('videoGrid');
            const noResults = document.getElementById('noResults');
            const loadingIndicator = document.getElementById('loadingIndicator');
            
            if (this.filteredVideos.length === 0) {
                grid.innerHTML = '';
                noResults.style.display = 'block';
                loadingIndicator.style.display = 'none';
                return;
            }

            noResults.style.display = 'none';

            // Sadece görünen videoları render et
            const videosToRender = this.filteredVideos.slice(0, this.visibleVideoCount);
            grid.innerHTML = videosToRender.map(v => this.createVideoCard(v)).join('');
            
            // Daha fazla video varsa yükleme göstergesini göster
            if (this.visibleVideoCount < this.filteredVideos.length) {
                loadingIndicator.style.display = 'block';
            } else {
                loadingIndicator.style.display = 'none';
            }

            // Video kartlarına ve beğenme butonlarına tıklama event'i ekleme
            grid.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', e => {
                    const videoId = card.dataset.videoId;
                    const video = this.videos.find(v => v.id === videoId);
                    if (video && !e.target.closest('.like-btn')) {
                        e.preventDefault();
                        const youtubeId = video.url.split('v=')[1];
                        if (this.isMobileDevice() && youtubeId) {
                            window.location.href = `vnd.youtube://watch?v=${youtubeId}`;
                            setTimeout(() => {
                                window.location.href = video.url;
                            }, 500);
                        } else {
                            window.open(video.url, '_blank');
                        }
                    }
                });
            });

            grid.querySelectorAll('.like-btn').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const videoId = btn.closest('.video-card').dataset.videoId;
                    this.toggleLike(videoId);
                });
            });
        }
        
        loadMoreVideos() {
            this.visibleVideoCount += VIDEOS_PER_PAGE;
            this.renderVideos();
        }
        
        createVideoCard(video) {
            const views = this.formatNumber(video.views || 0);
            const likes = this.formatNumber(video.likes || 0);
            const timeAgo = this.getTimeAgo(new Date(video.publishedAt));

            return `
                <a href="${video.url}" target="_blank" class="video-card" data-video-id="${video.id}">
                    <div class="video-thumbnail">
                        <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                    </div>
                    <div class="video-details">
                        <div class="channel-avatar">
                            <i class="fas fa-tv"></i>
                        </div>
                        <div class="video-meta">
                            <h3>${video.title}</h3>
                            <p>${video.channelTitle}</p>
                            <p>${views} görüntüleme • ${timeAgo}</p>
                            <div class="video-stats-likes">
                                <button class="like-btn" title="Beğen"><i class="fas fa-thumbs-up"></i></button>
                                <span>${likes}</span>
                            </div>
                        </div>
                    </div>
                </a>
            `;
        }
        
        toggleLike(videoId) {
            const video = this.videos.find(v => v.id === videoId);
            if (video) {
                video.likes = (video.likes || 0) + 1;
                this.saveVideosToStorage();
                this.renderVideos();
            }
        }

        setActiveFilter(filter) {
            this.visibleVideoCount = VIDEOS_PER_PAGE;
            document.querySelectorAll('.nav-link.active').forEach(l => l.classList.remove('active'));
            document.querySelector(`.nav-link[data-filter="${filter}"]`).classList.add('active');
            
            if (filter === 'all') {
                this.filteredVideos = [...this.videos];
            } else {
                this.filteredVideos = this.videos.filter(v => v.platform === filter);
            }
            this.isSearching = false;
            this.renderVideos();
        }

        searchVideos(term) {
            this.isSearching = true;
            this.visibleVideoCount = VIDEOS_PER_PAGE;
            const lowerTerm = term.toLowerCase().trim();
            if (!lowerTerm) {
                this.isSearching = false;
                this.filteredVideos = [...this.videos];
            } else {
                this.filteredVideos = this.videos.filter(v =>
                    v.title.toLowerCase().includes(lowerTerm) ||
                    v.channelTitle.toLowerCase().includes(lowerTerm)
                );
            }
            this.renderVideos();
        }
        
        sortVideos(sortBy) {
            this.videos.sort((a, b) => {
                if (sortBy === 'date') return new Date(b.publishedAt) - new Date(a.publishedAt);
                return 0;
            });
        }
        
        showStatsModal() {
            const stats = this.calculateStats();
            const body = document.getElementById('statsBody');
            
            const mostViewed = stats.mostViewedVideo;
            const mostLiked = stats.mostLikedVideo;
            
            body.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-card-value">${stats.totalVideos}</div><div class="stat-card-label">Toplam Video</div></div>
                    <div class="stat-card"><div class="stat-card-value">${this.formatNumber(stats.totalViews)}</div><div class="stat-card-label">Toplam İzlenme</div></div>
                    <div class="stat-card"><div class="stat-card-value">${this.formatNumber(stats.totalLikes)}</div><div class="stat-card-label">Toplam Beğeni</div></div>
                    <div class="stat-card"><div class="stat-card-value">${this.formatNumber(stats.avgViews)}</div><div class="stat-card-label">Ort. İzlenme</div></div>
                </div>
                
                <h3 class="stats-section-title">En İyiler</h3>
                <div class="top-videos-list">
                    ${mostViewed ? this.createTopVideoHTML('En Çok İzlenen', mostViewed, 'görüntüleme', mostViewed.views) : ''}
                    ${mostLiked ? this.createTopVideoHTML('En Çok Beğenilen', mostLiked, 'beğeni', mostLiked.likes) : ''}
                </div>
                
                <h3 class="stats-section-title">Kanallara Göre Dağılım</h3>
                <div class="channel-stats-list">
                    ${Object.entries(stats.channelCounts).sort(([,a],[,b]) => b-a).map(([platform, count]) => `
                        <div class="channel-item">
                            <span>${PLATFORM_TAGS[platform] || 'Bilinmeyen'}</span>
                            <strong>${count} Video</strong>
                        </div>
                    `).join('')}
                </div>
            `;
            this.showModal('statsModal');
        }

        calculateStats() {
            const totalVideos = this.videos.length;
            if (totalVideos === 0) return { totalVideos: 0, totalViews: 0, totalLikes: 0, avgViews: 0, channelCounts: {}, mostViewedVideo: null, mostLikedVideo: null };

            let totalViews = 0, totalLikes = 0;
            let mostViewedVideo = this.videos[0], mostLikedVideo = this.videos[0];
            const channelCounts = {};

            for (const video of this.videos) {
                totalViews += video.views || 0;
                totalLikes += video.likes || 0;
                if ((video.views || 0) > (mostViewedVideo.views || 0)) mostViewedVideo = video;
                if ((video.likes || 0) > (mostLikedVideo.likes || 0)) mostLikedVideo = video;
                channelCounts[video.platform] = (channelCounts[video.platform] || 0) + 1;
            }

            return {
                totalVideos, totalViews, totalLikes,
                avgViews: Math.round(totalViews / totalVideos),
                channelCounts, mostViewedVideo, mostLikedVideo
            };
        }
        
        createTopVideoHTML(category, video, statName, statValue) {
            return `
                <div class="video-item">
                    <img src="${video.thumbnail}" alt="${video.title}">
                    <div>
                        <h4>${category}: ${video.title}</h4>
                        <p>${video.channelTitle}</p>
                        <p><strong>${this.formatNumber(statValue)} ${statName}</strong></p>
                    </div>
                </div>
            `;
        }

        handleLogin() {
            if (document.getElementById('username').value === 'gencer' && document.getElementById('password').value === '12345') {
                this.hideModal('loginModal'); this.showModal('adminModal'); this.renderAdminList();
            } else { alert('Hatalı kullanıcı adı veya şifre'); }
        }

        switchTab(tabName) {
            document.querySelector('.admin-tabs .active').classList.remove('active');
            document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
            document.querySelector('.tab-content.active').classList.remove('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
        }

        renderAdminList() {
            const list = document.getElementById('adminVideoList');
            list.innerHTML = this.videos.map(v => `
                <div class="admin-video-item" style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid var(--border-color);">
                    <span>${v.title}</span>
                    <div>
                        <button onclick="app.editVideo('${v.id}')">Düzenle</button>
                        <button onclick="app.deleteVideo('${v.id}')">Sil</button>
                    </div>
                </div>
            `).join('');
        }
        
        handleFormSubmit() {
            const form = document.getElementById('addVideoForm');
            const videoId = document.getElementById('videoIdToUpdate').value;
            if (videoId) this.updateVideo(videoId, new FormData(form));
            else this.addVideo(new FormData(form));
            form.reset();
        }

        addVideo(formData) {
            let videoId = 'manual_' + Date.now();
            const url = formData.get('url');
            const idMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
            if (idMatch) videoId = idMatch[1];
            
            const newVideo = this.formDataToObject(formData, videoId);
            newVideo.publishedAt = new Date().toISOString();
            
            this.videos.unshift(newVideo);
            this.saveVideosToStorage();
            this.renderAll();
            this.renderAdminList();
            this.switchTab('list');
        }

        editVideo(videoId) {
            const video = this.videos.find(v => v.id === videoId);
            if (!video) return;
            this.switchTab('add');
            document.getElementById('videoIdToUpdate').value = video.id;
            for (const key in video) {
                const input = document.getElementById(`video${key.charAt(0).toUpperCase() + key.slice(1)}`);
                if (input) input.value = video[key];
            }
        }
        
        updateVideo(videoId, formData) {
            const index = this.videos.findIndex(v => v.id === videoId);
            if (index === -1) return;
            const updatedVideo = this.formDataToObject(formData, videoId);
            this.videos[index] = { ...this.videos[index], ...updatedVideo };
            this.saveVideosToStorage();
            this.renderAll();
            this.renderAdminList();
            this.switchTab('list');
        }

        deleteVideo(videoId) {
            if (confirm('Bu videoyu silmek istediğinizden emin misiniz?')) {
                this.videos = this.videos.filter(v => v.id !== videoId);
                this.saveVideosToStorage();
                this.renderAll();
                this.renderAdminList();
            }
        }

        showModal(modalId) { document.getElementById(modalId).style.display = 'block'; }
        hideModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
        
        formDataToObject(formData, id) {
            return {
                id: id,
                title: formData.get('title'),
                url: formData.get('url'),
                thumbnail: formData.get('thumbnail'),
                channelTitle: formData.get('channel'),
                platform: formData.get('platform'),
                views: parseInt(formData.get('views')) || 0,
                likes: parseInt(formData.get('likes')) || 0,
            };
        }

        autoFillThumbnail(url) {
            const idMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
            if (idMatch) {
                document.getElementById('videoThumbnail').value = `https://i3.ytimg.com/vi/${idMatch[1]}/maxresdefault.jpg`;
            }
        }
        
        toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
        }

        setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            document.querySelector('#themeToggle i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(0) + ' B';
            return num;
        }
        
        isMobileDevice() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        getTimeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " yıl önce";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " ay önce";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " gün önce";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " saat önce";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " dakika önce";
            return "az önce";
        }
        
        getDemoVideos() {
            const now = new Date();
            const videos = [];
            for(let i=1; i<=20; i++) {
                videos.push({
                    id: `demo_${i}`,
                    title: `Örnek Video ${i}`,
                    url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
                    thumbnail: `https://picsum.photos/480/270?random=${i}`,
                    channelTitle: `Demo Kanal ${i % 3 + 1}`,
                    platform: ['kanald', 'atv', 'trt', 'star'][i % 4],
                    views: Math.floor(Math.random() * 1000000),
                    likes: Math.floor(Math.random() * 50000),
                    publishedAt: new Date(now.setDate(now.getDate() - i)).toISOString()
                });
            }
            return videos;
        }
    }

    window.app = new DiziTubeApp();
});