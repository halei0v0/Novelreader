/**
 * 阅读器核心模块
 * 负责阅读界面的交互和内容展示
 */
class NovelReader {
    constructor() {
        this.currentNovel = null;
        this.currentChapter = null;
        this.currentChapterIndex = 0;
        this.isFullscreen = false;
        this.bookmarks = new Map();
        this.saveProgressTimeout = null;
        
        this.initElements();
        this.initEvents();
    }

    /**
     * 初始化DOM元素
     */
    initElements() {
        // 阅读器相关元素
        this.readerSection = document.getElementById('reader');
        this.novelTitle = document.getElementById('novelTitle');
        this.chapterTitle = document.getElementById('chapterTitle');
        this.chapterContent = document.getElementById('chapterContent');
        this.chapterList = document.getElementById('chapterList');
        this.chapterNav = document.getElementById('chapterNav');
        
        // 控制按钮
        this.backBtn = document.getElementById('backBtn');
        this.prevChapterBtn = document.getElementById('prevChapter');
        this.nextChapterBtn = document.getElementById('nextChapter');
        this.bookmarkBtn = document.getElementById('bookmarkBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.closeNavBtn = document.getElementById('closeNavBtn');
        
        // 进度显示
        this.progressText = document.getElementById('progressText');
        this.progressFill = document.getElementById('progressFill');
    }

    /**
     * 初始化事件监听
     */
    initEvents() {
        // 返回按钮
        this.backBtn.addEventListener('click', () => {
            this.hideReader();
        });

        // 章节导航
        this.prevChapterBtn.addEventListener('click', () => {
            this.loadPreviousChapter();
        });

        this.nextChapterBtn.addEventListener('click', () => {
            this.loadNextChapter();
        });

        // 书签功能
        this.bookmarkBtn.addEventListener('click', () => {
            this.toggleBookmark();
        });

        // 全屏功能
        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 章节导航开关
        this.closeNavBtn.addEventListener('click', () => {
            this.toggleChapterNav(false);
        });

        // 滚动事件
        this.chapterContent.addEventListener('scroll', () => {
            this.updateReadingProgress();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (this.readerSection.classList.contains('hidden')) return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    this.loadPreviousChapter();
                    break;
                case 'ArrowRight':
                    this.loadNextChapter();
                    break;
                case 'Escape':
                    if (this.isFullscreen) {
                        this.toggleFullscreen();
                    } else {
                        this.hideReader();
                    }
                    break;
                case 'b':
                case 'B':
                    this.toggleBookmark();
                    break;
                case 'f':
                case 'F':
                    this.toggleFullscreen();
                    break;
            }
        });

        // 触摸手势支持
        let touchStartX = 0;
        let touchEndX = 0;

        this.chapterContent.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        this.chapterContent.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        });
    }

    /**
     * 显示阅读器
     * @param {Object} novel - 小说信息
     * @param {number} chapterIndex - 章节索引
     */
    showReader(novel, chapterIndex = 0) {
        this.currentNovel = novel;
        this.currentChapterIndex = chapterIndex;
        
        // 显示阅读器界面
        document.getElementById('novelList').classList.add('hidden');
        this.readerSection.classList.remove('hidden');
        
        // 设置小说信息
        this.novelTitle.textContent = novel.title;
        
        // 加载章节数据
        this.loadChapterList();
        this.loadChapter(chapterIndex);
        
        // 加载书签
        this.loadBookmarks();
        
        // 恢复阅读设置
        this.applyReadingSettings();
        
        // 更新书签状态
        this.updateBookmarkStatus();
    }

    /**
     * 隐藏阅读器
     */
    hideReader() {
        // 清除防抖定时器并立即保存进度
        if (this.saveProgressTimeout) {
            clearTimeout(this.saveProgressTimeout);
            this.saveProgressTimeout = null;
        }
        this.saveReadingProgress();
        
        // 隐藏阅读器
        this.readerSection.classList.add('hidden');
        document.getElementById('novelList').classList.remove('hidden');
        
        // 重置状态
        this.currentNovel = null;
        this.currentChapter = null;
        this.currentChapterIndex = 0;
        
        // 退出全屏
        if (this.isFullscreen) {
            this.toggleFullscreen();
        }
    }

    /**
     * 加载章节列表
     */
    loadChapterList() {
        this.chapterList.innerHTML = '';
        
        this.currentNovel.chapters.forEach((chapter, index) => {
            const chapterItem = document.createElement('div');
            chapterItem.className = 'chapter-item';
            chapterItem.textContent = `第${chapter.number}章 ${chapter.title}`;
            chapterItem.dataset.index = index;
            
            if (index === this.currentChapterIndex) {
                chapterItem.classList.add('active');
            }
            
            chapterItem.addEventListener('click', () => {
                this.loadChapter(index);
            });
            
            this.chapterList.appendChild(chapterItem);
        });
    }

    /**
     * 加载章节内容
     * @param {number} chapterIndex - 章节索引
     */
    async loadChapter(chapterIndex) {
        if (chapterIndex < 0 || chapterIndex >= this.currentNovel.chapters.length) {
            return;
        }

        // 保存当前章节的阅读进度
        if (this.currentChapter !== null) {
            this.saveReadingProgress();
        }

        this.currentChapterIndex = chapterIndex;
        const chapter = this.currentNovel.chapters[chapterIndex];
        
        // 显示加载状态
        this.showChapterLoading();
        
        try {
            // 尝试从缓存获取章节内容
            let content = window.storage.getChapterContent(this.currentNovel.id, chapterIndex);
            
            if (!content) {
                // 如果没有缓存，需要从完整小说数据中获取
                // 这里假设我们有完整的章节数据
                content = chapter.content || '';
                
                // 缓存章节内容
                if (content) {
                    window.storage.saveChapterContent(this.currentNovel.id, chapterIndex, content);
                }
            }
            
            // 更新章节信息
            this.chapterTitle.textContent = `第${chapter.number}章 ${chapter.title}`;
            this.renderChapterContent(content);
            
            // 更新章节列表激活状态
            this.updateChapterActiveState(chapterIndex);
            
            // 更新按钮状态
            this.updateNavigationButtons();
            
            // 恢复滚动位置
            this.restoreScrollPosition();
            
            // 更新书签状态
            this.updateBookmarkStatus();
            
        } catch (error) {
            console.error('加载章节失败:', error);
            this.showChapterError();
        }
    }

    /**
     * 渲染章节内容
     * @param {string} content - 章节内容
     */
    renderChapterContent(content) {
        if (!content) {
            this.showChapterError();
            return;
        }

        // 将内容按段落分割并处理
        const paragraphs = content.split('\n');
        let htmlContent = '';
        let isFirstParagraph = true;

        paragraphs.forEach((paragraph, index) => {
            const trimmedParagraph = paragraph.trim();
            
            // 保留空行作为段落间距
            if (!trimmedParagraph) {
                htmlContent += '<p class="empty-paragraph">&nbsp;</p>';
                return;
            }

            // 检查是否是章节分隔符
            if (trimmedParagraph.match(/^={3,}$/)) {
                htmlContent += '<div class="scene-break">◇ ◇ ◇</div>';
                return;
            }

            // 检查是否是对话（多种引号格式）
            if (trimmedParagraph.match(/^[""].*[""]$/) || 
                trimmedParagraph.match(/^[""].*[""]$/) ||
                trimmedParagraph.match(/^「.*」$/) ||
                trimmedParagraph.match(/^『.*』$/)) {
                htmlContent += `<p class="dialogue">${this.escapeHtml(trimmedParagraph)}</p>`;
                return;
            }

            // 检查是否是章节内小标题
            if (trimmedParagraph.match(/^第.*节/) || 
                trimmedParagraph.match(/^【.*】$/) ||
                trimmedParagraph.match(/^\*.*\*$/)) {
                htmlContent += `<p class="chapter-title-inline">${this.escapeHtml(trimmedParagraph)}</p>`;
                return;
            }

            // 处理普通段落
            let paragraphClass = isFirstParagraph ? 'first-paragraph' : '';
            
            // 处理段落中的特殊格式，保留原始空格
            let processedParagraph = this.processParagraphText(paragraph);
            
            htmlContent += `<p class="${paragraphClass}">${processedParagraph}</p>`;
            
            isFirstParagraph = false;
        });

        this.chapterContent.innerHTML = htmlContent;
        
        // 滚动到顶部
        this.chapterContent.scrollTop = 0;
    }

    /**
     * 处理段落文本中的特殊格式
     * @param {string} text - 原始文本
     * @returns {string} 处理后的HTML
     */
    processParagraphText(text) {
        let processed = this.escapeHtml(text);
        
        // 处理强调文本（*文本*）
        processed = processed.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        
        // 处理加粗文本（**文本**）
        processed = processed.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        
        // 处理删除线（~~文本~~）
        processed = processed.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
        
        // 处理下划线（__文本__）
        processed = processed.replace(/__([^_\n]+)__/g, '<u>$1</u>');
        
        // 处理空格（保留所有空格，转换为HTML实体）
        processed = processed.replace(/ /g, ' &nbsp;');
        
        // 修复段落开头可能产生的多余空格
        processed = processed.replace(/^(&nbsp;)+/, '');
        
        return processed;
    }

    /**
     * HTML转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 显示章节加载状态
     */
    showChapterLoading() {
        this.chapterContent.innerHTML = '<div class="loading"></div>';
    }

    /**
     * 显示章节加载错误
     */
    showChapterError() {
        this.chapterContent.innerHTML = `
            <div class="chapter-error">
                <p>章节内容加载失败</p>
                <button class="btn btn-small" onclick="window.reader.loadChapter(${this.currentChapterIndex})">
                    重试
                </button>
            </div>
        `;
    }

    /**
     * 加载上一章
     */
    loadPreviousChapter() {
        if (this.currentChapterIndex > 0) {
            this.loadChapter(this.currentChapterIndex - 1);
        }
    }

    /**
     * 加载下一章
     */
    loadNextChapter() {
        if (this.currentChapterIndex < this.currentNovel.chapters.length - 1) {
            this.loadChapter(this.currentChapterIndex + 1);
        }
    }

    /**
     * 更新章节激活状态
     * @param {number} activeIndex - 激活的章节索引
     */
    updateChapterActiveState(activeIndex) {
        const chapterItems = this.chapterList.querySelectorAll('.chapter-item');
        chapterItems.forEach((item, index) => {
            if (index === activeIndex) {
                item.classList.add('active');
                // 滚动到激活的章节
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * 更新导航按钮状态
     */
    updateNavigationButtons() {
        this.prevChapterBtn.disabled = this.currentChapterIndex === 0;
        this.nextChapterBtn.disabled = this.currentChapterIndex === this.currentNovel.chapters.length - 1;
    }

    /**
     * 切换书签
     */
    toggleBookmark() {
        const bookmarkId = `${this.currentNovel.id}_${this.currentChapterIndex}`;
        const scrollPosition = this.chapterContent.scrollTop;
        
        if (this.bookmarks.has(bookmarkId)) {
            // 移除书签
            window.storage.removeBookmark(this.currentNovel.id, bookmarkId);
            this.bookmarks.delete(bookmarkId);
            this.showNotification('书签已移除');
        } else {
            // 添加书签
            const bookmark = {
                chapterIndex: this.currentChapterIndex,
                chapterTitle: this.currentNovel.chapters[this.currentChapterIndex].title,
                scrollPosition: scrollPosition,
                note: ''
            };
            
            window.storage.saveBookmark(this.currentNovel.id, bookmark);
            this.bookmarks.set(bookmarkId, bookmark);
            this.showNotification('书签已添加');
        }
        
        this.updateBookmarkStatus();
    }

    /**
     * 更新书签状态
     */
    updateBookmarkStatus() {
        const bookmarkId = `${this.currentNovel.id}_${this.currentChapterIndex}`;
        const hasBookmark = this.bookmarks.has(bookmarkId);
        
        if (hasBookmark) {
            this.bookmarkBtn.classList.add('active');
            this.bookmarkBtn.title = '移除书签';
        } else {
            this.bookmarkBtn.classList.remove('active');
            this.bookmarkBtn.title = '添加书签';
        }
    }

    /**
     * 加载书签
     */
    loadBookmarks() {
        this.bookmarks.clear();
        const bookmarks = window.storage.getBookmarks(this.currentNovel.id);
        
        Object.values(bookmarks).forEach(bookmark => {
            const bookmarkId = `${this.currentNovel.id}_${bookmark.chapterIndex}`;
            this.bookmarks.set(bookmarkId, bookmark);
        });
    }

    /**
     * 切换全屏模式
     */
    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        
        if (this.isFullscreen) {
            document.body.classList.add('fullscreen');
            this.fullscreenBtn.title = '退出全屏';
        } else {
            document.body.classList.remove('fullscreen');
            this.fullscreenBtn.title = '全屏';
        }
        
        // 保存设置
        window.storage.saveSettings({ fullscreen: this.isFullscreen });
    }

    /**
     * 切换章节导航
     * @param {boolean} show - 是否显示
     */
    toggleChapterNav(show) {
        if (show === undefined) {
            this.chapterNav.classList.toggle('open');
        } else {
            if (show) {
                this.chapterNav.classList.add('open');
            } else {
                this.chapterNav.classList.remove('open');
            }
        }
    }

    /**
     * 更新阅读进度
     */
    updateReadingProgress() {
        if (!this.currentNovel || this.currentChapterIndex === null) return;
        
        const scrollTop = this.chapterContent.scrollTop;
        const scrollHeight = this.chapterContent.scrollHeight;
        const clientHeight = this.chapterContent.clientHeight;
        
        if (scrollHeight > clientHeight) {
            const progress = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
            this.progressText.textContent = `${progress}%`;
            this.progressFill.style.width = `${progress}%`;
            
            // 使用防抖保存阅读进度
            this.debounceSaveProgress();
        }
    }

    /**
     * 防抖保存阅读进度
     */
    debounceSaveProgress() {
        if (this.saveProgressTimeout) {
            clearTimeout(this.saveProgressTimeout);
        }
        
        this.saveProgressTimeout = setTimeout(() => {
            this.saveReadingProgress();
        }, 500); // 500ms防抖延迟
    }

    /**
     * 保存阅读进度
     */
    saveReadingProgress() {
        if (this.currentNovel && this.currentChapterIndex >= 0) {
            const scrollPosition = this.chapterContent.scrollTop;
            const scrollHeight = this.chapterContent.scrollHeight;
            const clientHeight = this.chapterContent.clientHeight;
            
            // 计算更精确的进度信息
            const progress = scrollHeight > clientHeight ? 
                Math.round((scrollPosition / (scrollHeight - clientHeight)) * 100) : 0;
            
            window.storage.saveReadingProgress(
                this.currentNovel.id,
                this.currentChapterIndex,
                scrollPosition,
                progress
            );
        }
    }

    /**
     * 恢复滚动位置
     */
    restoreScrollPosition() {
        const progress = window.storage.getReadingProgress(this.currentNovel.id);
        if (progress && progress.chapterIndex === this.currentChapterIndex) {
            // 延迟恢复滚动位置，确保内容已渲染
            setTimeout(() => {
                this.chapterContent.scrollTop = progress.scrollPosition || 0;
            }, 100);
        }
    }

    /**
     * 应用阅读设置
     */
    applyReadingSettings() {
        const settings = window.storage.getSettings();
        
        // 应用主题
        document.body.setAttribute('data-theme', settings.theme);
        
        // 应用字体设置
        this.chapterContent.style.fontSize = `${settings.fontSize || 16}px`;
        this.chapterContent.style.lineHeight = settings.lineHeight || 1.6;
        this.chapterContent.style.fontFamily = settings.fontFamily || 'system-ui';
        
        // 应用段落间距
        const paragraphSpacing = settings.paragraphSpacing || 1.0;
        this.chapterContent.style.setProperty('--paragraph-spacing', `${paragraphSpacing}em`);
        
        // 应用文本对齐
        this.chapterContent.className = this.chapterContent.className.replace(/text-\w+/g, '');
        this.chapterContent.classList.add(`text-${settings.textAlign || 'justify'}`);
        
        // 应用首行缩进
        this.chapterContent.className = this.chapterContent.className.replace(/indent-\w+/g, '');
        const indentClass = this.getIndentClass(settings.textIndent || '2em');
        this.chapterContent.classList.add(indentClass);
        
        // 应用排版增强
        this.applyTypographyEnhancements(settings);
        
        // 恢复全屏状态
        if (settings.fullscreen && !this.isFullscreen) {
            this.toggleFullscreen();
        }
    }

    /**
     * 获取首行缩进类名
     * @param {string} indentValue - 缩进值
     * @returns {string} CSS类名
     */
    getIndentClass(indentValue) {
        switch (indentValue) {
            case '0': return 'indent-none';
            case '1.5em': return 'indent-small';
            case '2em': 
            default: return 'indent-normal';
        }
    }

    /**
     * 应用排版增强功能
     * @param {Object} settings - 设置对象
     */
    applyTypographyEnhancements(settings) {
        // 移除现有的增强类
        this.chapterContent.classList.remove('enhanced-ligatures', 'enhanced-kerning', 'enhanced-smooth');
        
        // 添加增强类
        if (settings.enableLigatures !== false) {
            this.chapterContent.classList.add('enhanced-ligatures');
        }
        
        if (settings.enableKerning !== false) {
            this.chapterContent.classList.add('enhanced-kerning');
        }
        
        if (settings.enableSmoothFont !== false) {
            this.chapterContent.classList.add('enhanced-smooth');
        }
    }

    /**
     * 处理滑动手势
     * @param {number} startX - 开始位置
     * @param {number} endX - 结束位置
     */
    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // 向左滑动 - 下一章
                this.loadNextChapter();
            } else {
                // 向右滑动 - 上一章
                this.loadPreviousChapter();
            }
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知消息
     */
    showNotification(message) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--accent-primary);
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 3000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }

    /**
     * 获取当前阅读状态
     * @returns {Object} 阅读状态
     */
    getReadingState() {
        return {
            novel: this.currentNovel,
            chapterIndex: this.currentChapterIndex,
            scrollPosition: this.chapterContent.scrollTop,
            isFullscreen: this.isFullscreen
        };
    }
}

// 创建全局阅读器实例
window.reader = new NovelReader();