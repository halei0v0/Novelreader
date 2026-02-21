# GitHub Pages 部署指南

## 部署步骤

### 1. 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 创建新仓库，命名为 `novelreader`
3. 设置为 Public（公开）
4. 点击 "Create repository"

### 2. 初始化本地 Git 仓库

```bash
# 在项目根目录执行
cd F:\Github项目\Novelreader

# 初始化 Git
git init

# 添加所有文件
git add .

# 提交
git commit -m "初始提交：小说阅读器"

# 关联远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/novelreader.git

# 推送到 GitHub
git push -u origin main
```

### 3. 启用 GitHub Pages

1. 进入仓库页面
2. 点击 "Settings"
3. 左侧菜单找到 "Pages"
4. 在 "Build and deployment" 部分：
   - Source 选择 "Deploy from a branch"
   - Branch 选择 `main` 分支
   - Folder 选择 `/ (root)`
5. 点击 "Save"

### 4. 等待部署完成

- GitHub 会自动构建并部署
- 大约 1-2 分钟后，你的网站就可以通过以下地址访问：
  ```
  https://你的用户名.github.io/novelreader/
  ```

## 注意事项

### 文件大小限制

- 单个文件最大 100 MB
- 每月带宽 100 GB
- 存储空间 1 GB

### 当前项目文件大小

- `novel_2.json` (17.01 MB) ✅
- `novel_0.json` (9.55 MB) ✅
- `novel_1.json` (9.60 MB) ✅
- `novel_3.json` (11.02 MB) ✅

**总计约 47 MB，完全在限制范围内！**

### 优化建议

如果文件过大，可以考虑：
1. 将超长小说拆分为多个文件
2. 压缩存储章节内容
3. 使用懒加载技术

## 常见问题

### Q: 为什么 GitHub Pages 无法正常工作？

A: 检查：
- 文件路径是否正确（区分大小写）
- 文件是否都在仓库根目录
- 是否启用了 HTTPS

### Q: 如何更新网站？

A:
```bash
git add .
git commit -m "更新小说"
git push
```

### Q: 可以使用自定义域名吗？

A: 可以！在 GitHub Pages 设置中添加自定义域名

## 部署后访问

部署成功后，访问：
```
https://你的用户名.github.io/novelreader/
```

即可看到你的小说阅读器网站！