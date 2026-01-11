# 洛雪音乐第三方音源后台 (Deno Deploy)

这是一个用 Deno Deploy 实现的洛雪音乐第三方音源后台服务，完全兼容洛雪音乐的第三方音源脚本。

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
# 设置访问令牌
export DENO_DEPLOY_TOKEN='your-token'

# 部署
./deploy.sh

# 或手动部署
deployctl deploy --project=dn-music-server main.ts
```

## API 文档

### 服务状态

```bash
GET /api/status
```

响应:
```json
{
  "scriptCount": 3,
  "activeRequests": 0,
  "uptime": 3600,
  "defaultSource": {
    "id": "user_api_xxx",
    "name": "六音音源",
    "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
  },
  "timestamp": 1234567890
}
```

### 脚本管理

#### 列出所有脚本

```bash
GET /api/scripts
```

#### 获取已加载音源列表

```bash
GET /api/scripts/loaded
```

响应:
```json
[
  {
    "id": "user_api_abc123",
    "name": "六音音源",
    "supportedSources": ["kw", "kg", "tx", "wy", "mg"],
    "isDefault": true
  }
]
```

#### 获取默认音源

```bash
GET /api/scripts/default
```

响应:
```json
{
  "id": "user_api_abc123",
  "name": "六音音源",
  "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
}
```

#### 导入脚本（内容）

```bash
POST /api/scripts
Content-Type: application/json

{
  "script": "/* @name xxx ... */ 脚本内容"
}
```

#### 从 URL 导入脚本

```bash
POST /api/scripts/import/url
Content-Type: application/json

{
  "url": "https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js"
}
```

**常用音源 URL:**
- 六音音源: `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js`
- Huibq音源: `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/huibq/latest.js`
- 花样音源: `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/flower/latest.js`
- ikun公益音源: `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/ikun/latest.js`
- 聚合API: `https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/juhe/latest.js`

#### 从文件导入脚本

```bash
POST /api/scripts/import/file
Content-Type: multipart/form-data

# 或 JSON 格式
POST /api/scripts/import/file
Content-Type: application/json

{
  "script": "/* @name xxx ... */ 脚本内容",
  "fileName": "my-source.js"
}
```

#### 设置默认音源

```bash
PUT /api/scripts/:id/default
Content-Type: application/json

{}
```

响应:
```json
{
  "success": true,
  "message": "默认音源已设置为: 六音音源"
}
```

#### 删除脚本

```bash
DELETE /api/scripts/:id
```

### 音乐播放

#### 获取音乐播放URL

```bash
POST /api/music/url
Content-Type: application/json

{
  "source": "kw",           // 音源: kw/kg/tx/wy/mg/xm
  "songmid": "123456",      // 歌曲ID (必需)
  "quality": "320k",        // 音质: 128k/320k/flac/flac24bit (必需)
  "name": "演员",           // 歌曲名 (必需)
  "singer": "薛之谦",       // 歌手名 (必需)
  "hash": "xxx",            // 酷我专用
  "songId": "xxx",          // 酷狗专用
  "copyrightId": "xxx",     // 咪咕专用
  "strMediaMid": "xxx",     // QQ专用
  "albumName": "演员"
}
```

响应:
```json
{
  "success": true,
  "url": "https://example.com/music.mp3",
  "type": "320k",
  "source": "kw",
  "quality": "320k"
}
```

#### 获取歌词

```bash
POST /api/music/lyric
Content-Type: application/json

{
  "source": "kw",
  "songmid": "123456",
  "name": "演员",
  "singer": "薛之谦"
}
```

响应:
```json
{
  "success": true,
  "lyric": {
    "lyric": "[00:00.00]歌词内容...",
    "tlyric": "[00:00.00]翻译歌词...",
    "rlyric": null,
    "lxlyric": null
  }
}
```

#### 获取封面图

```bash
POST /api/music/pic
Content-Type: application/json

{
  "source": "kw",
  "songmid": "123456",
  "name": "演员",
  "singer": "薛之谦"
}
```

响应:
```json
{
  "success": true,
  "url": "https://example.com/pic.jpg"
}
```

### 通用请求

```bash
POST /api/request
Content-Type: application/json

{
  "requestKey": "req_xxx",
  "data": {
    "source": "kw",
    "action": "musicUrl",
    "info": {
      "type": "320k",
      "musicInfo": {
        "id": "xxx",
        "name": "歌曲名",
        "singer": "歌手名",
        "songmid": "xxx",
        "source": "kw"
      }
    }
  }
}
```

### 导出

```bash
GET /api/export/:id       # 导出单个脚本
POST /api/export/all      # 导出所有脚本
```

## curl 测试命令

### 1. 检查服务状态

```bash
curl https://your-project.deno.dev/api/status
```

### 2. 获取默认音源

```bash
curl https://your-project.deno.dev/api/scripts/default
```

### 3. 从URL导入六音音源

```bash
curl -X POST https://your-project.deno.dev/api/scripts/import/url \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js"}'
```

### 4. 设置默认音源

```bash
# 先获取脚本列表
curl https://your-project.deno.dev/api/scripts/loaded

# 假设返回的 id 是 user_api_abc123
curl -X PUT https://your-project.deno.dev/api/scripts/user_api_abc123/default \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### 5. 获取音乐播放URL

```bash
curl -X POST https://your-project.deno.dev/api/music/url \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "kw",
    "songmid": "123456",
    "name": "演员",
    "singer": "薛之谦",
    "quality": "320k"
  }'
```

### 6. 获取已加载音源列表

```bash
curl https://your-project.deno.dev/api/scripts/loaded
```

### 7. 删除脚本

```bash
curl -X DELETE https://your-project.deno.dev/api/scripts/user_api_abc123
```

## 脚本开发指南

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

发送 HTTP 请求:

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

加密工具:

```javascript
const aesBuffer = lx.utils.crypto.aesEncrypt(buffer, 'aes-128-cbc', key, iv);
const rsaBuffer = lx.utils.crypto.rsaEncrypt(buffer, publicKey);
const randomBytes = lx.utils.crypto.randomBytes(16);
const md5Hash = lx.utils.crypto.md5('string');
```

## 环境变量

- `PORT`: 服务端口 (默认 8080)
- `DENO_DEPLOY`: 是否在 Deno Deploy 环境中运行

## 项目结构

```
dn_music_server/
├── main.ts                    # 主入口文件
├── app.ts                     # 应用框架
├── router.ts                  # 路由系统
├── deno.json                  # Deno 配置
├── deploy.sh                  # 部署脚本
├── engine/
│   ├── script_engine.ts       # 脚本引擎
│   ├── sandbox.ts             # 沙箱环境
│   ├── lx_global.ts           # LX 全局对象
│   └── request_manager.ts     # 请求管理器
├── storage/
│   └── storage.ts             # 脚本存储
├── handler/
│   └── request_handler.ts     # 请求处理器
├── routes/
│   └── api.ts                 # API 路由
├── adapter/
│   ├── client_adapter.ts      # 客户端适配器
│   └── lxmusic_proxy.js       # 洛雪音乐代理脚本
└── examples/
    └── test_source.js         # 测试音源脚本
```

## 性能优化

1. 脚本执行超时: 30秒
2. HTTP请求超时: 60秒
3. 请求处理超时: 20秒

## 许可证

MIT License
