#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os
import re
from pathlib import Path

def parse_novel_file(file_path):
    """解析小说txt文件，提取章节信息"""
    # 尝试用UTF-8编码读取，如果失败则尝试GBK
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
    # 常见章节匹配模式 - 增强限制，避免误匹配
    chapter_patterns = [
        r'^第\s*[0-9零一二三四五六七八九十百千万]+\s*[章节集卷回部篇]',  # 第X章/节/卷（严格匹配）
        r'^第\s*[0-9零一二三四五六七八九十百千万]+\s*[ \t、\.\-：:]\s*[^\n]{1,50}',  # 第1 标题（标题长度限制）
        r'^Chapter\s*[0-9]+.*',  # Chapter X
        r'^[0-9]+\.\s*[^\n]{1,50}',  # 1. 标题（标题长度限制）
        r'^序\s*[言文]?',  # 序言/序文
        r'^楔子',  # 楔子（完整匹配）
        r'^引子',  # 引子（完整匹配）
        r'^番外[^\n]{0,50}',  # 番外（标题长度限制）
        r'^卷\s*[0-9零一二三四五六七八九十百千万]+\s*[章节集卷回部篇]?',  # 卷X
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
                # 章节标题通常格式简洁，不会包含太多连续的特殊字符
                if not re.search(r'[。！？，、；：""''（）\[\]{}]{3,}', line_stripped):
                    # 额外验证：章节标题应该是独立的行，不太可能是段落的一部分
                    # 检查是否是典型的章节格式（如"第X章"、"第X章 标题"）
                    # 重要：必须以"章"、"节"、"卷"、"回"、"部"、"篇"结尾，或者后面紧跟分隔符和简短标题
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
                        # 匹配了但不符合严格格式，可能是误匹配
                        is_chapter = False
                else:
                    # 包含过多标点符号，不是章节标题
                    is_chapter = False
            else:
                # 标题过长，不是章节标题
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
    
    return {
        'title': book_name,
        'author': author,
        'description': description,
        'chapters': chapters
    }

def convert_novels():
    """转换目录下所有小说文件"""
    # 优先从 novel 目录读取小说
    script_dir = os.path.dirname(os.path.abspath(__file__))
    novel_dir = os.path.join(script_dir, 'novel')
    
    txt_files = []
    
    # 如果 novel 目录存在且有文件，从那里读取
    if os.path.exists(novel_dir):
        for file in os.listdir(novel_dir):
            if file.lower().endswith('.txt'):
                txt_files.append(file)
        if txt_files:
            print(f"从 novel 目录读取小说: {len(txt_files)} 个文件")
    
    # 如果 novel 目录为空，从根目录读取
    if not txt_files:
        txt_files = [
            '《奥术神座》（精校版全本+番外）作者：爱潜水的乌贼.txt',
            '十日终焉.txt',
            '这个魔子不对劲.txt'
        ]
        print(f"从项目根目录读取小说")
    
    novels = []
    for txt_file in txt_files:
        file_path = os.path.join(script_dir, 'novel' if os.path.exists(novel_dir) else '', txt_file)
        if os.path.exists(file_path):
            print(f"正在解析: {txt_file}")
            novel_data = parse_novel_file(file_path)
            novels.append(novel_data)
            print(f"  找到 {len(novel_data['chapters'])} 章")
        else:
            print(f"文件不存在: {txt_file}")
    
    # 保存小说列表（元数据）
    novels_meta = []
    for i, novel in enumerate(novels):
        # 创建小说ID（使用文件名）
        novel_id = f"novel_{i}"
        
        # 保存小说元数据
        novels_meta.append({
            'id': novel_id,
            'title': novel['title'],
            'author': novel['author'],
            'description': novel['description'],
            'chapters_count': len(novel['chapters'])
        })
        
        # 保存小说章节内容到单独的文件
        novel_file = f"data/{novel_id}.json"
        os.makedirs('data', exist_ok=True)
        with open(novel_file, 'w', encoding='utf-8') as f:
            json.dump(novel, f, ensure_ascii=False, indent=2)
        
        # 获取文件大小
        file_size = os.path.getsize(novel_file) / 1024 / 1024  # MB
        print(f"  已保存: {novel_file} ({file_size:.2f} MB)")
    
    # 保存小说列表
    with open('novels.json', 'w', encoding='utf-8') as f:
        json.dump(novels_meta, f, ensure_ascii=False, indent=2)
    
    print(f"\n转换完成！共 {len(novels)} 本小说")
    print(f"小说列表: novels.json")
    print(f"小说数据: data/ 目录")
    
    # 打印统计信息
    for novel in novels_meta:
        print(f"\n{novel['title']}:")
        print(f"  作者: {novel['author']}")
        print(f"  章节数: {novel['chapters_count']}")

if __name__ == '__main__':
    convert_novels()