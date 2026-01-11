import { ScriptInfo, MusicUrlRequest } from "./script_engine.ts";
import { RequestManager } from "./request_manager.ts";

interface SourceInfo {
  type: string;
  actions: string[];
  qualitys: string[];
}

interface InitData {
  sources: Record<string, SourceInfo>;
  openDevTools?: boolean;
  message?: string;
}

interface UpdateAlertData {
  log: string;
  updateUrl?: string;
}

export class LXGlobal {
  private scriptInfo: ScriptInfo;
  private requestManager: RequestManager;
  private requestHandler: ((data: any) => Promise<any>) | null = null;
  private isInited: boolean = false;
  private isShowedUpdateAlert: boolean = false;
  private supportedActions: Set<string> = new Set(['musicUrl', 'lyric', 'pic']);
  private supportedSources: Set<string> = new Set(['kw', 'kg', 'tx', 'wy', 'mg', 'local', 'xm']);

  constructor(
    scriptInfo: ScriptInfo,
    requestManager: RequestManager,
    requestHandler: (data: any) => Promise<any>
  ) {
    this.scriptInfo = scriptInfo;
    this.requestManager = requestManager;
    this.requestHandler = requestHandler;
  }

  createGlobalObject(): any {
    const self = this;

    return {
      EVENT_NAMES: {
        request: 'request',
        inited: 'inited',
        updateAlert: 'updateAlert',
      },

      request: this.createRequestMethod(),

      send: this.createSendMethod(),

      on: this.createOnMethod(),

      utils: {
        crypto: this.createCryptoUtils(),
        buffer: this.createBufferUtils(),
        zlib: this.createZlibUtils(),
      },

      currentScriptInfo: {
        name: this.scriptInfo.name,
        description: this.scriptInfo.description,
        version: this.scriptInfo.version,
        author: this.scriptInfo.author,
        homepage: this.scriptInfo.homepage,
        rawScript: this.scriptInfo.rawScript,
      },

      version: '2.0.0',
      env: 'deno-deploy',

      removeEvent: () => {},
      removeAllEvents: () => {},
    };
  }

  private createRequestMethod(): any {
    return (url: string, options: any = {}, callback?: Function) => {
      const {
        method = 'get',
        timeout,
        headers,
        body,
        form,
        formData,
      } = options;

      const requestOptions = {
        url,
        method,
        headers: headers || {},
        timeout: Math.min(timeout || 60000, 60000),
        body,
        form,
        formData,
      };

      this.requestManager.addRequest(requestOptions, callback);

      return () => {
        this.requestManager.cancelRequest(url);
      };
    };
  }

  private createSendMethod(): any {
    return async (eventName: string, data?: any): Promise<any> => {
      switch (eventName) {
        case 'inited':
          if (this.isInited) {
            throw new Error('Script is inited');
          }
          this.isInited = true;
          return this.handleInit(data);

        case 'updateAlert':
          if (this.isShowedUpdateAlert) {
            throw new Error('The update alert can only be called once.');
          }
          this.isShowedUpdateAlert = true;
          return this.handleUpdateAlert(data);

        default:
          throw new Error(`Unknown event name: ${eventName}`);
      }
    };
  }

  private createOnMethod(): any {
    return async (eventName: string, handler: Function): Promise<void> => {
      if (!['request'].includes(eventName)) {
        throw new Error(`Event not supported: ${eventName}`);
      }

      if (eventName === 'request') {
        this.requestHandler = handler;
      }
    };
  }

