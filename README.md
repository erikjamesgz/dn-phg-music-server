# 拼好歌 后端服务框架(Deno Deploy)

这是一个用 Deno Deploy 实现的 拼好歌 后台服务框架，此后端服务不提供任何数据，仅提供脚本运行环境和能力，数据全部由用户自行导入的第三方脚本提供，此项目参考洛雪音乐源码编写（抄来的），兼容洛雪音乐的第三方音源脚本（部分兼容）。

## 功能特性

- ✅ 兼容洛雪音乐第三方音源脚本 API
- ✅ 支持 `lx.request()` HTTP 请求
- ✅ 支持 `lx.on('request')` 事件机制
- ✅ 支持 `lx.send('inited')` 初始化
- ✅ 支持 `lx.utils.crypto` 加密工具
- ✅ 支持 `lx.utils.buffer` 缓冲区操作
- ✅ 支持 `lx.utils.zlib` 压缩操作
- ✅ 脚本存储和管理
- ✅ 完整的 RESTful API
- ✅ 支持 URL/文件导入脚本
- ✅ 支持设置默认音源
- ✅ 音乐URL缓存
- ✅ 跨平台搜索（酷我/酷狗/QQ/网易云/咪咕）
- ✅ 歌单解析（支持短链接）

## 快速开始

### 1. 安装 Deno

```bash
curl -fsSL https://deno.land/x/install/install.sh | sh
```

### 2. 本地运行

```bash
deno run --allow-all --watch main.ts
```

### 3. 部署到 Deno Deploy

```bash
export DENO_DEPLOY_TOKEN='your-token'
./deploy.sh
```

## API 前缀说明

服务启动后会生成一个随机的 API Key（32位字符），部分接口需要在路径中包含此 Key。

- **公开接口**：无需 API Key，如 `/api/music/url`、`/api/search`
- **管理接口**：需要 API Key，如 `/{apiKey}/api/scripts`

API Key 可通过环境变量 `API_KEY` 指定，或由系统自动生成并保存在 `./data/api_key.json` 中。

---

## API 文档

### 统一响应格式

所有接口返回统一的 JSON 格式：

```json
{
  "code": 200,
  "msg": "success",
  "data": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 状态码：200=成功，400=参数错误，404=未找到，500=服务器错误 |
| msg | string | 响应消息 |
| data | object/null | 响应数据，失败时可能为 null |

---

## 一、服务状态接口

### 1.1 获取服务状态

```http
GET /api/status
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "scriptCount": 3,
    "activeRequests": 0,
    "timestamp": 1734567890123,
    "defaultSource": {
      "id": "user_api_abc123",
      "name": "六音音源",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
    }
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| scriptCount | number | 已加载的脚本数量 |
| activeRequests | number | 当前活跃的请求数量 |
| timestamp | number | 服务器时间戳（毫秒） |
| defaultSource | object/null | 默认音源信息，未设置时为 null |
| defaultSource.id | string | 音源脚本ID |
| defaultSource.name | string | 音源名称 |
| defaultSource.supportedSources | string[] | 支持的音乐平台代码列表 |

---

## 二、脚本管理接口

### 2.1 获取已加载音源列表

```http
GET /{apiKey}/api/scripts/loaded
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "id": "user_api_abc123",
      "name": "六音音源",
      "description": "多平台音乐源",
      "author": "作者名",
      "homepage": "https://example.com",
      "version": "1.0.0",
      "createdAt": "2024-01-15 10:30:00",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"],
      "isDefault": true
    }
  ]
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 脚本唯一标识 |
| name | string | 音源名称 |
| description | string | 音源描述 |
| author | string | 作者 |
| homepage | string | 主页地址 |
| version | string | 版本号 |
| createdAt | string | 创建时间（格式：YYYY-MM-DD HH:mm:ss） |
| supportedSources | string[] | 支持的平台代码：kw=酷我, kg=酷狗, tx=QQ音乐, wy=网易云, mg=咪咕 |
| isDefault | boolean | 是否为默认音源 |

### 2.2 获取默认音源

```http
GET /{apiKey}/api/scripts/default
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "defaultSource": {
      "id": "user_api_abc123",
      "name": "六音音源",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
    },
    "scripts": [
      {
        "id": "user_api_abc123",
        "name": "六音音源",
        "supportedSources": ["kw", "kg", "tx", "wy", "mg"],
        "isDefault": true
      }
    ]
  }
}
```

### 2.3 导入脚本（内容）

```http
POST /{apiKey}/api/scripts
Content-Type: application/json

