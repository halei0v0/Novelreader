#!/usr/bin/env python3
"""
检查数据完整性 - 验证 novels.json 中的小说与 data 目录下的实际数据是否一致
"""

import json
import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).parent
NOVELS_JSON = BASE_DIR / "novels.json"
DATA_DIR = BASE_DIR / "data"

def check_data_integrity():
    """检查数据完整性"""
    print("=" * 60)
    print("数据完整性检查")
    print("=" * 60)
    
    # 读取 novels.json
    with open(NOVELS_JSON, 'r', encoding='utf-8') as f:
        novels_meta = json.load(f)
    
    # 获取所有小说ID
    novel_ids_in_meta = set(novel['id'] for novel in novels_meta)
    
    # 获取 data 目录下所有小说目录
    novel_dirs_in_data = set()
    if DATA_DIR.exists():
        for item in DATA_DIR.iterdir():
            if item.is_dir() and item.name.startswith('novel_'):
                novel_dirs_in_data.add(item.name)
    
    print(f"\n📊 novels.json 中的小说数量: {len(novel_ids_in_meta)}")
    print(f"📁 data 目录下的小说数量: {len(novel_dirs_in_data)}")
    
    # 检查缺失的小说
    missing_in_data = novel_ids_in_meta - novel_dirs_in_data
    extra_in_data = novel_dirs_in_data - novel_ids_in_meta
    
    if missing_in_data:
        print(f"\n❌ novels.json 中有但 data 目录中缺失的小说 ({len(missing_in_data)} 个):")
        for novel_id in sorted(missing_in_data):
            novel = next((n for n in novels_meta if n['id'] == novel_id), None)
            if novel:
                print(f"   - {novel_id}: {novel['title']}")
    
    if extra_in_data:
        print(f"\n⚠️  data 目录中有但 novels.json 中缺失的小说 ({len(extra_in_data)} 个):")
        for novel_id in sorted(extra_in_data):
            print(f"   - {novel_id}")
    
    # 检查每个小说的数据完整性
    print("\n" + "=" * 60)
    print("详细数据检查")
    print("=" * 60)
    
    issues = []
    
    for novel in novels_meta:
        novel_id = novel['id']
        novel_dir = DATA_DIR / novel_id
        
        if not novel_dir.exists():
            issues.append({
                'id': novel_id,
                'title': novel['title'],
                'issue': '目录不存在',
                'severity': 'error'
            })
            continue
        
        # 检查 meta.json
        meta_file = novel_dir / 'meta.json'
        if not meta_file.exists():
            issues.append({
                'id': novel_id,
                'title': novel['title'],
                'issue': 'meta.json 不存在',
                'severity': 'error'
            })
            continue
        
        try:
            with open(meta_file, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        except json.JSONDecodeError as e:
            issues.append({
                'id': novel_id,
                'title': novel['title'],
                'issue': f'meta.json 解析失败: {e}',
                'severity': 'error'
            })
            continue
        
        # 检查章节标题数量
        meta_chapters_count = meta.get('chapters_count', 0)
        meta_titles_count = len(meta.get('chapter_titles', []))
        
        # 统计实际 chunk 文件
        chunk_files = list(novel_dir.glob('chunk_*.json'))
        chunk_files.sort()
        
        if not chunk_files:
            issues.append({
                'id': novel_id,
                'title': novel['title'],
                'issue': '没有 chunk 文件',
                'severity': 'error'
            })
            continue
        
        # 计算实际章节数
        actual_chapters = 0
        for chunk_file in chunk_files:
            try:
                with open(chunk_file, 'r', encoding='utf-8') as f:
                    chunk_data = json.load(f)
                    actual_chapters += len(chunk_data.get('chapters', []))
            except json.JSONDecodeError:
                issues.append({
                    'id': novel_id,
                    'title': novel['title'],
                    'issue': f'{chunk_file.name} 解析失败',
                    'severity': 'error'
                })
        
        # 检查数量是否一致
        if meta_chapters_count != actual_chapters:
            issues.append({
                'id': novel_id,
                'title': novel['title'],
                'issue': f'章节数不一致: meta={meta_chapters_count}, 实际={actual_chapters}',
                'severity': 'warning'
            })
        
        if meta_titles_count != actual_chapters:
            issues.append({
                'id': novel_id,
                'title': novel['title'],
                'issue': f'标题数量不一致: meta={meta_titles_count}, 实际={actual_chapters}',
                'severity': 'warning'
            })
        
        # 检查是否有内容的章节
        has_content_count = sum(1 for t in meta.get('chapter_titles', []) if t.get('has_content', False))
        if has_content_count == 0 and meta_chapters_count > 0:
            issues.append({
                'id': novel_id,
                'title': novel['title'],
                'issue': '所有章节都没有内容标记',
                'severity': 'warning'
            })
    
    # 打印问题
    if issues:
        print(f"\n发现 {len(issues)} 个问题:\n")
        
        errors = [i for i in issues if i['severity'] == 'error']
        warnings = [i for i in issues if i['severity'] == 'warning']
        
        if errors:
            print(f"🔴 严重错误 ({len(errors)} 个):")
            for issue in errors:
                print(f"   [{issue['id']}] {issue['title']}")
                print(f"       {issue['issue']}")
            print()
        
        if warnings:
            print(f"🟡 警告 ({len(warnings)} 个):")
            for issue in warnings:
                print(f"   [{issue['id']}] {issue['title']}")
                print(f"       {issue['issue']}")
    else:
        print("\n✅ 所有小说数据完整，未发现问题！")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    check_data_integrity()
