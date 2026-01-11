import { ScriptInfo, MusicUrlRequest, MusicUrlResponse } from "./script_engine.ts";
import { RequestManager } from "./request_manager.ts";
import { LXGlobal } from "./lx_global.ts";

export class Sandbox {
  private scriptInfo: ScriptInfo;
  private requestManager: RequestManager;
  private lxGlobal: LXGlobal;
  private sourceHandlers: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private requestHandler: ((data: any) => Promise<any>) | null = null;

  constructor(scriptInfo: ScriptInfo, requestManager: RequestManager) {
    this.scriptInfo = scriptInfo;
    this.requestManager = requestManager;
    this.lxGlobal = new LXGlobal(scriptInfo, requestManager, this.handleRequest.bind(this));
  }

  async initialize(): Promise<void> {
    try {
      await this.executeScript(this.scriptInfo.rawScript);
      this.isInitialized = true;
      console.log(`🔒 Sandbox 初始化完成: ${this.scriptInfo.name}`);
    } catch (error) {
      console.error(`❌ Sandbox 初始化失败: ${this.scriptInfo.name}`, error);
      throw error;
    }
  }

  private async executeScript(script: string): Promise<void> {
    try {
      const lxObject = this.lxGlobal.createGlobalObject();

      const wrappedScript = `
        (function(lx) {
          ${script}
        })
      `;

      const fn = eval(wrappedScript);

      if (typeof fn === 'function') {
        await Promise.race([
          Promise.resolve(fn(lxObject)),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Script execution timeout')), 30000)
          )
        ]);
      }
    } catch (error) {
      console.error("脚本执行错误:", error);
      throw error;
    }
  }

  private async handleRequest(data: MusicUrlRequest): Promise<MusicUrlResponse | null> {
    if (!this.requestHandler) {
      console.warn(`⚠️ 请求处理器未设置: ${this.scriptInfo.name}`);
      return null;
    }

    try {
      const result = await this.requestHandler(data);
      return this.validateResponse(result, data.action);
    } catch (error) {
      console.error(`请求处理错误: ${this.scriptInfo.name}`, error);
      return null;
    }
  }

  private validateResponse(result: any, action: string): MusicUrlResponse | null {
    if (!result) return null;

    switch (action) {
      case 'musicUrl':
        if (typeof result !== 'string' || result.length > 2048 || !/^https?:/.test(result)) {
          console.warn('⚠️ 无效的音乐URL响应');
          return null;
        }
        return {
          source: this.getCurrentSource(),
          action,
          data: {
            type: 'musicUrl',
            url: result,
          },
        };

      case 'lyric':
        if (typeof result !== 'object' || typeof result.lyric !== 'string') {
          console.warn('⚠️ 无效的歌词响应');
          return null;
        }
        return {
          source: this.getCurrentSource(),
          action,
          data: {
            type: 'lyric',
            lyric: result.lyric,
            tlyric: result.tlyric || null,
            rlyric: result.rlyric || null,
            lxlyric: result.lxlyric || null,
          },
        };

      case 'pic':
        if (typeof result !== 'string' || result.length > 2048 || !/^https?:/.test(result)) {
          console.warn('⚠️ 无效的图片URL响应');
          return null;
        }
        return {
          source: this.getCurrentSource(),
          action,
          data: result,
        };

      default:
        return null;
    }
  }

  private getCurrentSource(): string {
    return this.scriptInfo.id;
  }

  async request(request: MusicUrlRequest): Promise<MusicUrlResponse | null> {
    if (!this.isInitialized) {
      throw new Error('Sandbox not initialized');
    }

    return this.handleRequest(request);
  }

  supportsSource(source: string): boolean {
    return this.sourceHandlers.has(source);
  }

  setSourceHandler(source: string, handler: any): void {
    this.sourceHandlers.set(source, handler);
  }

  setRequestHandler(handler: (data: any) => Promise<any>): void {
    this.requestHandler = handler;
  }

  async terminate(): Promise<void> {
    try {
      this.sourceHandlers.clear();
      await this.lxGlobal.cleanup();
      this.isInitialized = false;
      console.log(`🔒 Sandbox 已终止: ${this.scriptInfo.name}`);
    } catch (error) {
      console.error(`终止 Sandbox 时出错: ${this.scriptInfo.name}`, error);
    }
  }

  getScriptInfo(): ScriptInfo {
    return this.scriptInfo;
  }
}