  private createCryptoUtils(): any {
    return {
      aesEncrypt: (buffer: Uint8Array, mode: string, key: Uint8Array, iv: Uint8Array): Uint8Array => {
        try {
          const crypto = require('node:crypto');
          const cipher = crypto.createCipheriv(mode, key, iv);
          return Buffer.concat([cipher.update(buffer), cipher.final()]);
        } catch (error) {
          console.error('AES加密错误:', error);
          throw error;
        }
      },

      rsaEncrypt: (buffer: Uint8Array, key: string): Uint8Array => {
        try {
          const crypto = require('node:crypto');
          const paddedBuffer = Buffer.concat([
            Buffer.alloc(128 - buffer.length),
            buffer,
          ]);
          return crypto.publicEncrypt(
            { key, padding: crypto.constants.RSA_NO_PADDING },
            paddedBuffer
          );
        } catch (error) {
          console.error('RSA加密错误:', error);
          throw error;
        }
      },

      randomBytes: (size: number): Uint8Array => {
        const crypto = require('node:crypto');
        return crypto.randomBytes(size);
      },

      md5: (str: string): string => {
        const crypto = require('node:crypto');
        return crypto.createHash('md5').update(str).digest('hex');
      },
    };
  }

  private createBufferUtils(): any {
    return {
      from: (...args: any[]): Uint8Array => {
        return Buffer.from(...args);
      },

      bufToString: (buf: Uint8Array, format: string): string => {
        return Buffer.from(buf).toString(format);
      },
    };
  }

  private createZlibUtils(): any {
    return {
      inflate: async (buf: Uint8Array): Promise<Uint8Array> => {
        try {
          const zlib = require('node:zlib');
          return new Promise((resolve, reject) => {
            zlib.inflate(buf, (err: any, data: Buffer) => {
              if (err) reject(err);
              else resolve(new Uint8Array(data));
            });
          });
        } catch (error) {
          console.error('zlib inflate 错误:', error);
          throw error;
        }
      },

      deflate: async (data: string): Promise<Uint8Array> => {
        try {
          const zlib = require('node:zlib');
          return new Promise((resolve, reject) => {
            zlib.deflate(data, (err: any, buf: Buffer) => {
              if (err) reject(err);
              else resolve(new Uint8Array(buf));
            });
          });
        } catch (error) {
          console.error('zlib deflate 错误:', error);
          throw error;
        }
      },
    };
  }

  private async handleInit(data?: InitData): Promise<any> {
    if (!data || typeof data !== 'object') {
      return { status: false, message: 'Missing required parameter init info' };
    }

    const sourceInfo: Record<string, SourceInfo> = {};

    try {
      for (const source of this.supportedSources) {
        const userSource = data.sources?.[source];
        if (!userSource || userSource.type !== 'music') continue;

        const qualitys = this.getSupportedQualitys(source);
        const actions = this.supportedActions;

        sourceInfo[source] = {
          type: 'music',
          actions: Array.from(actions),
          qualitys,
        };
      }

      return {
        status: true,
        data: { sources: sourceInfo },
      };
    } catch (error: any) {
      return { status: false, message: error.message };
    }
  }

  private getSupportedQualitys(source: string): string[] {
    const qualityMap: Record<string, string[]> = {
      kw: ['128k', '320k', 'flac', 'flac24bit'],
      kg: ['128k', '320k', 'flac', 'flac24bit'],
      tx: ['128k', '320k', 'flac', 'flac24bit'],
      wy: ['128k', '320k', 'flac', 'flac24bit'],
      mg: ['128k', '320k', 'flac', 'flac24bit'],
      local: [],
      xm: ['128k', '320k', 'flac'],
    };

    return qualityMap[source] || [];
  }

  private async handleUpdateAlert(data?: UpdateAlertData): Promise<any> {
    if (!data || typeof data !== 'object') {
      throw new Error('parameter format error.');
    }

    if (!data.log || typeof data.log !== 'string') {
      throw new Error('log is required.');
    }

    const alertData = {
      name: this.scriptInfo.name,
      description: this.scriptInfo.description,
      log: data.log.substring(0, 1024),
      updateUrl: data.updateUrl,
    };

    console.log('📢 更新提醒:', alertData);

    return alertData;
  }

  async cleanup(): Promise<void> {
    this.requestHandler = null;
    this.isInited = false;
    this.isShowedUpdateAlert = false;
  }
}
