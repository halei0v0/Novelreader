// 小说数据
let novelsData = null;
let allNovelsMeta = null; // 存储所有小说元数据用于搜索
let currentNovel = null;
let currentChapterIndex = 0;

// 阅读设置
let readerSettings = {
    theme: 'light',
    fontSize: 16,
    lineHeight: 1.8
};

// LocalStorage 键名
const STORAGE_KEYS = {
    NOVELS: 'novelreader_novels',
    PROGRESS: 'novelreader_progress',
    SETTINGS: 'novelreader_settings'
};

// 加载小说列表
async function loadNovelsMeta() {
    try {
        const response = await fetch('novels.json');
        const meta = await response.json();
        return meta;
    } catch (error) {
        console.error('加载小说列表失败:', error);
        return null;
    }
}

// 加载小说完整数据
async function loadNovelData(novelId) {
    try {
        const response = await fetch(`data/${novelId}.json`);
        const novelData = await response.json();
        return novelData;
    } catch (error) {
        console.error('加载小说数据失败:', error);
        return null;
    }
}

// 加载小说列表页面
async function loadNovelList() {
    const novelsMeta = await loadNovelsMeta();
    if (!novelsMeta) {
        document.getElementById('novel-list').innerHTML = '<p class="text-center text-muted">加载失败，请刷新重试</p>';
        return;
    }

    // 保存所有小说数据用于搜索
    allNovelsMeta = novelsMeta;
    
    // 渲染小说列表
    renderNovelList(novelsMeta);
}

// 渲染小说列表（用于显示搜索结果）
function renderNovelList(novelsMeta) {
    const container = document.getElementById('novel-list');
    
    if (novelsMeta.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">没有找到匹配的小说</p></div>';
        return;
    }
    
    container.innerHTML = novelsMeta.map((novel) => {
        const progress = getReadingProgress(novel.title);
        const progressPercent = progress ? Math.round((progress.chapterIndex / novel.chapters_count) * 100) : 0;
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="novel-card" onclick="openNovel('${novel.id}')">
                    <div class="novel-cover">📖</div>
                    <div class="novel-info">
                        <h3 class="novel-title">${escapeHtml(novel.title)}</h3>
                        <p class="novel-author">作者：${escapeHtml(novel.author)}</p>
                        <p class="novel-description">${escapeHtml(novel.description)}</p>
                        <div class="novel-meta">
                            ${progressPercent > 0 ? `<span class="badge bg-success">已读 ${progressPercent}%</span>` : ''}
                            <button class="read-btn">开始阅读</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 搜索小说
function filterNovels() {
    if (!allNovelsMeta) return;
    
    const searchTerm = document.getElementById('search-input').value.trim().toLowerCase();
    const searchInfo = document.getElementById('search-info');
    
    if (!searchTerm) {
        // 如果搜索框为空，显示所有小说
        renderNovelList(allNovelsMeta);
        searchInfo.textContent = '';
        searchInfo.className = 'search-info';
        return;
    }
    
    // 搜索匹配：书名、作者、描述
    const filteredNovels = allNovelsMeta.filter(novel => {
        const titleMatch = novel.title.toLowerCase().includes(searchTerm);
        const authorMatch = novel.author.toLowerCase().includes(searchTerm);
        const descMatch = novel.description.toLowerCase().includes(searchTerm);
        return titleMatch || authorMatch || descMatch;
    });
    
    // 显示搜索结果
    renderNovelList(filteredNovels);
    
    // 更新搜索信息
    searchInfo.textContent = `找到 ${filteredNovels.length} 本小说`;
    searchInfo.className = 'search-info active';
}

// 清除搜索
function clearSearch() {
    const searchInput = document.getElementById('search-input');
    const searchInfo = document.getElementById('search-info');
    const searchIcon = document.getElementById('search-icon');
    
    searchInput.value = '';
    searchInfo.textContent = '';
    searchInfo.className = 'search-info';
    searchIcon.textContent = '🔍';
    
    // 重新显示所有小说
    if (allNovelsMeta) {
        renderNovelList(allNovelsMeta);
    }
    
    searchInput.focus();
}

// 监听搜索框的 Enter 键
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterNovels();
            }
        });
    }
});

