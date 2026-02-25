import re
from datetime import datetime

try:
    # 读取 sitemap.xml
    with open('sitemap.xml', 'r', encoding='utf-8') as f:
        content = f.read()

    # 替换 lastmod 日期
    current_date = datetime.now().strftime('%Y-%m-%d')
    content = re.sub(r'<lastmod>[\d-]+</lastmod>', f'<lastmod>{current_date}</lastmod>', content)

    # 写回文件
    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'sitemap.xml 已更新为: {current_date}')
except Exception as e:
    print(f'更新失败: {e}')
    input('按回车键退出...')