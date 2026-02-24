#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动添加小说脚本
自动扫描 novel 目录中的所有 .txt 文件并转换为网站可用的格式
"""
import json
import os
from datetime import datetime
from shared_parser import parse_novel_file

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
        novel_dir = os.path.join(data_dir, novel['id'])
        os.makedirs(novel_dir, exist_ok=True)
        
        # 保存章节标题列表（轻量，用于快速加载目录）
        novel_meta_file = os.path.join(novel_dir, 'meta.json')
        with open(novel_meta_file, 'w', encoding='utf-8') as f:
            json.dump({
                'title': novel['data']['title'],
                'author': novel['data']['author'],
                'description': novel['data']['description'],
                'chapters_count': len(novel['data']['chapters']),
                'chapter_titles': novel['data'].get('chapter_titles', [])
            }, f, ensure_ascii=False, indent=2)
        
        # 分块保存章节内容（每100章一个块）
        chunk_size = 100
        for chunk_index in range(0, len(novel['data']['chapters']), chunk_size):
            chunk_data = novel['data']['chapters'][chunk_index:chunk_index + chunk_size]
            chunk_file = os.path.join(novel_dir, f"chunk_{chunk_index // chunk_size}.json")
            
            with open(chunk_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'chunk_index': chunk_index // chunk_size,
                    'start_chapter': chunk_index,
                    'end_chapter': min(chunk_index + chunk_size, len(novel['data']['chapters'])),
                    'chapters': chunk_data
                }, f, ensure_ascii=False, indent=2)
        
        # 计算总大小
        meta_size = os.path.getsize(novel_meta_file) / 1024
        print(f"  已保存: {novel['data']['title']} -> {novel['id']}/meta.json ({meta_size:.2f} KB)")
        print(f"         章节数: {len(novel['data']['chapters'])}, 块数: {(len(novel['data']['chapters']) + chunk_size - 1) // chunk_size}")
    
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
