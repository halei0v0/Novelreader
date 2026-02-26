// 小说数据
let novelsData = null;
let allNovelsMeta = null; // 存储所有小说元数据用于搜索
let currentNovel = null;
let currentChapterIndex = 0;

// 章节块缓存（用于按需加载）- 使用 LRU 缓存策略
let chapterCache = {};  // { novelId: { chunkIndex: chaptersData } }
let chunkSize = 100;  // 每个块的章节数
const MAX_CACHE_SIZE = 5;  // 最大缓存 chunk 数量（防止内存泄漏）
let cacheAccessOrder = [];  // 缓存访问顺序 [novelId_chunkIndex, ...]
let isLoadingChapter = false;  // 加载状态，防止并发请求

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
    SETTINGS: 'novelreader_settings',
    BOOKMARKS: 'novelreader_bookmarks'
};

// 显示加载进度条
function showProgressBar() {
    const progressBar = document.getElementById('chapter-progress-bar');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.opacity = '1';
    }
}

// 更新加载进度
function updateProgressBar(percent) {
    const progressBar = document.getElementById('chapter-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
}

// 隐藏加载进度条
function hideProgressBar() {
    const progressBar = document.getElementById('chapter-progress-bar');
    if (progressBar) {
        progressBar.style.opacity = '0';
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 300);
    }
}

