/**
 * 主应用模块
 * 负责整体应用逻辑和模块协调
 */
class NovelReaderApp {
    constructor() {
        this.novels = new Map();
        this.currentView = 'list'; // 'list' or 'reader'
        this.isPageLoading = true; // 添加页面加载状态标记
        
        this.initElements();
        this.initEvents();
        this.initSettings();
    }

    /**
     * 初始化DOM元素
     */
    initElements() {
        // 小说列表相关
        this.novelGrid = document.getElementById('novelGrid');
        this.refreshBtn = document.getElementById('refreshBtn');
        
        // 搜索相关
        this.searchBtn = document.getElementById('searchBtn');
        this.searchModal = document.getElementById('searchModal');
        this.searchInput = document.getElementById('searchInput');
        this.searchSubmitBtn = document.getElementById('searchSubmitBtn');
        this.searchResults = document.getElementById('searchResults');
        this.closeSearchBtn = document.getElementById('closeSearchBtn');
        
        // 设置相关
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        
        // 主题切换
        this.themeToggle = document.getElementById('themeToggle');
    }

    /**
     * 初始化事件监听
     */
    initEvents() {
        // 刷新按钮
        this.refreshBtn.addEventListener('click', () => {
            // 清除缓存并重新加载
            this.novels.clear();
            this.loadNovels();
        });

        // 搜索功能
        this.searchBtn.addEventListener('click', () => {
            this.showSearchModal();
        });

        this.searchSubmitBtn.addEventListener('click', () => {
            this.performSearch();
        });

        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        this.closeSearchBtn.addEventListener('click', () => {
            this.hideSearchModal();
        });

        // 设置功能
        this.settingsBtn.addEventListener('click', () => {
            this.showSettingsModal();
        });

        this.closeSettingsBtn.addEventListener('click', () => {
            this.hideSettingsModal();
        });

        // 主题切换
        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });

        // 模态框背景点击关闭
        this.searchModal.addEventListener('click', (e) => {
            if (e.target === this.searchModal) {
                this.hideSearchModal();
            }
        });

        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.hideSettingsModal();
            }
        });

        // 设置项变化监听
        this.initSettingsEvents();

        // 页面加载完成
        document.addEventListener('DOMContentLoaded', () => {
            // 延迟加载，避免刷新时触发文件选择器
            setTimeout(() => {
                this.isPageLoading = false; // 页面加载完成
                this.loadNovels();
            }, 100);
        });

        // 在线/离线状态监听
        window.addEventListener('online', () => {
            this.showNotification('网络连接已恢复');
        });

        window.addEventListener('offline', () => {
            this.showNotification('网络连接已断开', 'warning');
        });
    }

    /**
     * 初始化设置事件
     */
    initSettingsEvents() {
        // 字体大小
        const fontSize = document.getElementById('fontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        
        fontSize.addEventListener('input', (e) => {
            const size = e.target.value;
            fontSizeValue.textContent = `${size}px`;
            this.updateSetting('fontSize', parseInt(size));
        });

        // 行间距
        const lineHeight = document.getElementById('lineHeight');
        const lineHeightValue = document.getElementById('lineHeightValue');
        
        lineHeight.addEventListener('input', (e) => {
            const height = e.target.value;
            lineHeightValue.textContent = height;
            this.updateSetting('lineHeight', parseFloat(height));
        });

        // 字体
        const fontFamily = document.getElementById('fontFamily');
        fontFamily.addEventListener('change', (e) => {
            this.updateSetting('fontFamily', e.target.value);
        });

        // 段落间距
        const paragraphSpacing = document.getElementById('paragraphSpacing');
        const paragraphSpacingValue = document.getElementById('paragraphSpacingValue');
        
        paragraphSpacing.addEventListener('input', (e) => {
            const spacing = e.target.value;
            paragraphSpacingValue.textContent = spacing;
            this.updateSetting('paragraphSpacing', parseFloat(spacing));
        });

        // 文本对齐
        const textAlign = document.getElementById('textAlign');
        textAlign.addEventListener('change', (e) => {
            this.updateSetting('textAlign', e.target.value);
        });

        // 首行缩进
        const textIndent = document.getElementById('textIndent');
        textIndent.addEventListener('change', (e) => {
            this.updateSetting('textIndent', e.target.value);
        });

        // 排版增强选项
        const enableLigatures = document.getElementById('enableLigatures');
        const enableKerning = document.getElementById('enableKerning');
        const enableSmoothFont = document.getElementById('enableSmoothFont');

        enableLigatures.addEventListener('change', (e) => {
            this.updateSetting('enableLigatures', e.target.checked);
        });

        enableKerning.addEventListener('change', (e) => {
            this.updateSetting('enableKerning', e.target.checked);
        });

        enableSmoothFont.addEventListener('change', (e) => {
            this.updateSetting('enableSmoothFont', e.target.checked);
        });

        // 主题按钮
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this.setTheme(theme);
                
                // 更新按钮状态
                themeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    /**
     * 初始化设置
     */
    initSettings() {
        const settings = window.storage.getSettings();
        
        // 应用主题
        this.setTheme(settings.theme);
        
        // 更新设置UI
        document.getElementById('fontSize').value = settings.fontSize || 16;
        document.getElementById('fontSizeValue').textContent = `${settings.fontSize || 16}px`;
        
        document.getElementById('lineHeight').value = settings.lineHeight || 1.6;
        document.getElementById('lineHeightValue').textContent = settings.lineHeight || 1.6;
        
        document.getElementById('fontFamily').value = settings.fontFamily || 'system-ui';
        
        document.getElementById('paragraphSpacing').value = settings.paragraphSpacing || 1.0;
        document.getElementById('paragraphSpacingValue').textContent = settings.paragraphSpacing || 1.0;
        
        document.getElementById('textAlign').value = settings.textAlign || 'justify';
        
        document.getElementById('textIndent').value = settings.textIndent || '2em';
        
        document.getElementById('enableLigatures').checked = settings.enableLigatures !== false;
        document.getElementById('enableKerning').checked = settings.enableKerning !== false;
        document.getElementById('enableSmoothFont').checked = settings.enableSmoothFont !== false;
        
        // 更新主题按钮状态
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === settings.theme) {
                btn.classList.add('active');
            }
        });
    }

    /**
     * 加载小说列表
     */
    async loadNovels() {
        try {
            this.showLoading();
            
            console.log('开始加载小说文件...');
            
            // 扫描novel文件夹中的txt文件
            const novelFiles = await this.scanNovelFiles();
            
            console.log(`扫描到 ${novelFiles.length} 个文件:`, novelFiles.map(f => f.name));
            
            // 解析小说文件
            for (const file of novelFiles) {
                console.log(`正在解析文件: ${file.name}`);
                await this.parseNovelFile(file);
            }
            
            // 渲染小说列表
            this.renderNovelList();
            
            console.log(`成功加载 ${this.novels.size} 本小说`);
            
        } catch (error) {
            console.error('加载小说失败:', error);
            this.showError(`加载小说失败: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 扫描小说文件
     * @returns {Array} 文件列表
     */
    async scanNovelFiles() {
        const files = [];
        
        // 常见的小说文件名列表
        const commonNovelFiles = [
            '十日终焉.txt',
            '斗破苍穹.txt',
            '完美世界.txt',
            '遮天.txt',
            '圣墟.txt',
            '凡人修仙传.txt',
            '仙逆.txt',
            '我欲封天.txt',
            '求魔.txt',
            '一念永恒.txt'
        ];
        
        // 尝试加载常见的小说文件
        for (const filename of commonNovelFiles) {
            try {
                const response = await fetch(`novel/${filename}`, { 
                    method: 'HEAD',
                    cache: 'no-cache'
                });
                
                if (response.ok) {
                    console.log(`找到文件: ${filename}`);
                    // 获取文件内容
                    const contentResponse = await fetch(`novel/${filename}`);
                    const content = await contentResponse.text();
                    
                    files.push({
                        name: filename,
                        content: content,
                        size: content.length,
                        lastModified: response.headers.get('last-modified') || Date.now()
                    });
                }
            } catch (error) {
                // 静默处理文件不存在的情况
                console.debug(`文件不存在或无法访问: ${filename}`);
            }
        }
        
        // 如果没有找到任何文件，尝试通过多种方法获取
        if (files.length === 0) {
            // 方法1: 尝试获取目录列表
            try {
                const dirResponse = await fetch('novel/', { method: 'GET' });
                if (dirResponse.ok) {
                    const dirText = await dirResponse.text();
                    // 解析HTML查找.txt文件
                    const txtMatches = dirText.match(/[^"']*\.txt/gi) || [];
                    
                    for (const filename of txtMatches) {
                        if (!files.find(f => f.name === filename)) {
                            try {
                                const response = await fetch(`novel/${filename}`);
                                if (response.ok) {
                                    const content = await response.text();
                                    files.push({
                                        name: filename,
                                        content: content,
                                        size: content.length
                                    });
                                }
                            } catch (error) {
                                console.warn(`无法加载文件: ${filename}`, error);
                            }
                        }
                    }
                }
            } catch (error) {
                console.debug('无法获取目录列表');
            }

            // 方法2: 尝试常见的文件名模式
            if (files.length === 0) {
                const patterns = [
                    '*.txt',
                    '小说*.txt',
                    '*小说.txt',
                    'story*.txt',
                    'novel*.txt'
                ];
                
                // 这里我们无法直接使用通配符，但可以尝试一些常见的变体
                const additionalFiles = [
                    '小说.txt',
                    'story.txt',
                    'novel.txt',
                    'test.txt'
                ];
                
                for (const filename of additionalFiles) {
                    try {
                        const response = await fetch(`novel/${filename}`, { method: 'HEAD' });
                        if (response.ok) {
                            const contentResponse = await fetch(`novel/${filename}`);
                            const content = await contentResponse.text();
                            files.push({
                                name: filename,
                                content: content,
                                size: content.length
                            });
                        }
                    } catch (error) {
                        // 忽略文件不存在的情况
                    }
                }
            }
        }
        
        console.log(`扫描完成，找到 ${files.length} 个小说文件`);
        
        return files;
    }

    /**
     * 解析小说文件
     * @param {Object} file - 文件对象
     */
    async parseNovelFile(file) {
        try {
            // 验证文件格式
            const validation = window.parser.validateFormat(file.content);
            if (!validation.isValid) {
                console.warn(`文件格式验证失败: ${file.name}`, validation.errors);
                return;
            }
            
            // 快速解析获取基本信息
            const novelInfo = window.parser.quickParse(file.content, file.name);
            
            // 检查缓存
            const cachedNovel = window.storage.getNovelInfo(novelInfo.id);
            if (cachedNovel && cachedNovel.parseTime > file.lastModified) {
                this.novels.set(novelInfo.id, cachedNovel);
                return;
            }
            
            // 完整解析
            const fullNovel = window.parser.parseNovel(file.content, file.name);
            
            // 添加文件信息
            fullNovel.fileSize = file.size;
            fullNovel.lastModified = Date.now();
            
            // 缓存小说信息
            window.storage.saveNovelInfo(novelInfo.id, fullNovel);
            
            // 存储到内存
            this.novels.set(novelInfo.id, fullNovel);
            
        } catch (error) {
            console.error(`解析文件失败: ${file.name}`, error);
        }
    }

    /**
     * 渲染小说列表
     */
    renderNovelList() {
        this.novelGrid.innerHTML = '';
        
        if (this.novels.size === 0) {
            this.renderEmptyState();
            return;
        }
        
        this.novels.forEach(novel => {
            const novelCard = this.createNovelCard(novel);
            this.novelGrid.appendChild(novelCard);
        });
    }

    /**
     * 创建小说卡片
     * @param {Object} novel - 小说信息
     * @returns {HTMLElement} 小说卡片元素
     */
    createNovelCard(novel) {
        const card = document.createElement('div');
        card.className = 'novel-card';
        card.dataset.novelId = novel.id;
        
        // 获取阅读进度
        const progress = window.storage.getReadingProgress(novel.id);
        const progressPercent = progress ? 
            Math.round((progress.chapterIndex / novel.totalChapters) * 100) : 0;
        
        card.innerHTML = `
            <h3>${novel.title}</h3>
            <p class="author">作者: ${novel.author || '未知'}</p>
            <p class="description">${novel.summary || '暂无简介'}</p>
            <div class="meta">
                <span>${novel.totalChapters}章</span>
                <span>${this.formatFileSize(novel.fileSize)}</span>
                ${progressPercent > 0 ? `<span class="progress">阅读进度: ${progressPercent}%</span>` : ''}
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.openNovel(novel, progress ? progress.chapterIndex : 0);
        });
        
        return card;
    }

    /**
     * 渲染空状态
     */
    renderEmptyState() {
        this.novelGrid.innerHTML = `
            <div class="empty-state">
                <h3>暂无小说</h3>
                <p>请在novel文件夹中放入txt格式的小说文件</p>
                <p>或点击下方按钮手动选择文件</p>
                <button class="btn btn-primary" onclick="app.showFileSelector(true)">
                    选择文件
                </button>
                <details style="margin-top: 20px; text-align: left;">
                    <summary style="cursor: pointer; color: #666;">故障排除</summary>
                    <div style="margin-top: 10px; font-size: 14px; color: #888;">
                        <p>可能的原因：</p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>novel文件夹中没有txt文件</li>
                            <li>文件名包含特殊字符</li>
                            <li>服务器权限问题</li>
                            <li>CORS策略限制</li>
                        </ul>
                        <p>建议：</p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>确保文件名为英文或中文，不含空格</li>
                            <li>检查浏览器控制台的错误信息</li>
                            <li>使用本地服务器运行（如Python）</li>
                        </ul>
                    </div>
                </details>
            </div>
        `;
    }

    /**
     * 打开小说
     * @param {Object} novel - 小说信息
     * @param {number} chapterIndex - 章节索引
     */
    openNovel(novel, chapterIndex = 0) {
        this.currentView = 'reader';
        window.reader.showReader(novel, chapterIndex);
    }

    /**
     * 显示搜索模态框
     */
    showSearchModal() {
        this.searchModal.classList.remove('hidden');
        this.searchInput.focus();
    }

    /**
     * 隐藏搜索模态框
     */
    hideSearchModal() {
        this.searchModal.classList.add('hidden');
        this.searchInput.value = '';
        this.searchResults.innerHTML = '';
    }

    /**
     * 执行搜索
     */
    performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.showNotification('请输入搜索关键词');
            return;
        }
        
        const results = this.searchNovels(query);
        this.renderSearchResults(results);
    }

    /**
     * 搜索小说
     * @param {string} query - 搜索关键词
     * @returns {Array} 搜索结果
     */
    searchNovels(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        this.novels.forEach(novel => {
            let score = 0;
            let matchedFields = [];
            
            // 搜索标题
            if (novel.title.toLowerCase().includes(lowerQuery)) {
                score += 10;
                matchedFields.push('标题');
            }
            
            // 搜索作者
            if (novel.author && novel.author.toLowerCase().includes(lowerQuery)) {
                score += 8;
                matchedFields.push('作者');
            }
            
            // 搜索简介
            if (novel.summary && novel.summary.toLowerCase().includes(lowerQuery)) {
                score += 5;
                matchedFields.push('简介');
            }
            
            // 搜索章节标题
            const chapterMatches = novel.chapters.filter(chapter => 
                chapter.title.toLowerCase().includes(lowerQuery)
            );
            
            if (chapterMatches.length > 0) {
                score += chapterMatches.length * 2;
                matchedFields.push(`章节(${chapterMatches.length}个)`);
            }
            
            if (score > 0) {
                results.push({
                    novel,
                    score,
                    matchedFields,
                    chapterMatches
                });
            }
        });
        
        // 按相关性排序
        results.sort((a, b) => b.score - a.score);
        
        return results;
    }

    /**
     * 渲染搜索结果
     * @param {Array} results - 搜索结果
     */
    renderSearchResults(results) {
        this.searchResults.innerHTML = '';
        
        if (results.length === 0) {
            this.searchResults.innerHTML = `
                <div class="no-results">
                    <p>未找到相关小说</p>
                </div>
            `;
            return;
        }
        
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            
            resultItem.innerHTML = `
                <h4>${result.novel.title}</h4>
                <p class="author">作者: ${result.novel.author || '未知'}</p>
                <p class="match-info">匹配: ${result.matchedFields.join(', ')}</p>
            `;
            
            resultItem.addEventListener('click', () => {
                this.hideSearchModal();
                
                // 如果有章节匹配，打开第一个匹配的章节
                if (result.chapterMatches.length > 0) {
                    const chapterIndex = result.novel.chapters.findIndex(
                        ch => ch.title === result.chapterMatches[0].title
                    );
                    this.openNovel(result.novel, chapterIndex);
                } else {
                    this.openNovel(result.novel);
                }
            });
            
            this.searchResults.appendChild(resultItem);
        });
    }

    /**
     * 显示设置模态框
     */
    showSettingsModal() {
        this.settingsModal.classList.remove('hidden');
    }

    /**
     * 隐藏设置模态框
     */
    hideSettingsModal() {
        this.settingsModal.classList.add('hidden');
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * 设置主题
     * @param {string} theme - 主题名称
     */
    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        window.storage.saveSettings({ theme });
        
        // 更新主题按钮状态
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 更新设置
     * @param {string} key - 设置键
     * @param {any} value - 设置值
     */
    updateSetting(key, value) {
        window.storage.saveSettings({ [key]: value });
        
        // 如果阅读器正在显示，立即应用设置
        if (this.currentView === 'reader') {
            window.reader.applyReadingSettings();
        }
    }

    /**
     * 显示文件选择器
     * @param {boolean} autoOpen - 是否自动打开文件选择器
     */
    showFileSelector(autoOpen = true) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.multiple = true;
        
        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            
            for (const file of files) {
                try {
                    const content = await this.readFileContent(file);
                    await this.parseNovelFile({
                        name: file.name,
                        content: content,
                        size: content.length,
                        lastModified: file.lastModified
                    });
                } catch (error) {
                    console.error(`读取文件失败: ${file.name}`, error);
                }
            }
            
            this.renderNovelList();
        });
        
        // 只有在明确要求时才自动打开文件选择器
        // 并且确保页面不在加载状态
        if (autoOpen && !this.isPageLoading) {
            input.click();
        }
    }

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文件内容
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'utf-8');
        });
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        this.novelGrid.innerHTML = '<div class="loading"></div>';
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        // 由渲染方法处理
    }

    /**
     * 显示错误信息
     * @param {string} message - 错误信息
     */
    showError(message) {
        this.novelGrid.innerHTML = `
            <div class="error-state">
                <h3>加载失败</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="app.loadNovels()">
                    重试
                </button>
            </div>
        `;
    }

    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background-color: ${type === 'warning' ? '#ff9800' : '#4caf50'};
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 3000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// 创建全局应用实例
window.app = new NovelReaderApp();