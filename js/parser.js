/**
 * 小说文件解析模块
 * 负责解析txt文件，提取元数据和章节信息
 */
class NovelParser {
    constructor() {
        this.chapterRegex = /^第(\d+)章\s*(.+)$/;
        this.authorRegex = /^label_author(.+)$/;
        this.summaryRegex = /^简介:\s*$/;
        this.separatorRegex = /^={3,}$/;
    }

    /**
     * 解析小说文件内容
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @returns {Object} 解析后的小说信息
     */
    parseNovel(content, filename) {
        const lines = content.split('\n');
        const novel = {
            id: this.generateId(filename),
            filename: filename,
            title: '',
            author: '',
            summary: '',
            chapters: [],
            totalChapters: 0,
            wordCount: 0,
            parseTime: Date.now()
        };

        let currentChapter = null;
        let inSummary = false;
        let summaryLines = [];
        let lineIndex = 0;

        // 解析文件头部信息
        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            
            if (!line) {
                lineIndex++;
                continue;
            }

            // 解析标题
            if (!novel.title) {
                novel.title = line;
                lineIndex++;
                continue;
            }

            // 解析作者
            if (!novel.author && this.authorRegex.test(line)) {
                novel.author = line.match(this.authorRegex)[1];
                lineIndex++;
                continue;
            }

            // 解析简介
            if (!novel.summary && this.summaryRegex.test(line)) {
                inSummary = true;
                lineIndex++;
                continue;
            }

            if (inSummary) {
                if (this.separatorRegex.test(line)) {
                    // 简介结束
                    novel.summary = summaryLines.join('\n').trim();
                    inSummary = false;
                    lineIndex++;
                    break;
                } else {
                    summaryLines.push(line);
                }
            }

            lineIndex++;
        }

        // 如果没有找到简介分隔符，将已收集的行作为简介
        if (inSummary && summaryLines.length > 0) {
            novel.summary = summaryLines.join('\n').trim();
        }

        // 解析章节
        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            
            // 检查是否是章节标题
            const chapterMatch = this.chapterRegex.exec(line);
            if (chapterMatch) {
                // 保存上一个章节
                if (currentChapter) {
                    novel.chapters.push(currentChapter);
                }

                // 创建新章节
                currentChapter = {
                    index: novel.chapters.length,
                    number: parseInt(chapterMatch[1]),
                    title: chapterMatch[2],
                    content: '',
                    wordCount: 0
                };
            } else if (currentChapter) {
                // 添加章节内容
                if (line) {
                    currentChapter.content += line + '\n';
                    currentChapter.wordCount++;
                }
            }

