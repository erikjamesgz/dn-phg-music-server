import { Application } from "../app.ts";
import { RequestHandler } from "../handler/request_handler.ts";
import { ScriptStorage } from "../storage/storage.ts";
import { ScriptEngine } from "../engine/script_engine.ts";
import { SearchService } from "../services/search_service.ts";
import { LyricService } from "../services/lyric_service.ts";

interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T | null;
}

class ApiResponseBuilder {
  static success<T>(data: T, msg: string = "success"): ApiResponse<T> {
    return {
      code: 200,
      msg,
      data,
    };
  }

  static error(msg: string, code: number = 400, data: any = null): ApiResponse<any> {
    return {
      code,
      msg,
      data,
    };
  }

  static created<T>(data: T, msg: string = "created"): ApiResponse<T> {
    return {
      code: 201,
      msg,
      data,
    };
  }

  static notFound(msg: string = "not found"): ApiResponse<null> {
    return {
      code: 404,
      msg,
      data: null,
    };
  }

  static serverError(msg: string = "internal server error"): ApiResponse<null> {
    return {
      code: 500,
      msg,
      data: null,
    };
  }

  static toResponse<T>(data: ApiResponse<T>, httpStatus: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status: httpStatus,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  static toTextResponse(content: string, contentType: string = "text/plain; charset=utf-8"): Response {
    return new Response(content, {
      headers: { "Content-Type": contentType },
    });
  }

  static toHtmlResponse(html: string): Response {
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export class APIRoutes {
  private app: Application;
  private handler: RequestHandler;
  private storage: ScriptStorage;
  private engine: ScriptEngine;
  private searchService: SearchService;
  private lyricService: LyricService;

  constructor(
    app: Application,
    handler: RequestHandler,
    storage: ScriptStorage,
    engine: ScriptEngine
  ) {
    this.app = app;
    this.handler = handler;
    this.storage = storage;
    this.engine = engine;
    this.searchService = new SearchService();
    this.lyricService = new LyricService();

    this.setupRoutes();
  }

  private setupRoutes(): void {
    const router = this.app.getRouter();

    router.get("/", () => this.handleIndex());
    router.get("/health", () => this.handleHealth());
    router.get("/api/status", (ctx) => this.handleStatus(ctx));

    router.get("/api/scripts", (ctx) => this.handleListScripts(ctx));
    router.post("/api/scripts", (ctx) => this.handleImportScript(ctx));
    router.get("/api/scripts/loaded", (ctx) => this.handleGetLoadedScripts(ctx));
    router.get("/api/scripts/:id", (ctx) => this.handleGetScript(ctx));
    router.post("/api/scripts/delete", (ctx) => this.handleRemoveScript(ctx));
    router.put("/api/scripts/:id", (ctx) => this.handleUpdateScript(ctx));

    router.post("/api/scripts/import/url", (ctx) => this.handleImportScriptFromUrl(ctx));
    router.post("/api/scripts/import/file", (ctx) => this.handleImportScriptFromFile(ctx));

    router.post("/api/scripts/default", (ctx) => this.handleSetDefaultSource(ctx));
    router.get("/api/scripts/default", (ctx) => this.handleGetDefaultSource(ctx));

    router.post("/api/music/url", async (ctx) => {
      console.log('\n========== [API] 收到 /api/music/url 请求 ==========');
      const startTime = Date.now();
      let response: Response;
      try {
        response = await this.handleGetMusicUrl(ctx);
        const duration = Date.now() - startTime;
        console.log('[API] /api/music/url 调用完成，耗时:', duration, 'ms');
        console.log('[API] 返回状态:', response.status);
        const headersObj: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
        console.log('[API] 返回头:', headersObj);
        const responseBody = await response.clone().text();
        console.log('[API] 返回内容:', responseBody);
        console.log('========== [API] /api/music/url 请求结束 ==========\n');
        return response;
      } catch (error: any) {
        console.error('[API] /api/music/url 抛出异常:', error.message);
        console.error('[API] 异常堆栈:', error.stack);
        console.log('========== [API] /api/music/url 请求异常结束 ==========\n');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "Internal Server Error"), 500);
      }
    });
    router.post("/api/music/lyric", async (ctx) => {
      console.log('\n========== [API] 收到 /api/music/lyric 请求 ==========');
      const startTime = Date.now();
      try {
        const response = await this.handleGetLyricDirect(ctx);
        const duration = Date.now() - startTime;
        console.log('[API] /api/music/lyric 调用完成，耗时:', duration, 'ms');
        console.log('[API] 返回状态:', response.status);
        const responseBody = await response.clone().text();
        console.log('[API] 返回内容:', responseBody);
        console.log('========== [API] /api/music/lyric 请求结束 ==========\n');
        return response;
      } catch (error: any) {
        console.error('[API] /api/music/lyric 抛出异常:', error.message);
        console.error('[API] 异常堆栈:', error.stack);
        console.log('========== [API] /api/music/lyric 请求异常结束 ==========\n');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "Internal Server Error"), 500);
      }
    });
    router.post("/api/music/pic", async (ctx) => {
      console.log('\n========== [API] 收到 /api/music/pic 请求 ==========');
      const startTime = Date.now();
      let response: Response;
      try {
        response = await this.handleGetPic(ctx);
        const duration = Date.now() - startTime;
        console.log('[API] /api/music/pic 调用完成，耗时:', duration, 'ms');
        console.log('[API] 返回状态:', response.status);
        const responseBody = await response.clone().text();
        console.log('[API] 返回内容:', responseBody);
        console.log('========== [API] /api/music/pic 请求结束 ==========\n');
        return response;
      } catch (error: any) {
        console.error('[API] /api/music/pic 抛出异常:', error.message);
        console.error('[API] 异常堆栈:', error.stack);
        console.log('========== [API] /api/music/pic 请求异常结束 ==========\n');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "Internal Server Error"), 500);
      }
    });

    router.get("/api/search", (ctx) => this.handleSearch(ctx));

    router.post("/api/request", (ctx) => this.handleRequest(ctx));
    router.delete("/api/request/:requestKey", (ctx) => this.handleCancelRequest(ctx));

    router.get("/api/export/:id", (ctx) => this.handleExportScript(ctx));
    router.post("/api/export/all", (ctx) => this.handleExportAllScripts(ctx));

    router.post("/api/scripts/:id/update-alert", (ctx) => this.handleSetUpdateAlert(ctx));

    router.get("/api/test/music-url", (ctx) => this.handleTestMusicUrl(ctx));

    // 新增：直接调用平台API获取歌词（不走第三方脚本）
    router.post("/api/music/lyric/direct", async (ctx) => {
      console.log('\n========== [API] 收到 /api/music/lyric/direct 请求 ==========');
      const startTime = Date.now();
      try {
        const response = await this.handleGetLyricDirect(ctx);
        const duration = Date.now() - startTime;
        console.log('[API] /api/music/lyric/direct 调用完成，耗时:', duration, 'ms');
        console.log('========== [API] /api/music/lyric/direct 请求结束 ==========\n');
        return response;
      } catch (error: any) {
        console.error('[API] /api/music/lyric/direct 抛出异常:', error.message);
        console.error('[API] 异常堆栈:', error.stack);
        console.log('========== [API] /api/music/lyric/direct 请求异常结束 ==========\n');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "Internal Server Error"), 500);
      }
    });
  }

  private async handleIndex(): Promise<Response> {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>洛雪音乐第三方音源后台</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: white; text-align: center; margin-bottom: 30px; font-size: 2.5em; }
    .card {
      background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .status { display: flex; gap: 20px; flex-wrap: wrap; }
    .status-item { flex: 1; min-width: 200px; text-align: center; }
    .status-value { font-size: 2em; font-weight: bold; color: #667eea; }
    .status-label { color: #666; margin-top: 5px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    .btn {
      display: inline-block; padding: 10px 20px; background: #667eea; color: white;
      border: none; border-radius: 5px; cursor: pointer; margin: 5px;
    }
    .btn:hover { background: #5568d3; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    .api-method { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 0.85em; font-weight: bold; margin-right: 10px; }
    .get { background: #61affe; color: white; }
    .post { background: #49cc90; color: white; }
    .put { background: #fca130; color: white; }
    .delete { background: #f93e3e; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 洛雪音乐第三方音源后台</h1>

    <div class="card">
      <h2>服务状态</h2>
      <div class="status">
        <div class="status-item">
          <div class="status-value" id="scriptCount">-</div>
          <div class="status-label">已加载脚本</div>
        </div>
        <div class="status-item">
          <div class="status-value" id="activeSource">-</div>
          <div class="status-label">默认音源</div>
        </div>
        <div class="status-item">
          <div class="status-value">运行中</div>
          <div class="status-label">服务状态</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>📜 脚本管理</h2>
      <pre>
<span class="api-method get">GET</span>  <code>/api/scripts</code>                    - 列出所有脚本
<span class="api-method get">GET</span>  <code>/api/scripts/loaded</code>             - 获取已加载音源列表
<span class="api-method get">GET</span>  <code>/api/scripts/:id</code>                - 获取单个脚本
<span class="api-method get">GET</span>  <code>/api/scripts/default</code>            - 获取默认音源

<span class="api-method post">POST</span> <code>/api/scripts</code>                    - 导入脚本(内容)
<span class="api-method post">POST</span> <code>/api/scripts/import/url</code>         - 从URL导入脚本
<span class="api-method post">POST</span> <code>/api/scripts/import/file</code>        - 从文件导入脚本

<span class="api-method put">PUT</span>  <code>/api/scripts/:id</code>                - 更新脚本
<span class="api-method post">POST</span> <code>/api/scripts/default</code>           - 设置默认音源

<span class="api-method post">POST</span> <code>/api/scripts/delete</code>              - 删除脚本
</pre>
    </div>

    <div class="card">
      <h2>🎵 音乐播放</h2>
      <pre>
<span class="api-method post">POST</span> <code>/api/music/url</code>     - 获取音乐播放URL
<span class="api-method post">POST</code> /api/music/lyric</code>    - 获取歌词
<span class="api-method post">POST</code> /api/music/pic</code>      - 获取封面图

请求参数示例:
{
  "source": "kw",           // 音源: kw/kg/tx/wy/mg/xm
  "songmid": "123456",      // 歌曲ID
  "hash": "xxx",            // 酷我专用
  "songId": "xxx",          // 酷狗专用
  "copyrightId": "xxx",     // 咪咕专用
  "strMediaMid": "xxx",     // QQ专用
  "quality": "320k",        // 音质: 128k/320k/flac/flac24bit
  "name": "歌曲名",
  "singer": "歌手名"
}
</pre>
    </div>

    <div class="card">
      <h2>📡 请求处理</h2>
      <pre>
<span class="api-method post">POST</span> <code>/api/request</code>              - 发送请求
<span class="api-method delete">DELETE</code> /api/request/:key</code>    - 取消请求
</pre>
    </div>

    <div class="card">
      <h2>📤 导出</h2>
      <pre>
<span class="api-method get">GET</span>  <code>/api/export/:id</code>           - 导出单个脚本
<span class="api-method post">POST</code> /api/export/all</code>         - 导出所有脚本
</pre>
    </div>

    <div class="card">
      <h2>⚡ 快速操作</h2>
      <button class="btn" onclick="refreshStatus()">刷新状态</button>
      <button class="btn" onclick="listScripts()">查看脚本列表</button>
      <button class="btn" onclick="importFromUrl()">从URL导入</button>
      <button class="btn" onclick="testMusicUrl()">测试播放URL</button>
    </div>
  </div>

  <script>
    async function refreshStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        document.getElementById('scriptCount').textContent = data.scriptCount;
        
        const defaultRes = await fetch('/api/scripts/default');
        const defaultData = await defaultRes.json();
        document.getElementById('activeSource').textContent = defaultData.name || '未设置';
      } catch (e) {
        console.error('获取状态失败:', e);
      }
    }

    async function listScripts() {
      try {
        const res = await fetch('/api/scripts/loaded');
        const scripts = await res.json();
        alert('已在控制台输出音源列表');
      } catch (e) {
      }
    }

    async function importFromUrl() {
      const url = prompt('请输入脚本URL:',
        'https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js');
      if (!url) return;
      
      try {
        const res = await fetch('/api/scripts/import/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (data.success) {
          alert('导入成功: ' + data.apiInfo.name);
          refreshStatus();
        } else {
          alert('导入失败: ' + data.error);
        }
      } catch (e) {
        alert('导入失败: ' + e.message);
      }
    }

    async function testMusicUrl() {
      try {
        const res = await fetch('/api/music/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'kw',
            songmid: 'test123',
            name: '测试歌曲',
            singer: '测试歌手',
            quality: '128k'
          })
        });
        const data = await res.json();
        alert('已在控制台输出结果');
      } catch (e) {
        alert('测试失败: ' + e.message);
      }
    }

    refreshStatus();
    setInterval(refreshStatus, 5000);
  </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  private async handleHealth(): Promise<Response> {
    return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
      status: "healthy",
      timestamp: Date.now(),
    }));
  }

  private async handleStatus(_ctx: any): Promise<Response> {
    const defaultSource = this.storage.getDefaultSourceInfo();
    return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
      scriptCount: this.storage.getScriptCount(),
      activeRequests: this.handler.getActiveRequestCount(),
      timestamp: Date.now(),
      defaultSource: defaultSource,
    }));
  }

  private async handleListScripts(_ctx: any): Promise<Response> {
    try {
      const scripts = this.storage.getScripts();
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(scripts));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleGetLoadedScripts(_ctx: any): Promise<Response> {
    try {
      const scripts = this.storage.getLoadedScripts();
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(scripts));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleImportScript(ctx: any): Promise<Response> {
    try {
      let body;
      const contentType = ctx.req.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        body = await ctx.req.json();
      } else {
        const text = await ctx.req.text();
        body = { script: text };
      }

      if (!body.script) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少脚本内容", 400));
      }

      let scriptInfo;
      if (/^https?:\/\//.test(body.script)) {
        scriptInfo = await this.storage.importScriptFromUrl(body.script);
      } else {
        scriptInfo = await this.storage.importScript(body.script);
      }
      
      const loaded = await this.engine.loadScript(scriptInfo);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.created({
        apiInfo: scriptInfo,
        loaded,
      }, "脚本导入成功"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleImportScriptFromUrl(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();
      
      if (!body.url) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少URL参数", 400));
      }

      const scriptInfo = await this.storage.importScriptFromUrl(body.url);
      const loaded = await this.engine.loadScript(scriptInfo);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.created({
        apiInfo: scriptInfo,
        loaded,
      }, "从URL导入成功"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleImportScriptFromFile(ctx: any): Promise<Response> {
    try {
      const contentType = ctx.req.headers.get("content-type") || "";
      let body: any = {};

      if (contentType.includes("multipart/form-data")) {
        const text = await ctx.req.text();
        const boundary = contentType.split("boundary=")[1];
        const parts = text.split("--" + boundary);
        
        for (const part of parts) {
          if (part.includes("filename=")) {
            const scriptMatch = part.match(/Content-Type:.*?\r?\n\r?\n([\s\S]*?)\r?\n--/);
            if (scriptMatch) {
              body.script = scriptMatch[1].trim();
            }
          }
        }
      } else {
        body = await ctx.req.json();
      }

      if (!body.script) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少脚本内容", 400));
      }

      const scriptInfo = await this.storage.importScriptFromFile(body.script, body.fileName);
      const loaded = await this.engine.loadScript(scriptInfo);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.created({
        apiInfo: scriptInfo,
        loaded,
      }, "从文件导入成功"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleGetScript(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const script = await this.storage.getScript(id);

      if (!script) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.notFound("脚本不存在"), 404);
      }

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(script));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleRemoveScript(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();
      const { id } = body;
      
      if (!id) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少脚本ID参数", 400));
      }
      
      const removed = await this.storage.removeScript(id);

      if (removed) {
        await this.engine.unloadScript(id);
      }

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        removed,
      }, removed ? "脚本已删除" : "脚本不存在"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleUpdateScript(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const body = await ctx.req.json();

      if (!body.script) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少脚本内容", 400));
      }

      const updated = await this.storage.updateScript(id, body.script);

      if (!updated) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.notFound("脚本不存在"));
      }

      await this.engine.unloadScript(id);
      await this.engine.loadScript(updated);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        apiInfo: updated,
      }, "脚本更新成功"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleSetDefaultSource(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();
      const { id } = body;
      
      if (!id) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少脚本ID参数", 400));
      }
      
      const success = await this.storage.setDefaultSource(id);
      const scriptInfo = await this.storage.getScript(id);
      
      if (success && scriptInfo) {
        await this.engine.unloadScript(id);
        await this.engine.loadScript(scriptInfo);
      }

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        defaultSource: scriptInfo?.name || id,
      }, success ? `默认音源已设置为: ${scriptInfo?.name || id}` : "脚本不存在"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleGetDefaultSource(_ctx: any): Promise<Response> {
    try {
      const defaultInfo = this.storage.getDefaultSourceInfo();
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        id: defaultInfo?.id || null,
        name: defaultInfo?.name || null,
        supportedSources: defaultInfo?.supportedSources || [],
      }));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleGetMusicUrl(ctx: any): Promise<Response> {
    console.log('\n========== [API] handleGetMusicUrl 开始 ==========');

    try {
      const body = await ctx.req.json();
      console.log('[API] 请求参数:', JSON.stringify(body, null, 2));

      const requiredFields = ['source', 'quality'];
      for (const field of requiredFields) {
        if (!body[field]) {
          console.error(`[API] 缺少必要参数: ${field}`);
          return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(`缺少必要参数: ${field}`, 400));
        }
      }

      const songId = body.songmid || body.id || body.songId || body.musicInfo?.id || body.musicInfo?.songmid || body.musicInfo?.hash || '';
      console.log('[API] songId 计算过程:');
      console.log('[API]   body.songmid:', body.songmid);
      console.log('[API]   body.id:', body.id);
      console.log('[API]   body.songId:', body.songId);
      console.log('[API]   body.musicInfo:', body.musicInfo);
      console.log('[API]   body.musicInfo?.id:', body.musicInfo?.id);
      console.log('[API]   body.musicInfo?.songmid:', body.musicInfo?.songmid);
      console.log('[API]   body.musicInfo?.hash:', body.musicInfo?.hash);
      console.log('[API]   最终 songId:', songId);
      const name = body.name || body.musicInfo?.name || '未知歌曲';
      const singer = body.singer || body.musicInfo?.singer || '未知歌手';
      const interval = body.interval || body.musicInfo?.interval || null;
      const hash = body.hash || body.musicInfo?.hash || body.musicInfo?.songmid || '';
      const albumName = body.albumName || body.musicInfo?.albumName || body.musicInfo?.album || '';
      const picUrl = body.picUrl || body.musicInfo?.picUrl || null;
      const strMediaMid = body.strMediaMid || body.musicInfo?.strMediaMid;
      const copyrightId = body.copyrightId || body.musicInfo?.copyrightId;

      const requestKey = `music_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log('[API] 生成 requestKey:', requestKey);

      const musicInfoSource = body.musicInfo?.source || body.source || 'unknown';
      console.log('[API] musicInfoSource:', musicInfoSource);

      const requestData = {
        requestKey,
        data: {
          source: musicInfoSource,
          action: 'musicUrl',
          info: {
            type: body.quality,
            musicInfo: {
              id: songId,
              name: name,
              singer: singer,
              source: musicInfoSource,
              interval: interval,
              songmid: songId,
              meta: {
                songId: songId,
                albumName: albumName,
                picUrl: picUrl,
                hash: hash,
                strMediaMid: strMediaMid,
                copyrightId: copyrightId,
              },
            },
          },
        },
      };
      console.log('[API] 调用 handler.handleRequest, 参数:', JSON.stringify(requestData, null, 2));

      const result = await this.handler.handleRequest(requestData);
      console.log('[API] handler.handleRequest 返回:', JSON.stringify(result, null, 2));

      if (result.status && result.data && result.data.result) {
        const musicUrlData = result.data.result as { url: string; type: string };
        if (musicUrlData.url) {
          console.log('[API] 获取成功，返回 URL:', musicUrlData.url);
          const responseData = {
            url: musicUrlData.url,
            type: musicUrlData.type,
            source: body.source,
            quality: body.quality,
          };
          console.log('[API] 最终响应:', JSON.stringify(responseData, null, 2));
          console.log('========== [API] handleGetMusicUrl 结束 ==========\n');
          return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(responseData, "获取成功"));
        }
      }

      console.error('[API] 获取播放URL失败:', result.message);
      console.log('========== [API] handleGetMusicUrl 结束 ==========\n');
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(result.message || "获取播放URL失败", 500, {
        source: body.source,
      }));
    } catch (error: any) {
      console.error('[API] handleGetMusicUrl 抛出异常:', error.message);
      console.error('[API] 异常堆栈:', error.stack);
      console.log('========== [API] handleGetMusicUrl 结束 ==========\n');
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }



  // 新增：直接调用平台API获取歌词（统一参数接口）
  // 统一参数：source, songId, name, singer
  private async handleGetLyricDirect(ctx: any): Promise<Response> {
    console.log('\n========== [API] handleGetLyricDirect 开始 ==========');
    console.log('[API] 请求时间:', new Date().toISOString());
    
    try {
      const body = await ctx.req.json();
      console.log('[API] 请求参数:', JSON.stringify(body, null, 2));

      // 验证必要参数
      if (!body.source) {
        console.error('[API] 缺少source参数');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数: source", 400));
      }

      const source = body.source;
      
      // 统一参数：只接受 songId
      const songId = body.songId;
      
      if (!songId) {
        console.error('[API] 缺少歌曲ID参数');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数: songId", 400));
      }

      // 统一参数名
      const name = body.name || '';
      const singer = body.singer || '';

      // 根据音源映射参数
      let musicInfo: any = { source };

      switch (source) {
        case 'kw':
          // 酷我：只需要 songmid
          musicInfo.songmid = songId;
          break;
        case 'kg':
          // 酷狗：需要 hash, name
          musicInfo.hash = songId;
          musicInfo.name = name || '未知歌曲';
          break;
        case 'tx':
          // QQ音乐：需要 songId (即 songmid)
          musicInfo.songId = songId;
          break;
        case 'wy':
          // 网易云：需要 songId
          musicInfo.songId = songId;
          break;
        case 'mg':
          // 咪咕：需要 copyrightId, name, singer
          musicInfo.copyrightId = songId;
          musicInfo.name = name;
          musicInfo.singer = singer;
          break;
        default:
          console.error('[API] 不支持的音源:', source);
          return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(`不支持的音源: ${source}`, 400));
      }

      console.log('[API] 开始调用歌词服务, musicInfo:', JSON.stringify(musicInfo, null, 2));
      
      // 调用歌词服务
      const lyricResult = await this.lyricService.getLyric(musicInfo);
      
      console.log('[API] 歌词服务返回成功');
      console.log('[API] 歌词长度:', lyricResult.lyric?.length || 0);
      console.log('[API] 翻译歌词长度:', lyricResult.tlyric?.length || 0);
      console.log('[API] 罗马音歌词长度:', lyricResult.rlyric?.length || 0);
      console.log('[API] 逐字歌词长度:', lyricResult.lxlyric?.length || 0);
      
      const response = ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        lyric: lyricResult.lyric,
        tlyric: lyricResult.tlyric || '',
        rlyric: lyricResult.rlyric || '',
        lxlyric: lyricResult.lxlyric || '',
      }, "获取歌词成功"));
      
      console.log('========== [API] handleGetLyricDirect 结束 ==========\n');
      return response;
    } catch (error: any) {
      console.error('[API] 获取歌词失败:', error.message);
      console.error('[API] 错误堆栈:', error.stack);
      console.log('========== [API] handleGetLyricDirect 异常结束 ==========\n');
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "获取歌词失败"));
    }
  }

  private async handleGetPic(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();

      if (!body.source || !body.songmid || !body.name || !body.singer) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数", 400));
      }

      const musicInfo = {
        id: body.songmid,
        name: body.name,
        singer: body.singer,
        songmid: body.songmid,
        source: body.source,
      };

      const requestKey = `pic_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const result = await this.handler.handleRequest({
        requestKey,
        data: {
          source: body.source,
          action: 'pic',
          info: { musicInfo },
        },
      });

      if (result.status) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
          url: result.data.result,
        }, "获取成功"));
      }

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(result.message || "获取封面图失败", 500));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }

  private async handleSearch(ctx: any): Promise<Response> {
    try {
      const url = new URL(ctx.req.url, `http://${ctx.req.headers.get('host')}`);
      const keyword = url.searchParams.get('keyword');
      const source = url.searchParams.get('source') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!keyword) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数: keyword", 400));
      }

      const results = await this.searchService.search(keyword, source, page, limit);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        keyword,
        page,
        limit,
        results,
      }, "搜索成功"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }

  private async handleRequest(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();

      if (!body.requestKey || !body.data) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数", 400));
      }

      const result = await this.handler.handleRequest(body);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(result, "请求完成"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }

  private async handleCancelRequest(ctx: any): Promise<Response> {
    try {
      const { requestKey } = ctx.params;
      this.handler.cancelRequest(requestKey);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        requestKey,
      }, "请求已取消"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }

  private async handleExportScript(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const script = await this.storage.exportScript(id);

      if (!script) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.notFound("脚本不存在"), 404);
      }

      return ApiResponseBuilder.toTextResponse(script, "text/plain; charset=utf-8");
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }

  private async handleExportAllScripts(_ctx: any): Promise<Response> {
    try {
      const scripts = await this.storage.exportAllScripts();
      const combined = scripts.join("\n\n// --- 分隔线 ---\n\n");

      return ApiResponseBuilder.toTextResponse(combined, "text/plain; charset=utf-8");
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }

  private async handleSetUpdateAlert(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const body = await ctx.req.json();
      const enabled = body.enabled ?? true;

      const success = await this.storage.setAllowShowUpdateAlert(id, enabled);

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        id,
        enabled,
      }, success ? "设置已更新" : "脚本不存在"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }

  private async handleTestMusicUrl(_ctx: any): Promise<Response> {
    try {
      await this.storage.ready();

      const allScripts = this.storage.getLoadedScripts();
      const kwScript = allScripts.find(script =>
        script.supportedSources.includes("kw")
      );

      if (!kwScript) {
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("未找到 kw 音源脚本", 404));
      }

      const musicInfo = {
        id: "12442905",
        name: "测试歌曲",
        singer: "测试歌手",
        source: "kw",
        interval: null,
        songmid: "12442905",
        meta: {
          songId: "12442905",
          albumName: "",
          picUrl: null,
        },
      };

      const result = await this.handler.handleRequest({
        requestKey: `test_${Date.now()}`,
        data: {
          source: "kw",
          action: "musicUrl",
          info: {
            type: "128k",
            musicInfo,
          },
        },
      });

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        scripts: allScripts,
        kwScriptFound: !!kwScript,
        result,
      }, "测试完成"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message));
    }
  }
}
