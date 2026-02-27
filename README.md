# Toggle Recent Tabs

一个 Chrome 扩展，用于快速切换最近访问的标签页。

## 功能

- **短按快捷键**：快速切换到上一个访问的标签页
- **长按快捷键**：显示弹窗，可选择最近访问的 5 个标签页
- **自定义快捷键**：支持自定义修饰键（Shift/Ctrl/Alt/Meta）+ 任意按键组合

## 安装

1. 下载或克隆此仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本项目目录

## 使用方法

1. 点击扩展图标，按下你想要的快捷键组合（默认 Hyper+Tab）
2. 保存配置
3. 在任意页面使用配置的快捷键：

   - **短按**（< 100ms）：快速切换到上一个标签页
   - **长按**（> 100ms）：显示标签页选择弹窗，可继续按 Tab 键切换高亮，松开修饰键确认选择

## 项目结构

```
├── manifest.json    # 扩展配置
├── background.js    # 后台脚本，管理标签页访问历史
├── content.js       # 内容脚本，处理快捷键和弹窗
├── popup.html       # 弹窗页面，配置快捷键
└── popup.js         # 弹窗脚本
```

## 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript

## License

MIT