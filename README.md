# 拼好歌 后端服务框架(Deno Deploy)

这是一个用 Deno Deploy 实现的 拼好歌 个人后台服务框架，此后端服务不提供音乐内容和数据，仅提供脚本运行环境和能力，数据全部由用户自行导入的脚本提供，此项目参考洛雪音乐源码编写（抄来的），兼容洛雪音乐的第三方音源脚本（部分兼容）。本项目代码开源且免费，如你是付费使用本项目，建议申请仅退款。

## 关联项目

- **拼好歌小程序端** - [phg-music](https://github.com/erikjamesgz/phg-music)

## 在线部署

### 部署步骤

1. **Fork 项目**
   
   Github打开[本项目](https://github.com/erikjamesgz/dn-phg-music-server) 点击右上角 Fork 按钮，将本项目 Fork 到你的 GitHub 账号

2. **登录 Deno**
   
   打开 [Deno 官网](https://console.deno.com/)，使用 GitHub 账号登录

3. **创建项目**
   
   - 打开 [Deno 控制台](https://console.deno.com/) ，点击 "New APP"
   - 授权并选择你 Fork 的本项目
   - 一路下一步完成部署

4. **获取服务地址**
   
   - 部署成功后，点击项目详情页左侧菜单的 "Overview"
   - 然后点击项目名右侧的“PRODUCTION URL” 预览
   - 再然后再在浏览器中复制浏览器地址栏的链接，格式如：
   ```
   https://xxxxx-dn-phg-musi-xx.deno.dev/
   ```

5. **获取 API Key**
   
   - 回到项目详情页，左侧菜单栏找到 "Logs" 选项 
   - 并在日志中搜索 `["API前缀"]`
   - 找到 `["api_key"]` 对应的值（32位字符串）

6. **拼接完整地址**
   
   将服务地址和 API Key 拼接，得到完整的服务器链接：
   ```
   https://xxxxx-dn-phg-musi-xx.deno.dev/你的API_KEY
   ```
   
   此链接可直接粘贴到拼好歌小程序的服务器设置中使用。

### 费用说明

> 以下为 2026年2月 的政策，以 Deno 官方为准

| 账户状态 | 免费请求次数/月 | 适用场景 |
|---------|---------------|---------|
| 未绑定银行卡 | 1万次/月 | 1-3人日常使用 |
| 已绑定银行卡 | 100万次/月 | 多人使用、高频调用 |
| 付费计划 | 更高额度 | 大规模商业使用 |

**建议**：用量较大时建议绑定银行卡，可大幅提升免费额度。

---

## API 前缀说明

服务启动后会生成一个随机的 API Key（32位字符），部分接口需要在路径中包含此 Key。

- **公开接口**：无需 API Key，如 `/api/status`
- **管理接口**：需要 API Key，如 `/{apiKey}/api/scripts`

API Key 用户可以通过deno环境变量 `api_key` 更改api_key的值，修改该值后可以达到更改接口密码的目的。

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

## 一、脚本管理接口

### 1.1 获取已加载音源列表

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

### 1.2 导入脚本（内容）

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

### 1.3 从 URL 导入脚本

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

### 1.4 从文件导入脚本

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

### 1.5 设置默认音源

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

### 1.6 删除脚本

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

## 二、音乐播放接口

### 2.1 获取音乐播放URL

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

### 2.2 获取歌词

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

### 2.3 获取封面图

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

## 三、搜索接口

### 3.1 搜索歌曲

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

## 四、歌单接口

### 4.1 获取歌单详情

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

### 4.2 通过短链接获取歌单详情

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

## 五、平台代码对照表

| 代码 | 平台 | 说明 |
|------|------|------|
| kw | 酷我音乐 | Kuwo Music |
| kg | 酷狗音乐 | Kugou Music |
| tx | QQ音乐 | QQ Music |
| wy | 网易云音乐 | NetEase Cloud Music |
| mg | 咪咕音乐 | Migu Music |

---

## 六、音质代码对照表

| 代码 | 音质 | 说明 |
|------|------|------|
| 128k | 标准音质 | 128kbps MP3 |
| 320k | 高品质 | 320kbps MP3 |
| flac | 无损音质 | FLAC |
| flac24bit | Hi-Res | 24bit FLAC |

**注意**：实际可用音质取决于各平台和歌曲本身的支持情况。

---

## 七、curl 测试命令

### 7.1 检查服务状态

```bash
curl http://localhost:8080/api/status
```

### 7.2 从URL导入音源脚本

```bash
curl -X POST http://localhost:8080/{apiKey}/api/scripts/import/url \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js"}'
```

### 7.3 获取已加载音源

```bash
curl http://localhost:8080/{apiKey}/api/scripts/loaded
```

### 7.4 设置默认音源

```bash
curl -X POST http://localhost:8080/{apiKey}/api/scripts/default \
  -H 'Content-Type: application/json' \
  -d '{"id":"user_api_abc123"}'
```

### 7.5 搜索歌曲

```bash
curl "http://localhost:8080/api/search?keyword=演员&source=kw&page=1&limit=10"
```

### 7.6 获取播放URL

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

### 7.7 获取歌词

```bash
curl -X POST http://localhost:8080/api/music/lyric \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "kw",
    "songId": "MUSIC_12345678"
  }'
```

### 7.8 获取歌单详情

```bash
curl -X POST http://localhost:8080/api/songlist/detail \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "wy",
    "id": "123456789"
  }'
```

### 7.9 删除脚本

```bash
curl -X POST http://localhost:8080/{apiKey}/api/scripts/delete \
  -H 'Content-Type: application/json' \
  -d '{"id":"user_api_abc123"}'
```

---

## 八、脚本开发指南
建议参考洛雪音乐的指引 https://lxmusic.toside.cn/desktop/custom-source
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

## 九、环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 8080 | 服务端口 |
| API_KEY | - | API密钥，不设置则自动生成 |
| DENO_DEPLOY | - | 是否在 Deno Deploy 环境中运行（自动检测） |

---

## 十、项目协议

本项目基于 Apache License 2.0 许可证发行，以下协议是对于 Apache License 2.0 的补充，如有冲突，以以下协议为准。

词语约定：本协议中的"本项目"指拼好歌后端服务框架项目；"使用者"指签署本协议的使用者；"官方音乐平台"指对本项目内置的包括酷我、酷狗、咪咕等音乐源的官方平台统称；"版权数据"指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。

### 一、数据来源

1.1 本项目的各官方平台在线数据来源全部由用户自行导入的第三方脚本提供，经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的合法性、准确性负责。

1.2 本项目本身没有获取某个音频数据的能力，本项目使用的在线音频数据来源来自用户导入"源"返回的在线链接。例如播放某首歌，本项目所做的只是将希望播放的歌曲名、艺术家等信息传递给"源"，若"源"返回了一个链接，则本项目将认为这就是该歌曲的音频数据而进行使用，至于这是不是正确的音频数据本项目无法校验其准确性，所以使用本项目的过程中可能会出现希望播放的音频与实际播放的音频不对应或者无法播放的问题。

1.3 本项目的非官方平台数据（例如"我的列表"内列表）来自使用者本地系统或者使用者连接的同步服务，本项目不对这些数据的合法性、准确性负责。

### 二、版权数据

2.1 使用本项目的过程中可能会产生版权数据。对于这些版权数据，本项目不拥有它们的所有权。为了避免侵权，使用者务必在 24 小时内 清除使用本项目的过程中所产生的版权数据。



### 三、资源使用

3.1 本项目内使用的部分包括但不限于字体、图片等资源来源于互联网。如果出现侵权可联系本项目移除。

### 四、免责声明

4.1 由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。

### 五、使用限制

5.1 本项目完全免费，且开源发布于 GitHub 面向全世界人用作对技术的学习交流。本项目不对项目内的技术可能存在违反当地法律法规的行为作保证。

6.2 禁止在违反当地法律法规的情况下使用本项目。 对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。

### 六、版权保护

6.1 音乐平台不易，请尊重版权，支持正版。

### 七、非商业性质

7.1 本项目仅用于对技术可行性的探索及研究，不接受任何商业（包括但不限于广告等）合作及捐赠。

### 八、接受协议

8.1 若你使用了本项目，即代表你接受本协议。

---

**参考项目**：[LX Music（洛雪音乐助手）](https://github.com/lyswhut/lx-music-desktop)
