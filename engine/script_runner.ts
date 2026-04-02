import { ScriptInfo, MusicUrlRequest, MusicUrlResponse, MusicUrlData, LyricData, PicData } from "./script_engine.ts";
import { Buffer } from "node:buffer";
import pako from "npm:pako";
import { createCipheriv, publicEncrypt, constants, randomBytes, createHash } from "node:crypto";

const EVENT_NAMES = {
  request: 'request',
  inited: 'inited',
  updateAlert: 'updateAlert',
  response: 'response',
};

export class ScriptRunner {
  private scriptInfo: ScriptInfo;
  private isInitialized: boolean = false;
  private registeredSources: Map<string, any> = new Map();
  private requestHandler: any = null;
  private initError: string | null = null;

  constructor(scriptInfo: ScriptInfo) {
    this.scriptInfo = scriptInfo;
  }

  async initialize(): Promise<void> {
    try {
      console.error('[ScriptRunner] 开始初始化脚本:', this.scriptInfo.name);

      const events: { request: ((data: any) => any) | null } = { request: null };
      let isInitedApi = false;

      const request = (url: string, options: any, callback: any) => {
        console.error('[ScriptRunner] request called:', url);
        console.error('[ScriptRunner] request options:', JSON.stringify(options, null, 2));
        
        const method = (options?.method || 'get').toLowerCase();
        const timeout = typeof options?.response_timeout == 'number' && options.response_timeout > 0 
          ? Math.min(options.response_timeout, 60_000) 
          : 60_000;
        const followMax = options?.follow_max ?? 5;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); }, timeout);

        let headers: any = { ...options?.headers };
        if (method === 'get' && headers['Content-Type']) {
          delete headers['Content-Type'];
        }

        const doFetch = async (currentUrl: string, redirectCount: number): Promise<Response> => {
          const fetchOptions: any = {
            method,
            headers,
            signal: controller.signal,
            redirect: 'manual',
          };

          if (options?.body) {
            fetchOptions.body = options.body;
          } else if (options?.form) {
            const formDataObj = new URLSearchParams();
            for (const key in options.form) {
              formDataObj.append(key, options.form[key]);
            }
            fetchOptions.body = formDataObj.toString();
            fetchOptions.headers = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
          } else if (options?.formData) {
            const formDataObj = new FormData();
            for (const key in options.formData) {
              formDataObj.append(key, options.formData[key]);
            }
            fetchOptions.body = formDataObj;
          }

          const response = await fetch(currentUrl, fetchOptions);

          if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
            if (redirectCount >= followMax) {
              throw new Error(`Maximum redirect count (${followMax}) exceeded`);
            }
            const newUrl = response.headers.get('location')!;
            const resolvedUrl = newUrl.startsWith('http') ? newUrl : new URL(newUrl, currentUrl).href;
            return doFetch(resolvedUrl, redirectCount + 1);
          }

