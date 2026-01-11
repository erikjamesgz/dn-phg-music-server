import { Sandbox } from "./sandbox.ts";
import { LXGlobal } from "./lx_global.ts";
import { RequestManager } from "./request_manager.ts";

export interface ScriptInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  version: string;
  rawScript: string;
}

export interface MusicUrlRequest {
  source: string;
  action: string;
  info: {
    type: string;
    musicInfo: {
      id: string;
      name: string;
      singer: string;
      albumName?: string;
      songmid: string;
      source: string;
    };
  };
}

export interface MusicUrlResponse {
  source: string;
  action: string;
  data: {
    type: string;
    url: string;
  };
}

export class ScriptEngine {
  private sandboxes: Map<string, Sandbox> = new Map();
  private requestManager: RequestManager;
  private activeScripts: Map<string, ScriptInfo> = new Map();

  constructor() {
    this.requestManager = new RequestManager();
  }

  async loadScript(scriptInfo: ScriptInfo): Promise<boolean> {
    try {
      console.log(`📜 加载脚本: ${scriptInfo.name}`);

      const sandbox = new Sandbox(scriptInfo, this.requestManager);

      await sandbox.initialize();

      this.sandboxes.set(scriptInfo.id, sandbox);
      this.activeScripts.set(scriptInfo.id, scriptInfo);

      console.log(`✅ 脚本加载成功: ${scriptInfo.name}`);
      return true;
    } catch (error) {
      console.error(`❌ 脚本加载失败: ${scriptInfo.name}`, error);
      return false;
    }
  }

  async unloadScript(scriptId: string): Promise<void> {
    const sandbox = this.sandboxes.get(scriptId);
    if (sandbox) {
      await sandbox.terminate();
      this.sandboxes.delete(scriptId);
      this.activeScripts.delete(scriptId);
      console.log(`🗑️ 脚本已卸载: ${scriptId}`);
    }
  }

  async getMusicUrl(request: MusicUrlRequest): Promise<MusicUrlResponse> {
    const { source, info } = request;

    for (const [scriptId, sandbox] of this.sandboxes) {
      try {
        if (sandbox.supportsSource(source)) {
          const response = await sandbox.request(request);
          if (response) {
            return response;
          }
        }
      } catch (error) {
        console.error(`脚本执行错误 [${scriptId}]:`, error);
      }
    }

    throw new Error(`No available script for source: ${source}`);
  }

  async getLyric(request: any): Promise<any> {
    const { source, info } = request;

    for (const [scriptId, sandbox] of this.sandboxes) {
      try {
        if (sandbox.supportsSource(source)) {
          const response = await sandbox.request(request);
          if (response) {
            return response;
          }
        }
      } catch (error) {
        console.error(`脚本执行错误 [${scriptId}]:`, error);
      }
    }

    throw new Error(`No available script for source: ${source}`);
  }

  async getPic(request: any): Promise<string> {
    const { source, info } = request;

    for (const [scriptId, sandbox] of this.sandboxes) {
      try {
        if (sandbox.supportsSource(source)) {
          const response = await sandbox.request(request);
          if (response) {
            return response;
          }
        }
      } catch (error) {
        console.error(`脚本执行错误 [${scriptId}]:`, error);
      }
    }

    throw new Error(`No available script for source: ${source}`);
  }

  getActiveScripts(): ScriptInfo[] {
    return Array.from(this.activeScripts.values());
  }

  getScript(scriptId: string): Sandbox | undefined {
    return this.sandboxes.get(scriptId);
  }

  async terminate(): Promise<void> {
    for (const sandbox of this.sandboxes.values()) {
      await sandbox.terminate();
    }
    this.sandboxes.clear();
    this.activeScripts.clear();
  }
}
