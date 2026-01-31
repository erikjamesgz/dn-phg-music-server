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
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly REQUEST_TIMEOUT = 60000;

  constructor(engine: ScriptEngine, storage: ScriptStorage) {
    this.engine = engine;
    this.storage = storage;
  }

  async handleRequest(requestData: RequestData): Promise<ResponseData> {
    const { requestKey, data } = requestData;
    const { source, action, info } = data;
     
    console.log('\n========== [RequestHandler] handleRequest 开始 ==========');
    console.log('[RequestHandler] requestKey:', requestKey);
    console.log('[RequestHandler] source:', source);
    console.log('[RequestHandler] action:', action);
   // console.log('[RequestHandler] info 1:', JSON.stringify(info, null, 2));
    await this.storage.ready();
    console.log('[RequestHandler] 即将调用 storage.ready()...');
   
    console.log('[RequestHandler] storage.ready() 完成');

    const timeoutKey = requestKey;
    if (this.timeouts.has(timeoutKey)) {
      clearTimeout(this.timeouts.get(timeoutKey));
      console.log('[RequestHandler] 清除旧超时定时器');
    }

    this.timeouts.set(timeoutKey, setTimeout(() => {
      console.log('[RequestHandler] 请求超时，取消请求');
      this.cancelRequest(timeoutKey);
    }, this.REQUEST_TIMEOUT));
    console.log('[RequestHandler] 设置超时定时器:', this.REQUEST_TIMEOUT, 'ms');

    try {
      let result: any;
      console.log('[RequestHandler] 开始处理 action:', action);

      switch (action) {
        case 'musicUrl':
          console.log('[RequestHandler] 调用 this.handleMusicUrl');
          console.log('[RequestHandler] handleMusicUrl 参数 - source:', source);
          //console.log('[RequestHandler] handleMusicUrl 参数 - info:', JSON.stringify(info));
          console.log('[RequestHandler] 即将调用 handleMusicUrl...');
          result = await this.handleMusicUrl(source, info);
          console.log('[RequestHandler] handleMusicUrl 完成');
          console.log('[RequestHandler] handleMusicUrl 返回:', JSON.stringify(result, null, 2));
          break;

        case 'lyric':
          console.log('[RequestHandler] 调用 this.handleLyric');
          console.log('[RequestHandler] handleLyric 参数 - source:', source);
          console.log('[RequestHandler] handleLyric 参数 - info:', JSON.stringify(info, null, 2));
          console.log('[RequestHandler] 即将调用 handleLyric...');
          result = await this.handleLyric(source, info);
          console.log('[RequestHandler] handleLyric 完成');
          console.log('[RequestHandler] handleLyric 返回:', JSON.stringify(result, null, 2));
          break;

        case 'pic':
          console.log('[RequestHandler] 调用 this.handlePic');
          console.log('[RequestHandler] handlePic 参数 - source:', source);
          console.log('[RequestHandler] handlePic 参数 - info:', JSON.stringify(info, null, 2));
          console.log('[RequestHandler] 即将调用 handlePic...');
          result = await this.handlePic(source, info);
          console.log('[RequestHandler] handlePic 完成');
          console.log('[RequestHandler] handlePic 返回:', result);
          break;

        default:
          console.error('[RequestHandler] 不支持的 action:', action);
          console.log('[RequestHandler] 即将抛出错误: Unsupported action');
          throw new Error(`Unsupported action: ${action}`);
      }

      clearTimeout(this.timeouts.get(timeoutKey));
      this.timeouts.delete(timeoutKey);
      console.log('[RequestHandler] 清除超时定时器');

      const response = {
        status: true,
        data: {
          requestKey,
          result,
        },
      };
      console.log('[RequestHandler] 成功返回:', JSON.stringify(response, null, 2));
      console.log('========== [RequestHandler] handleRequest 结束 ==========\n');
      return response;
    } catch (error: any) {
      console.error('[RequestHandler] 捕获到异常:', error.message);
      console.error('[RequestHandler] 异常堆栈:', error.stack);
      
      if (this.timeouts.has(timeoutKey)) {
        clearTimeout(this.timeouts.get(timeoutKey));
        this.timeouts.delete(timeoutKey);
        console.log('[RequestHandler] 异常情况下清除超时定时器');
      }

      const response = {
        status: false,
        message: error.message,
      };
      console.log('[RequestHandler] 错误返回:', JSON.stringify(response, null, 2));
      console.log('========== [RequestHandler] handleRequest 结束 ==========\n');
      return response;
    }
  }

  private async handleMusicUrl(source: string, info: any): Promise<any> {
    //console.log('[RequestHandler] handleMusicUrl called with source:', source, 'info:', JSON.stringify(info, null, 2));
    console.log('[RequestHandler] handleMusicUrl 内部开始执行');
    
    const defaultSourceId = this.storage.getDefaultSource();
    console.log('[RequestHandler] defaultSourceId:', defaultSourceId);
    
    let targetSource: string | null = source || defaultSourceId || null;
    let sourceType = source;
    console.log('[RequestHandler] 初始 targetSource:', targetSource, 'sourceType:', sourceType);
    
    // 如果没有指定源，使用默认源
    if (!targetSource && defaultSourceId) {
      targetSource = defaultSourceId;
      sourceType = defaultSourceId;
      console.log('[RequestHandler] 使用默认源, targetSource:', targetSource, 'sourceType:', sourceType);
      
      // 获取默认源的详细信息
      const allScripts = this.storage.getLoadedScripts();
      console.log('[RequestHandler] 已加载脚本数量:', allScripts.length);
      const defaultScript = allScripts.find(script => script.id === defaultSourceId);
      
      if (defaultScript && defaultScript.supportedSources.length > 0) {
        // 使用默认源支持的第一个音源类型
        sourceType = defaultScript.supportedSources[0];
        console.log('[RequestHandler] 使用默认源支持的音源类型:', sourceType);
      }
    }
    
    if (!targetSource) {
          console.log('[RequestHandler] No available script for source4:');
          console.log('[RequestHandler] 即将抛出错误: No available script');
      throw new Error(`No available script for source5: ${source}`);
    }

    if (!(targetSource as string).startsWith('user_api_')) {
      const allScripts = this.storage.getLoadedScripts();
      const targetScript = allScripts.find(script => {
        return script.supportedSources.includes(targetSource as string);
      });
      
      if (!targetScript) {
        console.log('[RequestHandler] 即将抛出错误: No available script for source6');
        throw new Error(`No available script for source6: ${source}`);
      }
      
      targetSource = targetScript.id;
    } else {
      const allScripts = this.storage.getLoadedScripts();
      const targetScript = allScripts.find(script => 
        script.id === targetSource
      );
      
      if (!targetScript) {
        console.log('[RequestHandler] 即将抛出错误: No available script for source7');
        throw new Error(`No available script for source7: ${source}`);
      }
      
      sourceType = targetScript.supportedSources[0];
    }
    
    console.log('[RequestHandler] info.type:', info.type);
    console.log('[RequestHandler] info.musicInfo:', JSON.stringify(info.musicInfo, null, 2));
    
    const musicInfo = info.musicInfo || {
      id: '',
      name: '未知歌曲',
      singer: '未知歌手',
      source: sourceType,
      interval: null,
      songmid: '',
      meta: {
        songId: '',
        albumName: '',
        picUrl: null,
        hash: '',
      }
    };

    console.log('[RequestHandler] 即将调用 engine.getMusicUrl, sourceType:', sourceType);
    const response = await this.engine.getMusicUrl({
      source: sourceType,
      action: 'musicUrl',
      info: {
        type: info.type || 'music',
        musicInfo: musicInfo
      },
    });
    console.log('[RequestHandler] engine.getMusicUrl 返回:', JSON.stringify(response, null, 2));
    
    if (!response || !response.data) {
      console.log('[RequestHandler] 即将抛出错误: Failed to get music URL (response为空)');
      throw new Error(`Failed to get music URL: source=${sourceType}`);
    }

    const responseData = response.data as MusicUrlData;
    
    if (!responseData.url) {
      console.log('[RequestHandler] 即将抛出错误: Music URL is empty');
      throw new Error(`Music URL is empty: source=${sourceType}`);
    }
    
    return {
      type: info.type || 'music',
      url: responseData.url,
    };
  }

  private async handleLyric(source: string, info: any): Promise<any> {
    console.log('[RequestHandler] 即将调用 engine.getLyric');
    const response = await this.engine.getLyric({
      source,
      action: 'lyric',
      info,
    });
    console.log('[RequestHandler] engine.getLyric 返回:', JSON.stringify(response, null, 2));

    if (!response) {
      console.log('[RequestHandler] 即将抛出错误: Failed to get lyric (response为空)');
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
    console.log('[RequestHandler] 即将调用 engine.getPic');
    const response = await this.engine.getPic({
      source,
      action: 'pic',
      info,
    });
    console.log('[RequestHandler] engine.getPic 返回:', JSON.stringify(response, null, 2));

    if (!response || !response.data) {
      console.log('[RequestHandler] 即将抛出错误: Failed to get pic URL (response为空)');
      throw new Error('Failed to get pic URL');
    }

    const picData = response.data as { url: string };
    return picData.url;
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