          return response;
        };

        doFetch(url, 0)
          .then(async (response) => {
            clearTimeout(timeoutId);
            const responseBody = await response.arrayBuffer();
            const rawUint8Array = new Uint8Array(responseBody);
            const rawString = new TextDecoder().decode(responseBody);
            let body: any = rawString;
            try { body = JSON.parse(rawString); } catch (e) {}

            const headersObj: any = {};
            if (typeof response.headers.forEach === 'function') {
              response.headers.forEach((value: string, key: string) => {
                headersObj[key] = value;
              });
            } else {
              Object.assign(headersObj, response.headers || {});
            }

            const respObj = {
              statusCode: response.status,
              statusMessage: response.statusText,
              headers: headersObj,
              bytes: responseBody.byteLength,
              raw: rawUint8Array,
              body,
            };

            console.error('[ScriptRunner] API Response:', {
              url,
              statusCode: response.status,
              bodyLength: rawString.length,
              bodyPreview: rawString.substring(0, 500)
            });

            if (callback) {
              try {
                callback(null, respObj, body);
              } catch (cbError: any) {
                console.error('[ScriptRunner] Callback error:', cbError.message);
              }
            }
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            console.error('[ScriptRunner] API Error:', url, error.message);
            if (callback) {
              try {
                callback(error, null, null);
              } catch (cbError: any) {
                console.error('[ScriptRunner] Callback error in catch:', cbError.message);
              }
            }
          });

        return () => {
          controller.abort();
        };
      };

      const send = (eventName: string, data: any): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (eventName === EVENT_NAMES.inited) {
            if (isInitedApi) {
              return resolve();
            }
            isInitedApi = true;

            if (!data) {
              this.initError = 'Missing required parameter init info';
              return reject(new Error(this.initError));
            }

            const registeredSourceList = Object.keys(data.sources || {});
            for (const source of registeredSourceList) {
              this.registeredSources.set(source, data.sources[source]);
            }

            this.isInitialized = true;
            console.error('[ScriptRunner] 初始化成功，注册的音源:', registeredSourceList);
            resolve();
          } else if (eventName === EVENT_NAMES.updateAlert) {
            console.error('[ScriptRunner] 更新提示:', data);
            resolve();
          } else if (eventName === EVENT_NAMES.response) {
            resolve();
          } else {
            reject(new Error('Unknown event name: ' + eventName));
          }
        });
      };

      const on = (eventName: string, handler: any): Promise<void> => {
        if (eventName === EVENT_NAMES.request) {
          events.request = handler;
          return Promise.resolve();
        }
        return Promise.reject(new Error('The event is not supported: ' + eventName));
      };

      const utils = {
        crypto: {
          aesEncrypt: (buffer: any, mode: string, key: any, iv: any) => {
            const cipher = createCipheriv(mode, key, iv);
            return Buffer.concat([cipher.update(buffer), cipher.final()]);
          },
          rsaEncrypt: (buffer: any, key: string) => {
            const cleanKey = key
              .replace('-----BEGIN PUBLIC KEY-----', '')
              .replace('-----END PUBLIC KEY-----', '');
            const paddedBuffer = Buffer.concat([Buffer.alloc(128 - buffer.length), buffer]);
            return publicEncrypt({ key: cleanKey, padding: constants.RSA_NO_PADDING }, paddedBuffer);
          },
          randomBytes: (size: number) => {
            return randomBytes(size);
          },
          md5: (str: string) => {
            if (typeof str !== 'string') throw new Error('param required a string');
            return createHash('md5').update(str).digest('hex');
          },
        },
        buffer: {
          from: (input: any, encoding?: string): Uint8Array => {
            if (typeof input === 'string') {
              switch (encoding) {
                case 'binary':
                  throw new Error('Binary encoding is not supported for input strings');
                case 'base64':
                  return Buffer.from(input, 'base64');
                case 'hex':
                  return Buffer.from(input, 'hex');
                default:
                  return Buffer.from(input, 'utf8');
              }
            } else if (Array.isArray(input) || ArrayBuffer.isView(input)) {
              return new Uint8Array(input);
            }
            throw new Error('Unsupported input type: ' + typeof input);
          },
          bufToString: (buf: any, format: string): string | Uint8Array => {
            if (!Array.isArray(buf) && !ArrayBuffer.isView(buf)) {
              throw new Error('Input is not a valid buffer');
            }
            const uint8Buf = new Uint8Array(buf as ArrayLike<number>);
            switch (format) {
              case 'binary':
                return uint8Buf;
              case 'hex':
                return Buffer.from(uint8Buf).toString('hex');
              case 'base64':
                return Buffer.from(uint8Buf).toString('base64');
              case 'utf8':
              case 'utf-8':
              default:
                return Buffer.from(uint8Buf).toString('utf8');
            }
          },
        },
        zlib: {
          inflate: (buf: any) => {
            return new Promise((resolve, reject) => {
              try {
                resolve(pako.inflate(buf));
              } catch (err: any) {
                reject(new Error(err.message));
              }
            });
          },
          deflate: (data: any) => {
            return new Promise((resolve, reject) => {
              try {
                resolve(pako.deflate(data));
              } catch (err: any) {
                reject(new Error(err.message));
              }
            });
          },
        },
      };

      const lx: any = {
        EVENT_NAMES,
        request,
        send,
        on,
        utils,
        currentScriptInfo: {
          name: this.scriptInfo.name,
          description: this.scriptInfo.description,
          version: this.scriptInfo.version,
          author: this.scriptInfo.author,
          homepage: this.scriptInfo.homepage,
          rawScript: this.scriptInfo.rawScript,
        },
        version: '2.0.0',
        env: 'desktop',
        proxy: { host: '', port: '' },
        getConsole: () => ({
          log: (...args: any[]) => console.log('[Console]', ...args),
          error: (...args: any[]) => console.error('[Console]', ...args),
          warn: (...args: any[]) => console.warn('[Console]', ...args),
          info: (...args: any[]) => console.info('[Console]', ...args),
        }),
        createMainWindow: () => {},
        getSystemFonts: async () => [],
      };

      (globalThis as any).lx = lx;

      const require = (moduleName: string): any => {
        if (moduleName === 'crypto') {
          return {
            createCipheriv,
            createDecipheriv: createCipheriv,
            randomBytes,
            createHash,
            publicEncrypt,
            constants,
          };
        }
        if (moduleName === 'buffer') {
          return { Buffer };
        }
        if (moduleName === 'zlib') {
          return {
            inflate: (buf: any) => pako.inflate(buf),
            deflate: (data: any) => pako.deflate(data),
          };
        }
        return undefined;
      };
      (globalThis as any).require = require;

      console.error('[ScriptRunner] 开始执行脚本...');
      console.error('[ScriptRunner] rawScript length:', this.scriptInfo.rawScript?.length || 0);
      console.error('[ScriptRunner] rawScript preview:', this.scriptInfo.rawScript?.substring(0, 200));
      
      const scriptFn = new Function(
        'window', 'self', 'globalThis', 'lx', 'events',
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        'atob', 'btoa', 'Buffer', 'pako', 'fetch',
        this.scriptInfo.rawScript
      );

      try {
        scriptFn(
          globalThis, globalThis, globalThis, lx, events,
          globalThis.setTimeout, globalThis.clearTimeout,
          globalThis.setInterval, globalThis.clearInterval,
          globalThis.atob, globalThis.btoa, Buffer, pako, fetch
        );
        console.error('[ScriptRunner] 脚本执行完成');
      } catch (error: any) {
        console.error('[ScriptRunner] 脚本执行失败:', error.message);
      }

      if (!isInitedApi) {
        console.error('[ScriptRunner] 等待脚本主动初始化 (最多 10 秒)...');
        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => {
            clearInterval(checkInterval);
            console.error('[ScriptRunner] 等待超时，主动完成初始化...');
            const defaultSources = {
              kw: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              kg: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              tx: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              wy: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              mg: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
            };
            try {
              send('inited', { sources: defaultSources });
              console.error('[ScriptRunner] 主动初始化成功');
            } catch (err: any) {
              console.error('[ScriptRunner] 主动初始化失败:', err.message);
            }
            resolve();
          }, 10000);

          const checkInterval = setInterval(() => {
            if (isInitedApi) {
              clearTimeout(timeoutId);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }

      if (!isInitedApi) {
        throw new Error('Initialization failed');
      }

      // 等待 request handler 被设置（最多 5 秒）
      if (!events.request) {
        console.error('[ScriptRunner] 等待 request handler 注册...');
        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => {
            clearInterval(checkInterval);
            console.error('[ScriptRunner] 等待 request handler 超时');
            resolve();
          }, 5000);

          const checkInterval = setInterval(() => {
            if (events.request) {
              clearTimeout(timeoutId);
              clearInterval(checkInterval);
              console.error('[ScriptRunner] Request handler 已注册');
              resolve();
            }
          }, 100);
        });
      }

      if (events.request) {
        this.requestHandler = events.request;
        console.error('[ScriptRunner] 初始化完成，注册的音源:', Array.from(this.registeredSources.keys()));
      } else {
        console.error('[ScriptRunner] Request handler not set');
        throw new Error('Request handler not set');
      }

    } catch (error: any) {
      console.error('[ScriptRunner] 初始化失败:', error.message);
      this.isInitialized = false;
      this.initError = error.message;
      throw error;
    }
  }

  async request(request: MusicUrlRequest): Promise<MusicUrlResponse> {
    console.error('[ScriptRunner] request called, source:', request.source, 'action:', request.action);

    if (!this.isInitialized) {
      throw new Error('Script not initialized');
    }

    if (!this.requestHandler) {
      throw new Error('Request handler not set');
    }

    const toOldMusicInfo = (info: any): any => {
      const musicInfo = info.musicInfo;
      const oInfo: Record<string, any> = {
        name: musicInfo.name,
        singer: musicInfo.singer,
        source: request.source,
        songmid: musicInfo.songmid || musicInfo.id || musicInfo.meta?.songId,
        interval: musicInfo.interval,
        albumName: musicInfo.meta?.albumName || '',
        img: musicInfo.meta?.picUrl || '',
        typeUrl: {},
        albumId: musicInfo.meta?.albumId || '',
        types: musicInfo.meta?.qualitys || [],
        _types: {},
      };

      if (musicInfo.meta) {
        if (musicInfo.meta.hash) oInfo.hash = musicInfo.meta.hash;
        if (musicInfo.meta.strMediaMid) oInfo.strMediaMid = musicInfo.meta.strMediaMid;
        if (musicInfo.meta.albumMid) oInfo.albumMid = musicInfo.meta.albumMid;
        if (musicInfo.meta.songId) oInfo.songId = musicInfo.meta.songId;
        if (musicInfo.meta.copyrightId) oInfo.copyrightId = musicInfo.meta.copyrightId;
        if (musicInfo.meta.lrcUrl) oInfo.lrcUrl = musicInfo.meta.lrcUrl;
        if (musicInfo.meta.mrcUrl) oInfo.mrcUrl = musicInfo.meta.mrcUrl;
        if (musicInfo.meta.trcUrl) oInfo.trcUrl = musicInfo.meta.trcUrl;
      }

      if (musicInfo.hash) oInfo.hash = musicInfo.hash;
      if (musicInfo.copyrightId) oInfo.copyrightId = musicInfo.copyrightId;
      if (musicInfo.strMediaMid) oInfo.strMediaMid = musicInfo.strMediaMid;

      return oInfo;
    };

    const response = await this.requestHandler({
      source: request.source,
      action: request.action,
      info: {
        type: request.info.type,
        musicInfo: toOldMusicInfo(request.info),
      },
    });

    let resultData: MusicUrlData | LyricData | PicData;

    switch (request.action) {
      case 'musicUrl':
        if (typeof response !== 'string') {
          throw new Error('Invalid musicUrl response: response is not a string');
        }
        if (response.length > 2048) {
          throw new Error('Invalid musicUrl response: response too long');
        }
        if (!/^https?:/.test(response)) {
          throw new Error('Invalid musicUrl response: not a valid http(s) url');
        }
        resultData = {
          type: request.info?.type || 'music',
          url: response,
        };
        break;

      case 'lyric':
        if (typeof response !== 'object' || response === null) {
          throw new Error('Invalid lyric response: response is not an object');
        }
        if (typeof response.lyric !== 'string') {
          throw new Error('Invalid lyric response: lyric is not a string');
        }
        resultData = {
          type: 'lyric',
          lyric: response.lyric,
          tlyric: (typeof response.tlyric === 'string' && response.tlyric.length < 5120) ? response.tlyric : null,
          rlyric: (typeof response.rlyric === 'string' && response.rlyric.length < 5120) ? response.rlyric : null,
          lxlyric: (typeof response.lxlyric === 'string' && response.lxlyric.length < 8192) ? response.lxlyric : null,
        };
        break;

      case 'pic':
        if (typeof response !== 'string') {
          throw new Error('Invalid pic response: response is not a string');
        }
        if (response.length > 2048) {
          throw new Error('Invalid pic response: response too long');
        }
        if (!/^https?:/.test(response)) {
          throw new Error('Invalid pic response: not a valid http(s) url');
        }
        resultData = {
          type: 'pic',
          url: response,
        };
        break;

      default:
        throw new Error(`Unsupported action: ${request.action}`);
    }

    return {
      source: request.source,
      action: request.action,
      data: resultData,
    };
  }

  getRegisteredSources(): Map<string, any> {
    return this.registeredSources;
  }

  getRegisteredSourceList(): string[] {
    return Array.from(this.registeredSources.keys());
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  supportsSource(source: string): boolean {
    return this.registeredSources.has(source);
  }

  async terminate(): Promise<void> {
    console.error('[ScriptRunner] 终止脚本:', this.scriptInfo.name);
    this.registeredSources.clear();
    this.requestHandler = null;
    this.isInitialized = false;
    this.initError = 'ScriptRunner terminated';
  }
}