// 打开小说
async function openNovel(novelId) {
    // 加载小说完整数据
    const novelData = await loadNovelData(novelId);
    if (!novelData) {
        alert('加载小说失败');
        return;
    }
    
    currentNovel = novelData;
    const progress = getReadingProgress(currentNovel.title);
    currentChapterIndex = progress ? progress.chapterIndex : 0;
    
    // 保存当前小说信息到 sessionStorage
    sessionStorage.setItem('currentNovel', JSON.stringify({
        id: novelId,
        chapterIndex: currentChapterIndex
    }));
    
    // 跳转到阅读器页面
    window.location.href = 'reader.html';
}

// 初始化阅读器
async function initReader() {
    // 获取当前小说信息
    const savedInfo = sessionStorage.getItem('currentNovel');
    if (!savedInfo) {
        window.location.href = 'index.html';
        return;
    }

    const info = JSON.parse(savedInfo);
    
    // 加载小说完整数据
    const novelData = await loadNovelData(info.id);
    if (!novelData) {
        alert('加载小说失败');
        window.location.href = 'index.html';
        return;
    }
    
    currentNovel = novelData;
    currentChapterIndex = info.chapterIndex;

    // 加载阅读设置
    loadSettings();

    // 应用设置
    applySettings();

    // 加载当前章节
    loadChapter(currentChapterIndex);

    // 加载目录
    loadTOC();

    // 自动保存进度
    setupAutoSave();

    // 滚动事件处理
    setupScrollHandler();
}

// 加载章节
function loadChapter(index) {
    if (index < 0 || index >= currentNovel.chapters.length) {
        return;
    }

    currentChapterIndex = index;
    const chapter = currentNovel.chapters[index];

    // 更新标题
    document.getElementById('novel-title').textContent = currentNovel.title;
    document.getElementById('chapter-title').textContent = chapter.title;
    document.getElementById('chapter-progress').textContent = `第 ${index + 1} 章 / 共 ${currentNovel.chapters.length} 章`;

    // 更新内容
    const contentDiv = document.getElementById('reader-content');
    
    // 将章节内容按段落分割
    const paragraphs = chapter.content.split('\n').filter(p => p.trim());
    const htmlContent = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
    
    contentDiv.innerHTML = htmlContent;

    // 滚动到顶部
    window.scrollTo(0, 0);

    // 更新目录高亮
    updateTOCHighlight();

    // 保存进度
    saveReadingProgress();
}

// 上一章
function prevChapter() {
    if (currentChapterIndex > 0) {
        loadChapter(currentChapterIndex - 1);
    } else {
        showToast('已经是第一章了');
    }
}

// 下一章
function nextChapter() {
    if (currentChapterIndex < currentNovel.chapters.length - 1) {
        loadChapter(currentChapterIndex + 1);
    } else {
        showToast('已经是最后一章了');
    }
}

// 加载目录
function loadTOC() {
    const tocList = document.getElementById('toc-list');
    tocList.innerHTML = currentNovel.chapters.map((chapter, index) => `
        <div class="toc-item" data-index="${index}" onclick="jumpToChapter(${index})">
            ${escapeHtml(chapter.title)}
        </div>
    `).join('');
}

// 过滤章节
function filterChapters() {
    const searchInput = document.getElementById('toc-search').value.toLowerCase();
    const items = document.querySelectorAll('.toc-item');
    
    items.forEach(item => {
        const title = item.textContent.toLowerCase();
        if (title.includes(searchInput)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// 跳转到章节
function jumpToChapter(index) {
    loadChapter(index);
    toggleTOC();
}

// 更新目录高亮
function updateTOCHighlight() {
    const items = document.querySelectorAll('.toc-item');
    items.forEach((item, index) => {
        if (index === currentChapterIndex) {
            item.classList.add('current');
        } else {
            item.classList.remove('current');
        }
    });
}

// 切换目录显示
function toggleTOC() {
    const tocModal = document.getElementById('toc-modal');
    tocModal.classList.toggle('active');
}

// 切换设置面板
function toggleSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.toggle('active');
}

// 设置主题
function setTheme(theme) {
    readerSettings.theme = theme;
    applySettings();
    saveSettings();
}

// 设置字体大小
function setFontSize(size) {
    readerSettings.fontSize = size;
    applySettings();
    saveSettings();
}

// 设置行间距
function setLineHeight(height) {
    readerSettings.lineHeight = height;
    applySettings();
    saveSettings();
}

// 应用设置
function applySettings() {
    const readerContainer = document.getElementById('reader-container');
    const readerContent = document.getElementById('reader-content');
    
    // 主题
    readerContainer.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    readerContainer.classList.add(`theme-${readerSettings.theme}`);
    
    // 字体大小
    if (readerContent) {
        readerContent.style.fontSize = `${readerSettings.fontSize}px`;
    }
    
    // 行间距
    if (readerContent) {
        readerContent.style.lineHeight = readerSettings.lineHeight;
    }
    
    // 更新按钮状态
    updateSettingsButtons();
}

// 更新设置按钮状态
function updateSettingsButtons() {
    // 主题按钮
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === readerSettings.theme);
    });
    
    // 字体大小按钮
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        const size = parseInt(btn.textContent);
        btn.classList.toggle('active', size === readerSettings.fontSize);
    });
    
    // 行间距按钮
    document.querySelectorAll('.line-height-btn').forEach(btn => {
        btn.classList.toggle('active', 
            btn.textContent === '紧凑' && readerSettings.lineHeight === 1.5 ||
            btn.textContent === '适中' && readerSettings.lineHeight === 1.8 ||
            btn.textContent === '宽松' && readerSettings.lineHeight === 2.0
        );
    });
}

