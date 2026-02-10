/**
 * 小说文件解析模块
 * 负责解析txt文件，提取元数据和章节信息
 */
class NovelParser {
    constructor() {
        // 修改正则表达式，支持"第X章"、"第X章 标题"、"第X卷"、"第X卷 标题"以及中文数字"第一章"、"第一卷"等格式
        this.chapterRegex = /^第([一二三四五六七八九十百千\d]+)(?:章|卷)(?:\s*(.+))?$/;
        // 支持多种作者格式
        this.authorRegexList = [
            /^label_author(.+)$/,
            /^作者[:：](.+)$/
        ];
        this.summaryRegex = /^简介[:：]\s*$/;
        this.separatorRegex = /^={3,}$/;
        // 新增：支持书名格式
        this.titleRegex = /^书名[:：](.+)$/;
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

            // 解析标题（支持"书名:"格式）
            if (!novel.title) {
                const titleMatch = this.titleRegex.exec(line);
                if (titleMatch) {
                    novel.title = titleMatch[1].trim();
                } else {
                    novel.title = line;
                }
                lineIndex++;
                continue;
            }

            // 解析作者（支持多种格式）
            if (!novel.author) {
                for (const regex of this.authorRegexList) {
                    const authorMatch = regex.exec(line);
                    if (authorMatch) {
                        novel.author = authorMatch[1].trim();
                        lineIndex++;
                        continue;
                    }
                }
            }

            // 解析简介（支持"简介:"格式）
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

            // 检查是否遇到分隔符，结束头部解析
            if (this.separatorRegex.test(line)) {
                lineIndex++;
                break;
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
                const chapterNumberStr = chapterMatch[1];
                const chapterNumber = this.chineseToNumber(chapterNumberStr);
                // 提取章节类型（章或卷）
                const chapterTypeMatch = line.match(/第([一二三四五六七八九十百千\d]+)(章|卷)/);
                const chapterType = chapterTypeMatch ? chapterTypeMatch[2] : '章';
                const chapterTitle = chapterMatch[2] ? chapterMatch[2].trim() : `第${chapterNumberStr}${chapterType}`;
                
                currentChapter = {
                    index: novel.chapters.length,
                    number: chapterNumber,
                    title: chapterTitle,
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
     * 将中文数字转换为阿拉伯数字
     * @param {string} chineseNum - 中文数字
     * @returns {number} 阿拉伯数字
     */
    chineseToNumber(chineseNum) {
        const chineseNums = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '百': 100, '千': 1000, '零': 0, '〇': 0
        };
        
        // 如果是纯阿拉伯数字，直接返回
        if (/^\d+$/.test(chineseNum)) {
            return parseInt(chineseNum);
        }
        
        let result = 0;
        let temp = 0;
        
        for (let i = 0; i < chineseNum.length; i++) {
            const char = chineseNum[i];
            const num = chineseNums[char];
            
            if (num === undefined) {
                continue;
            }
            
            if (num >= 10) {
                if (temp === 0) {
                    temp = 1;
                }
                result += temp * num;
                temp = 0;
            } else {
                temp = num;
            }
        }
        
        result += temp;
        
        return result;
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

        outerLoop:
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) continue;

            // 解析标题
            if (!novel.title) {
                const titleMatch = this.titleRegex.exec(line);
                if (titleMatch) {
                    novel.title = titleMatch[1].trim();
                } else {
                    novel.title = line;
                }
                continue;
            }

            // 解析作者
            if (!novel.author) {
                for (const regex of this.authorRegexList) {
                    const authorMatch = regex.exec(line);
                    if (authorMatch) {
                        novel.author = authorMatch[1].trim();
                        continue outerLoop;
                    }
                }
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

            // 检查是否遇到分隔符
            if (this.separatorRegex.test(line)) {
                continue;
            }

            // 解析章节标题
            const chapterMatch = this.chapterRegex.exec(line);
            if (chapterMatch) {
                const chapterNumberStr = chapterMatch[1];
                const chapterNumber = this.chineseToNumber(chapterNumberStr);
                // 提取章节类型（章或卷）
                const chapterTypeMatch = line.match(/第([一二三四五六七八九十百千\d]+)(章|卷)/);
                const chapterType = chapterTypeMatch ? chapterTypeMatch[2] : '章';
                const chapterTitle = chapterMatch[2] ? chapterMatch[2].trim() : `第${chapterNumberStr}${chapterType}`;
                novel.chapters.push({
                    index: chapterIndex++,
                    number: chapterNumber,
                    title: chapterTitle
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

        // 增加检查行数到500行，以支持更多格式
        for (let i = 0; i < Math.min(lines.length, 500); i++) {
            const line = lines[i].trim();
            
            if (!line) continue;

            // 检查标题
            if (!hasTitle && i === 0) {
                hasTitle = true;
                continue;
            }

            // 检查作者（支持多种格式）
            if (!hasAuthor) {
                for (const regex of this.authorRegexList) {
                    if (regex.test(line)) {
                        hasAuthor = true;
                        break;
                    }
                }
            }

            // 检查简介
            if (!hasSummary && this.summaryRegex.test(line)) {
                hasSummary = true;
                continue;
            }

            // 检查章节（支持"第X章"和"第X卷"格式）
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