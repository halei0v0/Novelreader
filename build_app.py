#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小说阅读器打包脚本
使用PyInstaller打包为独立可执行文件
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_requirements():
    """检查必要的环境"""
    print("🔍 检查环境...")
    
    # 检查Python版本
    if sys.version_info < (3, 7):
        print("❌ 需要Python 3.7或更高版本")
        return False
    
    print(f"✅ Python版本: {sys.version}")
    
    # 检查PyInstaller
    try:
        import PyInstaller
        print(f"✅ PyInstaller已安装: {PyInstaller.__version__}")
    except ImportError:
        print("❌ PyInstaller未安装，正在安装...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✅ PyInstaller安装完成")
    
    return True

def create_icon():
    """创建应用图标"""
    icon_path = Path("icon.ico")
    if not icon_path.exists():
        print("🎨 创建应用图标...")
        
        # 这里可以创建一个简单的图标文件
        # 由于无法直接创建ICO文件，我们跳过这一步
        print("⚠️ 跳过图标创建，将使用默认图标")
    
    return icon_path

def build_executable():
    """构建可执行文件"""
    print("🔨 开始构建可执行文件...")
    
    # 清理之前的构建
    for dir_name in ["build", "dist"]:
        if Path(dir_name).exists():
            shutil.rmtree(dir_name)
    
    # 构建命令
    cmd = [
        "pyinstaller",
        "--onefile",                    # 单文件模式
        "--windowed",                   # 无控制台窗口
        "--name=小说阅读器",            # 应用名称
        "--add-data=novel;novel",       # 添加novel文件夹
        "--clean",                      # 清理临时文件
        "novel_reader.py"               # 主程序文件
    ]
    
    # 如果有图标文件，添加图标
    icon_path = create_icon()
    if icon_path.exists():
        cmd.insert(-1, f"--icon={icon_path}")
    
    try:
        subprocess.check_call(cmd)
        print("✅ 构建完成！")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ 构建失败: {e}")
        return False

def create_portable_package():
    """创建便携版包"""
    print("📦 创建便携版包...")
    
    dist_dir = Path("dist")
    portable_dir = dist_dir / "小说阅读器_便携版"
    
    # 创建便携版目录
    portable_dir.mkdir(parents=True, exist_ok=True)
    
    # 复制可执行文件
    exe_file = dist_dir / "小说阅读器.exe"
    if exe_file.exists():
        shutil.copy2(exe_file, portable_dir / "小说阅读器.exe")
    
    # 复制novel文件夹
    novel_src = Path("novel")
    novel_dst = portable_dir / "novel"
    if novel_src.exists():
        if novel_dst.exists():
            shutil.rmtree(novel_dst)
        shutil.copytree(novel_src, novel_dst)
    else:
        novel_dst.mkdir(exist_ok=True)
        # 创建说明文件
        with open(novel_dst / "请在此处放入txt小说文件.txt", "w", encoding="utf-8") as f:
            f.write("请将txt格式的小说文件放入此文件夹中\n\n支持的文件格式：\n- .txt文件\n\n建议的文件格式：\n小说标题\n作者：作者名称\n简介：\n小说简介内容\n===\n第一章 章节标题\n章节内容...")
    
    # 创建启动脚本
    start_script = portable_dir / "启动小说阅读器.bat"
    with open(start_script, "w", encoding="gbk") as f:
        f.write('@echo off\necho 正在启动小说阅读器...\necho.\nstart "" "小说阅读器.exe"\n')
    
    # 创建说明文件
    readme_file = portable_dir / "使用说明.txt"
    with open(readme_file, "w", encoding="utf-8") as f:
        f.write("""小说阅读器使用说明

1. 运行方法：
   - 双击"启动小说阅读器.bat"或直接运行"小说阅读器.exe"

2. 添加小说：
   - 将txt格式的小说文件放入novel文件夹中
   - 点击应用中的"刷新列表"按钮

3. 阅读设置：
   - 可在阅读界面调整字体大小和行间距
   - 设置会自动保存

4. 阅读进度：
   - 阅读进度会自动保存
   - 下次打开时会恢复到上次阅读位置

5. 支持的文件格式：
   - txt格式（推荐UTF-8编码）
   - 文件大小建议不超过50MB

6. 故障排除：
   - 如果小说无法显示，请检查文件编码
   - 如果出现乱码，请将文件转换为UTF-8编码

版本：1.0.0
更新日期：2024年
""")
    
    print(f"✅ 便携版包创建完成：{portable_dir}")
    return portable_dir

def main():
    """主函数"""
    print("🚀 小说阅读器打包工具")
    print("=" * 50)
    
    # 检查环境
    if not check_requirements():
        print("❌ 环境检查失败，无法继续")
        return
    
    # 构建可执行文件
    if not build_executable():
        print("❌ 构建失败，请检查错误信息")
        return
    
    # 创建便携版包
    portable_dir = create_portable_package()
    
    print("=" * 50)
    print("🎉 打包完成！")
    print(f"📁 可执行文件：dist/小说阅读器.exe")
    print(f"📦 便携版包：{portable_dir}")
    print()
    print("💡 使用说明：")
    print("1. 可执行文件可以直接运行")
    print("2. 便携版包包含完整的运行环境")
    print("3. 建议分发便携版包给其他用户")
    print()
    print("🔧 测试运行：")
    if portable_dir and (portable_dir / "小说阅读器.exe").exists():
        print("是否立即测试运行？(y/n): ", end="")
        try:
            choice = input().lower()
            if choice == 'y':
                os.startfile(portable_dir / "小说阅读器.exe")
        except:
            pass

if __name__ == "__main__":
    main()