// 保存设置
function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(readerSettings));
}

// 加载设置
function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
        readerSettings = { ...readerSettings, ...JSON.parse(saved) };
    }
}

// 保存阅读进度
function saveReadingProgress() {
    const progress = {
        chapterIndex: currentChapterIndex,
        timestamp: Date.now()
    };
    
    const allProgress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
    allProgress[currentNovel.title] = progress;
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
    
    // 更新 sessionStorage
    const savedInfo = sessionStorage.getItem('currentNovel');
    if (savedInfo) {
        const info = JSON.parse(savedInfo);
        info.chapterIndex = currentChapterIndex;
        sessionStorage.setItem('currentNovel', JSON.stringify(info));
    }
}

// 获取阅读进度
function getReadingProgress(novelTitle) {
    const allProgress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
    return allProgress[novelTitle] || null;
}

// 自动保存进度
function setupAutoSave() {
    // 每次章节切换时保存
    // 已经在 loadChapter 中实现
    
    // 页面卸载时保存
    window.addEventListener('beforeunload', () => {
        saveReadingProgress();
    });
}

// 滚动处理
function setupScrollHandler() {
    const header = document.getElementById('reader-header');
    const footer = document.getElementById('reader-footer');
    let lastScrollY = window.scrollY;
    let scrollTimeout;

    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        
        const currentScrollY = window.scrollY;
        const isScrollingDown = currentScrollY > lastScrollY;
        
        // 页面顶部和底部时始终显示
        const isNearTop = currentScrollY < 100;
        const isNearBottom = currentScrollY + window.innerHeight >= document.body.scrollHeight - 100;
        
        if (isNearTop || isNearBottom) {
            header.classList.remove('hidden');
            footer.classList.remove('hidden');
        } else if (isScrollingDown) {
            header.classList.add('hidden');
            footer.classList.remove('hidden');
        } else {
            header.classList.remove('hidden');
            footer.classList.add('hidden');
        }
        
        lastScrollY = currentScrollY;
        
        // 防抖处理
        scrollTimeout = setTimeout(() => {
            if (isNearBottom && currentChapterIndex < currentNovel.chapters.length - 1) {
                // 自动进入下一章（可选功能，可根据需要开启）
                // nextChapter();
            }
        }, 300);
    });
}

// 返回首页
function goBack() {
    window.location.href = 'index.html';
}

// Toast 提示
function showToast(message) {
    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 24px;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    
    // 2秒后移除
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
            document.head.removeChild(style);
        }, 300);
    }, 2000);
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    // 只在阅读器页面响应
    if (!document.getElementById('reader-content')) return;
    
    // 检查是否在输入框中
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
        case 'ArrowLeft':
            prevChapter();
            break;
        case 'ArrowRight':
            nextChapter();
            break;
        case 'Escape':
            const settingsPanel = document.getElementById('settings-panel');
            const tocModal = document.getElementById('toc-modal');
            if (settingsPanel.classList.contains('active')) {
                toggleSettings();
            }
            if (tocModal.classList.contains('active')) {
                toggleTOC();
            }
            break;
    }
});