{
  "script": "/* @name xxx ... */ 脚本内容"
}
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| script | string | 是 | 脚本内容，也可以传入URL自动下载 |

**响应示例：**

```json
{
  "code": 201,
  "msg": "脚本导入成功",
  "data": {
    "apiInfo": {
      "id": "user_api_abc123",
      "name": "六音音源",
      "description": "描述",
      "author": "作者",
      "homepage": "https://example.com",
      "version": "1.0.0",
      "rawScript": "...",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
    },
    "loaded": true
  }
}
```

### 2.4 从 URL 导入脚本

```http
POST /{apiKey}/api/scripts/import/url
Content-Type: application/json

{
  "url": "https://example.com/source.js"
}
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 脚本下载地址 |

**响应示例：**

```json
{
  "code": 200,
  "msg": "从URL导入成功",
  "data": {
    "success": true,
    "defaultSource": {
      "id": "user_api_abc123",
      "name": "六音音源",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
    },
    "scripts": [...]
  }
}
```

**常用音源 URL：**

| 音源名称 | URL |
|---------|-----|
| 六音音源 | `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js` |
| Huibq音源 | `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/huibq/latest.js` |
| 花样音源 | `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/flower/latest.js` |
| ikun公益音源 | `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/ikun/latest.js` |
| 聚合API | `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/juhe/latest.js` |

### 2.5 从文件导入脚本

```http
POST /{apiKey}/api/scripts/import/file
Content-Type: application/json

{
  "script": "/* @name xxx ... */ 脚本内容",
  "fileName": "my-source.js"
}
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| script | string | 是 | 脚本文件内容 |
| fileName | string | 否 | 文件名（可选） |

也支持 `multipart/form-data` 格式上传文件。

### 2.6 设置默认音源

```http
POST /{apiKey}/api/scripts/default
Content-Type: application/json

{
  "id": "user_api_abc123"
}
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 脚本ID |

**响应示例：**

```json
{
  "code": 200,
  "msg": "默认音源已设置为: 六音音源",
  "data": {
    "success": true,
    "defaultSource": {
      "id": "user_api_abc123",
      "name": "六音音源",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
    },
    "scripts": [...]
  }
}
```

### 2.7 删除脚本

```http
POST /{apiKey}/api/scripts/delete
Content-Type: application/json

{
  "id": "user_api_abc123"
}
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 要删除的脚本ID |

**响应示例：**

```json
{
  "code": 200,
  "msg": "脚本已删除",
  "data": {
    "success": true,
    "defaultSource": {
      "id": "user_api_xyz789",
      "name": "其他音源",
      "supportedSources": ["kw", "kg"]
    },
    "scripts": [...]
  }
}
```

**注意**：如果删除的是默认音源，系统会自动将剩余的第一个音源设为默认。

---

## 三、音乐播放接口

### 3.1 获取音乐播放URL

