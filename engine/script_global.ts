import { ScriptInfo, MusicUrlRequest, MusicUrlResponse } from "./script_engine.ts";
import { RequestManager } from "./request_manager.ts";
import { Buffer } from "npm:buffer";
import CryptoJS from "npm:crypto-js";
import pako from "npm:pako";
import forge from "npm:node-forge";

export const EVENT_NAMES = {
  request: 'request',
  inited: 'inited',
  updateAlert: 'updateAlert',
};

const eventNames = Object.values(EVENT_NAMES);

const allSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'local'];

const supportQualitys: Record<string, string[]> = {
  kw: ['128k', '320k', 'flac', 'flac24bit'],
  kg: ['128k', '320k', 'flac', 'flac24bit'],
  tx: ['128k', '320k', 'flac', 'flac24bit'],
  wy: ['128k', '320k', 'flac', 'flac24bit'],
  mg: ['128k', '320k', 'flac', 'flac24bit'],
  local: [],
};

const supportActions: Record<string, string[]> = {
  kw: ['musicUrl'],
  kg: ['musicUrl'],
  tx: ['musicUrl'],
  wy: ['musicUrl'],
  mg: ['musicUrl'],
  xm: ['musicUrl'],
  local: ['musicUrl', 'lyric', 'pic'],
};

interface ScriptEvents {
  request: ((data: { source: string; action: string; info: any }) => Promise<any>) | null;
}

export class ScriptGlobal {
  private scriptInfo: ScriptInfo;
  private requestManager: RequestManager;
  private events: ScriptEvents = { request: null };
  private context: any;
  private requestHandler: ((data: MusicUrlRequest) => Promise<MusicUrlResponse | null>) | null = null;
  private registeredSources: Map<string, { actions: string[]; qualitys: string[] }> = new Map();
  private isInited: boolean = false;
  private isShowedUpdateAlert: boolean = false;

  constructor(scriptInfo: ScriptInfo, requestManager: RequestManager) {
    this.scriptInfo = scriptInfo;
    this.requestManager = requestManager;
  }

  setRequestHandler(handler: (data: MusicUrlRequest) => Promise<MusicUrlResponse | null>): void {
    this.requestHandler = handler;
  }

  getRegisteredSourceList(): string[] {
    return Array.from(this.registeredSources.keys());
  }

