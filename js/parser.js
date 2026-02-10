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

        // 从文件名提取标题（去掉扩展名）
        const baseTitle = filename.replace(/\.[^/.]+$/, '');
        novel.title = baseTitle;

        let currentChapter = null;
        let inSummary = false;
        let summaryLines = [];
        let lineIndex = 0;
        let foundValidContent = false;

        // 解析文件头部信息
        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            
            if (!line) {
                lineIndex++;
                continue;
            }

            foundValidContent = true;

            // 解析作者（多种格式）
            if (!novel.author) {
                const authorPatterns = [
                    /^作者[：:]\s*(.+)$/,
                    /^label_author(.+)$/,
                    /^author[：:]\s*(.+)$/i,
                    /^(.+)\s*著$/
                ];
                
                for (const pattern of authorPatterns) {
                    const match = pattern.exec(line);
                    if (match) {
                        novel.author = match[1].trim();
                        break;
                    }
                }
                
                if (novel.author) {
                    lineIndex++;
                    continue;
                }
            }

            // 解析简介（多种格式）
            if (!novel.summary && !inSummary) {
                const summaryPatterns = [
                    /^简介[：:]?\s*$/,
                    /^内容简介[：:]?\s*$/,
                    /^介绍[：:]?\s*$/,
                    /^summary[：:]?\s*$/i
                ];
                
                for (const pattern of summaryPatterns) {
                    if (pattern.test(line)) {
                        inSummary = true;
                        lineIndex++;
                        break;
                    }
                }
                
                if (inSummary) continue;
            }

            if (inSummary) {
                if (this.separatorRegex.test(line) || /^第[一二三四五六七八九十\d]+章/.test(line)) {
                    novel.summary = summaryLines.join('\n').trim();
                    inSummary = false;
                } else {
                    summaryLines.push(line);
                }
                lineIndex++;
                continue;
            }

            // 检查是否是章节标题（多种格式）
            const chapterPatterns = [
                /^第(\d+)章\s*(.+)$/,
                /^第([一二三四五六七八九十百千万]+)章\s*(.+)$/,
                /^(\d+)\.\s*(.+)$/,
                /^章节[：:]?\s*(.+)$/,
                /^(.+)\s*第[一二三四五六七八九十\d]+章/
            ];
            
            let isChapterTitle = false;
            for (const pattern of chapterPatterns) {
                const match = pattern.exec(line);
                if (match) {
                    isChapterTitle = true;
                    
                    // 保存上一个章节
                    if (currentChapter) {
                        currentChapter.content = this.cleanContent(currentChapter.content);
                        novel.chapters.push(currentChapter);
                    }

                    // 创建新章节
                    let chapterNumber, chapterTitle;
                    
                    if (pattern === chapterPatterns[0]) {
                        // 数字章节
                        chapterNumber = parseInt(match[1]);
                        chapterTitle = match[2];
                    } else if (pattern === chapterPatterns[1]) {
                        // 中文数字章节
                        chapterNumber = this.chineseNumberToArabic(match[1]);
                        chapterTitle = match[2];
                    } else if (pattern === chapterPatterns[2]) {
                        // 数字加点格式
                        chapterNumber = parseInt(match[1]);
                        chapterTitle = match[2];
                    } else {
                        // 其他格式
                        chapterNumber = novel.chapters.length + 1;
                        chapterTitle = match[1] || match[0];
                    }
                    
                    currentChapter = {
                        index: novel.chapters.length,
                        number: chapterNumber,
                        title: chapterTitle.trim(),
                        content: '',
                        wordCount: 0
                    };
                    break;
                }
            }

            if (isChapterTitle) {
                lineIndex++;
                continue;
            }

            // 如果没有章节，添加到当前章节内容
            if (currentChapter) {
                if (line) {
                    currentChapter.content += line + '\n';
                    currentChapter.wordCount++;
                }
            } else {
                // 如果还没有章节，创建默认章节
                if (!novel.chapters.length && foundValidContent) {
                    currentChapter = {
                        index: 0,
                        number: 1,
                        title: '正文',
                        content: '',
                        wordCount: 0
                    };
                    
                    if (line) {
                        currentChapter.content += line + '\n';
                        currentChapter.wordCount++;
                    }
                }
            }

            lineIndex++;
        }

        // 如果简介未结束，将已收集的行作为简介
        if (inSummary && summaryLines.length > 0) {
            novel.summary = summaryLines.join('\n').trim();
        }

        // 添加最后一个章节
        if (currentChapter) {
            currentChapter.content = this.cleanContent(currentChapter.content);
            novel.chapters.push(currentChapter);
        }

        // 如果没有找到任何章节，尝试按段落分割
        if (novel.chapters.length === 0 && foundValidContent) {
            console.log('未找到标准章节格式，尝试按段落分割');
            let chapterIndex = 0;
            let currentChapterContent = [];
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                if (trimmedLine) {
                    currentChapterContent.push(trimmedLine);
                    
                    // 每3000个字符或遇到明显分隔符时创建一个新章节
                    const totalLength = currentChapterContent.join('\n').length;
                    if (totalLength > 3000 || /^=+|^[-+*]{3,}/.test(trimmedLine)) {
                        const chapterContent = this.cleanContent(currentChapterContent.join('\n'));
                        novel.chapters.push({
                            index: chapterIndex,
                            number: chapterIndex + 1,
                            title: `第${chapterIndex + 1}节`,
                            content: chapterContent,
                            wordCount: chapterContent.split('\n').length
                        });
                        chapterIndex++;
                        currentChapterContent = [];
                    }
                }
            }
            
            // 添加最后一章
            if (currentChapterContent.length > 0) {
                const chapterContent = this.cleanContent(currentChapterContent.join('\n'));
                novel.chapters.push({
                    index: chapterIndex,
                    number: chapterIndex + 1,
                    title: `第${chapterIndex + 1}节`,
                    content: chapterContent,
                    wordCount: chapterContent.split('\n').length
                });
            }
        }

        // 如果仍然没有章节，创建一个默认章节包含所有内容
        if (novel.chapters.length === 0) {
            const cleanContent = this.cleanContent(content);
            novel.chapters.push({
                index: 0,
                number: 1,
                title: '正文',
                content: cleanContent,
                wordCount: cleanContent.split('\n').length
            });
        }

        // 计算统计信息
        novel.totalChapters = novel.chapters.length;
        novel.wordCount = novel.chapters.reduce((total, chapter) => total + chapter.wordCount, 0);

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

        // 从文件名提取标题（去掉扩展名）
        const baseTitle = filename.replace(/\.[^/.]+$/, '');
        novel.title = baseTitle;

        let inSummary = false;
        let summaryLines = [];
        let chapterIndex = 0;
        let foundValidContent = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) continue;

            foundValidContent = true;

            // 解析作者（多种格式）
            if (!novel.author) {
                const authorPatterns = [
                    /^作者[：:]\s*(.+)$/,
                    /^label_author(.+)$/,
                    /^author[：:]\s*(.+)$/i,
                    /^(.+)\s*著$/
                ];
                
                for (const pattern of authorPatterns) {
                    const match = pattern.exec(line);
                    if (match) {
                        novel.author = match[1].trim();
                        break;
                    }
                }
                
                if (novel.author) continue;
            }

            // 解析简介（多种格式）
            if (!novel.summary && !inSummary) {
                const summaryPatterns = [
                    /^简介[：:]?\s*$/,
                    /^内容简介[：:]?\s*$/,
                    /^介绍[：:]?\s*$/,
                    /^summary[：:]?\s*$/i
                ];
                
                for (const pattern of summaryPatterns) {
                    if (pattern.test(line)) {
                        inSummary = true;
                        break;
                    }
                }
                
                if (inSummary) continue;
            }

            if (inSummary) {
                if (this.separatorRegex.test(line) || /^第[一二三四五六七八九十\d]+章/.test(line)) {
                    novel.summary = summaryLines.join('\n').trim();
                    inSummary = false;
                } else {
                    summaryLines.push(line);
                }
                continue;
            }

            // 解析章节标题（多种格式）
            const chapterPatterns = [
                /^第(\d+)章\s*(.+)$/,
                /^第([一二三四五六七八九十百千万]+)章\s*(.+)$/,
                /^(\d+)\.\s*(.+)$/,
                /^章节[：:]?\s*(.+)$/,
                /^(.+)\s*第[一二三四五六七八九十\d]+章/
            ];
            
            for (const pattern of chapterPatterns) {
                const match = pattern.exec(line);
                if (match) {
                    let chapterNumber, chapterTitle;
                    
                    if (pattern === chapterPatterns[0]) {
                        // 数字章节
                        chapterNumber = parseInt(match[1]);
                        chapterTitle = match[2];
                    } else if (pattern === chapterPatterns[1]) {
                        // 中文数字章节
                        chapterNumber = this.chineseNumberToArabic(match[1]);
                        chapterTitle = match[2];
                    } else if (pattern === chapterPatterns[2]) {
                        // 数字加点格式
                        chapterNumber = parseInt(match[1]);
                        chapterTitle = match[2];
                    } else {
                        // 其他格式
                        chapterNumber = chapterIndex + 1;
                        chapterTitle = match[1] || match[0];
                    }
                    
                    novel.chapters.push({
                        index: chapterIndex++,
                        number: chapterNumber,
                        title: chapterTitle.trim()
                    });
                    break;
                }
            }
        }

        // 如果简介未结束，将已收集的行作为简介
        if (inSummary && summaryLines.length > 0) {
            novel.summary = summaryLines.join('\n').trim();
        }

        // 如果没有找到任何章节，尝试按段落分割
        if (novel.chapters.length === 0 && foundValidContent) {
            console.log('未找到标准章节格式，尝试按段落分割');
            let chapterIndex = 0;
            let currentChapterContent = [];
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                if (trimmedLine) {
                    currentChapterContent.push(trimmedLine);
                    
                    // 每1000个字符或遇到明显分隔符时创建一个新章节
                    const totalLength = currentChapterContent.join('\n').length;
                    if (totalLength > 3000 || /^=+|^[-+*]{3,}/.test(trimmedLine)) {
                        novel.chapters.push({
                            index: chapterIndex++,
                            number: chapterIndex + 1,
                            title: `第${chapterIndex + 1}节`
                        });
                        currentChapterContent = [];
                    }
                }
            }
            
            // 添加最后一章
            if (currentChapterContent.length > 0) {
                novel.chapters.push({
                    index: chapterIndex++,
                    number: chapterIndex + 1,
                    title: `第${chapterIndex + 1}节`
                });
            }
        }

        novel.totalChapters = novel.chapters.length;
        
        // 如果仍然没有章节，创建一个默认章节
        if (novel.chapters.length === 0) {
            novel.chapters.push({
                index: 0,
                number: 1,
                title: '正文'
            });
            novel.totalChapters = 1;
        }
        
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
     * 中文数字转换为阿拉伯数字
     * @param {string} chineseNum - 中文数字
     * @returns {number} 阿拉伯数字
     */
    chineseNumberToArabic(chineseNum) {
        const chineseNumbers = {
            '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
            '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
            '十': 10, '百': 100, '千': 1000, '万': 10000
        };
        
        let result = 0;
        let temp = 0;
        
        for (let i = 0; i < chineseNum.length; i++) {
            const char = chineseNum[i];
            const num = chineseNumbers[char];
            
            if (num === undefined) continue;
            
            if (num === 10 || num === 100 || num === 1000) {
                if (temp === 0) {
                    temp = 1;
                }
                temp *= num;
            } else if (num === 10000) {
                result = (result + temp) * num;
                temp = 0;
            } else {
                temp += num;
            }
        }
        
        return result + temp;
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