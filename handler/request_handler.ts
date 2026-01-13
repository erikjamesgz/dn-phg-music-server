import { ScriptEngine, MusicUrlData, LyricData } from "../engine/script_engine.ts";
import { ScriptStorage } from "../storage/storage.ts";

interface RequestData {
  requestKey: string;
  data: {
    source: string;
    action: string;
    info: any;
  };
}

interface ResponseData {
  status: boolean;
  message?: string;
  data?: any;
}

export class RequestHandler {
  private engine: ScriptEngine;
  private storage: ScriptStorage;
  private requestQueue: Map<string, [Function, Function]> = new Map();
  private timeouts: Map<string, number> = new Map();
  private readonly REQUEST_TIMEOUT = 60000;

  constructor(engine: ScriptEngine, storage: ScriptStorage) {
    this.engine = engine;
    this.storage = storage;
  }

  async handleRequest(requestData: RequestData): Promise<ResponseData> {
    const { requestKey, data } = requestData;
    const { source, action, info } = data;

    console.log(`📨 收到请求: ${action} [${source}] - ${requestKey}`);

    const timeoutKey = requestKey;
    if (this.timeouts.has(timeoutKey)) {
      clearTimeout(this.timeouts.get(timeoutKey));
    }

    this.timeouts.set(timeoutKey, setTimeout(() => {
      this.cancelRequest(timeoutKey);
    }, this.REQUEST_TIMEOUT));

    try {
      let result: any;

      switch (action) {
        case 'musicUrl':
          result = await this.handleMusicUrl(source, info);
          break;

        case 'lyric':
          result = await this.handleLyric(source, info);
          break;

        case 'pic':
          result = await this.handlePic(source, info);
          break;

        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      clearTimeout(this.timeouts.get(timeoutKey));
      this.timeouts.delete(timeoutKey);

      console.log(`✅ 请求完成: ${requestKey}`);

      return {
        status: true,
        data: {
          requestKey,
          result,
        },
      };
    } catch (error: any) {
      clearTimeout(this.timeouts.get(timeoutKey));
      this.timeouts.delete(timeoutKey);

      console.error(`❌ 请求失败: ${requestKey} - ${error.message}`);

      return {
        status: false,
        message: error.message,
      };
    }
  }

  private async handleMusicUrl(source: string, info: any): Promise<any> {
    const defaultSourceId = this.storage.getDefaultSource();
    let targetSource: string | null = source || defaultSourceId || null;
    let sourceType = source;
    
    if (!targetSource) {
      throw new Error(`No available script for source: ${source}`);
    }

    // 如果传入的是音源类型（kg, wy, mg 等），需要找到支持该音源类型的脚本
    if (!(targetSource as string).startsWith('user_api_')) {
      const allScripts = this.storage.getLoadedScripts();
      const targetScript = allScripts.find(script => 
        script.supportedSources.includes(targetSource as string)
      );
      
      if (!targetScript) {
        throw new Error(`No available script for source: ${source}`);
      }
      
      targetSource = targetScript.id;
      console.log(`🎯 找到支持音源 ${source} 的脚本: ${targetScript.name} (${targetScript.id})`);
    } else {
      // 如果传入的是脚本 ID，需要找到该脚本支持的音源类型
      const allScripts = this.storage.getLoadedScripts();
      const targetScript = allScripts.find(script => 
        script.id === targetSource
      );
      
      if (!targetScript) {
        throw new Error(`No available script for source: ${source}`);
      }
      
      sourceType = targetScript.supportedSources[0];
      console.log(`🎯 找到脚本 ${targetScript.name} (${targetScript.id})，支持的音源: ${sourceType}`);
    }
    
    const response = await this.engine.getMusicUrl({
      source: sourceType,
      action: 'musicUrl',
      info,
    });
    
    console.log(`🎯 调用 getMusicUrl: sourceType=${sourceType}, source=${source}`);
    
    if (!response || !response.data) {
      console.error(`❌ 获取音乐URL失败: source=${sourceType}, songmid=${info?.musicInfo?.songmid || 'unknown'}`);
      throw new Error(`Failed to get music URL: source=${sourceType}`);
    }

    const responseData = response.data as MusicUrlData;
    
    if (!responseData.url) {
      console.error(`❌ 音乐URL为空: source=${sourceType}, songmid=${info?.musicInfo?.songmid || 'unknown'}`);
      throw new Error(`Music URL is empty: source=${sourceType}`);
    }
    
    return {
      type: info.type,
      url: responseData.url,
    };
  }

  private async handleLyric(source: string, info: any): Promise<any> {
    const response = await this.engine.getLyric({
      source,
      action: 'lyric',
      info,
    });

    if (!response) {
      throw new Error('Failed to get lyric');
    }

    const responseData = response.data as LyricData;
    
    return {
      lyric: responseData.lyric,
      tlyric: responseData.tlyric,
      rlyric: responseData.rlyric,
      lxlyric: responseData.lxlyric,
    };
  }

  private async handlePic(source: string, info: any): Promise<string> {
    const response = await this.engine.getPic({
      source,
      action: 'pic',
      info,
    });

    if (!response) {
      throw new Error('Failed to get pic URL');
    }

    return response;
  }

  cancelRequest(requestKey: string): void {
    const request = this.requestQueue.get(requestKey);
    if (request) {
      request[1](new Error('Request cancelled'));
      this.requestQueue.delete(requestKey);
    }

    if (this.timeouts.has(requestKey)) {
      clearTimeout(this.timeouts.get(requestKey));
      this.timeouts.delete(requestKey);
    }

    console.log(`⏹️ 请求已取消: ${requestKey}`);
  }

  getActiveRequestCount(): number {
    return this.requestQueue.size;
  }

  async cleanup(): Promise<void> {
    for (const [requestKey, [, reject]] of this.requestQueue) {
      reject(new Error('Server shutting down'));
    }
    this.requestQueue.clear();

    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }
}