  createGlobalObject(): any {
    const self = this;

    return {
      EVENT_NAMES: { ...EVENT_NAMES },

      request(url: string, options: any = {}, callback?: (err: any, resp: any, body: any) => void): (() => void) | undefined {
        const { method = 'get', timeout, headers, body, form, formData } = options;

        let data: any;
        if (body) {
          data = body;
        } else if (form) {
          data = form;
        } else if (formData) {
          data = formData;
        }

        const responseTimeout = typeof timeout === 'number' && timeout > 0 ? Math.min(timeout, 60000) : 60000;

        const controller = new AbortController();
        const { signal } = controller;

        const timeoutId = setTimeout(() => {
          controller.abort();
        }, responseTimeout);

        (async () => {
          try {
            const response = await fetch(url, {
              method,
              headers,
              body: data,
              signal,
            });

            clearTimeout(timeoutId);

            const responseBody = await response.arrayBuffer();
            const bytes = responseBody.byteLength;
            const rawUint8Array = new Uint8Array(responseBody);
            const rawString = new TextDecoder().decode(responseBody);

            let bodyData: any = rawString;
            try {
              bodyData = JSON.parse(rawString);
            } catch (_) {
              bodyData = rawString;
            }

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
              bytes,
              raw: rawUint8Array,
              body: bodyData,
            };

            if (callback) {
              try {
                callback.call(self, null, respObj, bodyData);
              } catch (err: any) {
                console.log('[PHG] request callback error:', err.message);
              }
            }
          } catch (error: any) {
            clearTimeout(timeoutId);
            if (callback) {
              try {
                callback.call(self, error, null, null);
              } catch (err: any) {
                console.log('[PHG] request callback error:', err.message);
              }
            }
          }
        })();

        return () => {
          controller.abort();
        };
      },

      send(eventName: string, data: any): Promise<void> {
        return new Promise((resolve, reject) => {
          if (!eventNames.includes(eventName)) {
            return reject(new Error('The event is not supported: ' + eventName));
          }
          switch (eventName) {
            case EVENT_NAMES.inited:
              if (self.isInited) {
                return reject(new Error('Script is inited'));
              }
              self.isInited = true;
              self.handleInit(self, data);
              resolve();
              break;

            case EVENT_NAMES.updateAlert:
              if (self.isShowedUpdateAlert) {
                return reject(new Error('The update alert can only be called once.'));
              }
              self.isShowedUpdateAlert = true;
              self.handleUpdateAlert(data, resolve, reject);
              break;

            default:
              reject(new Error('Unknown event name: ' + eventName));
          }
        });
      },

      on(eventName: string, handler: any): Promise<void> {
        if (!eventNames.includes(eventName)) {
          return Promise.reject(new Error('The event is not supported: ' + eventName));
        }
        switch (eventName) {
          case EVENT_NAMES.request:
            self.events.request = handler;
            break;
          default:
            return Promise.reject(new Error('The event is not supported: ' + eventName));
        }
        return Promise.resolve();
      },

      utils: {
        crypto: {
          aesEncrypt(buffer: any, mode: string, key: any, iv: any): any {
            return self.aesEncryptSync(buffer, mode, key, iv);
          },
          rsaEncrypt(buffer: any, key: string): any {
            return self.rsaEncryptSync(buffer, key);
          },
          randomBytes(size: number): Uint8Array {
            const bytes = new Uint8Array(size);
            crypto.getRandomValues(bytes);
            return bytes;
          },
          md5(str: string): string {
            return self.md5Sync(str);
          },
        },
        buffer: {
          from(...args: any[]): Uint8Array {
            return self.bufferFrom(...args);
          },
          bufToString(buf: any, format: string): string {
            return self.bufferBufToString(buf, format);
          },
        },
        zlib: {
          inflate(buf: any): Promise<any> {
            return self.inflateSync(buf);
          },
          deflate(data: any): Promise<any> {
            return self.deflateSync(data);
          },
        },
      },

      currentScriptInfo: {
        name: self.scriptInfo.name,
        description: self.scriptInfo.description,
        version: self.scriptInfo.version,
        author: self.scriptInfo.author,
        homepage: self.scriptInfo.homepage,
        rawScript: self.scriptInfo.rawScript,
      },

      version: '2.0.0',
      env: 'desktop',
    };
  }

  private handleInit(context: any, info: any): void {
    if (!info) {
      console.log('[PHG] Missing required parameter init info');
      return;
    }

    if (info.openDevTools === true) {
      console.log('[PHG] openDevTools requested (not implemented in server environment)');
    }

    this.registeredSources.clear();

    const sourceInfo: any = {
      sources: {},
    };

    try {
      for (const source of allSources) {
        const userSource = info.sources[source];
        if (!userSource || userSource.type !== 'music') continue;

        const qualitys = supportQualitys[source];
        const actions = supportActions[source];

        sourceInfo.sources[source] = {
          type: 'music',
          actions: actions.filter((a: string) => userSource.actions.includes(a)),
          qualitys: qualitys.filter((q: string) => userSource.qualitys.includes(q)),
        };

        if (sourceInfo.sources[source].actions.length > 0 && sourceInfo.sources[source].qualitys.length > 0) {
          this.registeredSources.set(source, {
            qualitys: sourceInfo.sources[source].qualitys,
            actions: sourceInfo.sources[source].actions,
          });
        }
      }
    } catch (error: any) {
      console.log('[PHG] handleInit error:', error);
      return;
    }

    console.log('[PHG] Script initialized:', sourceInfo);
  }

  private handleUpdateAlert(data: any, resolve: (value: void) => void, reject: (reason?: any) => void): void {
    if (!data || typeof data !== 'object') {
      return reject(new Error('parameter format error.'));
    }
    if (!data.log || typeof data.log !== 'string') {
      return reject(new Error('log is required.'));
    }
    if (data.updateUrl && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(data.updateUrl) && data.updateUrl.length > 1024) {
      delete data.updateUrl;
    }
    if (data.log.length > 1024) {
      data.log = data.log.substring(0, 1024) + '...';
    }

    console.log('[PHG] Update Alert:', {
      log: data.log,
      updateUrl: data.updateUrl,
    });

    resolve();
  }

  async handleRequest(data: { source: string; action: string; info: any }): Promise<any> {
    if (!this.events.request) {
      throw new Error('Request event is not defined');
    }

    try {
      const response = await this.events.request.call(this.context, {
        source: data.source,
        action: data.action,
        info: data.info,
      });

      switch (data.action) {
        case 'musicUrl':
          if (typeof response !== 'string' || response.length > 2048 || !/^https?:/.test(response)) {
            console.error('[PHG] musicUrl validation failed:', {
              responseType: typeof response,
              responseLength: typeof response === 'string' ? response.length : 'N/A',
              isValidUrl: typeof response === 'string' && /^https?:/.test(response),
              responsePreview: typeof response === 'string' ? response.substring(0, 200) : response
            });
            throw new Error('Invalid music URL response');
          }
          return {
            source: data.source,
            action: data.action,
            data: {
              type: data.info.type,
              url: response,
            },
          };

        case 'lyric':
          return {
            source: data.source,
            action: data.action,
            data: this.verifyLyricInfo(response),
          };

        case 'pic':
          if (typeof response !== 'string' || response.length > 2048 || !/^https?:/.test(response)) {
            console.error('[PHG] pic validation failed:', {
              responseType: typeof response,
              responseLength: typeof response === 'string' ? response.length : 'N/A',
              isValidUrl: typeof response === 'string' && /^https?:/.test(response),
              responsePreview: typeof response === 'string' ? response.substring(0, 200) : response
            });
            throw new Error('Invalid pic URL response');
          }
          return {
            source: data.source,
            action: data.action,
            data: response,
          };

        default:
          throw new Error(`Unknown action: ${data.action}`);
      }
    } catch (error: any) {
      console.error('[PHG] handleRequest error:', error);
      throw error;
    }
  }

  private verifyLyricInfo(info: any): any {
    if (typeof info !== 'object' || typeof info.lyric !== 'string') {
      console.error('[PHG] lyric validation failed:', {
        infoType: typeof info,
        isObject: typeof info === 'object' && info !== null,
        lyricType: typeof info?.lyric,
        hasLyric: 'lyric' in info,
        infoKeys: typeof info === 'object' ? Object.keys(info) : 'N/A'
      });
      throw new Error('Invalid lyric data format');
    }
    if (info.lyric.length > 51200) {
      console.error('[PHG] lyric too long:', info.lyric.length);
      throw new Error('Lyric data exceeds maximum length');
    }
    return {
      lyric: info.lyric,
      tlyric: (typeof info.tlyric === 'string' && info.tlyric.length < 5120) ? info.tlyric : null,
      rlyric: (typeof info.rlyric === 'string' && info.rlyric.length < 5120) ? info.rlyric : null,
      lxlyric: (typeof info.lxlyric === 'string' && info.lxlyric.length < 8192) ? info.lxlyric : null,
    };
  }

  private async aesEncrypt(buffer: ArrayBuffer, mode: string, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      const keyWord = CryptoJS.lib.WordArray.create(new Uint8Array(key));
      const ivWord = CryptoJS.lib.WordArray.create(new Uint8Array(iv));
      const bufferWord = CryptoJS.lib.WordArray.create(new Uint8Array(buffer));
      
      const encrypted = CryptoJS.AES.encrypt(bufferWord, keyWord, {
        iv: ivWord,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      
      return encrypted.ciphertext;
    } catch (error: any) {
      console.log('[PHG] aesEncrypt error:', error.message);
      throw new Error(error.message);
    }
  }

  private async rsaEncrypt(buffer: ArrayBuffer, key: string): Promise<ArrayBuffer> {
    try {
      const bufferArray = new Uint8Array(buffer);
      const paddedBuffer = new Uint8Array(128);
      paddedBuffer.set(bufferArray, 128 - bufferArray.length);
      
      const publicKey = forge.pki.publicKeyFromPem(key);
      const encrypted = publicKey.encrypt(paddedBuffer, 'NONE');
      
      const result = new Uint8Array(encrypted.length);
      for (let i = 0; i < encrypted.length; i++) {
        result[i] = encrypted.charCodeAt(i);
      }
      
      return result.buffer;
    } catch (error: any) {
      console.log('[PHG] rsaEncrypt error:', error.message);
      throw new Error(error.message);
    }
  }

  private async md5(str: string): Promise<string> {
    try {
      return CryptoJS.MD5(str).toString(CryptoJS.enc.Hex);
    } catch (error: any) {
      console.log('[PHG] md5 error:', error.message);
      throw new Error(error.message);
    }
  }

  private async inflate(buf: Uint8Array): Promise<Uint8Array> {
    try {
      const bufferArray = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
      const inflated = pako.inflate(bufferArray);
      return inflated;
    } catch (error: any) {
      console.log('[PHG] inflate error:', error.message);
      throw new Error(error.message);
    }
  }

  private async deflate(buf: Uint8Array): Promise<Uint8Array> {
    try {
      const dataArray = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
      const deflated = pako.deflate(dataArray);
      return deflated;
    } catch (error: any) {
      console.log('[PHG] deflate error:', error.message);
      throw new Error(error.message);
    }
  }

  private aesEncryptSync(buffer: any, mode: string, key: any, iv: any): any {
    try {
      const bufferArray = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
      const keyArray = key instanceof ArrayBuffer ? new Uint8Array(key) : new Uint8Array(key);
      const ivArray = iv instanceof ArrayBuffer ? new Uint8Array(iv) : new Uint8Array(iv);

      const keyWord = CryptoJS.lib.WordArray.create(keyArray);
      const ivWord = CryptoJS.lib.WordArray.create(ivArray);
      const bufferWord = CryptoJS.lib.WordArray.create(bufferArray);

      const encrypted = CryptoJS.AES.encrypt(bufferWord, keyWord, {
        iv: ivWord,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      
      const result = new Uint8Array(encrypted.ciphertext.words.length * 4);
      for (let i = 0; i < encrypted.ciphertext.words.length; i++) {
        const word = encrypted.ciphertext.words[i];
        result[i * 4] = (word >>> 24) & 0xff;
        result[i * 4 + 1] = (word >>> 16) & 0xff;
        result[i * 4 + 2] = (word >>> 8) & 0xff;
        result[i * 4 + 3] = word & 0xff;
      }
      
      return result;
    } catch (error: any) {
      console.log('[PHG] aesEncryptSync error:', error.message);
      throw new Error(error.message);
    }
  }

  private rsaEncryptSync(buffer: any, key: string): any {
    try {
      const bufferArray = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
      const paddedBuffer = new Uint8Array(128);
      paddedBuffer.set(bufferArray, 128 - bufferArray.length);
      
      const publicKey = forge.pki.publicKeyFromPem(key);
      const encrypted = publicKey.encrypt(paddedBuffer, 'NONE');
      
      const result = new Uint8Array(encrypted.length);
      for (let i = 0; i < encrypted.length; i++) {
        result[i] = encrypted.charCodeAt(i);
      }
      
      return result;
    } catch (error: any) {
      console.log('[PHG] rsaEncryptSync error:', error.message);
      throw new Error(error.message);
    }
  }

  private md5Sync(str: string): string {
    try {
      return CryptoJS.MD5(str).toString(CryptoJS.enc.Hex);
    } catch (error: any) {
      console.log('[PHG] md5Sync error:', error.message);
      throw new Error(error.message);
    }
  }

  private bufferFrom(...args: any[]): Uint8Array {
    try {
      if (args.length === 1) {
        if (typeof args[0] === 'string') {
          return new TextEncoder().encode(args[0]);
        }
        if (args[0] instanceof ArrayBuffer) {
          return new Uint8Array(args[0]);
        }
        if (Array.isArray(args[0])) {
          return new Uint8Array(args[0]);
        }
        if (args[0] instanceof Uint8Array) {
          return args[0];
        }
        return new Uint8Array(args[0]);
      }
      if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
        if (args[1] === 'hex') {
          const hex = args[0].replace(/\s/g, '');
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
          }
          return bytes;
        }
        if (args[1] === 'base64') {
          const binaryString = atob(args[0]);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        }
        return new TextEncoder().encode(args[0]);
      }
      return new Uint8Array(args[0]);
    } catch {
      return new Uint8Array(0);
    }
  }

  private bufferBufToString(buf: any, format: string): string {
    try {
      const bufferArray = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
      if (format === 'hex') {
        return Array.from(bufferArray).map((b: any) => (b as number).toString(16).padStart(2, '0')).join('');
      }
      if (format === 'base64') {
        const binaryString = Array.from(bufferArray).map((b: any) => String.fromCharCode(b as number)).join('');
        return btoa(binaryString);
      }
      if (format === 'binary') {
        return new TextDecoder('latin1').decode(bufferArray);
      }
      if (format === 'utf8' || format === 'utf-8') {
        return new TextDecoder('utf-8').decode(bufferArray);
      }
      if (format === 'ascii') {
        return new TextDecoder('ascii').decode(bufferArray);
      }
      return new TextDecoder('utf-8').decode(bufferArray);
    } catch {
      return '';
    }
  }

  private inflateSync(buf: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const bufferArray = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
        const inflated = pako.inflate(bufferArray);
        resolve(inflated);
      } catch (err: any) {
        reject(new Error(err.message));
      }
    });
  }

  private deflateSync(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        const deflated = pako.deflate(dataArray);
        resolve(deflated);
      } catch (err: any) {
        reject(new Error(err.message));
      }
    });
  }
}


