#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小说阅读器 - Python桌面版
使用tkinter创建GUI应用
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import os
import json
import re
from pathlib import Path
import threading
import webbrowser
from datetime import datetime

class NovelReaderApp:
    def __init__(self, root):
        self.root = root
        self.root.title("小说阅读器")
        self.root.geometry("1000x700")
        self.root.minsize(800, 600)
        
        # 设置应用图标和样式
        self.setup_styles()
        
        # 数据存储
        self.novels = {}
        self.current_novel = None
        self.current_chapter = 0
        self.reading_progress = {}
        self.settings = self.load_settings()
        
        # 创建界面
        self.create_widgets()
        self.load_novels()
        
        # 绑定事件
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
    def setup_styles(self):
        """设置应用样式"""
        style = ttk.Style()
        style.theme_use('clam')
        
        # 配置颜色主题
        self.colors = {
            'bg': '#ffffff',
            'fg': '#333333',
            'select_bg': '#e3f2fd',
            'select_fg': '#1976d2',
            'button_bg': '#1976d2',
            'button_fg': '#ffffff'
        }
        
        # 设置主题颜色
        style.configure('TFrame', background=self.colors['bg'])
        style.configure('TLabel', background=self.colors['bg'], foreground=self.colors['fg'])
        style.configure('TButton', background=self.colors['button_bg'], foreground=self.colors['button_fg'])
        style.configure('Treeview', background=self.colors['bg'], foreground=self.colors['fg'])
        style.configure('Treeview.Heading', background=self.colors['select_bg'], foreground=self.colors['select_fg'])
        
    def create_widgets(self):
        """创建界面组件"""
        # 创建主框架
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建左侧小说列表
        self.create_novel_list(main_frame)
        
        # 创建右侧阅读区域
        self.create_reading_area(main_frame)
        
        # 创建底部状态栏
        self.create_status_bar()
        
        # 创建菜单栏
        self.create_menu()
        
    def create_novel_list(self, parent):
        """创建小说列表"""
        # 左侧框架
        left_frame = ttk.Frame(parent)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, 10))
        left_frame.pack_propagate(False)
        left_frame.configure(width=300)
        
        # 标题
        title_label = ttk.Label(left_frame, text="小说列表", font=('微软雅黑', 14, 'bold'))
        title_label.pack(pady=(0, 10))
        
        # 刷新按钮
        refresh_btn = ttk.Button(left_frame, text="刷新列表", command=self.load_novels)
        refresh_btn.pack(pady=(0, 10))
        
        # 小说列表
        self.novel_tree = ttk.Treeview(left_frame, columns=('title', 'author'), show='tree headings')
        self.novel_tree.heading('#0', text='标题')
        self.novel_tree.heading('title', text='标题')
        self.novel_tree.heading('author', text='作者')
        
        # 隐藏标题列
        self.novel_tree.column('#0', width=0, stretch=False)
        self.novel_tree.column('title', width=180)
        self.novel_tree.column('author', width=100)
        
        # 滚动条
        scrollbar = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.novel_tree.yview)
        self.novel_tree.configure(yscrollcommand=scrollbar.set)
        
        self.novel_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.novel_tree.bind('<<TreeviewSelect>>', self.on_novel_select)
        self.novel_tree.bind('<Double-Button-1>', self.on_novel_double_click)
        
    def create_reading_area(self, parent):
        """创建阅读区域"""
        # 右侧框架
        right_frame = ttk.Frame(parent)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # 阅读器框架
        self.reader_frame = ttk.Frame(right_frame)
        self.reader_frame.pack(fill=tk.BOTH, expand=True)
        
        # 小说信息
        info_frame = ttk.Frame(self.reader_frame)
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.novel_title_label = ttk.Label(info_frame, text="请选择小说", font=('微软雅黑', 16, 'bold'))
        self.novel_title_label.pack(side=tk.LEFT)
        
        # 章节选择
        chapter_frame = ttk.Frame(self.reader_frame)
        chapter_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(chapter_frame, text="章节:").pack(side=tk.LEFT)
        
        self.chapter_var = tk.StringVar()
        self.chapter_combo = ttk.Combobox(chapter_frame, textvariable=self.chapter_var, state='readonly')
        self.chapter_combo.pack(side=tk.LEFT, padx=(5, 10))
        self.chapter_combo.bind('<<ComboboxSelected>>', self.on_chapter_change)
        
        # 章节导航按钮
        ttk.Button(chapter_frame, text="上一章", command=self.prev_chapter).pack(side=tk.LEFT, padx=2)
        ttk.Button(chapter_frame, text="下一章", command=self.next_chapter).pack(side=tk.LEFT, padx=2)
        
        # 阅读内容
        self.content_text = scrolledtext.ScrolledText(
            self.reader_frame,
            wrap=tk.WORD,
            font=('微软雅黑', 12),
            spacing1=8,
            spacing2=4,
            spacing3=8,
            padx=20,
            pady=20
        )
        self.content_text.pack(fill=tk.BOTH, expand=True)
        
        # 配置文本标签
        self.content_text.tag_configure('title', font=('微软雅黑', 14, 'bold'), spacing1=12, spacing3=12)
        self.content_text.tag_configure('dialogue', font=('微软雅黑', 12, 'italic'), lmargin1=40, lmargin2=40)
        
        # 阅读设置
        self.create_reading_settings(right_frame)
        
    def create_reading_settings(self, parent):
        """创建阅读设置"""
        settings_frame = ttk.LabelFrame(parent, text="阅读设置")
        settings_frame.pack(fill=tk.X, pady=(10, 0))
        
        # 字体大小
        font_frame = ttk.Frame(settings_frame)
        font_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(font_frame, text="字体大小:").pack(side=tk.LEFT)
        
        self.font_size_var = tk.IntVar(value=self.settings.get('font_size', 12))
        font_scale = ttk.Scale(font_frame, from_=10, to=20, variable=self.font_size_var, 
                              orient=tk.HORIZONTAL, command=self.update_font_size)
        font_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=10)
        
        self.font_size_label = ttk.Label(font_frame, text=str(self.font_size_var.get()))
        self.font_size_label.pack(side=tk.LEFT)
        
        # 行间距
        line_frame = ttk.Frame(settings_frame)
        line_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(line_frame, text="行间距:").pack(side=tk.LEFT)
        
        self.line_spacing_var = tk.DoubleVar(value=self.settings.get('line_spacing', 1.5))
        line_scale = ttk.Scale(line_frame, from_=1.0, to=2.0, variable=self.line_spacing_var,
                              orient=tk.HORIZONTAL, command=self.update_line_spacing)
        line_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=10)
        
        self.line_spacing_label = ttk.Label(line_frame, text=f"{self.line_spacing_var.get():.1f}")
        self.line_spacing_label.pack(side=tk.LEFT)
        
    def create_status_bar(self):
        """创建状态栏"""
        self.status_bar = ttk.Label(self.root, text="就绪", relief=tk.SUNKEN)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
    def create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="打开小说文件夹", command=self.open_novel_folder)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.on_closing)
        
        # 设置菜单
        settings_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="设置", menu=settings_menu)
        settings_menu.add_command(label="重置设置", command=self.reset_settings)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self.show_about)
        
    def load_novels(self):
        """加载小说列表"""
        self.novels.clear()
        self.novel_tree.delete(*self.novel_tree.get_children())
        
        novel_dir = Path("novel")
        if not novel_dir.exists():
            novel_dir.mkdir(exist_ok=True)
            self.status_bar.config(text="已创建novel文件夹，请放入txt文件")
            return
        
        txt_files = list(novel_dir.glob("*.txt"))
        if not txt_files:
            self.status_bar.config(text="novel文件夹中没有找到txt文件")
            return
        
        for file_path in txt_files:
            try:
                novel = self.parse_novel_file(file_path)
                if novel:
                    self.novels[file_path.name] = novel
                    self.novel_tree.insert('', 'end', values=(novel['title'], novel.get('author', '未知')))
            except Exception as e:
                print(f"解析文件 {file_path} 失败: {e}")
        
        self.status_bar.config(text=f"已加载 {len(self.novels)} 本小说")
        
    def parse_novel_file(self, file_path):
        """解析小说文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    content = f.read()
            except:
                return None
        
        lines = content.split('\n')
        novel = {
            'title': lines[0] if lines else '未知标题',
            'author': '',
            'chapters': [],
            'content': content
        }
        
        # 解析作者
        for line in lines[:10]:
            if line.startswith('作者：'):
                novel['author'] = line.replace('作者：', '').strip()
                break
        
        # 解析章节
        chapter_pattern = re.compile(r'^第(\d+)章\s*(.+)$')
        current_chapter = None
        
        for line in lines:
            match = chapter_pattern.match(line.strip())
            if match:
                if current_chapter:
                    novel['chapters'].append(current_chapter)
                
                current_chapter = {
                    'title': line.strip(),
                    'content': '',
                    'number': int(match.group(1))
                }
            elif current_chapter:
                current_chapter['content'] += line + '\n'
        
        if current_chapter:
            novel['chapters'].append(current_chapter)
        
        return novel
        
    def on_novel_select(self, event):
        """处理小说选择事件"""
        selection = self.novel_tree.selection()
        if not selection:
            return
        
        item = self.novel_tree.item(selection[0])
        title = item['values'][0]
        
        # 找到对应的小说
        for filename, novel in self.novels.items():
            if novel['title'] == title:
                self.current_novel = novel
                self.current_chapter = 0
                self.load_chapter_list()
                self.load_chapter(0)
                break
        
    def on_novel_double_click(self, event):
        """处理小说双击事件"""
        self.on_novel_select(event)
        
    def load_chapter_list(self):
        """加载章节列表"""
        if not self.current_novel:
            return
        
        chapters = self.current_novel['chapters']
        chapter_titles = [ch['title'] for ch in chapters]
        
        self.chapter_combo['values'] = chapter_titles
        if chapter_titles:
            self.chapter_combo.current(0)
        
    def load_chapter(self, chapter_index):
        """加载章节内容"""
        if not self.current_novel or chapter_index < 0 or chapter_index >= len(self.current_novel['chapters']):
            return
        
        chapter = self.current_novel['chapters'][chapter_index]
        
        # 清空文本框
        self.content_text.delete(1.0, tk.END)
        
        # 插入章节标题
        self.content_text.insert(tk.END, chapter['title'] + '\n\n', 'title')
        
        # 处理章节内容
        content = chapter['content']
        paragraphs = content.split('\n')
        
        for paragraph in paragraphs:
            if paragraph.strip():
                # 检查是否是对话
                if paragraph.strip().startswith('「') and paragraph.strip().endswith('」'):
                    self.content_text.insert(tk.END, paragraph + '\n\n', 'dialogue')
                else:
                    self.content_text.insert(tk.END, paragraph + '\n\n')
        
        # 更新状态
        self.current_chapter = chapter_index
        self.chapter_combo.current(chapter_index)
        
        # 保存阅读进度
        self.save_reading_progress()
        
        # 更新状态栏
        progress = f"{chapter_index + 1}/{len(self.current_novel['chapters'])}"
        self.status_bar.config(text=f"正在阅读: {self.current_novel['title']} - {chapter['title']} ({progress})")
        
    def on_chapter_change(self, event):
        """处理章节选择变化"""
        if not self.current_novel:
            return
        
        current = self.chapter_combo.current()
        if current >= 0:
            self.load_chapter(current)
        
    def prev_chapter(self):
        """上一章"""
        if self.current_chapter > 0:
            self.load_chapter(self.current_chapter - 1)
        
    def next_chapter(self):
        """下一章"""
        if self.current_novel and self.current_chapter < len(self.current_novel['chapters']) - 1:
            self.load_chapter(self.current_chapter + 1)
        
    def update_font_size(self, value):
        """更新字体大小"""
        size = int(float(value))
        self.font_size_label.config(text=str(size))
        self.content_text.config(font=('微软雅黑', size))
        self.settings['font_size'] = size
        self.save_settings()
        
    def update_line_spacing(self, value):
        """更新行间距"""
        spacing = float(value)
        self.line_spacing_label.config(text=f"{spacing:.1f}")
        self.content_text.config(spacing2=int(spacing * 10))
        self.settings['line_spacing'] = spacing
        self.save_settings()
        
    def open_novel_folder(self):
        """打开小说文件夹"""
        novel_dir = Path("novel")
        if novel_dir.exists():
            os.startfile(novel_dir)
        else:
            messagebox.showinfo("提示", "novel文件夹不存在，已自动创建")
            novel_dir.mkdir(exist_ok=True)
            
    def reset_settings(self):
        """重置设置"""
        if messagebox.askyesno("确认", "确定要重置所有设置吗？"):
            self.settings = {}
            self.save_settings()
            self.font_size_var.set(12)
            self.line_spacing_var.set(1.5)
            messagebox.showinfo("提示", "设置已重置")
            
    def show_about(self):
        """显示关于信息"""
        about_text = """小说阅读器 v1.0.0