            lineIndex++;
        }

        // 添加最后一个章节
        if (currentChapter) {
            novel.chapters.push(currentChapter);
        }

        // 计算统计信息
        novel.totalChapters = novel.chapters.length;
        novel.wordCount = novel.chapters.reduce((total, chapter) => total + chapter.wordCount, 0);

        // 清理章节内容
        novel.chapters.forEach(chapter => {
            chapter.content = this.cleanContent(chapter.content);
        });

        return novel;
    }

    /**
     * 清理章节内容
     * @param {string} content - 原始内容
     * @returns {string} 清理后的内容
     */
    cleanContent(content) {
        return content
            .replace(/ +/g, ' ')  // 合并多个空格，但保留单个空格
            .replace(/\n{3,}/g, '\n\n') // 最多保留两个连续换行
            .replace(/^\n+|\n+$/g, '') // 去除首尾换行
            .trim();
    }

    /**
     * 生成小说ID
     * @param {string} filename - 文件名
     * @returns {string} 小说ID
     */
    generateId(filename) {
        // 移除文件扩展名并转换为小写
        const baseName = filename.replace(/\.[^/.]+$/, '').toLowerCase();
        // 简单的哈希函数
        let hash = 0;
        for (let i = 0; i < baseName.length; i++) {
            const char = baseName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 分块读取大文件
     * @param {File} file - 文件对象
     * @param {number} chunkSize - 块大小
     * @returns {Promise<string>} 文件内容
     */
    async readFileInChunks(file, chunkSize = 1024 * 1024) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            let content = '';
            let offset = 0;

            reader.onload = (e) => {
                content += e.target.result;
                offset += chunkSize;

                if (offset < file.size) {
                    readNextChunk();
                } else {
                    resolve(content);
                }
            };

            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };

            function readNextChunk() {
                const blob = file.slice(offset, offset + chunkSize);
                reader.readAsText(blob, 'utf-8');
            }

            readNextChunk();
        });
    }

    /**
     * 快速解析小说（仅解析元数据和章节标题）
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @returns {Object} 基础小说信息
     */
    quickParse(content, filename) {
        const lines = content.split('\n');
        const novel = {
            id: this.generateId(filename),
            filename: filename,
            title: '',
            author: '',
            summary: '',
            chapters: [],
            totalChapters: 0,
            parseTime: Date.now()
        };

        let inSummary = false;
        let summaryLines = [];
        let chapterIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) continue;

            // 解析标题
            if (!novel.title) {
                novel.title = line;
                continue;
            }

            // 解析作者
            if (!novel.author && this.authorRegex.test(line)) {
                novel.author = line.match(this.authorRegex)[1];
                continue;
            }

            // 解析简介
            if (!novel.summary && this.summaryRegex.test(line)) {
                inSummary = true;
                continue;
            }

            if (inSummary) {
                if (this.separatorRegex.test(line)) {
                    novel.summary = summaryLines.join('\n').trim();
                    inSummary = false;
                } else {
                    summaryLines.push(line);
                }
                continue;
            }

            // 解析章节标题
            const chapterMatch = this.chapterRegex.exec(line);
            if (chapterMatch) {
                novel.chapters.push({
                    index: chapterIndex++,
                    number: parseInt(chapterMatch[1]),
                    title: chapterMatch[2]
                });
            }
        }

        if (inSummary && summaryLines.length > 0) {
            novel.summary = summaryLines.join('\n').trim();
        }

        novel.totalChapters = novel.chapters.length;
        return novel;
    }

    /**
     * 验证小说文件格式
     * @param {string} content - 文件内容
     * @returns {Object} 验证结果
     */
    validateFormat(content) {
        const lines = content.split('\n');
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        let hasTitle = false;
        let hasAuthor = false;
        let hasSummary = false;
        let hasChapters = false;
        let chapterCount = 0;

        for (let i = 0; i < Math.min(lines.length, 100); i++) {
            const line = lines[i].trim();
            
            if (!line) continue;

            // 检查标题
            if (!hasTitle && i === 0) {
                hasTitle = true;
                continue;
            }

            // 检查作者
            if (!hasAuthor && this.authorRegex.test(line)) {
                hasAuthor = true;
                continue;
            }

            // 检查简介
            if (!hasSummary && this.summaryRegex.test(line)) {
                hasSummary = true;
                continue;
            }

            // 检查章节
            const chapterMatch = this.chapterRegex.exec(line);
            if (chapterMatch) {
                hasChapters = true;
                chapterCount++;
            }
        }

        // 验证结果
        if (!hasTitle) {
            result.isValid = false;
            result.errors.push('缺少小说标题');
        }

        if (!hasAuthor) {
            result.warnings.push('缺少作者信息');
        }

        if (!hasSummary) {
            result.warnings.push('缺少简介信息');
        }

        if (!hasChapters) {
            result.isValid = false;
            result.errors.push('未找到章节内容');
        } else if (chapterCount < 2) {
            result.warnings.push('章节数量较少');
        }

        return result;
    }

    /**
     * 搜索章节内容
     * @param {Array} chapters - 章节数组
     * @param {string} keyword - 搜索关键词
     * @returns {Array} 搜索结果
     */
    searchInChapters(chapters, keyword) {
        const results = [];
        const regex = new RegExp(this.escapeRegex(keyword), 'gi');

        chapters.forEach((chapter, index) => {
            const matches = chapter.content.match(regex);
            if (matches && matches.length > 0) {
                // 获取匹配位置的上下文
                const context = this.getSearchContext(chapter.content, keyword, 50);
                results.push({
                    chapterIndex: index,
                    chapterTitle: chapter.title,
                    matchCount: matches.length,
                    context: context
                });
            }
        });

        return results;
    }

    /**
     * 获取搜索关键词的上下文
     * @param {string} content - 章节内容
     * @param {string} keyword - 关键词
     * @param {number} contextLength - 上下文长度
     * @returns {string} 上下文文本
     */
    getSearchContext(content, keyword, contextLength) {
        const index = content.toLowerCase().indexOf(keyword.toLowerCase());
        if (index === -1) return '';

        const start = Math.max(0, index - contextLength);
        const end = Math.min(content.length, index + keyword.length + contextLength);
        
        let context = content.substring(start, end);
        if (start > 0) context = '...' + context;
        if (end < content.length) context = context + '...';
        
        return context;
    }

    /**
     * 转义正则表达式特殊字符
     * @param {string} string - 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// 创建全局解析器实例
window.parser = new NovelParser();