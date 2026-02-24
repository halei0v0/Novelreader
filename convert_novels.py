#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os
from shared_parser import parse_novel_file

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
        
        # 创建小说目录
        novel_dir = f"data/{novel_id}"
        os.makedirs(novel_dir, exist_ok=True)
        
        # 保存章节标题列表（轻量，用于快速加载目录）
        novel_meta_file = f"{novel_dir}/meta.json"
        with open(novel_meta_file, 'w', encoding='utf-8') as f:
            json.dump({
                'title': novel['title'],
                'author': novel['author'],
                'description': novel['description'],
                'chapters_count': len(novel['chapters']),
                'chapter_titles': novel.get('chapter_titles', [])
            }, f, ensure_ascii=False, indent=2)
        
        # 分块保存章节内容（每100章一个块）
        chunk_size = 100
        for chunk_index in range(0, len(novel['chapters']), chunk_size):
            chunk_data = novel['chapters'][chunk_index:chunk_index + chunk_size]
            chunk_file = f"{novel_dir}/chunk_{chunk_index // chunk_size}.json"
            
            with open(chunk_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'chunk_index': chunk_index // chunk_size,
                    'start_chapter': chunk_index,
                    'end_chapter': min(chunk_index + chunk_size, len(novel['chapters'])),
                    'chapters': chunk_data
                }, f, ensure_ascii=False, indent=2)
        
        # 获取文件大小
        meta_size = os.path.getsize(novel_meta_file) / 1024  # KB
        print(f"  已保存: {novel_meta_file} ({meta_size:.2f} KB)")
        print(f"  已保存: {len(novel['chapters'])} 章，分 {(len(novel['chapters']) + chunk_size - 1) // chunk_size} 个块")
    
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