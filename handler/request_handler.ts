import { ScriptEngine } from "../engine/script_engine.ts";
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
  private readonly REQUEST_TIMEOUT = 20000;

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
    const response = await this.engine.getMusicUrl({
      source,
      action: 'musicUrl',
      info,
    });

    if (!response) {
      throw new Error('Failed to get music URL');
    }

    return {
      type: info.type,
      url: response.data.url,
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

    return response.data;
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