一个简洁优雅的小说阅读应用

功能特点：
• 支持txt格式小说
• 优雅的阅读体验
• 丰富的阅读设置
• 阅读进度自动保存

作者：小说阅读器团队
技术支持：Python + Tkinter"""
        
        messagebox.showinfo("关于小说阅读器", about_text)
        
    def load_settings(self):
        """加载设置"""
        try:
            with open('settings.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
        
    def save_settings(self):
        """保存设置"""
        try:
            with open('settings.json', 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, ensure_ascii=False, indent=2)
        except:
            pass
        
    def load_reading_progress(self):
        """加载阅读进度"""
        try:
            with open('reading_progress.json', 'r', encoding='utf-8') as f:
                self.reading_progress = json.load(f)
        except:
            self.reading_progress = {}
        
    def save_reading_progress(self):
        """保存阅读进度"""
        if not self.current_novel:
            return
        
        self.reading_progress[self.current_novel['title']] = {
            'chapter': self.current_chapter,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            with open('reading_progress.json', 'w', encoding='utf-8') as f:
                json.dump(self.reading_progress, f, ensure_ascii=False, indent=2)
        except:
            pass
        
    def on_closing(self):
        """关闭应用"""
        self.save_settings()
        self.save_reading_progress()
        self.root.destroy()

def main():
    """主函数"""
    root = tk.Tk()
    app = NovelReaderApp(root)
    
    # 加载阅读进度
    app.load_reading_progress()
    
    root.mainloop()

if __name__ == "__main__":
    main()