// 加载小说列表（带重试机制）
async function loadNovelsMeta(retryCount = 3) {
    for (let i = 0; i < retryCount; i++) {
        try {
            const response = await fetch('novels.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const meta = await response.json();
            return meta;
        } catch (error) {
            console.error(`加载小说列表失败 (尝试 ${i + 1}/${retryCount}):`, error);

            if (i === retryCount - 1) {
                // 最后一次尝试失败，显示错误提示
                showToast('加载失败，请检查网络连接后刷新重试');
                return null;
            }

            // 等待 1 秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return null;
}

// 加载小说元数据（不含章节内容）
async function loadNovelMeta(novelId) {
    try {
        const response = await fetch(`data/${novelId}/meta.json`);
        const meta = await response.json();
        return meta;
    } catch (error) {
        console.error('加载小说元数据失败:', error);
        return null;
    }
}

// 加载章节内容块（按需加载）- 实现 LRU 缓存策略
async function loadChapterChunk(novelId, chunkIndex) {
    const cacheKey = `${novelId}_${chunkIndex}`;

    // 检查缓存
    if (!chapterCache[novelId]) {
        chapterCache[novelId] = {};
    }

    if (chapterCache[novelId][chunkIndex]) {
        // 更新访问顺序（LRU）
        const accessIndex = cacheAccessOrder.indexOf(cacheKey);
        if (accessIndex !== -1) {
            cacheAccessOrder.splice(accessIndex, 1);
        }
        cacheAccessOrder.push(cacheKey);
        return chapterCache[novelId][chunkIndex];
    }

    try {
        const response = await fetch(`data/${novelId}/chunk_${chunkIndex}.json`);
        const chunkData = await response.json();

        // 缓存数据
        chapterCache[novelId][chunkIndex] = chunkData.chapters;
        cacheAccessOrder.push(cacheKey);

        // 如果缓存超过限制，删除最久未使用的 chunk
        while (cacheAccessOrder.length > MAX_CACHE_SIZE) {
            const oldestKey = cacheAccessOrder.shift();
            const [oldNovelId, oldChunkIndex] = oldestKey.split('_');
            if (chapterCache[oldNovelId] && chapterCache[oldNovelId][oldChunkIndex]) {
                delete chapterCache[oldNovelId][oldChunkIndex];
                // 如果该小说的所有 chunk 都被清空，删除小说对象
                if (Object.keys(chapterCache[oldNovelId]).length === 0) {
                    delete chapterCache[oldNovelId];
                }
            }
        }

        return chunkData.chapters;
    } catch (error) {
        console.error('加载章节块失败:', error);
        return null;
    }
}

// 加载单个章节内容
async function loadChapterContent(novelId, chapterIndex) {
    const chunkIndex = Math.floor(chapterIndex / chunkSize);
    const chapters = await loadChapterChunk(novelId, chunkIndex);
    
    if (!chapters) {
        return null;
    }
    
    const localIndex = chapterIndex % chunkSize;
    return chapters[localIndex];
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
    
    // 加载阅读历史
    loadReadingHistory();
}

// 渲染小说列表（用于显示搜索结果）
function renderNovelList(novelsMeta) {
    const container = document.getElementById('novel-list');
    const countElement = document.getElementById('novel-count');

    // 更新小说计数
    countElement.textContent = `共收录 ${novelsMeta.length} 本小说`;

    if (novelsMeta.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">没有找到匹配的小说</p></div>';
        return;
    }

    container.innerHTML = novelsMeta.map((novel) => {
        const progress = getReadingProgress(novel.title);
        const progressPercent = progress ? Math.round((progress.chapterIndex / novel.chapters_count) * 100) : 0;
        const isFav = isFavorite(novel.id);

        return `
            <div class="col-md-6 col-lg-4">
                <div class="novel-card" onclick="openNovel('${novel.id}')">
                    <button class="novel-favorite-btn ${isFav ? 'active' : ''}"
                            onclick="event.stopPropagation(); toggleFavorite('${novel.id}')"
                            title="${isFav ? '取消收藏' : '添加收藏'}">
                        <svg class="heart-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                    </button>
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

// 搜索小说（带防抖）
let searchDebounceTimer = null;
function filterNovels() {
    if (!allNovelsMeta) return;

    // 清除之前的定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    // 设置新的防抖定时器（300ms）
    searchDebounceTimer = setTimeout(() => {
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
    }, 300); // 防抖延迟 300ms
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

// 显示加载提示
function showLoading(text = '正在打开小说...') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.querySelector('.loading-text');
    if (loadingOverlay && loadingText) {
        loadingText.textContent = text;
        loadingOverlay.style.display = 'flex';
    }
}

// 隐藏加载提示
function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// 打开小说
async function openNovel(novelId) {
    // 显示加载提示
    showLoading('正在加载小说信息...');

    // 加载小说元数据
    const novelMeta = await loadNovelMeta(novelId);
    if (!novelMeta) {
        hideLoading();
        alert('加载小说失败');
        return;
    }

    currentNovel = novelMeta;
    const progress = getReadingProgress(currentNovel.title);
    currentChapterIndex = progress ? progress.chapterIndex : 0;

    // 保存当前小说信息到 sessionStorage
    sessionStorage.setItem('currentNovel', JSON.stringify({
        id: novelId,
        chapterIndex: currentChapterIndex
    }));

    // 更新加载提示
    showLoading('正在跳转...');

    // 跳转到阅读器页面
    setTimeout(() => {
        window.location.href = 'reader.html';
    }, 200);
}

// 初始化阅读器
async function initReader() {
    // 显示加载提示
    showLoading('正在加载小说信息...');

    // 获取当前小说信息
    const savedInfo = sessionStorage.getItem('currentNovel');
    if (!savedInfo) {
        hideLoading();
        window.location.href = 'index.html';
        return;
    }

    const info = JSON.parse(savedInfo);

    // 加载小说元数据
    const novelMeta = await loadNovelMeta(info.id);
    if (!novelMeta) {
        hideLoading();
        alert('加载小说失败');
        window.location.href = 'index.html';
        return;
    }

    currentNovel = novelMeta;
    currentChapterIndex = info.chapterIndex;

    // 动态加载 giscus 脚本
    loadGiscus();

    // 加载阅读设置
    loadSettings();

    // 应用设置
    applySettings();

    // 预加载当前章节块
    showLoading('正在加载章节...');
    const chunkIndex = Math.floor(currentChapterIndex / chunkSize);
    await loadChapterChunk(info.id, chunkIndex);

    // 加载当前章节
    await loadChapter(currentChapterIndex);

    // 加载目录
    loadTOC();

    // 自动保存进度
    setupAutoSave();

    // 滚动和触摸事件处理
    setupScrollHandler();

    // 移动端头尾栏默认隐藏
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
        const header = document.getElementById('reader-header');
        const footer = document.getElementById('reader-footer');
        header.classList.add('hidden');
        footer.classList.add('hidden');
    }

    // 隐藏加载提示
    hideLoading();
}

// 加载章节
async function loadChapter(index) {
    // 检查章节索引是否有效
    if (index < 0 || index >= currentNovel.chapters_count) {
        return;
    }

    // 检查是否正在加载，防止并发请求
    if (isLoadingChapter) {
        console.log('正在加载中，请稍候...');
        return;
    }

    isLoadingChapter = true;
    currentChapterIndex = index;

    try {
        // 显示加载进度条
        showProgressBar();
        updateProgressBar(30);

        // 获取章节标题（从元数据中）
        const chapterTitleInfo = currentNovel.chapter_titles[index];
        const chapterTitle = chapterTitleInfo ? chapterTitleInfo.title : `第 ${index + 1} 章`;

        updateProgressBar(50);

        // 如果章节没有内容（卷标题），查找下一个有内容的章节
        if (chapterTitleInfo && !chapterTitleInfo.has_content) {
            let nextIndex = index + 1;
            while (nextIndex < currentNovel.chapters_count) {
                if (currentNovel.chapter_titles[nextIndex] && currentNovel.chapter_titles[nextIndex].has_content) {
                    // 递归调用前先释放锁
                    isLoadingChapter = false;
                    await loadChapter(nextIndex);
                    return;
                }
                nextIndex++;
            }
            hideProgressBar();
            showToast('已经是最后一章了');
            return;
        }

        // 按需加载章节内容
        const chapter = await loadChapterContent(getCurrentNovelId(), index);
        if (!chapter) {
            console.error('加载章节失败:', index);
            hideProgressBar();
            return;
        }

        updateProgressBar(70);

        // 查找所属的卷标题（向前查找第一个没有内容的章节）
        let volumeTitle = '';
        for (let i = index - 1; i >= 0; i--) {
            if (!currentNovel.chapter_titles[i].has_content || currentNovel.chapter_titles[i].title.includes('卷')) {
                volumeTitle = currentNovel.chapter_titles[i].title;
                break;
            }
        }

        // 计算实际章节编号（排除卷标题）
        let actualChapterNum = 0;
        let totalContentChapters = 0;
        for (let i = 0; i < currentNovel.chapter_titles.length; i++) {
            if (currentNovel.chapter_titles[i].has_content) {
                totalContentChapters++;
                if (i <= index) {
                    actualChapterNum++;
                }
            }
        }

        // 更新顶部标题显示卷标题
        document.getElementById('novel-title').textContent = currentNovel.title;
        document.getElementById('chapter-title').textContent = volumeTitle || chapterTitle;
        document.getElementById('chapter-progress').textContent = `第 ${actualChapterNum} 章 / 共 ${totalContentChapters} 章`;

        // 更新内容
        const contentDiv = document.getElementById('reader-content');

        // 构建内容HTML，在正文前显示章节标题
        let htmlContent = '';

        // 如果有卷标题，在正文前显示章节标题
        if (volumeTitle) {
            htmlContent += `<div class="chapter-title-in-content">${escapeHtml(chapterTitle)}</div>`;
        }

        // 添加章节正文
        const paragraphs = chapter.content.split('\n').filter(p => p.trim());
        htmlContent += paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');

        contentDiv.innerHTML = htmlContent;

        // 滚动到顶部
        window.scrollTo(0, 0);

        // 更新目录高亮
        updateTOCHighlight();

        // 保存进度
        saveReadingProgress();

        // 更新书签按钮状态
        updateBookmarkButton();

        // 更新 giscus 评论主题
        updateGiscusTerm();

        // 更新 URL，确保 giscus 能识别不同章节
        const novelId = getCurrentNovelId();
        const newUrl = `reader.html?novel=${novelId}&chapter=${index}`;
        window.history.replaceState({ chapter: index }, '', newUrl);

        // 停止旧的计时器并启动新的计时器
        stopReadingTimer();
        startReadingTimer();

        // 记录阅读进度（章节数）
        recordReadingProgress(1);

        // 隐藏加载进度条
        updateProgressBar(100);
        setTimeout(hideProgressBar, 300);
    } catch (error) {
        console.error('加载章节失败:', error);
        hideProgressBar();
        showToast('加载章节失败，请重试');
    } finally {
        isLoadingChapter = false;
    }
}

// 动态加载 giscus 脚本
function loadGiscus() {
    const novelId = getCurrentNovelId();
    const chapterIndex = currentChapterIndex;

    // 使用 "小说ID_章节索引" 格式作为 term
    const term = `${novelId}_chapter_${chapterIndex}`;

    console.log('加载 giscus，term:', term, 'novelId:', novelId, 'chapterIndex:', chapterIndex);

    const giscusContainer = document.getElementById('giscus-container');
    if (!giscusContainer) {
        console.error('giscus-container 元素未找到');
        return;
    }

    // 创建 giscus 脚本元素
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', 'halei0v0/Novelreader');
    script.setAttribute('data-repo-id', 'R_kgDORMt8LA');
    script.setAttribute('data-category', 'Show and tell');
    script.setAttribute('data-category-id', 'DIC_kwDORMt8LM4C3GS-');
    script.setAttribute('data-mapping', 'specific');
    script.setAttribute('data-term', term);
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-theme', 'preferred_color_scheme');
    script.setAttribute('data-lang', 'zh-CN');
    script.setAttribute('data-loading', 'eager');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;

    // 插入脚本
    giscusContainer.innerHTML = '';
    giscusContainer.appendChild(script);
}

// 更新 giscus 评论主题
function updateGiscusTerm() {
    console.log('重新加载 giscus 脚本');
    loadGiscus();
}

// 上一章
async function prevChapter() {
    if (currentChapterIndex > 0) {
        let prevIndex = currentChapterIndex - 1;
        // 向前查找第一个有内容的章节
        while (prevIndex >= 0) {
            if (currentNovel.chapter_titles[prevIndex] && currentNovel.chapter_titles[prevIndex].has_content) {
                await loadChapter(prevIndex);
                return;
            }
            prevIndex--;
        }
        showToast('已经是第一章了');
    } else {
        showToast('已经是第一章了');
    }
}

// 下一章
async function nextChapter() {
    if (currentChapterIndex < currentNovel.chapters_count - 1) {
        let nextIndex = currentChapterIndex + 1;
        // 向后查找第一个有内容的章节
        while (nextIndex < currentNovel.chapters_count) {
            if (currentNovel.chapter_titles[nextIndex] && currentNovel.chapter_titles[nextIndex].has_content) {
                await loadChapter(nextIndex);
                return;
            }
            nextIndex++;
        }
        showToast('已经是最后一章了');
    } else {
        showToast('已经是最后一章了');
    }
}

// 加载目录
function loadTOC() {
    const tocList = document.getElementById('toc-list');
    
    // 只渲染前100章（虚拟滚动的基础）
    const renderCount = Math.min(currentNovel.chapters_count, 100);
    
    tocList.innerHTML = currentNovel.chapter_titles.slice(0, renderCount).map((chapterInfo, index) => {
        // 检测是否为卷标题
        const isVolume = !chapterInfo.has_content || chapterInfo.title.includes('卷');
        const className = isVolume ? 'toc-item toc-volume' : 'toc-item';
        
        return `
            <div class="${className}" data-index="${index}" onclick="jumpToChapter(${index})">
                ${escapeHtml(chapterInfo.title)}
            </div>
        `;
    }).join('');
    
    // 如果还有更多章节，添加一个"加载更多"按钮
    if (currentNovel.chapters_count > renderCount) {
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.className = 'toc-load-more';
        loadMoreBtn.textContent = `加载更多...（剩余 ${currentNovel.chapters_count - renderCount} 章）`;
        loadMoreBtn.onclick = loadMoreTOC;
        tocList.appendChild(loadMoreBtn);
    }
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

// 加载更多目录项
let renderedTOCCount = 100;
function loadMoreTOC() {
    const tocList = document.getElementById('toc-list');
    const loadMoreBtn = tocList.querySelector('.toc-load-more');
    
    // 移除"加载更多"按钮
    if (loadMoreBtn) {
        loadMoreBtn.remove();
    }
    
    // 渲染更多章节
    const newCount = Math.min(renderedTOCCount + 100, currentNovel.chapters_count);
    
    for (let i = renderedTOCCount; i < newCount; i++) {
        const chapterInfo = currentNovel.chapter_titles[i];
        const isVolume = !chapterInfo.has_content || chapterInfo.title.includes('卷');
        const className = isVolume ? 'toc-item toc-volume' : 'toc-item';
        
        const item = document.createElement('div');
        item.className = className;
        item.dataset.index = i;
        item.textContent = chapterInfo.title;
        item.onclick = () => jumpToChapter(i);
        
        tocList.appendChild(item);
    }
    
    renderedTOCCount = newCount;
    
    // 如果还有更多章节，重新添加"加载更多"按钮
    if (renderedTOCCount < currentNovel.chapters_count) {
        const newLoadMoreBtn = document.createElement('div');
        newLoadMoreBtn.className = 'toc-load-more';
        newLoadMoreBtn.textContent = `加载更多...（剩余 ${currentNovel.chapters_count - renderedTOCCount} 章）`;
        newLoadMoreBtn.onclick = loadMoreTOC;
        tocList.appendChild(newLoadMoreBtn);
    }
}

// 获取当前小说ID
function getCurrentNovelId() {
    const savedInfo = sessionStorage.getItem('currentNovel');
    if (savedInfo) {
        return JSON.parse(savedInfo).id;
    }
    return null;
}

// 跳转到章节
async function jumpToChapter(index) {
    await loadChapter(index);
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
    
    // 移动端：打开目录时显示头尾栏
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && tocModal.classList.contains('active')) {
        const header = document.getElementById('reader-header');
        const footer = document.getElementById('reader-footer');
        header.classList.remove('hidden');
        footer.classList.remove('hidden');
    }
}

// 切换设置面板
function toggleSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.toggle('active');
    
    // 移动端：打开设置时显示头尾栏
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && settingsPanel.classList.contains('active')) {
        const header = document.getElementById('reader-header');
        const footer = document.getElementById('reader-footer');
        header.classList.remove('hidden');
        footer.classList.remove('hidden');
    }
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

    // 清理旧数据，只保留最近 100 条记录（防止 localStorage 容量超限）
    const progressEntries = Object.entries(allProgress);
    if (progressEntries.length > 100) {
        // 按时间戳排序，保留最新的 100 条
        progressEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        const cleanedProgress = {};
        progressEntries.slice(0, 100).forEach(([title, data]) => {
            cleanedProgress[title] = data;
        });
        localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(cleanedProgress));
    } else {
        localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
    }

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

// 加载阅读历史
function loadReadingHistory() {
    const allProgress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
    const historyContainer = document.getElementById('reading-history');
    const historyList = document.getElementById('history-list');
    
    // 转换为数组并按时间戳降序排序
    const historyArray = Object.entries(allProgress)
        .map(([title, data]) => ({ title, ...data }))
        .sort((a, b) => b.timestamp - a.timestamp);
    
    if (historyArray.length === 0) {
        historyContainer.style.display = 'none';
        return;
    }
    
    // 只显示最近5条记录
    const recentHistory = historyArray.slice(0, 5);
    
    // 找到每个小说的元数据
    const historyItems = recentHistory.map(historyItem => {
        const novelMeta = allNovelsMeta.find(n => n.title === historyItem.title);
        if (!novelMeta) return null;
        
        const progressPercent = Math.round((historyItem.chapterIndex / novelMeta.chapters_count) * 100);
        const timeStr = formatTime(historyItem.timestamp);
        
        return {
            id: novelMeta.id,
            title: historyItem.title,
            author: novelMeta.author,
            chapterIndex: historyItem.chapterIndex,
            progressPercent: progressPercent,
            timeStr: timeStr
        };
    }).filter(item => item !== null);
    
    if (historyItems.length === 0) {
        historyContainer.style.display = 'none';
        return;
    }
    
    // 渲染历史记录
    historyList.innerHTML = historyItems.map(item => `
        <div class="history-item" onclick="jumpToHistoryNovel('${item.id}', ${item.chapterIndex})">
            <div class="history-item-info">
                <h4 class="history-item-title">${escapeHtml(item.title)}</h4>
                <p class="history-item-author">作者：${escapeHtml(item.author)}</p>
            </div>
            <div class="history-item-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${item.progressPercent}%"></div>
                </div>
                <span class="progress-text">已读 ${item.progressPercent}% · ${item.timeStr}</span>
            </div>
        </div>
    `).join('');
    
    historyContainer.style.display = 'block';
}

// 清空阅读历史
function clearHistory() {
    if (confirm('确定要清空所有阅读历史吗？')) {
        localStorage.removeItem(STORAGE_KEYS.PROGRESS);
        loadReadingHistory();
        showToast('阅读历史已清空');
    }
}

// 跳转到历史记录中的小说
async function jumpToHistoryNovel(novelId, chapterIndex) {
    // 显示加载提示
    showLoading('正在加载小说信息...');

    // 加载小说元数据
    const novelMeta = await loadNovelMeta(novelId);
    if (!novelMeta) {
        hideLoading();
        alert('加载小说失败');
        return;
    }
    
    currentNovel = novelMeta;
    currentChapterIndex = chapterIndex;
    
    // 保存当前小说信息到 sessionStorage
    sessionStorage.setItem('currentNovel', JSON.stringify({
        id: novelId,
        chapterIndex: currentChapterIndex
    }));
    
    // 更新加载提示
    showLoading('正在跳转...');

    // 跳转到阅读器页面
    setTimeout(() => {
        window.location.href = 'reader.html';
    }, 100);
}

// 格式化时间
function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < week) {
        return `${Math.floor(diff / day)}天前`;
    } else if (diff < month) {
        return `${Math.floor(diff / week)}周前`;
    } else {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
}

// 自动保存进度
function setupAutoSave() {
    // 每次章节切换时保存
    // 已经在 loadChapter 中实现

    // 页面卸载时保存
    window.addEventListener('beforeunload', () => {
        saveReadingProgress();
        stopReadingTimer();
    });
}

// 滚动和触摸处理
function setupScrollHandler() {
    const header = document.getElementById('reader-header');
    const footer = document.getElementById('reader-footer');
    const readerContent = document.getElementById('reader-content');
    
    // 滑动相关变量
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50; // 最小滑动距离
    
    // 检测是否为移动设备
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    if (isMobile) {
        // 移动端：点击中间区域显示/隐藏头尾栏，左右区域点击翻页
        readerContent.addEventListener('click', (e) => {
            // 检查点击是否在弹窗容器内，如果是则不触发翻页
            const target = e.target;
            const modalOverlay = target.closest('.modal-overlay') || target.closest('.modal-content');
            const panelOverlay = target.closest('.settings-panel') || target.closest('.bookmarks-panel');
            if (modalOverlay || panelOverlay) {
                return;
            }

            const clickX = e.clientX;
            const screenWidth = window.innerWidth;

            // 判断点击区域
            const leftZone = screenWidth * 0.25; // 左侧 25%
            const rightZone = screenWidth * 0.75; // 右侧 75%

            if (clickX < leftZone) {
                // 点击左侧区域：向前翻页
                prevChapter();
                // 翻页后隐藏头尾栏
                hideHeaderFooter();
            } else if (clickX > rightZone) {
                // 点击右侧区域：向后翻页
                nextChapter();
                // 翻页后隐藏头尾栏
                hideHeaderFooter();
            } else {
                // 点击中间区域：显示/隐藏头尾栏
                toggleHeaderFooter();
            }
        });
        
        // 移动端：滑动翻页
        readerContent.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, false);
        
        readerContent.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, false);
        
        function handleSwipe() {
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            
            // 只有水平滑动距离大于最小距离，且垂直滑动距离小于水平滑动距离时才触发
            if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 0) {
                    // 向右滑动：向前翻页
                    prevChapter();
                } else {
                    // 向左滑动：向后翻页
                    nextChapter();
                }
                // 滑动翻页后隐藏头尾栏
                hideHeaderFooter();
            }
        }
    } else {
        // PC端：保持原有的滚动显示/隐藏逻辑
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
        });
    }
    
    // 显示/隐藏头尾栏
    function toggleHeaderFooter() {
        header.classList.toggle('hidden');
        footer.classList.toggle('hidden');
    }
    
    // 隐藏头尾栏
    function hideHeaderFooter() {
        header.classList.add('hidden');
        footer.classList.add('hidden');
    }
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

// ===== 书签功能 =====

// 获取书签列表
function getBookmarks() {
    const allBookmarks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '{}');
    const novelId = getCurrentNovelId();
    return allBookmarks[novelId] || [];
}

// 保存书签列表
function saveBookmarks(bookmarks) {
    const allBookmarks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '{}');
    const novelId = getCurrentNovelId();
    allBookmarks[novelId] = bookmarks;
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(allBookmarks));
}

// 添加书签
function addBookmark() {
    const bookmarks = getBookmarks();
    const chapterTitleInfo = currentNovel.chapter_titles[currentChapterIndex];
    const chapterTitle = chapterTitleInfo ? chapterTitleInfo.title : `第 ${currentChapterIndex + 1} 章`;
    
    // 检查是否已存在
    const existingIndex = bookmarks.findIndex(b => b.chapterIndex === currentChapterIndex);
    if (existingIndex !== -1) {
        // 已存在，删除
        bookmarks.splice(existingIndex, 1);
        saveBookmarks(bookmarks);
        showToast('已取消书签');
        updateBookmarkButton();
        return;
    }
    
    // 添加新书签
    bookmarks.push({
        chapterIndex: currentChapterIndex,
        chapterTitle: chapterTitle,
        timestamp: Date.now()
    });
    
    // 按时间排序
    bookmarks.sort((a, b) => b.timestamp - a.timestamp);
    
    saveBookmarks(bookmarks);
    showToast('已添加书签');
    updateBookmarkButton();
}

// 删除书签
function deleteBookmark(chapterIndex) {
    const bookmarks = getBookmarks();
    const index = bookmarks.findIndex(b => b.chapterIndex === chapterIndex);
    if (index !== -1) {
        bookmarks.splice(index, 1);
        saveBookmarks(bookmarks);
        showToast('已删除书签');
        loadBookmarks();
        updateBookmarkButton();
    }
}

// 跳转到书签
async function jumpToBookmark(chapterIndex) {
    await loadChapter(chapterIndex);
    toggleBookmarks();
}

// 切换书签状态
function toggleBookmark() {
    addBookmark();
}

// 更新书签按钮状态
function updateBookmarkButton() {
    const bookmarkBtn = document.getElementById('bookmark-btn');
    if (!bookmarkBtn) return;
    
    const bookmarks = getBookmarks();
    const isBookmarked = bookmarks.some(b => b.chapterIndex === currentChapterIndex);
    
    const iconEmpty = bookmarkBtn.querySelector('.bookmark-icon-empty');
    const iconFilled = bookmarkBtn.querySelector('.bookmark-icon-filled');
    
    if (isBookmarked) {
        bookmarkBtn.classList.add('active');
        iconEmpty.style.display = 'none';
        iconFilled.style.display = 'block';
    } else {
        bookmarkBtn.classList.remove('active');
        iconEmpty.style.display = 'block';
        iconFilled.style.display = 'none';
    }
}

// 加载书签列表
function loadBookmarks() {
    const bookmarksList = document.getElementById('bookmarks-list');
    if (!bookmarksList) return;
    
    const bookmarks = getBookmarks();
    
    if (bookmarks.length === 0) {
        bookmarksList.innerHTML = '<div class="bookmark-empty">暂无书签<br>点击右上角 ☆ 添加书签</div>';
        return;
    }
    
    bookmarksList.innerHTML = bookmarks.map(bookmark => {
        const timeStr = formatTime(bookmark.timestamp);
        return `
            <div class="bookmark-item" onclick="jumpToBookmark(${bookmark.chapterIndex})">
                <div class="bookmark-chapter">${escapeHtml(bookmark.chapterTitle)}</div>
                <div class="bookmark-time">${timeStr}</div>
                <span class="bookmark-delete" onclick="event.stopPropagation(); deleteBookmark(${bookmark.chapterIndex})">×</span>
            </div>
        `;
    }).join('');
}

// 切换书签面板
function toggleBookmarks() {
    const bookmarksPanel = document.getElementById('bookmarks-panel');
    bookmarksPanel.classList.toggle('active');
    
    // 加载书签列表
    if (bookmarksPanel.classList.contains('active')) {
        loadBookmarks();
    }
    
    // 移动端：打开书签时显示头尾栏
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && bookmarksPanel.classList.contains('active')) {
        const header = document.getElementById('reader-header');
        const footer = document.getElementById('reader-footer');
        header.classList.remove('hidden');
        footer.classList.remove('hidden');
    }
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 小说分类系统 =====

// 分类关键词映射（更精确的分类规则）
const CATEGORY_KEYWORDS = {
    '玄幻': {
        keywords: ['玄幻', '仙侠', '修真', '修仙', '道术', '符箓', '飞升', '渡劫', '宗门', '丹药', '灵石', '真元', '元婴', '金丹', '筑基', '炼气', '剑仙', '武道', '灵力', '灵气', '修为', '灵根'],
        weight: 2.0,
        exclude: ['灵异', '盗墓', '古墓', '探险']
    },
    '都市': {
        keywords: ['都市', '总裁', '豪门', '神医', '相师', '鉴宝', '古董', '商界', '职场', '娱乐圈', '神豪', '兵王', '兵哥', '赘婿'],
        weight: 1.5,
        exclude: ['重生', '穿越', '系统', '末世', '科幻']
    },
    '科幻': {
        keywords: ['科幻', '星际', '机甲', '赛博', '未来', '外星', '飞船', '宇宙', '星球', '太空', '高科技'],
        weight: 2.0,
        exclude: ['游戏', '网游']
    },
    '末世': {
        keywords: ['末世', '末日', '丧尸', '变异', '进化', '天灾', '极热', '极寒', '永夜', '酸雨', '废土'],
        weight: 2.5,
        exclude: []
    },
    '奇幻': {
        keywords: ['奇幻', '魔法', '异界', '召唤', '魔兽', '精灵', '矮人', '巨龙', '法师', '骑士', '领主', '神灵'],
        weight: 1.8,
        exclude: ['游戏', '网游', '穿越']
    },
    '历史': {
        keywords: ['历史', '朝代', '皇帝', '皇子', '将军', '谋士', '宫廷', '权谋', '三国', '战国', '大明', '大唐', '大宋', '清朝'],
        weight: 2.0,
        exclude: ['玄幻', '仙侠', '修真']
    },
    '军事': {
        keywords: ['特种兵', '军火', '兵王', '战神', '军队', '战场', '抗战', '现代战争', '军旅'],
        weight: 2.0,
        exclude: ['玄幻', '修真', '仙侠']
    },
    '游戏': {
        keywords: ['游戏', '网游', '竞技', '电竞', '副本', '装备', '公会', '联盟', '王者荣耀', '英雄联盟', '魔兽世界'],
        weight: 1.8,
        exclude: ['现实', '都市']
    },
    '灵异': {
        keywords: ['灵异', '盗墓', '捉鬼', '僵尸', '鬼怪', '古墓', '探险', '寻宝', '诅咒', '驱魔', '阴阳', '风水师', '赶尸', '诡墓'],
        weight: 2.0,
        exclude: ['玄幻', '仙侠', '修真']
    },
    '同人': {
        keywords: ['同人', '同人小说', '衍生', '同人创作'],
        weight: 3.0,
        exclude: []
    },
    '航海': {
        keywords: ['航海', '海战', '海盗', '船长', '船只', '幽灵船', '海上', '大航海', '航海求生'],
        weight: 2.5,
        exclude: []
    },
    '原始': {
        keywords: ['原始', '蛮荒', '部落', '石器时代', '野人', '野蛮'],
        weight: 2.5,
        exclude: []
    },
    '情感': {
        keywords: ['言情', '婚恋', '恋爱', '甜宠', '虐恋', '总裁文', '豪门文', '宠妻'],
        weight: 1.5,
        exclude: ['玄幻', '仙侠', '修真', '末世', '科幻']
    }
};

// 自动分类函数（改进版，使用权重和排除词）
function autoCategorizeNovel(novel) {
    const title = novel.title.toLowerCase();
    const description = (novel.description || '').toLowerCase();

    const categoryScores = {};

    for (const [category, config] of Object.entries(CATEGORY_KEYWORDS)) {
        let score = 0;

        // 检查是否有排除词
        const hasExclude = config.exclude.some(exclude =>
            title.includes(exclude.toLowerCase()) || description.includes(exclude.toLowerCase())
        );

        if (hasExclude) {
            continue; // 如果有排除词，跳过该分类
        }

        // 计算标题中的关键词（权重更高）
        for (const keyword of config.keywords) {
            if (title.includes(keyword.toLowerCase())) {
                score += 3 * config.weight; // 标题中的关键词权重为3倍
            }
        }

        // 计算描述中的关键词（权重较低）
        for (const keyword of config.keywords) {
            if (description.includes(keyword.toLowerCase())) {
                score += 1 * config.weight; // 描述中的关键词权重为1倍
            }
        }

        if (score > 0) {
            categoryScores[category] = score;
        }
    }

    // 按分数排序
    const sortedCategories = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1])
        .map(([category]) => category);

    // 返回分数最高的1-2个分类（避免过度分类）
    return sortedCategories.slice(0, 2).length > 0 ? sortedCategories.slice(0, 2) : ['其他'];
}

// 为所有小说添加分类
function addCategoriesToNovels() {
    if (!allNovelsMeta) return;

    const CATEGORY_VERSION = 'v2.0'; // 分类系统版本号

    allNovelsMeta.forEach(novel => {
        // 如果分类不存在，或版本号不匹配，则重新分类
        if (!novel.categories || !novel.categoryVersion || novel.categoryVersion !== CATEGORY_VERSION) {
            novel.categories = autoCategorizeNovel(novel);
            novel.categoryVersion = CATEGORY_VERSION;
        }
    });
}

// 按分类筛选小说
function filterByCategory(category) {
    if (!allNovelsMeta) return;
    
    // 更新分类按钮状态
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    if (category === '全部') {
        renderNovelList(allNovelsMeta);
        return;
    }
    
    const filteredNovels = allNovelsMeta.filter(novel => 
        novel.categories && novel.categories.includes(category)
    );
    
    renderNovelList(filteredNovels);
    
    // 更新计数
    const countElement = document.getElementById('novel-count');
    countElement.textContent = `找到 ${filteredNovels.length} 本小说`;
}

// 获取所有分类
function getAllCategories() {
    if (!allNovelsMeta) return ['全部'];
    
    const categories = new Set(['全部']);
    allNovelsMeta.forEach(novel => {
        if (novel.categories) {
            novel.categories.forEach(cat => categories.add(cat));
        }
    });
    
    return Array.from(categories);
}

// 渲染分类按钮
function renderCategoryButtons() {
    const categories = getAllCategories();
    const categoryContainer = document.getElementById('category-container');
    
    if (!categoryContainer) return;
    
    categoryContainer.innerHTML = categories.map(category => `
        <button class="category-btn ${category === '全部' ? 'active' : ''}" 
                data-category="${category}" 
                onclick="filterByCategory('${category}')">
            ${category}
        </button>
    `).join('');
}

// ===== 收藏功能 =====

// 获取收藏列表
function getFavorites() {
    return JSON.parse(localStorage.getItem('novelreader_favorites') || '[]');
}

// 保存收藏列表
function saveFavorites(favorites) {
    localStorage.setItem('novelreader_favorites', JSON.stringify(favorites));
}

// 添加收藏
function toggleFavorite(novelId) {
    const favorites = getFavorites();
    const index = favorites.indexOf(novelId);
    
    if (index !== -1) {
        favorites.splice(index, 1);
        showToast('已取消收藏');
    } else {
        favorites.push(novelId);
        showToast('已添加收藏');
    }
    
    saveFavorites(favorites);
    renderNovelList(allNovelsMeta);
}

// 检查是否已收藏
function isFavorite(novelId) {
    const favorites = getFavorites();
    return favorites.includes(novelId);
}

// 只显示收藏的小说
function showFavoritesOnly() {
    const favorites = getFavorites();
    if (favorites.length === 0) {
        showToast('暂无收藏');
        return;
    }
    
    const favoriteNovels = allNovelsMeta.filter(novel => favorites.includes(novel.id));
    renderNovelList(favoriteNovels);
    
    const countElement = document.getElementById('novel-count');
    countElement.textContent = `我的收藏 ${favoriteNovels.length} 本`;
}

// ===== 阅读统计功能 =====

// 获取阅读统计
function getReadingStats() {
    const stats = JSON.parse(localStorage.getItem('novelreader_stats') || '{}');
    
    // 初始化统计
    if (!stats.totalReadChapters) {
        stats.totalReadChapters = 0;
    }
    if (!stats.totalReadingTime) {
        stats.totalReadingTime = 0; // 毫秒
    }
    if (!stats.lastReadDate) {
        stats.lastReadDate = null;
    }
    if (!stats.dailyReadChapters) {
        stats.dailyReadChapters = {};
    }
    
    return stats;
}

// 保存阅读统计
function saveReadingStats(stats) {
    localStorage.setItem('novelreader_stats', JSON.stringify(stats));
}

// 记录阅读进度
function recordReadingProgress(chaptersRead = 1) {
    const stats = getReadingStats();
    const today = new Date().toDateString();
    
    stats.totalReadChapters += chaptersRead;
    stats.lastReadDate = Date.now();
    
    // 每日阅读统计
    if (!stats.dailyReadChapters[today]) {
        stats.dailyReadChapters[today] = 0;
    }
    stats.dailyReadChapters[today] += chaptersRead;
    
    saveReadingStats(stats);
}

// 开始阅读计时
let readingStartTime = null;
let readingTimerInterval = null;

function startReadingTimer() {
    readingStartTime = Date.now();
    readingTimerInterval = setInterval(() => {
        const stats = getReadingStats();
        const elapsed = Date.now() - readingStartTime;
        stats.totalReadingTime += 1000; // 每秒增加1秒
        saveReadingStats(stats);
    }, 1000);
}

function stopReadingTimer() {
    if (readingTimerInterval) {
        clearInterval(readingTimerInterval);
        readingTimerInterval = null;
    }
    readingStartTime = null;
}

// 格式化阅读时间
function formatReadingTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
        return `${minutes}分钟`;
    } else {
        return `${seconds}秒`;
    }
}

// 显示阅读统计
function showReadingStats() {
    const stats = getReadingStats();
    const today = new Date().toDateString();
    const todayChapters = stats.dailyReadChapters[today] || 0;
    
    const statsHtml = `
        <div class="stats-content">
            <h3>📊 阅读统计</h3>
            <div class="stats-item">
                <span class="stats-label">累计阅读章节</span>
                <span class="stats-value">${stats.totalReadChapters} 章</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">累计阅读时长</span>
                <span class="stats-value">${formatReadingTime(stats.totalReadingTime)}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">今日阅读章节</span>
                <span class="stats-value">${todayChapters} 章</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">最后阅读时间</span>
                <span class="stats-value">${stats.lastReadDate ? formatTime(stats.lastReadDate) : '暂无'}</span>
            </div>
            <button class="btn btn-primary w-100 mt-3" onclick="closeStatsModal()">关闭</button>
        </div>
    `;
    
    const statsModal = document.createElement('div');
    statsModal.id = 'stats-modal';
    statsModal.className = 'modal-overlay';
    statsModal.innerHTML = statsHtml;
    document.body.appendChild(statsModal);

    statsModal.onclick = (e) => {
        if (e.target === statsModal) {
            closeStatsModal();
        }
    };
}

function closeStatsModal() {
    const statsModal = document.getElementById('stats-modal');
    if (statsModal) {
        statsModal.remove();
    }
}

// ===== 主题快捷切换 =====

function quickToggleTheme() {
    const themes = ['light', 'sepia', 'dark'];
    const currentIndex = themes.indexOf(readerSettings.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
}

// ===== 书签导出/导入 =====

// 导出书签
function exportBookmarks() {
    const allBookmarks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '{}');
    
    if (Object.keys(allBookmarks).length === 0) {
        showToast('暂无书签可导出');
        return;
    }
    
    // 创建导出数据
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        bookmarks: allBookmarks
    };
    
    // 创建下载链接
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novelreader_bookmarks_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('书签导出成功');
}

// 导入书签
function importBookmarks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importData = JSON.parse(event.target.result);
                
                if (!importData.bookmarks) {
                    showToast('无效的书签文件');
                    return;
                }
                
                // 合并书签
                const allBookmarks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '{}');
                Object.keys(importData.bookmarks).forEach(novelId => {
                    if (!allBookmarks[novelId]) {
                        allBookmarks[novelId] = [];
                    }
                    // 合并书签，避免重复
                    importData.bookmarks[novelId].forEach(importBookmark => {
                        const exists = allBookmarks[novelId].some(
                            b => b.chapterIndex === importBookmark.chapterIndex
                        );
                        if (!exists) {
                            allBookmarks[novelId].push(importBookmark);
                        }
                    });
                    // 按时间排序
                    allBookmarks[novelId].sort((a, b) => b.timestamp - a.timestamp);
                });
                
                localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(allBookmarks));
                showToast('书签导入成功');
                loadBookmarks();
            } catch (error) {
                console.error('导入书签失败:', error);
                showToast('导入失败，文件格式错误');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// ===== 分享功能 =====

function shareNovel() {
    if (!currentNovel) return;
    
    const shareText = `📖 《${currentNovel.title}》\n作者：${currentNovel.author}\n\n正在第 ${currentChapterIndex + 1} 章阅读`;
    const shareUrl = window.location.href;
    
    // 尝试使用 Web Share API
    if (navigator.share) {
        navigator.share({
            title: currentNovel.title,
            text: shareText,
            url: shareUrl
        }).catch(err => {
            console.log('分享取消:', err);
        });
    } else {
        // 降级方案：复制到剪贴板
        const fullText = `${shareText}\n${shareUrl}`;
        navigator.clipboard.writeText(fullText).then(() => {
            showToast('已复制分享链接');
        }).catch(() => {
            showToast('复制失败，请手动复制');
        });
    }
}

// ===== 阅读排行榜 =====

function showRanking(type = 'hot') {
    // 先移除旧的排行榜弹窗
    closeRankingModal();

    let rankedNovels = [];

    if (type === 'hot') {
        // 我的阅读排行：按阅读时长排序
        const allProgress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
        const stats = JSON.parse(localStorage.getItem('novelreader_stats') || '{}');

        rankedNovels = allNovelsMeta.map(novel => {
            const progress = allProgress[novel.title];
            const hasRead = progress && progress.chapterIndex > 0;
            const readPercent = hasRead ? Math.round((progress.chapterIndex / novel.chapters_count) * 100) : 0;

            return {
                ...novel,
                readCount: hasRead ? 1 : 0,  // 是否读过
                readPercent: readPercent,     // 阅读百分比
                lastRead: progress ? progress.timestamp : 0,  // 最后阅读时间
                hasProgress: hasRead          // 是否有阅读记录
            };
        }).filter(novel => novel.hasProgress)  // 只显示有阅读记录的小说
          .sort((a, b) => {
              // 先按阅读百分比排序，再按最后阅读时间排序
              if (b.readPercent !== a.readPercent) {
                  return b.readPercent - a.readPercent;
              }
              return b.lastRead - a.lastRead;
          });
    } else if (type === 'latest') {
        // 最新收录：按ID排序（假设ID越大越新），并过滤掉没有数据的小说
        rankedNovels = [...allNovelsMeta]
            .filter(novel => novel.chapters_count > 0)  // 过滤无效小说
            .sort((a, b) => {
                const idA = parseInt(a.id.replace('novel_', ''));
                const idB = parseInt(b.id.replace('novel_', ''));
                return idB - idA;
            });
    } else if (type === 'longest') {
        // 最长小说：按章节数排序
        rankedNovels = [...allNovelsMeta]
            .filter(novel => novel.chapters_count > 0)  // 过滤无效小说
            .sort((a, b) => b.chapters_count - a.chapters_count);
    }

    // 只显示前10名
    const top10 = rankedNovels.slice(0, 10);

    // 如果没有数据，显示提示
    if (top10.length === 0) {
        const noDataHtml = `
            <div class="ranking-content">
                <div class="ranking-header">
                    <h3>${type === 'hot' ? '🔥 我的阅读排行' : type === 'latest' ? '最新收录' : '📚 最长小说'}</h3>
                    <button class="btn-close btn-close-white" onclick="closeRankingModal()"></button>
                </div>
                <div class="ranking-tabs">
                    <button class="ranking-tab ${type === 'hot' ? 'active' : ''}" onclick="showRanking('hot')">热门</button>
                    <button class="ranking-tab ${type === 'latest' ? 'active' : ''}" onclick="showRanking('latest')">最新</button>
                    <button class="ranking-tab ${type === 'longest' ? 'active' : ''}" onclick="showRanking('longest')">最长</button>
                </div>
                <div class="ranking-empty">
                    <p>${type === 'hot' ? '暂无阅读记录，快去阅读小说吧！' : '暂无小说数据'}</p>
                </div>
            </div>
        `;

        const rankingModal = document.createElement('div');
        rankingModal.id = 'ranking-modal';
        rankingModal.className = 'modal-overlay';
        rankingModal.innerHTML = noDataHtml;
        document.body.appendChild(rankingModal);

        rankingModal.onclick = (e) => {
            if (e.target === rankingModal) {
                closeRankingModal();
            }
        };
        return;
    }

    const rankingHtml = `
        <div class="ranking-content">
            <div class="ranking-header">
                <h3>${type === 'hot' ? '🔥 我的阅读排行' : type === 'latest' ? '最新收录' : '📚 最长小说'}</h3>
                <button class="btn-close btn-close-white" onclick="closeRankingModal()"></button>
            </div>
            <div class="ranking-tabs">
                <button class="ranking-tab ${type === 'hot' ? 'active' : ''}" onclick="showRanking('hot')">热门</button>
                <button class="ranking-tab ${type === 'latest' ? 'active' : ''}" onclick="showRanking('latest')">最新</button>
                <button class="ranking-tab ${type === 'longest' ? 'active' : ''}" onclick="showRanking('longest')">最长</button>
            </div>
            <div class="ranking-list">
                ${top10.map((novel, index) => `
                    <div class="ranking-item" onclick="openNovel('${novel.id}')">
                        <div class="ranking-number">${index + 1}</div>
                        <div class="ranking-info">
                            <div class="ranking-title">${escapeHtml(novel.title)}</div>
                            <div class="ranking-meta">
                                <span>${escapeHtml(novel.author)}</span>
                                <span>${novel.chapters_count} 章</span>
                                ${type === 'hot' && novel.readPercent !== undefined ? `<span class="ranking-progress">已读 ${novel.readPercent}%</span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const rankingModal = document.createElement('div');
    rankingModal.id = 'ranking-modal';
    rankingModal.className = 'modal-overlay';
    rankingModal.innerHTML = rankingHtml;
    document.body.appendChild(rankingModal);

    rankingModal.onclick = (e) => {
        if (e.target === rankingModal) {
            closeRankingModal();
        }
    };
}

function closeRankingModal() {
    const rankingModal = document.getElementById('ranking-modal');
    if (rankingModal) {
        rankingModal.remove();
    }
}

// ===== 随机推荐 =====

// 随机推荐状态（持久化到 localStorage）
let recommendState = {
    excludedIds: [],  // 用户不喜欢/已排除的小说ID
    lastRecommendId: null,  // 上次推荐的小说ID
    recommendHistory: []  // 推荐历史（最近10本）
};

// 保存推荐状态
function saveRecommendState() {
    localStorage.setItem('novelreader_recommend_state', JSON.stringify(recommendState));
}

// 加载推荐状态
function loadRecommendState() {
    const saved = localStorage.getItem('novelreader_recommend_state');
    if (saved) {
        try {
            recommendState = JSON.parse(saved);
        } catch (e) {
            console.error('加载推荐状态失败:', e);
        }
    }
}

// 在页面加载时恢复推荐状态
document.addEventListener('DOMContentLoaded', () => {
    loadRecommendState();
});

function randomRecommend() {
    closeRecommendModal();

    if (!allNovelsMeta || allNovelsMeta.length === 0) {
        showToast('暂无小说可推荐');
        return;
    }

    // 获取已阅读和已收藏的小说ID
    const favorites = new Set(getFavorites());
    const readingProgress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
    const readingIds = new Set(Object.keys(readingProgress).map(title => {
        const novel = allNovelsMeta.find(n => n.title === title);
        return novel ? novel.id : null;
    }).filter(id => id));

    // 计算推荐池（排除已阅读、已收藏、已排除的小说）
    const recommendPool = allNovelsMeta.filter(novel => {
        // 排除已收藏的
        if (favorites.has(novel.id)) return false;
        // 排除已阅读的（阅读进度超过5%）
        if (readingIds.has(novel.id)) {
            const progress = getReadingProgress(novel.title);
            if (progress && progress.chapterIndex > 0) {
                const progressPercent = (progress.chapterIndex / novel.chapters_count) * 100;
                if (progressPercent > 5) return false;  // 已读超过5%的排除
            }
        }
        // 排除用户不喜欢的
        if (recommendState.excludedIds.includes(novel.id)) return false;
        // 排除上次推荐的
        if (recommendState.lastRecommendId === novel.id) return false;

        return true;
    });

    // 如果推荐池为空，重置排除列表
    if (recommendPool.length === 0) {
        if (recommendState.excludedIds.length > 0 || recommendState.lastRecommendId) {
            // 重置状态
            recommendState.excludedIds = [];
            recommendState.lastRecommendId = null;
            showToast('已重置推荐列表');
            setTimeout(() => randomRecommend(), 500);
            return;
        } else {
            showToast('所有小说都已读过或收藏');
            return;
        }
    }

    // 从推荐池中随机选择
    const randomIndex = Math.floor(Math.random() * recommendPool.length);
    const randomNovel = recommendPool[randomIndex];

    // 更新状态
    recommendState.lastRecommendId = randomNovel.id;
    recommendState.recommendHistory.unshift(randomNovel.id);
    if (recommendState.recommendHistory.length > 10) {
        recommendState.recommendHistory.pop();
    }
    saveRecommendState();

    // 生成推荐理由
    const reasons = [];
    if (randomNovel.categories && randomNovel.categories.length > 0) {
        reasons.push(`分类：${randomNovel.categories.join('、')}`);
    }
    if (randomNovel.chapters_count > 1000) {
        reasons.push('长篇连载');
    } else if (randomNovel.chapters_count < 300) {
        reasons.push('短篇精读');
    }
    reasons.push('未阅读');

    const recommendHtml = `
        <div class="recommend-content">
            <div class="recommend-header">
                <h3>🎲 随机推荐</h3>
                <button class="btn-close btn-close-white" onclick="closeRecommendModal()"></button>
            </div>
            <div class="recommend-novel">
                <h4>${escapeHtml(randomNovel.title)}</h4>
                <p class="recommend-author">作者：${escapeHtml(randomNovel.author)}</p>
                <p class="recommend-desc">${escapeHtml(randomNovel.description)}</p>
                <div class="recommend-meta">
                    <span class="badge bg-info">共 ${randomNovel.chapters_count} 章</span>
                    ${randomNovel.categories ? randomNovel.categories.map(cat => `<span class="badge bg-secondary">${escapeHtml(cat)}</span>`).join('') : ''}
                </div>
                <div class="recommend-reasons">
                    <small class="text-muted">推荐理由：${reasons.join(' · ')}</small>
                </div>
            </div>
            <div class="recommend-actions">
                <button class="btn btn-outline-secondary" onclick="dislikeNovel('${randomNovel.id}')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                    不喜欢
                </button>
                <button class="btn btn-outline-primary" onclick="closeRecommendModal(); randomRecommend();">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                        <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                        <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                    </svg>
                    换一本
                </button>
                <button class="btn btn-primary" onclick="openNovel('${randomNovel.id}')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                        <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 000 2.5v11a.5.5 0 00.707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 00.78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0016 13.5v-11a.5.5 0 00-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
                    </svg>
                    开始阅读
                </button>
            </div>
        </div>
    `;

    const recommendModal = document.createElement('div');
    recommendModal.id = 'recommend-modal';
    recommendModal.className = 'modal-overlay';
    recommendModal.innerHTML = recommendHtml;
    document.body.appendChild(recommendModal);

    recommendModal.onclick = (e) => {
        if (e.target === recommendModal) {
            closeRecommendModal();
        }
    };
}

// 不喜欢的小说
function dislikeNovel(novelId) {
    // 添加到排除列表
    recommendState.excludedIds.push(novelId);
    saveRecommendState();

    // 显示提示
    showToast('已将该小说加入不喜欢列表');

    // 重新推荐
    setTimeout(() => {
        randomRecommend();
    }, 300);
}

function closeRecommendModal() {
    const recommendModal = document.getElementById('recommend-modal');
    if (recommendModal) {
        recommendModal.remove();
    }
}

// ===== 相关推荐 =====

function getSimilarNovels(currentNovel) {
    if (!allNovelsMeta) return [];
    
    // 计算相似度：基于分类、作者、标签
    const similarNovels = allNovelsMeta
        .filter(novel => novel.id !== currentNovel.id)
        .map(novel => {
            let similarity = 0;
            
            // 分类相似度
            if (novel.categories && currentNovel.categories) {
                const commonCategories = novel.categories.filter(cat => 
                    currentNovel.categories.includes(cat)
                );
                similarity += commonCategories.length * 10;
            }
            
            // 作者相同
            if (novel.author === currentNovel.author) {
                similarity += 20;
            }
            
            // 章节数相近
            const chapterDiff = Math.abs(novel.chapters_count - currentNovel.chapters_count);
            if (chapterDiff < 500) {
                similarity += 5;
            }
            
            return { ...novel, similarity };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5); // 取前5本
    
    return similarNovels;
}

function showRelatedRecommendations() {
    if (!currentNovel) return;
    
    const similarNovels = getSimilarNovels(currentNovel);
    
    if (similarNovels.length === 0) {
        showToast('暂无相关推荐');
        return;
    }
    
    const relatedHtml = `
        <div class="related-content">
            <div class="related-header">
                <h3>📖 相关推荐</h3>
                <button class="btn-close btn-close-white" onclick="closeRelatedModal()"></button>
            </div>
            <div class="related-list">
                ${similarNovels.map(novel => `
                    <div class="related-item" onclick="openNovel('${novel.id}')">
                        <h4>${escapeHtml(novel.title)}</h4>
                        <p class="related-author">${escapeHtml(novel.author)}</p>
                        <p class="related-desc">${escapeHtml(novel.description)}</p>
                        <span class="related-meta">${novel.chapters_count} 章</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    const relatedModal = document.createElement('div');
    relatedModal.id = 'related-modal';
    relatedModal.className = 'modal-overlay';
    relatedModal.innerHTML = relatedHtml;
    document.body.appendChild(relatedModal);

    relatedModal.onclick = (e) => {
        if (e.target === relatedModal) {
            closeRelatedModal();
        }
    };
}

function closeRelatedModal() {
    const relatedModal = document.getElementById('related-modal');
    if (relatedModal) {
        relatedModal.remove();
    }
}

// ===== 关于页面 =====

function showAboutPage() {
    const aboutHtml = `
        <div class="about-content">
            <div class="about-header">
                <h3>📚 关于小说阅读器</h3>
                <button class="btn-close btn-close-white" onclick="closeAboutModal()"></button>
            </div>
            <div class="about-body">
                <div class="about-section">
                    <h4>🎯 项目介绍</h4>
                    <p>小说阅读器是一款轻量级的在线小说阅读工具，提供流畅的阅读体验和丰富的功能。</p>
                </div>
                <div class="about-section">
                    <h4>✨ 主要功能</h4>
                    <ul>
                        <li>📖 支持多种题材小说在线阅读</li>
                        <li>🔍 智能搜索和分类筛选</li>
                        <li>🌙 多种主题模式（白天/护眼/夜间）</li>
                        <li>🔖 书签和收藏功能</li>
                        <li>📊 阅读进度自动保存</li>
                        <li>⌨️ 键盘快捷键支持</li>
                        <li>💬 章节评论互动</li>
                    </ul>
                </div>
                <div class="about-section">
                    <h4>⌨️ 快捷键说明</h4>
                    <ul>
                        <li><kbd>←</kbd> 上一章</li>
                        <li><kbd>→</kbd> 下一章</li>
                        <li><kbd>Esc</kbd> 关闭面板</li>
                    </ul>
                </div>
                <div class="about-section">
                    <h4>👨‍💻 开发者</h4>
                    <p>作者：<a href="https://github.com/halei0v0" target="_blank">@halei0v0</a></p>
                    <p>项目地址：<a href="https://github.com/halei0v0/Novelreader" target="_blank">GitHub</a></p>
                </div>
                <div class="about-section">
                    <h4>💬 反馈与建议</h4>
                    <p>如有问题或建议，欢迎在评论区留言或通过GitHub提交Issue。</p>
                </div>
            </div>
            <button class="btn btn-primary w-100 mt-3" onclick="closeAboutModal()">关闭</button>
        </div>
    `;
    
    const aboutModal = document.createElement('div');
    aboutModal.id = 'about-modal';
    aboutModal.className = 'modal-overlay';
    aboutModal.innerHTML = aboutHtml;
    document.body.appendChild(aboutModal);

    aboutModal.onclick = (e) => {
        if (e.target === aboutModal) {
            closeAboutModal();
        }
    };
}

function closeAboutModal() {
    const aboutModal = document.getElementById('about-modal');
    if (aboutModal) {
        aboutModal.remove();
    }
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
            const bookmarksPanel = document.getElementById('bookmarks-panel');
            if (settingsPanel.classList.contains('active')) {
                toggleSettings();
            }
            if (tocModal.classList.contains('active')) {
                toggleTOC();
            }
            if (bookmarksPanel.classList.contains('active')) {
                toggleBookmarks();
            }
            break;
    }
});