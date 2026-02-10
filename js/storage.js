/**
 * 本地存储模块
 * 负责管理阅读进度、用户设置等数据的本地存储
 */
class StorageManager {
    constructor() {
        this.prefix = 'novelReader_';
        this.version = '1.0.0';
    }

    /**
     * 获取完整的存储键名
     * @param {string} key - 原始键名
     * @returns {string} 带前缀的键名
     */
    getKey(key) {
        return `${this.prefix}${key}`;
    }

    /**
     * 存储数据
     * @param {string} key - 键名
     * @param {any} value - 要存储的值
     */
    set(key, value) {
        try {
            const data = {
                version: this.version,
                timestamp: Date.now(),
                value: value
            };
            localStorage.setItem(this.getKey(key), JSON.stringify(data));
        } catch (error) {
            console.warn('存储数据失败:', error);
        }
    }

    /**
     * 获取数据
     * @param {string} key - 键名
     * @param {any} defaultValue - 默认值
     * @returns {any} 存储的值或默认值
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.getKey(key));
            if (!item) return defaultValue;
            
            const data = JSON.parse(item);
            
            // 检查版本兼容性
            if (data.version !== this.version) {
                console.warn('存储数据版本不匹配，使用默认值');
                this.remove(key);
                return defaultValue;
            }
            
            return data.value;
        } catch (error) {
            console.warn('获取数据失败:', error);
            return defaultValue;
        }
    }

    /**
     * 删除数据
     * @param {string} key - 键名
     */
    remove(key) {
        try {
            localStorage.removeItem(this.getKey(key));
        } catch (error) {
            console.warn('删除数据失败:', error);
        }
    }

    /**
     * 清空所有应用数据
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('清空数据失败:', error);
        }
    }

    /**
     * 保存阅读进度
     * @param {string} novelId - 小说ID
     * @param {number} chapterIndex - 章节索引
     * @param {number} scrollPosition - 滚动位置
     * @param {number} progress - 进度百分比
     */
    saveReadingProgress(novelId, chapterIndex, scrollPosition = 0, progress = 0) {
        const progressData = this.get('readingProgress', {});
        progressData[novelId] = {
            chapterIndex,
            scrollPosition,
            progress,
            lastReadTime: Date.now()
        };
        this.set('readingProgress', progressData);
    }

    /**
     * 获取阅读进度
     * @param {string} novelId - 小说ID
     * @returns {Object|null} 阅读进度信息
     */
    getReadingProgress(novelId) {
        const progress = this.get('readingProgress', {});
        return progress[novelId] || null;
    }

    /**
     * 保存用户设置
     * @param {Object} settings - 设置对象
     */
    saveSettings(settings) {
        const currentSettings = this.getSettings();
        const newSettings = { ...currentSettings, ...settings };
        this.set('settings', newSettings);
    }

    /**
     * 获取用户设置
     * @returns {Object} 设置对象
     */
    getSettings() {
        return this.get('settings', {
            theme: 'light',
            fontSize: 16,
            lineHeight: 1.6,
            fontFamily: 'system-ui',
            paragraphSpacing: 1.0,
            textAlign: 'justify',
            textIndent: '2em',
            enableLigatures: true,
            enableKerning: true,
            enableSmoothFont: true,
            autoBookmark: true,
            fullscreen: false
        });
    }

    /**
     * 保存书签
     * @param {string} novelId - 小说ID
     * @param {Object} bookmark - 书签信息
     */
    saveBookmark(novelId, bookmark) {
        const bookmarks = this.getBookmarks(novelId);
        const bookmarkId = Date.now().toString();
        bookmarks[bookmarkId] = {
            ...bookmark,
            id: bookmarkId,
            createTime: Date.now()
        };
        this.set(`bookmarks_${novelId}`, bookmarks);
        return bookmarkId;
    }

    /**
     * 获取小说的所有书签
     * @param {string} novelId - 小说ID
     * @returns {Object} 书签对象
     */
    getBookmarks(novelId) {
        return this.get(`bookmarks_${novelId}`, {});
    }

    /**
     * 删除书签
     * @param {string} novelId - 小说ID
     * @param {string} bookmarkId - 书签ID
     */
    removeBookmark(novelId, bookmarkId) {
        const bookmarks = this.getBookmarks(novelId);
        if (bookmarks[bookmarkId]) {
            delete bookmarks[bookmarkId];
            this.set(`bookmarks_${novelId}`, bookmarks);
        }
    }

    /**
     * 保存小说信息缓存
     * @param {string} novelId - 小说ID
     * @param {Object} novelInfo - 小说信息
     */
    saveNovelInfo(novelId, novelInfo) {
        this.set(`novel_${novelId}`, novelInfo);
    }

    /**
     * 获取小说信息缓存
     * @param {string} novelId - 小说ID
     * @returns {Object|null} 小说信息
     */
    getNovelInfo(novelId) {
        return this.get(`novel_${novelId}`);
    }

    /**
     * 保存章节内容缓存
     * @param {string} novelId - 小说ID
     * @param {number} chapterIndex - 章节索引
     * @param {string} content - 章节内容
     */
    saveChapterContent(novelId, chapterIndex, content) {
        const chapters = this.get(`chapters_${novelId}`, {});
        chapters[chapterIndex] = {
            content,
            cacheTime: Date.now()
        };
        this.set(`chapters_${novelId}`, chapters);
    }

    /**
     * 获取章节内容缓存
     * @param {string} novelId - 小说ID
     * @param {number} chapterIndex - 章节索引
     * @returns {string|null} 章节内容
     */
    getChapterContent(novelId, chapterIndex) {
        const chapters = this.get(`chapters_${novelId}`, {});
        const chapter = chapters[chapterIndex];
        
        // 检查缓存是否过期（7天）
        if (chapter && Date.now() - chapter.cacheTime < 7 * 24 * 60 * 60 * 1000) {
            return chapter.content;
        }
        
        return null;
    }

    /**
     * 清理过期的缓存数据
     */
    cleanExpiredCache() {
        try {
            const keys = Object.keys(localStorage);
            const now = Date.now();
            const expireTime = 7 * 24 * 60 * 60 * 1000; // 7天

            keys.forEach(key => {
                if (key.startsWith(this.prefix) && key.includes('chapters_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data && now - data.timestamp > expireTime) {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        // 清理损坏的数据
                        localStorage.removeItem(key);
                    }
                }
            });
        } catch (error) {
            console.warn('清理缓存失败:', error);
        }
    }

    /**
     * 获取存储使用情况
     * @returns {Object} 存储统计信息
     */
    getStorageInfo() {
        try {
            let totalSize = 0;
            let itemCount = 0;
            const keys = Object.keys(localStorage);

            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    const size = localStorage.getItem(key).length;
                    totalSize += size;
                    itemCount++;
                }
            });

            return {
                itemCount,
                totalSize: (totalSize / 1024).toFixed(2) + ' KB',
                maxSize: '5 MB', // localStorage通常限制为5MB
                usagePercent: Math.min((totalSize / (5 * 1024 * 1024)) * 100, 100).toFixed(2)
            };
        } catch (error) {
            console.warn('获取存储信息失败:', error);
            return {
                itemCount: 0,
                totalSize: '0 KB',
                maxSize: '5 MB',
                usagePercent: '0'
            };
        }
    }
}

// 创建全局存储管理器实例
window.storage = new StorageManager();

// 页面加载时清理过期缓存
document.addEventListener('DOMContentLoaded', () => {
    window.storage.cleanExpiredCache();
});