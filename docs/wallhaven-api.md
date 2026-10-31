# Wallhaven API v1 渐进式披漏笔记

来源：[wallhaven API v1 Documentation](https://wallhaven.cc/index.php/help/api)

更新时间：2026-05-15

> 这份文档按渐进式披漏整理：先给最小可用结论，再展开常用接口，最后补全参数、认证、限制和实现注意点。

## 第一层：30 秒可用版

Wallhaven API v1 是一组通过 URL 发起的 `GET` 接口，基础地址为：

```text
https://wallhaven.cc/api/v1
```

当前项目最常用的是搜索接口：

```text
GET https://wallhaven.cc/api/v1/search
```

常用分类参数：

| 场景 | categories |
| --- | --- |
| 综合/热门推荐 | `111` |
| 动漫精选 | `010` |
| 人物精选 | `001` |

常用过滤参数：

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `purity` | `100` | 内容分级，`100` 表示 SFW |
| `sorting` | `toplist` | 排序方式 |
| `atleast` | `3840x2160` | 最低分辨率 |
| `page` | `1` | 页码 |
| `q` | `landscape` | 搜索关键词 |

一个适合本项目的请求例子：

```text
GET /search?categories=111&purity=100&sorting=toplist&atleast=3840x2160&page=1
```

返回结果核心字段：

| 字段 | 用途 |
| --- | --- |
| `data[].id` | 壁纸 ID |
| `data[].path` | 原图地址 |
| `data[].thumbs.large` | 卡片缩略图 |
| `data[].thumbs.original` | 更接近原图比例的缩略图 |
| `data[].thumbs.small` | 下载记录等小尺寸预览 |
| `data[].resolution` | 分辨率文本 |
| `meta.current_page` | 当前页 |
| `meta.last_page` | 最后一页 |

## 第二层：常用接口

### 搜索和列表

```text
GET /search
```

用途：获取壁纸列表。Wallhaven 网站搜索页支持的大多数 URL 参数也可以用于 API。

常见用法：

```text
/search?categories=111&purity=100&sorting=hot&page=1
/search?categories=010&purity=100&sorting=toplist&atleast=3840x2160
/search?q=mountain&categories=111&purity=100
```

返回结构：

```ts
interface SearchResponse {
  data: WallpaperData[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    query?: string | { id: number; tag: string } | null
    seed?: string | null
  }
}
```

注意点：

- 每页最多返回 `24` 条。
- 搜索 `id:##` 这种精确标签时，`meta.query` 会变成标签对象。
- `sorting=random` 会返回 `meta.seed`，翻页时带上 seed 可以减少重复。

### 单张壁纸详情

```text
GET /w/<ID>
```

用途：获取某一张壁纸的完整信息，包括上传者、颜色、缩略图、标签等。

示例：

```text
/w/94x38z
```

NSFW 图片需要 API Key：

```text
/w/<ID>?apikey=<API_KEY>
```

详情接口比列表接口多出的常见字段：

| 字段 | 用途 |
| --- | --- |
| `uploader` | 上传者信息 |
| `colors` | 图片主色数组 |
| `tags` | 标签列表 |
| `source` | 来源 |

### 标签详情

```text
GET /tag/<ID>
```

用途：根据标签 ID 获取标签信息。

返回核心字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 标签 ID |
| `name` | 标签名 |
| `alias` | 别名 |
| `category` | 标签分类 |
| `purity` | 标签分级 |

### 用户设置

```text
GET /settings?apikey=<API_KEY>
```

用途：读取认证用户的浏览偏好，包括分级、分类、分辨率、比例、黑名单等。

典型字段：

| 字段 | 说明 |
| --- | --- |
| `thumb_size` | 默认缩略图尺寸偏好 |
| `per_page` | 每页数量 |
| `purity` | 用户允许的内容分级 |
| `categories` | 用户启用的分类 |
| `resolutions` | 用户偏好的分辨率 |
| `aspect_ratios` | 用户偏好的比例 |
| `toplist_range` | Toplist 默认时间范围 |
| `tag_blacklist` | 标签黑名单 |
| `user_blacklist` | 用户黑名单 |

### 用户收藏集

```text
GET /collections?apikey=<API_KEY>
GET /collections/<USERNAME>
GET /collections/<USERNAME>/<ID>
```

用途：

- 读取当前认证用户收藏集。
- 读取其他用户公开收藏集。
- 读取某个收藏集下的壁纸列表。

限制：

- 其他用户的私有收藏集不可访问。
- 收藏集列表里的壁纸结果结构与 `/search` 类似。
- 收藏集壁纸列表只支持 `purity` 过滤。

## 第三层：搜索参数查表

### q：搜索表达式

| 写法 | 说明 |
| --- | --- |
| `tagname` | 模糊搜索标签或关键词 |
| `-tagname` | 排除标签或关键词 |
| `+tag1 +tag2` | 必须同时包含 tag1 和 tag2 |
| `+tag1 -tag2` | 必须包含 tag1 且排除 tag2 |
| `@username` | 搜索某个用户上传的图片 |
| `id:123` | 精确标签搜索，不能与其他查询组合 |
| `type:png` | 搜索 PNG 文件 |
| `type:jpg` | 搜索 JPEG 文件 |
| `like:<wallpaper_id>` | 查找相似标签的壁纸 |

### categories：分类开关

`categories` 是三位二进制开关，顺序是：

```text
general / anime / people
```

| 值 | 含义 |
| --- | --- |
| `100` | 只看 General |
| `010` | 只看 Anime |
| `001` | 只看 People |
| `111` | 三类都看 |
| `101` | General + People |
| `011` | Anime + People |
| `110` | General + Anime |

### purity：内容分级开关

`purity` 也是三位二进制开关，顺序是：

```text
sfw / sketchy / nsfw
```

| 值 | 含义 |
| --- | --- |
| `100` | 只看 SFW |
| `010` | 只看 Sketchy |
| `001` | 只看 NSFW |
| `110` | SFW + Sketchy |
| `111` | 全部 |

NSFW 需要有效 API Key。

### sorting：排序方式

| 值 | 说明 |
| --- | --- |
| `date_added` | 最新添加 |
| `relevance` | 相关性 |
| `random` | 随机 |
| `views` | 浏览量 |
| `favorites` | 收藏数 |
| `toplist` | 排行 |
| `hot` | 热门 |

### order：排序方向

| 值 | 说明 |
| --- | --- |
| `desc` | 降序 |
| `asc` | 升序 |

### topRange：排行时间范围

仅当 `sorting=toplist` 时有意义。

| 值 | 说明 |
| --- | --- |
| `1d` | 1 天 |
| `3d` | 3 天 |
| `1w` | 1 周 |
| `1M` | 1 个月 |
| `3M` | 3 个月 |
| `6M` | 6 个月 |
| `1y` | 1 年 |

### 分辨率和比例

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `atleast` | `1920x1080` | 最低分辨率 |
| `resolutions` | `1920x1080,1920x1200` | 精确分辨率列表 |
| `ratios` | `16x9,16x10` | 宽高比列表 |

### colors：按颜色搜索

`colors` 使用十六进制颜色值，不带 `#`。

官方列出的可用色值包括：

```text
660000 990000 cc0000 cc3333 ea4c88 993399 663399 333399
0066cc 0099cc 66cccc 77cc33 669900 336600 666600 999900
cccc33 ffff00 ffcc33 ff9900 ff6600 cc6633 996633 663300
000000 999999 cccccc ffffff 424153
```

### page 和 seed

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `page` | `1` | 页码，不是无限滚动游标 |
| `seed` | `abc123` | 随机排序时使用，可减少翻页重复 |

## 第四层：认证、限流、错误

### 认证方式

API Key 可以通过两种方式传递：

```text
?apikey=<API_KEY>
```

或请求头：

```text
X-API-Key: <API_KEY>
```

建议应用内优先使用请求头，避免 API Key 出现在 URL、日志或错误上报里。

### 限流

官方限制为：

```text
45 requests / minute
```

触发限流时会返回：

```text
429 Too Many Requests
```

### 认证错误

以下情况会返回 `401 Unauthorized`：

- 未提供 API Key 却访问 NSFW 图片。
- API Key 无效。
- 访问需要认证的用户接口但认证失败。

### API 稳定性

官方说明 API 会尽量提前通知变更，但必要时可能无预告调整；API 以免费且按现状提供，不提供保证。

## 第五层：对当前项目的实现建议

### 搜索封装

当前项目已有 Rust 代理接口 `fetch_wallhaven_api`，建议继续由后端代理 Wallhaven API，避免前端 CORS 和 Referer 问题。

推荐前端只传业务参数：

```ts
wallhavenApi.search({
  categories: '111',
  purity: '100',
  sorting: 'toplist',
  atleast: '3840x2160',
  page: 1,
})
```

### 图片展示

列表卡片建议使用：

```ts
thumbs.large || thumbs.original || thumbs.small
```

详情弹窗建议先用缩略图过渡，再加载原图：

```ts
preview = thumbs.large || thumbs.original || thumbs.small
full = path
```

下载记录建议使用：

```ts
thumbs.small
```

### 分类菜单映射

当前菜单可以直接映射到 `categories`：

| 菜单 | categories |
| --- | --- |
| 热门推荐 | `111` |
| 动漫精选 | `010` |
| 人物精选 | `001` |

### 分页策略

使用 `meta.current_page` 和 `meta.last_page` 判断是否还有下一页：

```ts
hasMore = meta.current_page < meta.last_page
nextPage = meta.current_page + 1
```

### 错误处理建议

| 状态 | 用户提示 |
| --- | --- |
| `401` | 需要 API Key 或当前内容不可访问 |
| `429` | 请求太频繁，请稍后再试 |
| 网络错误 | 网络连接失败，请稍后重试 |
| JSON 解析失败 | API 响应格式异常 |

## 参考链接

- 官方 API 文档：https://wallhaven.cc/index.php/help/api
- 搜索接口：https://wallhaven.cc/api/v1/search
- 单图详情：https://wallhaven.cc/api/v1/w/<ID>
- 标签详情：https://wallhaven.cc/api/v1/tag/<ID>
- 用户设置：https://wallhaven.cc/api/v1/settings
- 收藏集：https://wallhaven.cc/api/v1/collections
