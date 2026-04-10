# Toggle Tab

一个 Chrome 扩展，用于通过自定义快捷键快速切换最近访问的标签页。

## 功能

- **短按快捷键**：快速切换到上一个访问的标签页
- **长按快捷键**：显示最近标签列表，可继续按键轮换选择
- **自定义快捷键**：支持自定义修饰键（Shift/Ctrl/Alt/Meta）+ 任意按键组合
- **本地存储配置**：仅在本地保存快捷键配置和最近标签状态

## 安装

1. 下载或克隆此仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本项目目录

## 上架准备

仓库已包含 Chrome Web Store 发布所需的基础材料：

- `manifest.json`：MV3 清单与图标配置
- `icons/`：扩展图标（16/32/48/128）
- `store-assets/`：Chrome Web Store 上架素材（图标、截图、原始素材）
- `PRIVACY.md`：隐私政策
- `STORE_LISTING.md`：商店标题、简介、详细描述、权限说明

建议额外准备：

- 1 到 5 张商店截图
- 一张 1280x800 或 640x400 的宣传图（可选但建议）
- Chrome Web Store 开发者账号

### 上架素材说明

`store-assets/` 目录中的素材已经按用途拆分：

- `store-assets/source/`：原始素材备份
- `store-assets/icons/`：Chrome Web Store 后台直接可上传的商店图标
- `store-assets/screenshots/`：Chrome Web Store 后台直接可上传的商店截图

当前可直接使用的文件：

- 原始图标：`store-assets/source/icon-source-keyboard-tab-switcher.png`
- 原始截图：`store-assets/source/screenshot-source-overview.png`
- 商店图标：`store-assets/icons/chrome-web-store-icon-128.png`
- 商店截图：`store-assets/screenshots/screenshot-01-overview-1280x800.png`
- 扩展运行图标：`icons/icon16.png`、`icons/icon32.png`、`icons/icon48.png`、`icons/icon128.png`

### Chrome Web Store 提交流程

1. 在开发者后台上传扩展包 `toggle-tab-v1.0.0.zip`
2. 在商品详情页填写标题、摘要和说明，可直接参考 `STORE_LISTING.md`
3. 在隐私权相关页面填写权限用途说明，并提供 `PRIVACY.md` 对应的公开链接
4. 上传 `store-assets/icons/chrome-web-store-icon-128.png` 作为商店图标
5. 上传 `store-assets/screenshots/` 下的截图作为商品截图
6. 检查权限说明、语言和分类后提交审核

## 使用方法

1. 点击扩展图标，按下你想要的快捷键组合（默认 Hyper+Tab）
2. 保存配置
3. 在任意页面使用配置的快捷键：

   - **短按**（< 100ms）：快速切换到上一个标签页
   - **长按**（> 100ms）：显示标签页选择弹窗，可继续按 Tab 键切换高亮，松开修饰键确认选择

## 项目结构

```text
├── manifest.json      # 扩展配置
├── background.js      # 后台脚本，管理标签页访问历史
├── content.js         # 内容脚本，处理快捷键和弹窗
├── popup.html         # 弹窗页面，配置快捷键
├── popup.js           # 弹窗脚本
├── icons/             # 发布图标资源
├── store-assets/      # Chrome Web Store 上架素材
│   ├── source/        # 原始素材备份
│   ├── icons/         # 商店图标
│   └── screenshots/   # 商店截图
├── PRIVACY.md         # 隐私政策
└── STORE_LISTING.md   # Chrome Web Store 文案
```

## 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript

## License

MIT

## 开源

该项目适合公开托管在 GitHub 等代码平台，并在 Chrome Web Store 说明中附上仓库地址。
如果你准备公开发布，建议同时补充：

- 仓库主页链接
- 支持邮箱或 issue 地址
- `PRIVACY.md` 的公开访问链接