```http
POST /api/music/url
Content-Type: application/json
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source | string | 是 | 音乐平台代码：kw=酷我, kg=酷狗, tx=QQ音乐, wy=网易云, mg=咪咕 |
| quality | string | 是 | 音质：128k, 320k, flac, flac24bit |
| songmid | string | 否 | 歌曲ID（通用字段，优先使用） |
| id | string | 否 | 歌曲ID（songmid的别名） |
| name | string | 否 | 歌曲名称（用于换源匹配） |
| singer | string | 否 | 歌手名称（用于换源匹配） |
| hash | string | 否 | 酷狗专用：歌曲hash |
| songId | string | 否 | 酷狗/QQ/网易云专用：歌曲ID |
| copyrightId | string | 否 | 咪咕专用：版权ID |
| strMediaMid | string | 否 | QQ音乐专用：媒体ID |
| interval | string | 否 | 歌曲时长（格式：mm:ss，用于换源匹配） |
| albumName | string | 否 | 专辑名称（用于换源匹配） |
| musicInfo | object | 否 | 完整歌曲信息对象（可替代上述字段） |
| allowToggleSource | boolean | 否 | 是否允许换源，默认true |
| excludeSources | string[] | 否 | 换源时排除的平台列表 |

**请求示例：**

```json
{
  "source": "kw",
  "songmid": "MUSIC_12345678",
  "quality": "320k",
  "name": "演员",
  "singer": "薛之谦",
  "interval": "04:30"
}
```

**响应示例（成功）：**

```json
{
  "code": 200,
  "msg": "获取成功",
  "data": {
    "url": "https://example.com/music.mp3",
    "type": "320k",
    "source": "kw",
    "quality": "320k",
    "lyric": "[00:00.00]歌词内容...",
    "tlyric": "[00:00.00]翻译歌词...",
    "rlyric": "[00:00.00]罗马音歌词...",
    "lxlyric": "[00:00.00]逐字歌词...",
    "cached": false,
    "fallback": {
      "toggled": false,
      "originalSource": "kw"
    }
  }
}
```

**响应示例（换源成功）：**

```json
{
  "code": 200,
  "msg": "获取成功（换源）",
  "data": {
    "url": "https://example.com/music.mp3",
    "type": "320k",
    "source": "kg",
    "quality": "320k",
    "lyric": "...",
    "tlyric": "...",
    "rlyric": "...",
    "lxlyric": "...",
    "cached": false,
    "fallback": {
      "toggled": true,
      "originalSource": "kw",
      "newSource": "kg",
      "matchedSong": {
        "name": "演员",
        "singer": "薛之谦"
      }
    }
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| url | string | 播放地址 |
| type | string | 实际音质类型 |
| source | string | 实际获取成功的平台代码 |
| quality | string | 请求的音质 |
| lyric | string | 原始歌词（LRC格式） |
| tlyric | string | 翻译歌词（LRC格式） |
| rlyric | string | 罗马音歌词（LRC格式） |
| lxlyric | string | 逐字歌词（LRC格式，带时间标签） |
| cached | boolean | 是否来自缓存 |
| fallback.toggled | boolean | 是否发生了换源 |
| fallback.originalSource | string | 原始请求的平台 |
| fallback.newSource | string | 换源后的平台（仅toggled=true时存在） |
| fallback.matchedSong | object | 换源匹配到的歌曲信息 |

### 3.2 获取歌词

```http
POST /api/music/lyric
Content-Type: application/json
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source | string | 是 | 音乐平台代码 |
| songId | string | 是 | 歌曲ID |
| name | string | 否 | 歌曲名称（咪咕、酷狗需要） |
| singer | string | 否 | 歌手名称（咪咕需要） |

**请求示例：**

```json
{
  "source": "kw",
  "songId": "MUSIC_12345678"
}
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "获取歌词成功",
  "data": {
    "lyric": "[00:00.00]歌词内容...",
    "tlyric": "[00:00.00]翻译歌词...",
    "rlyric": "[00:00.00]罗马音歌词...",
    "lxlyric": "[00:00.00]逐字歌词..."
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| lyric | string | 原始歌词（LRC格式） |
| tlyric | string | 翻译歌词（LRC格式），无则为空字符串 |
| rlyric | string | 罗马音歌词（LRC格式），无则为空字符串 |
| lxlyric | string | 逐字歌词（LRC格式），无则为空字符串 |

**各平台歌词获取参数说明：**

| 平台 | source | 必需参数 | 说明 |
|------|--------|----------|------|
| 酷我 | kw | songId | songId 即 songmid |
| 酷狗 | kg | songId, name | songId 即 hash，name 为歌曲名 |
| QQ音乐 | tx | songId | songId 即 songmid |
| 网易云 | wy | songId | songId 即歌曲数字ID |
| 咪咕 | mg | songId, name, singer | songId 即 copyrightId |

### 3.3 获取封面图

```http
POST /api/music/pic
Content-Type: application/json
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source | string | 是 | 音乐平台代码 |
| songmid | string | 是 | 歌曲ID |
| name | string | 是 | 歌曲名称 |
| singer | string | 是 | 歌手名称 |

**响应示例：**

```json
{
  "code": 200,
  "msg": "获取成功",
  "data": {
    "url": "https://example.com/cover.jpg"
  }
}
```

---

## 四、搜索接口

### 4.1 搜索歌曲

```http
GET /api/search?keyword=演员&source=kw&page=1&limit=20
```

**请求参数（Query String）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| source | string | 否 | 指定平台，不传则搜索所有平台 |
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认20 |

**响应示例：**

```json
{
  "code": 200,
  "msg": "搜索成功",
  "data": {
    "keyword": "演员",
    "page": 1,
    "limit": 20,
    "results": [
      {
        "platform": "kw",
        "name": "酷我音乐",
        "keyword": "演员",
        "page": 1,
        "results": [
          {
            "id": "MUSIC_12345678",
            "name": "演员",
            "singer": "薛之谦",
            "album": "绅士",
            "source": "kw",
            "interval": 270,
            "hash": "MUSIC_12345678",
            "musicInfo": {
              "id": "MUSIC_12345678",
              "name": "演员",
              "singer": "薛之谦",
              "album": "绅士",
              "duration": 270,
              "interval": 270,
              "songmid": "MUSIC_12345678",
              "hash": "MUSIC_12345678",
              "albumid": "12345"
            }
          }
        ]
      }
    ]
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| results | array | 搜索结果数组，每个元素代表一个平台的搜索结果 |
| results[].platform | string | 平台代码 |
| results[].name | string | 平台名称 |
| results[].results | array | 该平台的歌曲列表 |
| results[].results[].id | string | 歌曲ID |
| results[].results[].name | string | 歌曲名称 |
| results[].results[].singer | string | 歌手名称 |
| results[].results[].album | string | 专辑名称 |
| results[].results[].source | string | 平台代码 |
| results[].results[].interval | number | 歌曲时长（秒） |
| results[].results[].hash | string | 歌曲hash（用于播放） |
| results[].results[].musicInfo | object | 完整歌曲信息，可直接用于播放接口 |

---

## 五、歌单接口

### 5.1 获取歌单详情

```http
POST /api/songlist/detail
Content-Type: application/json
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source | string | 是 | 平台代码：wy, tx, kg, kw, mg |
| id | string | 是 | 歌单ID或歌单链接 |

**请求示例：**

```json
{
  "source": "wy",
  "id": "123456789"
}
```

也支持直接传入歌单链接：

```json
{
  "source": "wy",
  "id": "https://music.163.com/playlist?id=123456789"
}
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "获取歌单详情成功",
  "data": {
    "list": [
      {
        "id": "123456",
        "name": "演员",
        "singer": "薛之谦",
        "albumName": "绅士",
        "albumId": "789",
        "interval": "04:30",
        "source": "wy",
        "songmid": "123456",
        "img": "https://example.com/cover.jpg"
      }
    ],
    "page": 1,
    "limit": 100,
    "total": 50,
    "source": "wy",
    "info": {
      "name": "我的歌单",
      "img": "https://example.com/playlist_cover.jpg",
      "desc": "歌单描述",
      "author": "创建者昵称",
      "play_count": "10.5万"
    }
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| list | array | 歌曲列表 |
| list[].id | string | 歌曲ID |
| list[].name | string | 歌曲名称 |
| list[].singer | string | 歌手名称 |
| list[].albumName | string | 专辑名称 |
| list[].albumId | string | 专辑ID |
| list[].interval | string | 歌曲时长（格式：mm:ss） |
| list[].source | string | 平台代码 |
| list[].songmid | string | 歌曲ID（用于播放） |
| list[].hash | string | 歌曲hash（酷狗） |
| list[].copyrightId | string | 版权ID（咪咕） |
| list[].img | string | 封面图地址 |
| page | number | 当前页码 |
| limit | number | 每页数量 |
| total | number | 歌曲总数 |
| source | string | 平台代码 |
| info | object | 歌单信息 |
| info.name | string | 歌单名称 |
| info.img | string | 歌单封面 |
| info.desc | string | 歌单描述 |
| info.author | string | 创建者 |
| info.play_count | string | 播放次数 |

### 5.2 通过短链接获取歌单详情

```http
POST /api/songlist/detail/by-link
Content-Type: application/json
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| link | string | 是 | 歌单分享链接（支持短链接） |
| source | string | 否 | 指定平台（可选，不传则自动识别） |

**请求示例：**

```json
{
  "link": "https://music.163.com/#/playlist?id=123456789"
}
```

或短链接：

```json
{
  "link": "https://surl.cn/abc123"
}
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "获取歌单详情成功",
  "data": {
    "list": [...],
    "page": 1,
    "limit": 100,
    "total": 50,
    "source": "wy",
    "info": {...},
    "parsed": {
      "source": "wy",
      "id": "123456789"
    }
  }
}
```

**支持的歌单链接格式：**

| 平台 | 支持的链接格式 |
|------|---------------|
| 网易云 | `music.163.com/playlist?id=xxx`、`music.163.com/#/playlist?id=xxx` |
| QQ音乐 | `y.qq.com/n/yqq/playlist/xxx.html`、`i.y.qq.com/n2/m/share/details/taoge.html?id=xxx` |
| 酷狗 | `kugou.com/yy/special/single/xxx.html`、分享短链接 |
| 酷我 | `kuwo.cn/playlist_detail/xxx`、`m.kuwo.cn/h5app/playlist/xxx` |
| 咪咕 | `music.migu.cn/v3/music/playlist/xxx`、`h5.nf.migu.cn/app/v4/p/share/playlist/index.html?id=xxx` |

---

## 六、缓存管理接口

### 6.1 开启/关闭音乐URL缓存

```http
POST /api/cache/music-url/enable
Content-Type: application/json

{
  "enabled": true
}
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| enabled | boolean/number | 是 | true/1=开启，false/0=关闭 |

**响应示例：**

```json
{
  "code": 200,
  "msg": "音乐URL缓存已开启",
  "data": {
    "enabled": true,
    "cacheCount": 150
  }
}
```

### 6.2 获取缓存状态

```http
GET /api/cache/music-url/status
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "enabled": true,
    "cacheCount": 150
  }
}
```

### 6.3 清除缓存

```http
POST /api/cache/music-url/clear
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "音乐URL缓存已清除",
  "data": {
    "cleared": true
  }
}
```

---

## 七、通用请求接口

### 7.1 发送请求

```http
POST /api/request
Content-Type: application/json
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| requestKey | string | 是 | 请求唯一标识 |
| data | object | 是 | 请求数据对象 |
| data.source | string | 是 | 平台代码 |
| data.action | string | 是 | 操作类型：musicUrl, lyric, pic |
| data.info | object | 是 | 操作参数 |

**请求示例：**

```json
{
  "requestKey": "req_123456",
  "data": {
    "source": "kw",
    "action": "musicUrl",
    "info": {
      "type": "320k",
      "musicInfo": {
        "id": "MUSIC_12345678",
        "name": "演员",
        "singer": "薛之谦",
        "songmid": "MUSIC_12345678",
        "source": "kw"
      }
    }
  }
}
```

### 7.2 取消请求

```http
DELETE /api/request/{requestKey}
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "请求已取消",
  "data": {
    "requestKey": "req_123456"
  }
}
```

---

## 八、平台代码对照表

| 代码 | 平台 | 说明 |
|------|------|------|
| kw | 酷我音乐 | Kuwo Music |
| kg | 酷狗音乐 | Kugou Music |
| tx | QQ音乐 | QQ Music |
| wy | 网易云音乐 | NetEase Cloud Music |
| mg | 咪咕音乐 | Migu Music |

---

## 九、音质代码对照表

| 代码 | 音质 | 说明 |
|------|------|------|
| 128k | 标准音质 | 128kbps MP3 |
| 320k | 高品质 | 320kbps MP3 |
| flac | 无损音质 | FLAC |
| flac24bit | Hi-Res | 24bit FLAC |

**注意**：实际可用音质取决于各平台和歌曲本身的支持情况。

---

## 十、curl 测试命令

### 10.1 检查服务状态

```bash
curl http://localhost:8080/api/status
```

### 10.2 从URL导入音源脚本

```bash
curl -X POST http://localhost:8080/{apiKey}/api/scripts/import/url \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js"}'
```

### 10.3 获取已加载音源

```bash
curl http://localhost:8080/{apiKey}/api/scripts/loaded
```

### 10.4 设置默认音源

```bash
curl -X POST http://localhost:8080/{apiKey}/api/scripts/default \
  -H 'Content-Type: application/json' \
  -d '{"id":"user_api_abc123"}'
```

### 10.5 搜索歌曲

```bash
curl "http://localhost:8080/api/search?keyword=演员&source=kw&page=1&limit=10"
```

### 10.6 获取播放URL

```bash
curl -X POST http://localhost:8080/api/music/url \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "kw",
    "songmid": "MUSIC_12345678",
    "name": "演员",
    "singer": "薛之谦",
    "quality": "320k"
  }'
```

### 10.7 获取歌词

```bash
curl -X POST http://localhost:8080/api/music/lyric \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "kw",
    "songId": "MUSIC_12345678"
  }'
```

### 10.8 获取歌单详情

```bash
curl -X POST http://localhost:8080/api/songlist/detail \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "wy",
    "id": "123456789"
  }'
```

### 10.9 删除脚本

```bash
curl -X POST http://localhost:8080/{apiKey}/api/scripts/delete \
  -H 'Content-Type: application/json' \
  -d '{"id":"user_api_abc123"}'
```

---

## 十一、脚本开发指南

### 基本结构

```javascript
/**
 * @name 音源名称
 * @description 音源描述
 * @author 作者
 * @version 1.0.0
 * @homepage https://example.com
 */

// 初始化
lx.send('inited', {
  sources: {
    kw: {
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    },
  },
}).then(() => {
  console.log('初始化成功');
}).catch(err => {
  console.error('初始化失败:', err.message);
});

// 处理请求
lx.on('request', async(data) => {
  const { source, action, info } = data;
  
  switch (action) {
    case 'musicUrl':
      return await getMusicUrl(info);
    case 'lyric':
      return await getLyric(info);
    case 'pic':
      return await getPic(info);
  }
});
```

### API 参考

#### lx.request(url, options, callback)

发送 HTTP 请求：

```javascript
lx.request('https://api.example.com/music', {
  method: 'GET',
  timeout: 10000,
  headers: {
    'User-Agent': 'LXMusic',
  },
}, (err, resp, body) => {
  if (err) {
    console.error('请求失败:', err);
    return;
  }
  console.log('响应:', body);
});
```

#### lx.utils.crypto

加密工具：

```javascript
const aesBuffer = lx.utils.crypto.aesEncrypt(buffer, 'aes-128-cbc', key, iv);
const rsaBuffer = lx.utils.crypto.rsaEncrypt(buffer, publicKey);
const randomBytes = lx.utils.crypto.randomBytes(16);
const md5Hash = lx.utils.crypto.md5('string');
```

---

## 十二、环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 8080 | 服务端口 |
| API_KEY | - | API密钥，不设置则自动生成 |
| DENO_DEPLOY | - | 是否在 Deno Deploy 环境中运行（自动检测） |

---

## 十三、项目结构

```
dn_phg_music_server/
├── main.ts                    # 主入口文件
├── app.ts                     # 应用框架
├── router.ts                  # 路由系统
├── deno.json                  # Deno 配置
├── deploy.sh                  # 部署脚本
├── engine/
│   ├── script_engine.ts       # 脚本引擎
│   ├── sandbox.ts             # 沙箱环境
│   ├── script_global.ts       # LX 全局对象
│   └── request_manager.ts     # 请求管理器
├── storage/
│   └── storage.ts             # 脚本存储
├── handler/
│   └── request_handler.ts     # 请求处理器
├── routes/
│   └── api.ts                 # API 路由
├── services/
│   ├── lyric_service.ts       # 歌词服务
│   ├── search_service.ts      # 搜索服务
│   ├── songlist_service.ts    # 歌单服务
│   └── shortlink_service.ts   # 短链接解析服务
├── utils/
│   ├── aes.ts                 # AES 加密
│   ├── crypto.ts              # 加密工具
│   └── md5.ts                 # MD5 工具
└── data/
    ├── scripts.json           # 脚本数据
    ├── music_url_cache.json   # URL缓存
    ├── source_stats.json      # 音源统计
    └── api_key.json           # API密钥
```

---

## 十四、性能优化

- 脚本执行超时：30秒
- HTTP请求超时：60秒
- 请求处理超时：20秒
- 音乐URL缓存：支持KV存储或文件存储

---

## 许可证

MIT License
