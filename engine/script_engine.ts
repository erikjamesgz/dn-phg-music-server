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
  supportedSources: string[];
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
      source: string;
      interval: string | null;
      meta: {
        songId: string | number;
        albumName: string;
        picUrl?: string | null;
        hash?: string;
        strMediaMid?: string;
        copyrightId?: string;
      };
    };
  };
}

export interface MusicUrlData {
  type: string;
  url: string;
}

export interface LyricData {
  type: string;
  lyric: string;
  tlyric: string | null;
  rlyric: string | null;
  lxlyric: string | null;
}

export interface PicData {
  type: string;
  url: string;
}

export interface MusicUrlResponse {
  source: string;
  action: string;
  data: MusicUrlData | LyricData | PicData;
}

export class ScriptEngine {
  private sandboxes: Map<string, Sandbox> = new Map();
  private requestManager: RequestManager;
  private activeScripts: Map<string, ScriptInfo> = new Map();
  private storage: any;

  constructor(storage?: any) {
    this.requestManager = new RequestManager();
    this.storage = storage;
  }

  async loadScript(scriptInfo: ScriptInfo): Promise<boolean> {
    try {
      const sandbox = new Sandbox(scriptInfo, this.requestManager);

      await sandbox.initialize();
      
      const registeredSources = sandbox.getRegisteredSourceList();
      
      let finalSources: string[];
      
      if (registeredSources.length > 0) {
        finalSources = registeredSources;
      } else {
        finalSources = [];
      }
      
      if (finalSources.length > 0) {
        scriptInfo.supportedSources = finalSources;
        
        for (const source of finalSources) {
          if (!sandbox.supportsSource(source)) {
            sandbox.setSourceHandler(source, async(request: MusicUrlRequest) => {
              return this.handleScriptRequest(sandbox, request);
            });
          }
        }
        
        if (this.storage) {
          await this.storage.updateScriptSupportedSources(scriptInfo.id, finalSources);
        }
      }

      this.sandboxes.set(scriptInfo.id, sandbox);
      this.activeScripts.set(scriptInfo.id, scriptInfo);

      return true;
    } catch (error: any) {
      console.error(`[ScriptEngine] 加载脚本失败: ${scriptInfo.name}`, error?.message || error);
      throw error; // 重新抛出错误，让上层知道初始化失败
    }
  }

  async unloadScript(scriptId: string): Promise<void> {
    const sandbox = this.sandboxes.get(scriptId);
    if (sandbox) {
      await sandbox.terminate();
      this.sandboxes.delete(scriptId);
      this.activeScripts.delete(scriptId);
    }
  }

  async getMusicUrl(request: MusicUrlRequest): Promise<MusicUrlResponse> {
    console.log('\n========== [ScriptEngine] getMusicUrl 开始 ==========');
    console.log('[ScriptEngine] source:', request.source);
    console.log('[ScriptEngine] action:', request.action);
   // console.log('[ScriptEngine] info:', JSON.stringify(request.info, null, 2));
    console.log('[ScriptEngine] 可用的 sandboxes:', Array.from(this.sandboxes.keys()));
    console.log('[ScriptEngine] 可用的 activeScripts:', Array.from(this.activeScripts.keys()));

    const { source, info } = request;

    const triedScripts: string[] = [];

    for (const [scriptId, sandbox] of this.sandboxes) {
      //console.log('\n[ScriptEngine] 检查 sandbox:', scriptId);
      //console.log('[ScriptEngine] sandbox.supportsSource(', source, '):', sandbox.supportsSource(source));
                          console.log('[ScriptEngine] 2222');

      try {
        if (sandbox.supportsSource(source)) {
          triedScripts.push(scriptId);
          console.log('[ScriptEngine] 即将调用 sandbox.request...');
          console.log('[ScriptEngine] sandbox 对象:', sandbox ? '存在' : '不存在');
          console.log('[ScriptEngine] sandbox.supportsSource 结果: true');
          
          console.log('[ScriptEngine] 即将执行 sandbox.request(request)...');
          const response = await sandbox.request(request);
          console.log('[ScriptEngine] sandbox.request 执行完成');
          //console.log('[ScriptEngine] sandbox.request 返回:', JSON.stringify(response, null, 2));
          
          if (response && response.data && request.action === 'musicUrl' && (response.data as MusicUrlData).url) {
            console.log('[ScriptEngine] 获取成功，返回 response');
            console.log('========== [ScriptEngine] getMusicUrl 结束 ==========\n');
            return response;
          }
        }else{
                    console.log('[ScriptEngine] sandbox.supportsSource 不可用');

        }
      } catch (error: any) {
        console.error('[ScriptEngine] sandbox.request 异常:', error.message);
        console.error('[ScriptEngine] 异常堆栈:', error.stack);
        
        if (error.message.includes('404') || error.message.includes('Not Found') || error.message.includes('API') || error.message.includes('服务器')) {
          console.log('[ScriptEngine] 跳过此脚本，继续尝试下一个');
          continue;
        }
        console.error('[ScriptEngine] 抛出异常');
        console.log('========== [ScriptEngine] getMusicUrl 结束 ==========\n');
        throw error;
      }
    }

    console.error('[ScriptEngine] 没有找到支持 source:', source, '的脚本');
    console.error('[ScriptEngine] 已尝试的脚本:', triedScripts);
    
    if (triedScripts.length > 0) {
      console.error('[ScriptEngine] 抛出异常: 所有可用脚本都执行失败');
      console.log('========== [ScriptEngine] getMusicUrl 结束 ==========\n');
      throw new Error(`所有可用脚本都执行失败: ${triedScripts.join(', ')}。请检查API服务器状态。`);
    }

    console.error('[ScriptEngine] 抛出异常: No available script for source');
    console.log('========== [ScriptEngine] getMusicUrl 结束 ==========\n');
    throw new Error(`No available script for source1: ${source}`);
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
      }
    }

    throw new Error(`No available script for source2: ${source}`);
  }

  async getPic(request: any): Promise<MusicUrlResponse> {
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
      }
    }

    throw new Error(`No available script for source3: ${source}`);
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

  private async handleScriptRequest(sandbox: Sandbox, request: MusicUrlRequest): Promise<MusicUrlResponse> {
    const { source, action, info } = request;
    
    try {
      const response = await sandbox.request(request);
      
      if (response && response.data) {
        return response;
      }
      
      return {
        source,
        action,
        data: { type: 'music', url: '', lyric: '' } as MusicUrlData | LyricData | PicData,
      };
    } catch (error) {
      throw error;
    }
  }
}
