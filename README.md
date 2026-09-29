# Kotoba Lyrics

为 Spotify 提供逐字同步歌词、翻译和沉浸式显示的 Spicetify 扩展。

[下载安装](https://github.com/okgutta/Kotoba-Lyrics/releases/latest) · [更新日志](https://github.com/okgutta/Kotoba-Lyrics/releases) · [反馈问题](https://github.com/okgutta/Kotoba-Lyrics/issues)

## 功能

- 逐字歌词、罗马音与中文翻译。
- 全屏、独立窗口和播放侧栏歌词。
- 自定义字体、字号、行距和背景，支持自动更新。

## 安装

先安装 [Spicetify](https://spicetify.app/docs/getting-started/)。

1. 下载最新 Release 中的 [kotoba-lyrics.js](https://github.com/okgutta/Kotoba-Lyrics/releases/latest/download/kotoba-lyrics.js)。
2. 放入 Spicetify 的 `Extensions` 文件夹；已安装用户覆盖同名文件。
3. 执行：

```bash
spicetify config extensions kotoba-lyrics.js
spicetify apply
```

播放歌曲后，点击播放栏的 **Kotoba Lyrics** 打开歌词。设置和更新入口位于歌词页齿轮或 Spotify 菜单。

旧用户先运行 `spicetify config extensions lyrivamusic.js-` 移除旧文件的启用记录，再按上述步骤安装。原有设置与缓存保留。插件商店搜索 **Kotoba Lyrics**；若仍显示旧名称，请完整退出并重新打开 Spotify。

## 开发

```bash
git clone https://github.com/okgutta/Kotoba-Lyrics.git
cd Kotoba-Lyrics
bun install --frozen-lockfile
bun run check
bun run build -- --no-copy
```

## 致谢与许可

基于 [Spikerko / Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) 开发，遵循 [AGPL-3.0-or-later](LICENSE)。详见 [NOTICE](NOTICE.md)。
