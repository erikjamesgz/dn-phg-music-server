import { Application } from "../app.ts";
import { RequestHandler } from "../handler/request_handler.ts";
import { ScriptStorage } from "../storage/storage.ts";
import { ScriptEngine } from "../engine/script_engine.ts";

export class APIRoutes {
  private app: Application;
  private handler: RequestHandler;
  private storage: ScriptStorage;
  private engine: ScriptEngine;

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

    this.setupRoutes();
  }

  private setupRoutes(): void {
    const router = this.app.getRouter();

    router.get("/", () => this.handleIndex());
    router.get("/health", () => this.handleHealth());
    router.get("/api/status", () => this.handleStatus());

    router.get("/api/scripts", () => this.handleListScripts());
    router.post("/api/scripts", (ctx) => this.handleImportScript(ctx));
    router.get("/api/scripts/loaded", () => this.handleGetLoadedScripts());
    router.get("/api/scripts/:id", (ctx) => this.handleGetScript(ctx));
    router.post("/api/scripts/delete", (ctx) => this.handleRemoveScript(ctx));
    router.put("/api/scripts/:id", (ctx) => this.handleUpdateScript(ctx));

    router.post("/api/scripts/import/url", (ctx) => this.handleImportScriptFromUrl(ctx));
    router.post("/api/scripts/import/file", (ctx) => this.handleImportScriptFromFile(ctx));

    router.post("/api/scripts/default", (ctx) => this.handleSetDefaultSource(ctx));
    router.get("/api/scripts/default", () => this.handleGetDefaultSource());

    router.post("/api/music/url", (ctx) => this.handleGetMusicUrl(ctx));
    router.post("/api/music/lyric", (ctx) => this.handleGetLyric(ctx));
    router.post("/api/music/pic", (ctx) => this.handleGetPic(ctx));

    router.post("/api/request", (ctx) => this.handleRequest(ctx));
    router.delete("/api/request/:requestKey", (ctx) => this.handleCancelRequest(ctx));

    router.get("/api/export/:id", (ctx) => this.handleExportScript(ctx));
    router.post("/api/export/all", () => this.handleExportAllScripts());

    router.post("/api/scripts/:id/update-alert", (ctx) => this.handleSetUpdateAlert(ctx));
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
        console.log('已加载音源:', scripts);
        alert('已在控制台输出音源列表');
      } catch (e) {
        console.error('获取音源列表失败:', e);
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
        console.log('播放URL测试结果:', data);
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
    return new Response(
      JSON.stringify({ status: "healthy", timestamp: Date.now() }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  private async handleStatus(): Promise<Response> {
    const defaultSource = this.storage.getDefaultSourceInfo();
    return new Response(
      JSON.stringify({
        scriptCount: this.storage.getScriptCount(),
        activeRequests: this.handler.getActiveRequestCount(),
        timestamp: Date.now(),
        defaultSource: defaultSource,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  private async handleListScripts(): Promise<Response> {
    try {
      const scripts = this.storage.getScripts();
      return new Response(JSON.stringify(scripts), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleGetLoadedScripts(): Promise<Response> {
    try {
      const scripts = this.storage.getLoadedScripts();
      return new Response(JSON.stringify(scripts), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
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
        return new Response(JSON.stringify({ error: "缺少脚本内容" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const scriptInfo = await this.storage.importScript(body.script);
      const loaded = await this.engine.loadScript(scriptInfo);

      return new Response(
        JSON.stringify({
          success: true,
          apiInfo: scriptInfo,
          loaded,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleImportScriptFromUrl(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();
      
      if (!body.url) {
        return new Response(JSON.stringify({ error: "缺少URL参数" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const scriptInfo = await this.storage.importScriptFromUrl(body.url);
      const loaded = await this.engine.loadScript(scriptInfo);

      return new Response(
        JSON.stringify({
          success: true,
          apiInfo: scriptInfo,
          loaded,
          message: "从URL导入成功",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
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
        return new Response(JSON.stringify({ error: "缺少脚本内容" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const scriptInfo = await this.storage.importScriptFromFile(body.script, body.fileName);
      const loaded = await this.engine.loadScript(scriptInfo);

      return new Response(
        JSON.stringify({
          success: true,
          apiInfo: scriptInfo,
          loaded,
          message: "从文件导入成功",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleGetScript(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const script = await this.storage.getScript(id);

      if (!script) {
        return new Response(JSON.stringify({ error: "脚本不存在" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(script), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleRemoveScript(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();
      const { id } = body;
      
      if (!id) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "缺少脚本ID参数",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      const removed = await this.storage.removeScript(id);

      if (removed) {
        await this.engine.unloadScript(id);
      }

      return new Response(
        JSON.stringify({
          success: removed,
          message: removed ? "脚本已删除" : "脚本不存在",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleUpdateScript(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const body = await ctx.req.json();

      if (!body.script) {
        return new Response(JSON.stringify({ error: "缺少脚本内容" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const updated = await this.storage.updateScript(id, body.script);

      if (!updated) {
        return new Response(JSON.stringify({ error: "脚本不存在" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      await this.engine.unloadScript(id);
      await this.engine.loadScript(updated);

      return new Response(
        JSON.stringify({
          success: true,
          apiInfo: updated,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleSetDefaultSource(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();
      const { id } = body;
      
      if (!id) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "缺少脚本ID参数",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      const success = await this.storage.setDefaultSource(id);
      const scriptInfo = await this.storage.getScript(id);
      
      if (success && scriptInfo) {
        await this.engine.unloadScript(id);
        await this.engine.loadScript(scriptInfo);
      }

      return new Response(
        JSON.stringify({
          success,
          message: success ? `默认音源已设置为: ${scriptInfo?.name || id}` : "脚本不存在",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleGetDefaultSource(): Promise<Response> {
    try {
      const defaultInfo = this.storage.getDefaultSourceInfo();
      return new Response(
        JSON.stringify({
          id: defaultInfo?.id || null,
          name: defaultInfo?.name || null,
          supportedSources: defaultInfo?.supportedSources || [],
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleGetMusicUrl(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();

      const requiredFields = ['source', 'quality', 'name', 'singer'];
      for (const field of requiredFields) {
        if (!body[field]) {
          return new Response(
            JSON.stringify({ error: `缺少必要参数: ${field}` }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      const musicInfo = {
        id: body.songmid || body.id || '',
        name: body.name,
        singer: body.singer,
        albumName: body.albumName || '',
        songmid: body.songmid || body.id || '',
        source: body.source,
        hash: body.hash,
        songId: body.songId,
        copyrightId: body.copyrightId,
        strMediaMid: body.strMediaMid,
      };

      const requestKey = `music_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const result = await this.handler.handleRequest({
        requestKey,
        data: {
          source: body.source,
          action: 'musicUrl',
          info: {
            type: body.quality,
            musicInfo,
          },
        },
      });

      if (result.status && result.data && result.data.result) {
        const musicUrlData = result.data.result as { url: string; type: string };
        if (musicUrlData.url) {
          return new Response(
            JSON.stringify({
              success: true,
              url: musicUrlData.url,
              type: musicUrlData.type,
              source: body.source,
              quality: body.quality,
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result.message || "获取播放URL失败",
          source: body.source,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleGetLyric(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();

      if (!body.source || !body.songmid || !body.name || !body.singer) {
        return new Response(
          JSON.stringify({ error: "缺少必要参数" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const musicInfo = {
        id: body.songmid,
        name: body.name,
        singer: body.singer,
        songmid: body.songmid,
        source: body.source,
      };

      const requestKey = `lyric_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const result = await this.handler.handleRequest({
        requestKey,
        data: {
          source: body.source,
          action: 'lyric',
          info: { musicInfo },
        },
      });

      if (result.status) {
        return new Response(
          JSON.stringify({
            success: true,
            lyric: result.data.result,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result.message || "获取歌词失败",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleGetPic(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();

      if (!body.source || !body.songmid || !body.name || !body.singer) {
        return new Response(
          JSON.stringify({ error: "缺少必要参数" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
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
        return new Response(
          JSON.stringify({
            success: true,
            url: result.data.result,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result.message || "获取封面图失败",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleRequest(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();

      if (!body.requestKey || !body.data) {
        return new Response(
          JSON.stringify({ error: "缺少必要参数" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const result = await this.handler.handleRequest(body);

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleCancelRequest(ctx: any): Promise<Response> {
    try {
      const { requestKey } = ctx.params;
      this.handler.cancelRequest(requestKey);

      return new Response(
        JSON.stringify({
          success: true,
          message: "请求已取消",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleExportScript(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const script = await this.storage.exportScript(id);

      if (!script) {
        return new Response(JSON.stringify({ error: "脚本不存在" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(script, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${id}.js"`,
        },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleExportAllScripts(): Promise<Response> {
    try {
      const scripts = await this.storage.exportAllScripts();
      const combined = scripts.join("\n\n// --- 分隔线 ---\n\n");

      return new Response(combined, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="all_scripts_${Date.now()}.js"`,
        },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleSetUpdateAlert(ctx: any): Promise<Response> {
    try {
      const { id } = ctx.params;
      const body = await ctx.req.json();
      const enabled = body.enabled ?? true;

      const success = this.storage.setAllowShowUpdateAlert(id, enabled);

      return new Response(
        JSON.stringify({
          success,
          message: success ? "设置已更新" : "脚本不存在",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
