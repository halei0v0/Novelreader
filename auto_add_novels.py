#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动添加小说脚本
自动扫描 novel 目录中的所有 .txt 文件并转换为网站可用的格式
"""
import json
import os
import re
from pathlib import Path
from datetime import datetime

def parse_novel_file(file_path):
    """解析小说txt文件，提取章节信息"""
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
                if not re.search(r'[。！？，、；：""''（）\[\]\{\}]{3,}', line_stripped):
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
    
    return {
        'title': book_name,
        'author': author,
        'description': description,
        'chapters': chapters
    }

def auto_add_novels():
    """自动扫描 novel 目录并添加所有小说"""
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    novel_dir = os.path.join(script_dir, 'novel')
    
    # 检查 novel 目录是否存在
    if not os.path.exists(novel_dir):
        print(f"错误: novel 目录不存在: {novel_dir}")
        print("请先创建 novel 目录并将小说文件放入其中")
        return
    
    # 扫描 novel 目录中的所有 .txt 文件
    txt_files = []
    for file in os.listdir(novel_dir):
        if file.lower().endswith('.txt'):
            txt_files.append(file)
    
    if not txt_files:
        print(f"novel 目录中没有找到 .txt 文件")
        print("请将小说 .txt 文件放入 novel 目录中")
        return
    
    print(f"找到 {len(txt_files)} 个小说文件:")
    for txt_file in txt_files:
        print(f"  - {txt_file}")
    print()
    
    # 读取现有的小说列表
    novels_json_path = os.path.join(script_dir, 'novels.json')
    existing_novels = []
    existing_ids = set()
    
    if os.path.exists(novels_json_path):
        try:
            with open(novels_json_path, 'r', encoding='utf-8') as f:
                existing_novels = json.load(f)
            existing_ids = {novel['id'] for novel in existing_novels}
            print(f"现有小说数量: {len(existing_novels)}")
        except Exception as e:
            print(f"读取现有小说列表失败: {e}")
    
    # 解析新小说
    novels = []
    new_novels = []
    used_ids = set()  # 跟踪本次运行中已使用的 ID
    
    for txt_file in txt_files:
        file_path = os.path.join(novel_dir, txt_file)
        novel_data = parse_novel_file(file_path)
        
        # 检查是否已经存在（通过标题匹配）
        novel_id = None
        for existing in existing_novels:
            if existing['title'] == novel_data['title']:
                novel_id = existing['id']
                break
        
        if novel_id is None:
            # 新小说，生成新的 ID
            max_id = -1
            # 从现有 ID 和本次已使用的 ID 中找出最大值
            all_ids = existing_ids | used_ids
            for existing_id in all_ids:
                if existing_id.startswith('novel_'):
                    try:
                        num = int(existing_id.replace('novel_', ''))
                        max_id = max(max_id, num)
                    except ValueError:
                        pass
            
            novel_id = f"novel_{max_id + 1}"
            used_ids.add(novel_id)
            new_novels.append(novel_data['title'])
        else:
            # 已存在的小说，覆盖数据
            print(f"更新已有小说: {novel_data['title']} (ID: {novel_id})")
            used_ids.add(novel_id)
        
        novels.append({
            'id': novel_id,
            'data': novel_data
        })
    
    # 保存小说数据
    data_dir = os.path.join(script_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    for novel in novels:
        novel_file = os.path.join(data_dir, f"{novel['id']}.json")
        with open(novel_file, 'w', encoding='utf-8') as f:
            json.dump(novel['data'], f, ensure_ascii=False, indent=2)
        
        file_size = os.path.getsize(novel_file) / 1024 / 1024
        print(f"  已保存: {novel['data']['title']} -> {novel['id']}.json ({file_size:.2f} MB)")
    
    # 更新小说列表
    novels_meta = []
    for novel in novels:
        novels_meta.append({
            'id': novel['id'],
            'title': novel['data']['title'],
            'author': novel['data']['author'],
            'description': novel['data']['description'],
            'chapters_count': len(novel['data']['chapters'])
        })
    
    with open(novels_json_path, 'w', encoding='utf-8') as f:
        json.dump(novels_meta, f, ensure_ascii=False, indent=2)
    
    print(f"\n处理完成！")
    print(f"总小说数量: {len(novels_meta)}")
    
    if new_novels:
        print(f"新增小说: {len(new_novels)}")
        for title in new_novels:
            print(f"  - {title}")
    
    print(f"\n小说列表: novels.json")
    print(f"小说数据: data/ 目录")
    print(f"\n请刷新浏览器页面查看新添加的小说")

if __name__ == '__main__':
    print("=" * 50)
    print("自动添加小说脚本")
    print(f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    print()
    
    auto_add_novels()
