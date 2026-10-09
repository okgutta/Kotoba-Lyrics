# Kotoba Lyrics 歌词 API 文档

本文档描述 Kotoba Lyrics 当前的歌词获取管线、服务边界和缓存行为。

## 架构总览

Kotoba Lyrics 仅通过 **LYRIVA** 获取歌词：使用 `https://api.lyriva.xyz` 的 Unified API，通过 `/lyriva/lyrics` 一次请求获取最终歌词模型。

LYRIVA 端点支持匿名访问，无需填写歌词 API Key。翻译服务使用各自独立的密钥。

## LYRIVA 歌词接口

```text
GET https://api.lyriva.xyz/lyriva/lyrics
```

查询参数：

- `title`：当前歌曲标题
- `artist`：艺人名称
- `album`：专辑名称（可选）
- `duration`：歌曲时长，单位秒（可选）
- `isrc`：ISRC（可选）

请求头：

```http
Accept: application/json
X-Client-Name: Kotoba Lyrics
```

`X-Client-Name` 用于 LYRIVA 首页与后台的客户端名称显示，直连和代理回退请求都会携带。它不用于认证，浏览器原始 `User-Agent` 仍由服务端保留供后台排查。

成功响应的核心字段：

```json
{
  "data": {
    "track": { "title": "...", "artist": "..." },
    "plainLyrics": "...",
    "syncedLyrics": [
      {
        "startMs": 1234,
        "text": "你好",
        "words": [
          { "startMs": 1234, "durationMs": 280, "text": "你" },
          { "startMs": 1514, "durationMs": 360, "text": "好" }
        ]
      }
    ],
    "translation": "..."
  },
  "meta": {
    "matchLevel": "HIGH_CONFIDENCE",
    "matchScore": 0.98
  }
}
```

`syncedLyrics[].words` 提供逐字时间轴：`startMs` 是从歌曲起点计算的绝对毫秒数，`durationMs` 是该字或词的持续毫秒数，不是相对行起点的偏移。客户端将结束时间计算为 `startMs + durationMs`，同时兼容旧响应的绝对 `endMs` 字段；两者同时存在时以 `durationMs` 为准。

客户端优先使用有效逐字时间轴，逐字数据缺失或无效时回退到逐行歌词，无逐行时间轴时使用静态歌词。原始文本、空格和译文会保留。逐行歌词支持歌词源提供的整行罗马音；逐字和静态歌词暂不保证显示该字段。客户端会校验歌词文本、时间戳和匹配元数据；不满足可信度要求的数据不会进入渲染或持久缓存。

LYRIVA 歌词请求不携带 API Key、`Authorization` 或 Cookie。扩展优先从 Spotify 直接请求 API；如果服务端未允许 `https://xpui.app.spotify.com` Origin，则匿名回退到 Spicetify CORS 代理。翻译服务的认证不受此变更影响。

## 缓存与竞态保护

- 歌词缓存 key 为 Spotify track ID，模型同时保存完整 Spotify URI 与歌曲匹配信息。
- 仅复用来源为 LYRIVA、歌曲身份一致且匹配等级有效的歌词缓存；旧来源的缓存会重新获取。
- 客户端启动和切歌时会在歌词页外预取当前歌曲；打开歌词页时优先使用内存缓存，避免再次等待网络。
- 请求使用 generation + `AbortController` 保护；切歌、关闭页面或新请求开始时，旧请求不能更新当前页面、全局 store 或缓存。
- `spotify:local:*`、非 track URI 和格式错误 URI 不会访问缓存或远端来源。
- 仅在 LYRIVA 返回明确的 `not-found` 结果时写入 `NO_LYRICS` 负缓存；网络错误、限流、服务暂时不可用、响应解析失败或缺少 `data` 时作为可重试失败处理，不写负缓存。
- 缓存模型会在渲染前进行运行时结构校验。

## 翻译

翻译是独立管线，不属于歌词来源：

- Google 免费翻译
- DeepSeek
- ChatGPT
- 自定义 OpenAI 兼容 API

翻译缓存记录服务和歌曲身份；整首缓存可按歌词指纹复用其他服务已完成的译文。切换服务、当前服务的密钥、模型或自定义地址时会取消正在进行的翻译，过期响应不再写入缓存。
用户提供的 API Key 只会直连对应服务，不经过共享代理；自定义远程端点必须使用 HTTPS（本机回环地址除外）。

语言识别与本地增强会在歌词首帧显示后运行。客户端不再动态执行远程罗马音脚本；逐行歌词可使用 API 自带的罗马音，西里尔文字可使用随扩展打包的本地转换器补全。

## 开发命令

```bash
bun run dev
bun run build
bun run test
bun run lint
bun run typecheck
bun run check
```

构建产物为 `dist/kotoba-lyrics.js`。运行时仍保留历史 `/SpicyLyrics` 路由和 DOM/CSS namespace，以兼容已安装用户和 Spotify 页面结构。
