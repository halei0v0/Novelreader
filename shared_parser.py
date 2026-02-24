#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小说解析器共享模块
提供小说文本文件的解析功能，供 convert_novels.py 和 auto_add_novels.py 共用
"""
import re
from pathlib import Path


def parse_novel_file(file_path):
    """
    解析小说txt文件，提取章节信息
    
    Args:
        file_path: 小说文件路径
        
    Returns:
        dict: 包含 title, author, description, chapters 的字典
    """
    # 尝试用UTF-8编码读取，如果失败则尝试其他编码
    content = None
    for encoding in ['utf-8', 'gbk', 'gb18030']:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                content = f.read()
            print(f"  使用编码: {encoding}")
            break
        except UnicodeDecodeError:
            continue
    
    if content is None:
        print(f"  警告: 无法读取文件，使用utf-8 with ignore")
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    
    # 提取书名、作者、简介
    lines = content.split('\n')
    
    # 尝试从文件名提取书名
    book_name = Path(file_path).stem
    author = "未知作者"
    description = ""
    
    # 尝试解析文件头信息
    header_lines = []
    for i, line in enumerate(lines[:100]):
        if line.strip():
            header_lines.append(line.strip())
        elif header_lines:
            break
    
    # 尝试提取作者
    author_pattern = r'作者[:：]\s*(.+?)(?:\s|$|简介|描述)'
    for line in header_lines:
        match = re.search(author_pattern, line)
        if match:
            author = match.group(1).strip()
            break
    
    # 尝试提取简介
    desc_pattern = r'(?:简介|描述)[:：]\s*(.+)'
    desc_lines = []
    in_desc = False
    for line in header_lines:
        match = re.search(desc_pattern, line)
        if match:
            desc_lines.append(match.group(1).strip())
            in_desc = True
        elif in_desc and line.strip():
            desc_lines.append(line.strip())
        elif in_desc:
            break
    
    description = ' '.join(desc_lines) if desc_lines else "暂无简介"
    
    # 提取章节
    # 常见章节匹配模式
    chapter_patterns = [
        r'^第\s*[0-9零一二三四五六七八九十百千万]+\s*[章节集卷回部篇]',
        r'^第\s*[0-9零一二三四五六七八九十百千万]+\s*[ \t、\.\-：:]\s*[^\n]{1,50}',
        r'^Chapter\s*[0-9]+.*',
        r'^[0-9]+\.\s*[^\n]{1,50}',
        r'^序\s*[言文]?',
        r'^楔子',
        r'^引子',
        r'^番外[^\n]{0,50}',
        r'^卷\s*[0-9零一二三四五六七八九十百千万]+\s*[章节集卷回部篇]?',
    ]
    
    combined_pattern = '|'.join(chapter_patterns)
    
    chapters = []
    current_chapter = None
    current_content = []
    
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            current_content.append("")
            continue
            
        # 检查是否是章节标题
        is_chapter = False
        match = re.match(combined_pattern, line_stripped, re.MULTILINE)
        
        if match:
            # 额外验证：章节标题不应过长（一般不超过50字）
            title_len = len(line_stripped)
            if title_len <= 50:
                # 额外验证：避免误匹配包含大量标点或特殊字符的行
                if not re.search(r'[。！？，、；：""''（）\[\{\}]{3,}', line_stripped):
                    # 严格格式验证
                    if re.match(r'^第\s*[0-9零一二三四五六七八九十百千万]+\s*[章节集卷回部篇]\s*$', line_stripped) or \
                       re.match(r'^第\s*[0-9零一二三四五六七八九十百千万]+\s*[章节集卷回部篇]\s+[^\n]{1,20}$', line_stripped) or \
                       re.match(r'^Chapter\s*[0-9]+\s*$', line_stripped) or \
                       re.match(r'^Chapter\s*[0-9]+\s+[^\n]{1,20}$', line_stripped) or \
                       re.match(r'^[0-9]+\.\s*[^\n]{1,20}$', line_stripped) or \
                       re.match(r'^序\s*[言文]?$', line_stripped) or \
                       re.match(r'^楔子$', line_stripped) or \
                       re.match(r'^引子$', line_stripped) or \
                       re.match(r'^番外[^\n]{0,20}$', line_stripped):
                        is_chapter = True
                    else:
                        is_chapter = False
                else:
                    is_chapter = False
            else:
                is_chapter = False
        
        if is_chapter:
            # 保存上一章
            if current_chapter and current_content:
                chapters.append({
                    'title': current_chapter,
                    'content': '\n'.join(current_content).strip()
                })
            
            current_chapter = line_stripped
            current_content = []
        else:
            current_content.append(line)
    
    # 保存最后一章
    if current_chapter and current_content:
        chapters.append({
            'title': current_chapter,
            'content': '\n'.join(current_content).strip()
        })
    
    # 如果没有找到章节，整个文件作为一章
    if not chapters:
        chapters.append({
            'title': '正文',
            'content': content.strip()
        })
    
    # 分离章节标题和内容，用于按需加载
    chapter_titles = [
        {'title': ch['title'], 'has_content': bool(ch['content'].strip())}
        for ch in chapters
    ]
    
    return {
        'title': book_name,
        'author': author,
        'description': description,
        'chapters': chapters,  # 完整数据（用于初始化）
        'chapter_titles': chapter_titles  # 仅标题（用于快速加载目录）
    }
