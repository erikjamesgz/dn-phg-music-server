import { Application } from "../app.ts";
import { RequestHandler } from "../handler/request_handler.ts";
import { ScriptStorage } from "../storage/storage.ts";
import { ScriptEngine } from "../engine/script_engine.ts";
import { SearchService } from "../services/search_service.ts";
import { LyricService } from "../services/lyric_service.ts";
import { SongListService } from "../services/songlist_service.ts";
import { ShortLinkService } from "../services/shortlink_service.ts";

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
  private songListService: SongListService;
  private shortLinkService: ShortLinkService;
  private apiKey: string;
 
  constructor(
    app: Application,
    handler: RequestHandler,
    storage: ScriptStorage,
    engine: ScriptEngine,
    apiKey: string
  ) {
    this.app = app;
    this.handler = handler;
    this.storage = storage;
    this.engine = engine;
    this.apiKey = apiKey;
    this.searchService = new SearchService();
    this.lyricService = new LyricService();
    this.songListService = new SongListService();
    this.shortLinkService = new ShortLinkService();

    this.setupRoutes();
  }

  private setupRoutes(): void {
    const router = this.app.getRouter();
    const prefix = `/${this.apiKey}`;

    router.get("/", () => this.handleIndex());
    router.get("/api/status", (ctx) => this.handleStatus(ctx));

    // 管理页面
    router.get(`${prefix}/admin`, () => this.handleAdminPage());

    router.post(`${prefix}/api/scripts`, (ctx) => this.handleImportScript(ctx));
    router.get(`${prefix}/api/scripts/loaded`, (ctx) => this.handleGetLoadedScripts(ctx));
    router.post(`${prefix}/api/scripts/delete`, (ctx) => this.handleRemoveScript(ctx));

    router.post(`${prefix}/api/scripts/import/url`, (ctx) => this.handleImportScriptFromUrl(ctx));
    router.post(`${prefix}/api/scripts/import/file`, (ctx) => this.handleImportScriptFromFile(ctx));

    router.post(`${prefix}/api/scripts/default`, (ctx) => this.handleSetDefaultSource(ctx));
    router.get(`${prefix}/api/scripts/default`, (ctx) => this.handleGetDefaultSource(ctx));

    router.post(`${prefix}/api/cache/music-url/enable`, (ctx) => this.handleSetMusicUrlCacheEnabled(ctx));
    router.get(`${prefix}/api/cache/music-url/status`, (ctx) => this.handleGetMusicUrlCacheStatus(ctx));
    router.post(`${prefix}/api/cache/music-url/clear`, (ctx) => this.handleClearMusicUrlCache(ctx));

    router.post(`${prefix}/api/music/url`, async (ctx) => {
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
    router.post(`${prefix}/api/music/lyric`, async (ctx) => {
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
    router.post(`${prefix}/api/music/pic`, async (ctx) => {
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

    router.get(`${prefix}/api/search`, (ctx) => this.handleSearch(ctx));

    router.post(`${prefix}/api/request`, (ctx) => this.handleRequest(ctx));
    router.delete(`${prefix}/api/request/:requestKey`, (ctx) => this.handleCancelRequest(ctx));

    router.post(`${prefix}/api/music/lyric/direct`, async (ctx) => {
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

    router.post(`${prefix}/api/songlist/detail`, async (ctx) => {
      console.log('\n========== [API] 收到 /api/songlist/detail 请求 ==========');
      const startTime = Date.now();
      try {
        const response = await this.handleGetSongListDetail(ctx);
        const duration = Date.now() - startTime;
        console.log('[API] /api/songlist/detail 调用完成，耗时:', duration, 'ms');
        console.log('========== [API] /api/songlist/detail 请求结束 ==========\n');
        return response;
      } catch (error: any) {
        console.error('[API] /api/songlist/detail 抛出异常:', error.message);
        console.error('[API] 异常堆栈:', error.stack);
        console.log('========== [API] /api/songlist/detail 请求异常结束 ==========\n');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "Internal Server Error"), 500);
      }
    });

    router.post(`${prefix}/api/songlist/detail/by-link`, async (ctx) => {
      console.log('\n========== [API] 收到 /api/songlist/detail/by-link 请求 ==========');
      const startTime = Date.now();
      try {
        const response = await this.handleGetSongListDetailByLink(ctx);
        const duration = Date.now() - startTime;
        console.log('[API] /api/songlist/detail/by-link 调用完成，耗时:', duration, 'ms');
        console.log('========== [API] /api/songlist/detail/by-link 请求结束 ==========\n');
        return response;
      } catch (error: any) {
        console.error('[API] /api/songlist/detail/by-link 抛出异常:', error.message);
        console.error('[API] 异常堆栈:', error.stack);
        console.log('========== [API] /api/songlist/detail/by-link 请求异常结束 ==========\n');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "Internal Server Error"), 500);
      }
    });
  }

  private async handleIndex(): Promise<Response> {
    try {
      const readmePath = new URL("../README.md", import.meta.url).pathname;
      const readmeContent = await Deno.readTextFile(readmePath);
      
      const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>拼好歌 后端服务框架</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .card {
      background: white; border-radius: 10px; padding: 30px; margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    h2 { color: #667eea; margin: 25px 0 15px 0; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    h3 { color: #555; margin: 20px 0 10px 0; }
    h4 { color: #666; margin: 15px 0 10px 0; }
    p { color: #444; line-height: 1.8; margin: 10px 0; }
    code { 
      background: #f4f4f4; padding: 2px 6px; border-radius: 3px; 
      font-family: 'Monaco', 'Menlo', monospace; font-size: 0.9em;
    }
    pre { 
      background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; 
      overflow-x: auto; margin: 15px 0;
    }
    pre code { background: none; color: inherit; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f8f8f8; }
    tr:nth-child(even) { background: #fafafa; }
    blockquote { 
      border-left: 4px solid #667eea; padding-left: 15px; margin: 15px 0; 
      color: #666; background: #f9f9f9; padding: 10px 15px;
    }
    ul, ol { margin: 10px 0; padding-left: 25px; }
    li { margin: 5px 0; line-height: 1.6; }
    hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    a { color: #667eea; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0; }
    strong { color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${this.markdownToHtml(readmeContent)}
    </div>
  </div>
</body>
</html>
      `;
      
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (error) {
      return new Response("README.md not found", { status: 404 });
    }
  }

  private async handleAdminPage(): Promise<Response> {
    const scripts = this.storage.getLoadedScripts();
    const defaultSource = this.storage.getDefaultSourceInfo();
    const scriptsJson = JSON.stringify(scripts);
    const defaultSourceJson = JSON.stringify(defaultSource);
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>音源管理 - 拼好歌</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .card {
      background: white; border-radius: 10px; padding: 25px; margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
    h1 span { font-size: 24px; }
    h2 { color: #667eea; margin: 0 0 15px 0; font-size: 18px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; }
    input[type="text"], textarea {
      width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px;
      font-size: 14px; transition: border-color 0.2s;
    }
    input[type="text"]:focus, textarea:focus { outline: none; border-color: #667eea; }
    .btn {
      padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;
      font-size: 14px; font-weight: 500; transition: all 0.2s; margin-right: 10px;
    }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5a6fd6; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-danger:hover { background: #c82333; }
    .btn-success { background: #28a745; color: white; }
    .btn-success:hover { background: #218838; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #5a6268; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .script-list { list-style: none; }
    .script-item {
      border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-bottom: 10px;
      display: flex; justify-content: space-between; align-items: center;
      transition: all 0.2s;
    }
    .script-item:hover { border-color: #667eea; box-shadow: 0 2px 8px rgba(102,126,234,0.1); }
    .script-item.default { border-color: #28a745; background: #f8fff8; }
    .script-info h3 { font-size: 16px; color: #333; margin-bottom: 5px; }
    .script-info p { font-size: 13px; color: #666; margin: 2px 0; }
    .script-info .tag {
      display: inline-block; background: #e9ecef; color: #495057;
      padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 5px;
    }
    .script-info .tag.default-tag { background: #28a745; color: white; }
    .script-actions { display: flex; gap: 8px; }
    .empty-state { text-align: center; padding: 40px; color: #666; }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 10px; }
    .toast {
      position: fixed; bottom: 20px; right: 20px; padding: 15px 25px;
      border-radius: 8px; color: white; font-weight: 500;
      transform: translateY(100px); opacity: 0; transition: all 0.3s; z-index: 1000;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { background: #28a745; }
    .toast.error { background: #dc3545; }
    .loading { display: none; text-align: center; padding: 20px; }
    .loading.show { display: block; }
    .spinner {
      border: 3px solid #f3f3f3; border-top: 3px solid #667eea;
      border-radius: 50%; width: 30px; height: 30px;
      animation: spin 1s linear infinite; margin: 0 auto 10px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .quick-import { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
    .quick-import .btn { flex: 1; min-width: 120px; text-align: center; }
    .status-bar { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
    .status-item {
      background: #f8f9fa; padding: 12px 20px; border-radius: 8px;
      text-align: center; flex: 1; min-width: 100px;
    }
    .status-item .value { font-size: 24px; font-weight: bold; color: #667eea; }
    .status-item .label { font-size: 12px; color: #666; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1><span>🎵</span> 音源管理</h1>
      <div class="status-bar">
        <div class="status-item">
          <div class="value" id="scriptCount">0</div>
          <div class="label">已加载音源</div>
        </div>
        <div class="status-item">
          <div class="value" id="defaultSource">未设置</div>
          <div class="label">默认音源</div>
        </div>
      </div>
      <h2>📥 导入音源</h2>
      <div class="form-group">
        <label>从 URL 导入</label>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="importUrl" placeholder="输入音源脚本 URL..." style="flex: 1;">
          <button class="btn btn-primary" onclick="importFromUrl()">导入</button>
        </div>
      </div>
      <div class="quick-import">
        <button class="btn btn-secondary" onclick="quickImport('https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js')">六音音源</button>
        <button class="btn btn-secondary" onclick="quickImport('https://raw.githubusercontent.com/lyswhut/lx-music-source/master/scripts/dist/lx-music-source.js')">官方示例</button>
      </div>
      <div class="form-group" style="margin-top: 20px;">
        <label>从文件导入</label>
        <input type="file" id="importFile" accept=".js" onchange="importFromFile()">
      </div>
    </div>
    <div class="card">
      <h2>📋 已加载音源</h2>
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <div>处理中...</div>
      </div>
      <ul class="script-list" id="scriptList"></ul>
    </div>
  </div>
  <div class="toast" id="toast"></div>
  <script>
    const API_PREFIX = '/${this.apiKey}';
    const SCRIPTS_DATA = ${scriptsJson};
    const DEFAULT_SOURCE = ${defaultSourceJson};
    
    function init() {
      document.getElementById('scriptCount').textContent = SCRIPTS_DATA.length;
      document.getElementById('defaultSource').textContent = DEFAULT_SOURCE ? DEFAULT_SOURCE.name : '未设置';
      renderScriptList();
    }
    
    function renderScriptList() {
      const list = document.getElementById('scriptList');
      if (SCRIPTS_DATA.length === 0) {
        list.innerHTML = '<li class="empty-state"><span>📭</span><p>暂无音源，请导入</p></li>';
        return;
      }
      list.innerHTML = SCRIPTS_DATA.map(function(script) {
        var tags = '<span class="tag">v' + (script.version || '未知') + '</span>';
        tags += '<span class="tag">' + (script.author || '未知作者') + '</span>';
        script.supportedSources.forEach(function(s) { tags += '<span class="tag">' + s + '</span>'; });
        var defaultTag = script.isDefault ? '<span class="tag default-tag">默认</span>' : '';
        var setDefaultBtn = !script.isDefault ? '<button class="btn btn-success btn-sm" onclick="setDefault(\\'' + script.id + '\\')">设为默认</button>' : '';
        var actions = setDefaultBtn + '<button class="btn btn-danger btn-sm" onclick="deleteScript(\\'' + script.id + '\\')">删除</button>';
        return '<li class="script-item' + (script.isDefault ? ' default' : '') + '" id="script-' + script.id + '">' +
          '<div class="script-info"><h3>' + script.name + ' ' + defaultTag + '</h3>' +
          '<p>' + (script.description || '无描述') + '</p><p>' + tags + '</p>' +
          '<p style="font-size: 11px; color: #999;">ID: ' + script.id + '</p></div>' +
          '<div class="script-actions">' + actions + '</div></li>';
      }).join('');
    }
    
    function showToast(message, type) {
      type = type || 'success';
      var toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast ' + type;
      toast.classList.add('show');
      setTimeout(function() { toast.classList.remove('show'); }, 3000);
    }
    
    function showLoading() { document.getElementById('loading').classList.add('show'); }
    function hideLoading() { document.getElementById('loading').classList.remove('show'); }
    
    function importFromUrl() {
      var url = document.getElementById('importUrl').value.trim();
      if (!url) { showToast('请输入 URL', 'error'); return; }
      showLoading();
      fetch(API_PREFIX + '/api/scripts/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      }).then(function(res) { return res.json(); }).then(function(data) {
        if (data.code === 200 || data.code === 201) { showToast('导入成功'); setTimeout(function() { location.reload(); }, 1000); }
        else { showToast(data.msg || '导入失败', 'error'); }
      }).catch(function(e) { showToast('导入失败: ' + e.message, 'error'); }).finally(hideLoading);
    }
    
    function quickImport(url) {
      document.getElementById('importUrl').value = url;
      importFromUrl();
    }
    
    function importFromFile() {
      var file = document.getElementById('importFile').files[0];
      if (!file) return;
      showLoading();
      file.text().then(function(content) {
        return fetch(API_PREFIX + '/api/scripts/import/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: content, fileName: file.name })
        });
      }).then(function(res) { return res.json(); }).then(function(data) {
        if (data.code === 200 || data.code === 201) { showToast('导入成功'); setTimeout(function() { location.reload(); }, 1000); }
        else { showToast(data.msg || '导入失败', 'error'); }
      }).catch(function(e) { showToast('导入失败: ' + e.message, 'error'); }).finally(hideLoading);
    }
    
    function deleteScript(id) {
      if (!confirm('确定要删除这个音源吗？')) return;
      showLoading();
      fetch(API_PREFIX + '/api/scripts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      }).then(function(res) { return res.json(); }).then(function(data) {
        if (data.code === 200) { showToast('删除成功'); setTimeout(function() { location.reload(); }, 1000); }
        else { showToast(data.msg || '删除失败', 'error'); }
      }).catch(function(e) { showToast('删除失败: ' + e.message, 'error'); }).finally(hideLoading);
    }
    
    function setDefault(id) {
      showLoading();
      fetch(API_PREFIX + '/api/scripts/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      }).then(function(res) { return res.json(); }).then(function(data) {
        if (data.code === 200) { showToast('设置成功'); setTimeout(function() { location.reload(); }, 1000); }
        else { showToast(data.msg || '设置失败', 'error'); }
      }).catch(function(e) { showToast('设置失败: ' + e.message, 'error'); }).finally(hideLoading);
    }
    
    init();
  </script>
</body>
</html>`;
    
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  private markdownToHtml(markdown: string): string {
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/^---$/gim, '<hr>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    html = html.replace(/<li>/g, '<ul><li>').replace(/<\/li><br><ul><li>/g, '</li><li>');
    html = html.replace(/<\/li><br>(?!<li>)/g, '</li></ul><br>');
    
    return html;
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

      const loadedScripts = this.storage.getLoadedScripts();
      const defaultInfo = this.storage.getDefaultSourceInfo();

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        success: loaded,
        defaultSource: {
          id: defaultInfo?.id || null,
          name: defaultInfo?.name || null,
          supportedSources: defaultInfo?.supportedSources || [],
        },
        scripts: loadedScripts,
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

      const loadedScripts = this.storage.getLoadedScripts();
      const defaultInfo = this.storage.getDefaultSourceInfo();

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        success: removed,
        defaultSource: {
          id: defaultInfo?.id || null,
          name: defaultInfo?.name || null,
          supportedSources: defaultInfo?.supportedSources || [],
        },
        scripts: loadedScripts,
      }, removed ? "脚本已删除" : "脚本不存在"));
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

      const loadedScripts = this.storage.getLoadedScripts();
      const defaultInfo = this.storage.getDefaultSourceInfo();
      
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        success: success,
        defaultSource: {
          id: defaultInfo?.id || null,
          name: defaultInfo?.name || null,
          supportedSources: defaultInfo?.supportedSources || [],
        },
        scripts: loadedScripts,
      }, success ? `默认音源已设置为: ${scriptInfo?.name || id}` : "设置失败"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleGetDefaultSource(_ctx: any): Promise<Response> {
    try {
      const defaultInfo = this.storage.getDefaultSourceInfo();
      const loadedScripts = this.storage.getLoadedScripts();
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        defaultSource: {
          id: defaultInfo?.id || null,
          name: defaultInfo?.name || null,
          supportedSources: defaultInfo?.supportedSources || [],
        },
        scripts: loadedScripts,
      }));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleSetMusicUrlCacheEnabled(ctx: any): Promise<Response> {
    try {
      const body = await ctx.req.json();
      const enabled = body.enabled === 1 || body.enabled === true;

      await this.storage.setMusicUrlCacheEnabled(enabled);
      const isEnabled = await this.storage.isMusicUrlCacheEnabled();
      const cacheCount = await this.storage.getMusicUrlCacheCount();

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        enabled: isEnabled,
        cacheCount,
      }, enabled ? "音乐URL缓存已开启" : "音乐URL缓存已关闭"));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleGetMusicUrlCacheStatus(_ctx: any): Promise<Response> {
    try {
      const isEnabled = await this.storage.isMusicUrlCacheEnabled();
      const cacheCount = await this.storage.getMusicUrlCacheCount();

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        enabled: isEnabled,
        cacheCount,
      }));
    } catch (error: any) {
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(error.message, 500));
    }
  }

  private async handleClearMusicUrlCache(_ctx: any): Promise<Response> {
    try {
      await this.storage.clearMusicUrlCache();

      return ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        cleared: true,
      }, "音乐URL缓存已清除"));
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

      const allowToggleSource = body.allowToggleSource !== false;
      const excludeSources = body.excludeSources || [];

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

      const cacheEnabled = await this.storage.isMusicUrlCacheEnabled();
      const cacheKey = `${body.source}_${songId}_${body.quality}`;

      if (cacheEnabled && songId) {
        const cachedUrl = await this.storage.getMusicUrlCache(body.source, songId, body.quality);
        if (cachedUrl && cachedUrl.url) {
          console.log(`[API] 使用缓存 URL, cacheKey: ${cacheKey}`);
          const responseData = {
            url: cachedUrl.url,
            type: cachedUrl.quality || body.quality,
            source: body.source,
            quality: body.quality,
            lyric: '',
            tlyric: '',
            rlyric: '',
            lxlyric: '',
            cached: true,
            cachedAt: new Date(cachedUrl.cachedAt).toISOString(),
          };
          console.log('[API] 返回缓存数据:', JSON.stringify(responseData, null, 2));
          console.log('========== [API] handleGetMusicUrl 结束 ==========\n');
          return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(responseData, "获取成功（缓存）"));
        }
        console.log(`[API] 缓存未命中, cacheKey: ${cacheKey}`);
      }

      const name = body.name || body.musicInfo?.name || '未知歌曲';
      const singer = body.singer || body.musicInfo?.singer || '未知歌手';

      const defaultScriptId = await this.storage.getDefaultSource();
      const scriptId = defaultScriptId || 'unknown';
      const originalSource = body.source;

      const lyricPromise = this.getLyricForMusicUrl(body, songId, name, singer, '', '');
      lyricPromise.then(() => console.log('[API] 歌词获取完成')).catch(e => console.log('[API] 歌词获取失败:', e.message));

      const result = await this.tryGetMusicUrl(body, songId, name, singer);
      
      if (result.success && result.url) {
        if (result.url.endsWith('2149972737147268278.mp3')) {
          console.error('[API] 检测到无效URL，判断获取失败');
          await this.storage.updateSourceStats(scriptId, originalSource, false);
          
          if (allowToggleSource) {
            return await this.tryToggleSource(body, songId, name, singer, originalSource, excludeSources, scriptId, lyricPromise);
          }
          
          return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("获取播放URL失败", 500, {
            source: body.source,
          }));
        }

        await this.storage.updateSourceStats(scriptId, originalSource, true);

        if (cacheEnabled && songId) {
          await this.storage.setMusicUrlCache(body.source, songId, result.url, body.quality);
          console.log(`[API] 已缓存 URL, cacheKey: ${cacheKey}`);
        }

        let lyricResult: { lyric: string; tlyric: string; rlyric: string; lxlyric: string } = { lyric: '', tlyric: '', rlyric: '', lxlyric: '' };
        try {
          const result = await Promise.race([
            lyricPromise,
            new Promise<{ lyric: string; tlyric: string; rlyric: string; lxlyric: string }>((resolve) => setTimeout(() => resolve({ lyric: '', tlyric: '', rlyric: '', lxlyric: '' }), 3000))
          ]);
          lyricResult = {
            lyric: result.lyric || '',
            tlyric: result.tlyric || '',
            rlyric: result.rlyric || '',
            lxlyric: result.lxlyric || '',
          };
        } catch (e) {
          console.log('[API] 歌词获取超时或失败，继续返回播放URL');
        }

        const responseData = {
          url: result.url,
          type: result.type || body.quality,
          source: body.source,
          quality: body.quality,
          lyric: lyricResult.lyric || '',
          tlyric: lyricResult.tlyric || '',
          rlyric: lyricResult.rlyric || '',
          lxlyric: lyricResult.lxlyric || '',
          cached: false,
          fallback: {
            toggled: false,
            originalSource: originalSource,
          },
        };
        console.log('[API] 最终响应:', JSON.stringify(responseData, null, 2));
        console.log('========== [API] handleGetMusicUrl 结束 ==========\n');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(responseData, "获取成功"));
      }

      await this.storage.updateSourceStats(scriptId, originalSource, false);

      if (allowToggleSource) {
        return await this.tryToggleSource(body, songId, name, singer, originalSource, excludeSources, scriptId, lyricPromise);
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

  private async tryGetMusicUrl(body: any, songId: string, name: string, singer: string): Promise<{ success: boolean; url?: string; type?: string; message?: string }> {
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
        return { success: true, url: musicUrlData.url, type: musicUrlData.type };
      }
    }

    return { success: false, message: result.message || "获取播放URL失败" };
  }

  private async tryToggleSource(
    body: any,
    songId: string,
    name: string,
    singer: string,
    originalSource: string,
    excludeSources: string[],
    scriptId: string,
    lyricPromise?: Promise<{lyric: string; tlyric?: string; rlyric?: string; lxlyric?: string}>
  ): Promise<Response> {
    console.log(`[API] 开始换源流程，原始音源: ${originalSource}`);

    const keyword = `${name} ${singer}`.trim();
    console.log(`[API] 跨源搜索关键词: ${keyword}`);

    const targetInterval = body.interval || body.musicInfo?.interval;
    const targetAlbumName = body.albumName || body.musicInfo?.albumName || body.musicInfo?.album;

    const allSources = ['kw', 'kg', 'tx', 'wy', 'mg'];
    const sourcesToSearch = allSources.filter(s => s !== originalSource && !excludeSources.includes(s));
    
    console.log(`[API] 并行搜索音源: ${sourcesToSearch.join(', ')}`);

    const searchPromises = sourcesToSearch.map(async (source) => {
      try {
        const searchResults = await this.searchService.search(keyword, source, 1, 10);
        const searchResult = searchResults.find(r => r.platform === source);
        return { source, searchResult };
      } catch (error: any) {
        console.log(`[API] ${source} 搜索失败: ${error.message}`);
        return { source, searchResult: null };
      }
    });

    const searchResultsArray = await Promise.all(searchPromises);

    const matchedSongs: any[] = [];
    for (const { source, searchResult } of searchResultsArray) {
      if (!searchResult || searchResult.results.length === 0) {
        console.log(`[API] ${source} 搜索结果为空`);
        continue;
      }

      const matchedSong = this.findBestMatch(searchResult.results, name, singer, targetInterval, targetAlbumName);
      if (matchedSong) {
        matchedSongs.push({
          ...matchedSong,
          source,
          matchScore: matchedSong.matchScore || 0,
        });
        console.log(`[API] ${source} 找到匹配歌曲: ${matchedSong.name} - ${matchedSong.singer} (匹配度: ${matchedSong.matchScore || 0})`);
      } else {
        console.log(`[API] ${source} 未找到匹配歌曲`);
      }
    }

    if (matchedSongs.length === 0) {
      console.log('[API] 所有音源均未找到匹配歌曲');
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("未找到匹配歌曲", 404, {
        source: originalSource,
      }));
    }

    const sourceStats = await this.storage.getSourceStatsForScript(scriptId);
    const sortedSongs = this.sortByMatchAndSuccessRate(matchedSongs, sourceStats);
    
    console.log(`[API] 综合排序后的歌曲列表:`);
    sortedSongs.forEach((song: any, index: number) => {
      const stats = sourceStats[song.source];
      const rate = stats ? ((stats.success / (stats.success + stats.fail)) * 100).toFixed(1) : '0.0';
      console.log(`[API]   ${index + 1}. ${song.source}: ${song.name} - ${song.singer} (匹配度: ${song.matchScore?.toFixed(2) || 0}, 成功率: ${rate}%)`);
    });

    for (const song of sortedSongs) {
      const newSource = song.source;
      console.log(`[API] 尝试从 ${newSource} 获取播放URL`);

      try {
        const newBody = {
          ...body,
          source: newSource,
          musicInfo: {
            ...body.musicInfo,
            ...song.musicInfo,
            source: newSource,
          },
        };

        const newSongId = song.musicInfo?.songmid || song.musicInfo?.id || song.id || song.hash;
        const result = await this.tryGetMusicUrl(newBody, newSongId, song.name, song.singer);

        if (result.success && result.url) {
          if (result.url.endsWith('2149972737147268278.mp3')) {
            console.log(`[API] ${newSource} 返回无效URL，继续尝试下一个`);
            await this.storage.updateSourceStats(scriptId, newSource, false);
            continue;
          }

          await this.storage.updateSourceStats(scriptId, newSource, true);
          console.log(`[API] 换源成功: ${originalSource} -> ${newSource}`);

          let lyricResult: { lyric: string; tlyric: string; rlyric: string; lxlyric: string } = { lyric: '', tlyric: '', rlyric: '', lxlyric: '' };
          
          if (lyricPromise) {
            try {
              const result = await Promise.race([
                lyricPromise,
                new Promise<{ lyric: string; tlyric: string; rlyric: string; lxlyric: string }>((resolve) => setTimeout(() => resolve({ lyric: '', tlyric: '', rlyric: '', lxlyric: '' }), 2000))
              ]);
              lyricResult = {
                lyric: result.lyric || '',
                tlyric: result.tlyric || '',
                rlyric: result.rlyric || '',
                lxlyric: result.lxlyric || '',
              };
            } catch (e) {
              console.log('[API] 原始歌词获取失败，尝试获取新音源歌词');
            }
          }
          
          if (!lyricResult.lyric) {
            try {
              let lyricSongId = '';
              let lyricHash = '';
              let lyricCopyrightId = '';
              
              switch (newSource) {
                case 'kw':
                  lyricSongId = song.musicInfo?.songmid || song.id || '';
                  break;
                case 'kg':
                  lyricHash = song.musicInfo?.hash || song.hash || '';
                  break;
                case 'tx':
                  lyricSongId = song.musicInfo?.songmid || song.musicInfo?.songId || song.id || '';
                  break;
                case 'wy':
                  lyricSongId = song.musicInfo?.songId || song.musicInfo?.id || song.id || '';
                  break;
                case 'mg':
                  lyricCopyrightId = song.musicInfo?.copyrightId || song.id || '';
                  break;
              }
              
              const newLyricResult = await Promise.race([
                this.getLyricForMusicUrl(newBody, lyricSongId, song.name, song.singer, lyricHash, lyricCopyrightId),
                new Promise<{ lyric: string; tlyric: string; rlyric: string; lxlyric: string }>((resolve) => setTimeout(() => resolve({ lyric: '', tlyric: '', rlyric: '', lxlyric: '' }), 3000))
              ]);
              lyricResult = {
                lyric: newLyricResult.lyric || '',
                tlyric: newLyricResult.tlyric || '',
                rlyric: newLyricResult.rlyric || '',
                lxlyric: newLyricResult.lxlyric || '',
              };
            } catch (e) {
              console.log('[API] 新音源歌词获取失败');
            }
          }

          const responseData = {
            url: result.url,
            type: result.type || body.quality,
            source: newSource,
            quality: body.quality,
            lyric: lyricResult.lyric || '',
            tlyric: lyricResult.tlyric || '',
            rlyric: lyricResult.rlyric || '',
            lxlyric: lyricResult.lxlyric || '',
            cached: false,
            fallback: {
              toggled: true,
              originalSource: originalSource,
              newSource: newSource,
              matchedSong: {
                name: song.name,
                singer: song.singer,
              },
            },
          };
          console.log('[API] 换源成功响应:', JSON.stringify(responseData, null, 2));
          console.log('========== [API] handleGetMusicUrl 结束 ==========\n');
          return ApiResponseBuilder.toResponse(ApiResponseBuilder.success(responseData, "获取成功（换源）"));
        }

        await this.storage.updateSourceStats(scriptId, newSource, false);
        console.log(`[API] ${newSource} 获取URL失败，继续尝试下一个`);
      } catch (error: any) {
        console.error(`[API] ${newSource} 换源异常:`, error.message);
        await this.storage.updateSourceStats(scriptId, newSource, false);
      }
    }

    console.log('[API] 所有音源尝试完毕，均失败');
    console.log('========== [API] handleGetMusicUrl 结束 ==========\n');
    return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("所有音源均获取失败", 500, {
      source: originalSource,
      triedSources: sortedSongs.map((s: any) => s.source),
    }));
  }

  private sortByMatchAndSuccessRate(songs: any[], sourceStats: { [source: string]: { success: number; fail: number } }): any[] {
    const getSuccessRate = (source: string): number => {
      const stats = sourceStats[source];
      if (!stats) return 0.5;
      const total = stats.success + stats.fail;
      if (total === 0) return 0.5;
      return stats.success / total;
    };

    const getSuccessCount = (source: string): number => {
      const stats = sourceStats[source];
      return stats?.success || 0;
    };

    return songs.sort((a, b) => {
      const matchScoreA = a.matchScore || 0;
      const matchScoreB = b.matchScore || 0;
      
      const intervalMatchA = a.intervalMatch ? 1 : 0;
      const intervalMatchB = b.intervalMatch ? 1 : 0;
      
      const successRateA = getSuccessRate(a.source);
      const successRateB = getSuccessRate(b.source);
      
      const successCountA = getSuccessCount(a.source);
      const successCountB = getSuccessCount(b.source);

      if (intervalMatchA !== intervalMatchB) {
        return intervalMatchB - intervalMatchA;
      }

      const totalScoreA = matchScoreA * 0.5 + successRateA * 0.3 + Math.min(successCountA / 100, 0.2);
      const totalScoreB = matchScoreB * 0.5 + successRateB * 0.3 + Math.min(successCountB / 100, 0.2);

      return totalScoreB - totalScoreA;
    });
  }

  private findBestMatch(results: any[], targetName: string, targetSinger: string, targetInterval?: string, targetAlbumName?: string): any | null {
    if (results.length === 0) return null;

    const singersRxp = /、|&|;|；|\/|,|，|\|/;
    const sortSingle = (singer: string) => singersRxp.test(singer)
      ? singer.split(singersRxp).sort((a, b) => a.localeCompare(b)).join('、')
      : (singer || '');
    
    const trimStr = (str: string) => typeof str === 'string' ? str.trim() : (str || '');
    const filterStr = (str: string) => typeof str === 'string' 
      ? str.replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '').toLowerCase() 
      : String(str || '').toLowerCase();
    
    const getIntv = (interval: string | number | undefined): number => {
      if (!interval) return 0;
      if (typeof interval === 'number') return interval;
      if (typeof interval !== 'string') return 0;
      const intvArr = interval.split(':');
      let intv = 0;
      let unit = 1;
      while (intvArr.length) {
        intv += parseInt(intvArr.pop() || '0') * unit;
        unit *= 60;
      }
      return intv;
    };

    const fMusicName = filterStr(targetName);
    const fSinger = filterStr(sortSingle(targetSinger));
    const fAlbumName = filterStr(targetAlbumName || '');
    const fInterval = getIntv(targetInterval);

    const isEqualsInterval = (intv: number) => {
      if (!fInterval && !intv) return false;
      return Math.abs((fInterval || intv) - (intv || fInterval)) < 5;
    };
    const isIncludesName = (name: string) => (fMusicName.includes(name) || name.includes(fMusicName));
    const isIncludesSinger = (singer: string) => fSinger ? (fSinger.includes(singer) || singer.includes(fSinger)) : true;

    const processedResults = results.map(item => {
      const resultName = trimStr(item.name || '');
      const resultSinger = trimStr(item.singer || '');
      const resultInterval = item.interval;
      const resultAlbumName = trimStr(item.albumName || '');
      
      return {
        ...item,
        name: resultName,
        singer: resultSinger,
        interval: resultInterval,
        albumName: resultAlbumName,
        fSinger: filterStr(sortSingle(resultSinger)),
        fMusicName: filterStr(resultName),
        fAlbumName: filterStr(resultAlbumName),
        fInterval: getIntv(resultInterval),
        intervalMatch: isEqualsInterval(getIntv(resultInterval)),
        nameMatch: filterStr(resultName) === fMusicName,
        singerMatch: filterStr(sortSingle(resultSinger)) === fSinger,
        albumMatch: filterStr(resultAlbumName) === fAlbumName,
      };
    });

    const sortMusic = (list: any[], filter: (item: any) => boolean): any[] => {
      const matched = list.filter(filter);
      const rest = list.filter(item => !filter(item));
      return [...matched, ...rest];
    };

    let sortedResults = [...processedResults];
    
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.singerMatch && item.nameMatch && item.intervalMatch
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.nameMatch && item.singerMatch && item.fAlbumName === fAlbumName
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.singerMatch && item.nameMatch
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.nameMatch && item.intervalMatch
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.singerMatch && item.intervalMatch
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.intervalMatch
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.nameMatch
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      item.singerMatch
    );
    sortedResults = sortMusic(sortedResults, (item: any) => 
      !!(item.fAlbumName === fAlbumName && fAlbumName)
    );

    const calculateMatchScore = (item: any, index: number): number => {
      let score = 0;
      
      if (item.nameMatch) {
        score += 0.4;
      } else if (isIncludesName(item.fMusicName)) {
        score += 0.2;
      }
      
      if (item.singerMatch) {
        score += 0.3;
      } else if (isIncludesSinger(item.fSinger)) {
        score += 0.15;
      }
      
      if (item.intervalMatch) {
        score += 0.2;
      }
      
      if (fAlbumName && item.albumMatch) {
        score += 0.1;
      }

      const positionBonus = Math.max(0, (processedResults.length - index) / processedResults.length * 0.1);
      score += positionBonus;
      
      return score;
    };

    const bestMatch = sortedResults[0];
    if (!bestMatch) return null;

    const matchScore = calculateMatchScore(bestMatch, 0);
    
    if (matchScore < 0.3 && !bestMatch.intervalMatch) {
      console.log(`[API] 最佳匹配分数过低: ${matchScore.toFixed(2)}，且时长不匹配`);
      return null;
    }

    return {
      ...bestMatch,
      matchScore,
    };
  }

  // 辅助方法：为音乐URL接口获取歌词
  private async getLyricForMusicUrl(body: any, songId: string, name: string, singer: string, hash: string, copyrightId?: string): Promise<{lyric: string; tlyric?: string; rlyric?: string; lxlyric?: string}> {
    try {
      const source = body.musicInfo?.source || body.source || 'unknown';
      
      // 根据音源映射参数
      let musicInfo: any = { source };

      switch (source) {
        case 'kw':
          musicInfo.songmid = songId;
          break;
        case 'kg':
          musicInfo.hash = hash || songId;
          musicInfo.name = name || '未知歌曲';
          break;
        case 'tx':
          musicInfo.songId = songId;
          break;
        case 'wy':
          musicInfo.songId = songId;
          break;
        case 'mg':
          musicInfo.copyrightId = copyrightId || songId;
          musicInfo.name = name;
          musicInfo.singer = singer;
          break;
        default:
          console.log('[API] 不支持的音源用于歌词获取:', source);
          return { lyric: '' };
      }

      console.log('[API] 获取歌词, musicInfo:', JSON.stringify(musicInfo, null, 2));
      
      const lyricResult = await this.lyricService.getLyric(musicInfo);
      
      console.log('[API] 歌词获取成功, 长度:', lyricResult.lyric?.length || 0);
      return {
        lyric: lyricResult.lyric || '',
        tlyric: lyricResult.tlyric || '',
        rlyric: lyricResult.rlyric || '',
        lxlyric: lyricResult.lxlyric || '',
      };
    } catch (error: any) {
      console.error('[API] 获取歌词失败:', error.message);
      return { lyric: '' };
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

  // 处理歌单详情请求
  private async handleGetSongListDetail(ctx: any): Promise<Response> {
    console.log('\n========== [API] handleGetSongListDetail 开始 ==========');
    
    try {
      const body = await ctx.req.json();
      console.log('[API] 请求参数:', JSON.stringify(body, null, 2));

      // 验证必要参数
      if (!body.source) {
        console.error('[API] 缺少source参数');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数: source", 400));
      }

      if (!body.id) {
        console.error('[API] 缺少id参数');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数: id (歌单ID或链接)", 400));
      }

      const source = body.source;
      const id = body.id;

      // 验证音源
      const validSources = ['wy', 'tx', 'kg', 'kw', 'mg'];
      if (!validSources.includes(source)) {
        console.error('[API] 不支持的音源:', source);
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error(`不支持的音源: ${source}，支持: wy, tx, kg, kw, mg`, 400));
      }

      console.log('[API] 开始获取歌单详情, source:', source, 'id:', id);
      
      // 调用歌单服务
      const result = await this.songListService.getListDetail(source, id);
      
      console.log('[API] 歌单详情获取成功');
      console.log('[API] 歌单名称:', result.info.name);
      console.log('[API] 歌曲数量:', result.list.length);
      console.log('[API] 总数量:', result.total);
      
      const response = ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        list: result.list,
        page: result.page,
        limit: result.limit,
        total: result.total,
        source: result.source,
        info: result.info,
      }, "获取歌单详情成功"));
      
      console.log('========== [API] handleGetSongListDetail 结束 ==========\n');
      return response;
    } catch (error: any) {
      console.error('[API] 获取歌单详情失败:', error.message);
      console.error('[API] 错误堆栈:', error.stack);
      console.log('========== [API] handleGetSongListDetail 异常结束 ==========\n');
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "获取歌单详情失败"));
    }
  }

  // 处理短链接歌单详情请求
  private async handleGetSongListDetailByLink(ctx: any): Promise<Response> {
    console.log('\n========== [API] handleGetSongListDetailByLink 开始 ==========');
    
    try {
      const body = await ctx.req.json();
      console.log('[API] 请求参数:', JSON.stringify(body, null, 2));

      // 验证必要参数
      if (!body.link) {
        console.error('[API] 缺少link参数');
        return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("缺少必要参数: link (歌单链接)", 400));
      }

      const link = body.link;
      // 可选参数：客户端可以指定平台，如果不指定则自动识别
      const specifiedSource = body.source;

      let source: string;
      let id: string;

      if (specifiedSource) {
        // 客户端指定了平台，直接使用
        console.log('[API] 客户端指定了平台:', specifiedSource);
        source = specifiedSource;
        
        // 从链接中提取ID
        const extractedId = await this.shortLinkService.extractIdFromUrl(link, source);
        if (!extractedId) {
          console.error('[API] 无法从链接中提取ID');
          return ApiResponseBuilder.toResponse(ApiResponseBuilder.error("无法从链接中提取歌单ID，请检查链接格式是否正确", 400));
        }
        id = extractedId;
        console.log('[API] 从链接提取ID成功:', id);
      } else {
        // 自动识别平台和ID
        console.log('[API] 开始解析短链接:', link);
        const parseResult = await this.shortLinkService.parseShortLink(link);
        console.log('[API] 短链接解析成功:', parseResult);
        source = parseResult.source;
        id = parseResult.id;
      }
      
      // 调用歌单服务获取详情
      console.log('[API] 开始获取歌单详情, source:', source, 'id:', id);
      const result = await this.songListService.getListDetail(source, id);
      
      console.log('[API] 歌单详情获取成功');
      console.log('[API] 歌单名称:', result.info.name);
      console.log('[API] 歌曲数量:', result.list.length);
      console.log('[API] 总数量:', result.total);
      
      const response = ApiResponseBuilder.toResponse(ApiResponseBuilder.success({
        list: result.list,
        page: result.page,
        limit: result.limit,
        total: result.total,
        source: result.source,
        info: result.info,
        parsed: {
          source: source,
          id: id,
        },
      }, "获取歌单详情成功"));
      
      console.log('========== [API] handleGetSongListDetailByLink 结束 ==========\n');
      return response;
    } catch (error: any) {
      console.error('[API] 获取歌单详情失败:', error.message);
      console.error('[API] 错误堆栈:', error.stack);
      console.log('========== [API] handleGetSongListDetailByLink 异常结束 ==========\n');
      return ApiResponseBuilder.toResponse(ApiResponseBuilder.serverError(error.message || "获取歌单详情失败"));
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
}
