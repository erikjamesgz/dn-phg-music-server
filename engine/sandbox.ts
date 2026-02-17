import { ScriptInfo, MusicUrlRequest, MusicUrlResponse, MusicUrlData, LyricData, PicData } from "./script_engine.ts";
import { RequestManager } from "./request_manager.ts";
import pako from "npm:pako";
import { Buffer } from "npm:buffer";

const USER_API_RENDERER_EVENT_NAME = {
  initEnv: 'userApi_initEnv',
  init: 'userApi_init',
  request: 'userApi_request',
  response: 'userApi_response',
  openDevTools: 'userApi_openDevTools',
  showUpdateAlert: 'userApi_showUpdateAlert',
  getProxy: 'userApi_getProxy',
  proxyUpdate: 'userApi_proxyUpdate',
};

const proxy = {
  host: '',
  port: '',
};

export class Sandbox {
  private scriptInfo: ScriptInfo;
  private requestManager: RequestManager;
  private isInitialized: boolean = false;
  private registeredSources: Map<string, any> = new Map();
  private requestHandler: any = null;
  private initError: string | null = null;
  private initResult: any = null;
  private requestCallbacks: Map<string, { resolve: any; reject: any }> = new Map();

  constructor(scriptInfo: ScriptInfo, requestManager: RequestManager) {
    this.scriptInfo = scriptInfo;
    this.requestManager = requestManager;
  }

  private sendMessage(action: string, data: any, status: boolean, message?: string): void {
      console.log('[Sandbox sendMessage] called with action:', action, 'status:', status, 'message:', message);
      
      switch (action) {
        case USER_API_RENDERER_EVENT_NAME.init:
          if (status) {
            console.log('[Sandbox] Init successful, data:', JSON.stringify(data));
            this.initResult = data;
            this.isInitialized = true;
          } else {
            console.error('[Sandbox] Init failed, message:', message);
            this.initError = message || 'Initialization failed';
          }
          break;
        case USER_API_RENDERER_EVENT_NAME.response:
          const requestKey = data?.requestKey;
          if (requestKey && this.requestCallbacks.has(requestKey)) {
            const callback = this.requestCallbacks.get(requestKey);
            if (status) {
              callback?.resolve(data);
            } else {
              const errorMsg = message || 'Request failed';
              console.error('[Sandbox sendMessage] Response error:', errorMsg);
              callback?.reject(new Error(errorMsg));
            }
            this.requestCallbacks.delete(requestKey);
          } else {
            console.warn('[Sandbox sendMessage] No callback found for requestKey:', requestKey);
          }
          break;
        case USER_API_RENDERER_EVENT_NAME.openDevTools:
          console.log('[Sandbox] Open DevTools requested');
          break;
        case USER_API_RENDERER_EVENT_NAME.showUpdateAlert:
          console.log('[Sandbox] Update alert:', data);
          break;
        default:
          console.log('[Sandbox] Unknown action:', action);
      }
    }

  async initialize(): Promise<void> {
    try {
      console.log('[Sandbox] 开始初始化脚本:', this.scriptInfo.name);
      
      const allSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'local'];
      const supportQualitys = {
        kw: ['128k', '320k', 'flac', 'flac24bit'],
        kg: ['128k', '320k', 'flac', 'flac24bit'],
        tx: ['128k', '320k', 'flac', 'flac24bit'],
        wy: ['128k', '320k', 'flac', 'flac24bit'],
        mg: ['128k', '320k', 'flac', 'flac24bit'],
        local: [],
      };
      const supportActions = {
        kw: ['musicUrl'],
        kg: ['musicUrl'],
        tx: ['musicUrl'],
        wy: ['musicUrl'],
        mg: ['musicUrl'],
        xm: ['musicUrl'],
        local: ['musicUrl', 'lyric', 'pic'],
      };

      const EVENT_NAMES = {
        request: 'request',
        inited: 'inited',
        updateAlert: 'updateAlert',
        response: 'response',
      };
      const eventNames = Object.values(EVENT_NAMES);
      const events: { request: ((data: any) => any) | null } = { request: null };

      let isInitedApi = false;
      let isShowedUpdateAlert = false;

      const httpsRxp = /^https:/;

      const getRequestAgent = (url: string) => {
        return undefined;
      };

      const verifyLyricInfo = (info: any): any => {
        if (typeof info != 'object' || typeof info.lyric != 'string') throw new Error('failed');
        if (info.lyric.length > 51200) throw new Error('failed');
        return {
          lyric: info.lyric,
          tlyric: (typeof info.tlyric == 'string' && info.tlyric.length < 5120) ? info.tlyric : null,
          rlyric: (typeof info.rlyric == 'string' && info.rlyric.length < 5120) ? info.rlyric : null,
          lxlyric: (typeof info.lxlyric == 'string' && info.lxlyric.length < 8192) ? info.lxlyric : null,
        };
      };

      const handleRequest = (context: any, { requestKey, data }: any) => {
        console.log('[Sandbox] handleRequest called');
        console.log('[Sandbox]   requestKey:', requestKey);
        console.log('[Sandbox]   data:', JSON.stringify(data));
        
        if (!events.request) {
          console.error('[Sandbox] Request event is not defined');
          this.sendMessage(USER_API_RENDERER_EVENT_NAME.response, { requestKey }, false, 'Request event is not defined');
          return;
        }
        
        try {
          events.request.call(context, { source: data.source, action: data.action, info: data.info }).then((response: any) => {
            console.log('[Sandbox] Request handler promise resolved');
            console.log('[Sandbox]   response type:', typeof response);
            console.log('[Sandbox]   response:', response);
            
            let sendData = { requestKey };
            switch (data.action) {
              case 'musicUrl':
                console.log('[Sandbox] Processing musicUrl action');
                if (typeof response != 'string' || response.length > 2048 || !/^https?:/.test(response)) {
                  console.error('[Sandbox] Invalid musicUrl response');
                  throw new Error('failed');
                }
                sendData.result = {
                  source: data.source,
                  action: data.action,
                  data: {
                    type: data.info.type,
                    url: response,
                  },
                };
                break;
              case 'lyric':
                console.log('[Sandbox] Processing lyric action');
                sendData.result = {
                  source: data.source,
                  action: data.action,
                  data: verifyLyricInfo(response),
                };
                break;
              case 'pic':
                console.log('[Sandbox] Processing pic action');
                if (typeof response != 'string' || response.length > 2048 || !/^https?:/.test(response)) {
                  console.error('[Sandbox] Invalid pic response');
                  throw new Error('failed');
                }
                sendData.result = {
                  source: data.source,
                  action: data.action,
                  data: response,
                };
                break;
              default:
                console.log('[Sandbox] Unknown action:', data.action);
            }
            console.log('[Sandbox] 请求成功:', sendData.result);
            this.sendMessage(USER_API_RENDERER_EVENT_NAME.response, sendData, true);
          }).catch((err: any) => {
            const errMsg = err?.message || String(err) || 'Request failed';
            console.error('[Sandbox] Request handler promise rejected:', errMsg);
            this.sendMessage(USER_API_RENDERER_EVENT_NAME.response, { requestKey }, false, errMsg);
          });
        } catch (err: any) {
          const errMsg = err?.message || String(err) || 'Request failed';
          console.error('[Sandbox] handleRequest exception:', errMsg);
          this.sendMessage(USER_API_RENDERER_EVENT_NAME.response, { requestKey }, false, errMsg);
        }
      };

      const handleInit = (context: any, info: any) => {
        console.log('[Sandbox] handleInit called');
        console.log('[Sandbox] handleInit info:', JSON.stringify(info));
        
        if (!info) {
          console.error('[Sandbox] Missing init info');
          this.sendMessage(USER_API_RENDERER_EVENT_NAME.init, null, false, 'Missing required parameter init info');
          return;
        }
        
        if (info.openDevTools === true) {
          console.log('[Sandbox] Open DevTools requested');
          this.sendMessage(USER_API_RENDERER_EVENT_NAME.openDevTools, {}, true);
        }
        
        const sourceInfo: any = { sources: {} };
        
        try {
          for (const source of allSources) {
            const userSource = (info as any).sources?.[source];
            if (!userSource || userSource.type !== 'music') continue;
            const qualitys = supportQualitys[source];
            const actions = supportActions[source];
            sourceInfo.sources[source] = {
              type: 'music',
              actions: actions.filter((a: string) => userSource.actions?.includes(a)),
              qualitys: qualitys.filter((q: string) => userSource.qualitys?.includes(q)),
            };
          }
        } catch (error: any) {
          console.error('[Sandbox] Error in handleInit:', error.message);
          this.sendMessage(USER_API_RENDERER_EVENT_NAME.init, null, false, error.message);
          return;
        }
        
        console.log('[Sandbox] Source info prepared:', Object.keys(sourceInfo.sources));
        
        const registeredSourceList = Object.keys((info as any).sources || {});
        console.log('[Sandbox] Storing registered sources:', registeredSourceList);
        for (const source of registeredSourceList) {
          this.registeredSources.set(source, (info as any).sources[source]);
        }
        
        this.sendMessage(USER_API_RENDERER_EVENT_NAME.init, sourceInfo, true);

        (globalThis as any)._handleRequest = (data: any) => {
          console.log('[Sandbox] _handleRequest called');
          handleRequest(context, data);
        };
      };

      const handleShowUpdateAlert = (data: any, resolve: any, reject: any) => {
        if (!data || typeof data != 'object') return reject(new Error('parameter format error.'));
        if (!data.log || typeof data.log != 'string') return reject(new Error('log is required.'));
        if (data.updateUrl && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(data.updateUrl) && data.updateUrl.length > 1024) delete data.updateUrl;
        if (data.log.length > 1024) data.log = data.log.substring(0, 1024) + '...';
        console.log('[Sandbox] 更新提示:', data.log);
        this.sendMessage(USER_API_RENDERER_EVENT_NAME.showUpdateAlert, {
          log: data.log,
          updateUrl: data.updateUrl,
        }, true);
        resolve();
      };

      const onError = (errorMessage: string) => {
        console.log('[Sandbox] onError called with:', errorMessage);
        
        // If already processed an error, don't process again
        if (isInitedApi) {
          console.log('[Sandbox] onError: already processed an error, ignoring');
          return;
        }
        
        // Mark as initialized to prevent further error processing
        isInitedApi = true;
        
        // Always call sendMessage for errors
        this.sendMessage(USER_API_RENDERER_EVENT_NAME.init, null, false, errorMessage);
        
        // Don't throw error, just log it
        // This matches the desktop version behavior
        console.log('[Sandbox] onError: API not initialized, error sent');
        if (errorMessage.length > 1024) errorMessage = errorMessage.substring(0, 1024) + '...';
        this.initError = errorMessage;
      };

      const request = function(this: any, url: string, options: any, callback: any) {
        console.log('[Sandbox] request called with url:', url);
        console.log('[Sandbox] request options:', JSON.stringify(options));
        
        let opts = {
          headers: options?.headers || {},
          agent: getRequestAgent(url),
        };
        let data;
        if (options?.body) {
          data = options.body;
        } else if (options?.form) {
          data = options.form;
          (opts as any).json = false;
        } else if (options?.formData) {
          data = options.formData;
          (opts as any).json = false;
        }
        const timeout = typeof options?.response_timeout == 'number' && options.response_timeout > 0 ? Math.min(options.response_timeout, 60_000) : 60_000;
        const followMax = options?.follow_max ?? 5; // 默认跟随 5 次重定向

        const method = (options?.method || 'get').toLowerCase();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); }, timeout);

        // 处理 headers - 移除 GET 请求中的 Content-Type
        let headers: any = { ...opts.headers };
        if (method === 'get' && headers['Content-Type']) {
          delete headers['Content-Type'];
        }

        const doFetch = async (currentUrl: string, redirectCount: number): Promise<Response> => {
          const fetchOptions: any = {
            method: method,
            headers: headers,
            signal: controller.signal,
            redirect: 'manual', // 手动处理重定向以支持 follow_max
          };

          if (data) {
            if (options?.form) {
              const formDataObj = new URLSearchParams();
              for (const key in data) {
                formDataObj.append(key, data[key]);
              }
              fetchOptions.body = formDataObj.toString();
              fetchOptions.headers = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
            } else if (options?.formData) {
              const formDataObj = new FormData();
              for (const key in data) {
                formDataObj.append(key, data[key]);
              }
              fetchOptions.body = formDataObj;
            } else {
              fetchOptions.body = data;
            }
          }

          const response = await fetch(currentUrl, fetchOptions);
          
          // 处理重定向
          if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
            if (redirectCount >= followMax) {
              throw new Error(`Maximum redirect count (${followMax}) exceeded`);
            }
            const newUrl = response.headers.get('location')!;
            // 解析相对 URL
            const resolvedUrl = newUrl.startsWith('http') ? newUrl : new URL(newUrl, currentUrl).href;
            return doFetch(resolvedUrl, redirectCount + 1);
          }
          
          return response;
        };

        let requestObj: any = { aborted: false };

        doFetch(url, 0).then((response: any) => {
          clearTimeout(timeoutId);
          console.log('[Sandbox] Response received:', response.status, response.statusText);

          return response.arrayBuffer().then((responseBody: ArrayBuffer) => {
            const bytes = responseBody.byteLength;
            const rawUint8Array = new Uint8Array(responseBody);
            const rawString = new TextDecoder().decode(responseBody);
            let body = rawString;
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
              bytes: bytes, 
              raw: rawUint8Array,
              body: body 
            };
            
            console.log('[Sandbox] Response body:', typeof body === 'string' ? body.substring(0, 200) : JSON.stringify(body).substring(0, 200));
            
            if (callback) {
              try {
                console.log('[Sandbox] Calling callback...');
                console.log('[Sandbox] callback type:', typeof callback);
                console.log('[Sandbox] lx.send type:', typeof lx.send);
                console.log('[Sandbox] lx.send === send:', lx.send === send);
                console.log('[Sandbox] typeof lx.on:', typeof lx.on);
                
                callback.call(this, null, respObj, body);
                console.log('[Sandbox] Callback executed successfully');
                
                console.log('[Sandbox] After callback, isInitedApi:', isInitedApi);
                
              } catch (err) {
                console.error('[Sandbox] Callback error:', err);
                onError(err instanceof Error ? err.message : String(err));
              }
            } else {
              console.log('[Sandbox] No callback provided');
            }
          }).catch((arrayBufferError: any) => {
            console.error('[Sandbox] Array buffer error:', arrayBufferError.message);
            if (callback) {
              callback.call(this, arrayBufferError, null, null);
            }
          });
        }).catch((error: any) => {
          clearTimeout(timeoutId);
          console.error('[Sandbox] Request error:', error.message);
          if (callback) {
            try {
              callback.call(this, error, null, null);
            } catch (callbackError: any) {
              console.error('[Sandbox] Error in callback during error handling:', callbackError.message);
              onError(callbackError.message);
            }
          }
        });

        return () => { 
          if (!requestObj.aborted) {
            controller.abort();
            requestObj.aborted = true;
          }
        };
      };

      const send = (eventName: string, data: any) => {
        console.log('[Sandbox send] Function called!');
        console.log('[Sandbox send] eventName:', eventName);
        console.log('[Sandbox send] data:', JSON.stringify(data));
        console.log('[Sandbox send] isInitedApi:', isInitedApi);
        console.log('[Sandbox send] eventNames:', eventNames);
        console.log('[Sandbox send] typeof lx.send:', typeof lx.send);
        console.log('[Sandbox send] lx.send === send:', lx.send === send);
        
        return new Promise<void>((resolve, reject) => {
          console.log('[Sandbox send] Inside Promise executor');
          if (!eventNames.includes(eventName)) {
            console.log('[Sandbox send] event name not in eventNames:', eventName);
            return reject(new Error('The event is not supported: ' + eventName));
          }
          switch (eventName) {
            case EVENT_NAMES.inited:
              console.log('[Sandbox send] Processing inited event');
              if (isInitedApi) {
                console.log('[Sandbox send] isInitedApi is true, ignoring duplicate init');
                // 桌面版会 reject，但我们在服务器环境下忽略重复初始化，不报告错误
                return resolve();
              }
              isInitedApi = true;
              console.log('[Sandbox send] isInitedApi set to true');
              console.log('[Sandbox send] Calling handleInit with data');
              try {
                handleInit(this, data);
                console.log('[Sandbox send] handleInit returned successfully');
              } catch (error: any) {
                console.error('[Sandbox send] handleInit threw error:', error.message);
                // 初始化失败，抛出错误
                throw error;
              }
              resolve();
              console.log('[Sandbox send] Promise resolved');
              break;
            case EVENT_NAMES.updateAlert:
              if (isShowedUpdateAlert) return reject(new Error('The update alert can only be called once.'));
              isShowedUpdateAlert = true;
              handleShowUpdateAlert(data, resolve, reject);
              break;
            case EVENT_NAMES.response:
              console.log('[Sandbox send] Processing response event');
              this.sendMessage(USER_API_RENDERER_EVENT_NAME.response, data, true);
              resolve();
              break;
            default:
              console.log('[Sandbox] send: unknown event name:', eventName);
              reject(new Error('Unknown event name: ' + eventName));
          }
        });
      };

      const on = (eventName: string, handler: any) => {
        console.log('[Sandbox] on called:', eventName);
        if (!eventNames.includes(eventName)) return Promise.reject(new Error('The event is not supported: ' + eventName));
        switch (eventName) {
          case EVENT_NAMES.request:
            console.log('[Sandbox] Setting events.request handler');
            try {
              events.request = handler;
              console.log('[Sandbox] events.request set successfully');
            } catch (err) {
              console.error('[Sandbox] Error setting events.request:', err);
            }
            break;
          default:
            return Promise.reject(new Error('The event is not supported: ' + eventName));
        }
        console.log('[Sandbox] on completed successfully');
        return Promise.resolve();
      };

      const utils = {
        crypto: {
          aesEncrypt: async(buffer: any, mode: string, key: any, iv: any) => {
            const cryptoKey = await crypto.subtle.importKey(
              'raw',
              key,
              { name: 'AES-CBC' },
              false,
              ['encrypt']
            );
            const encrypted = await crypto.subtle.encrypt(
              { name: 'AES-CBC', iv: iv },
              cryptoKey,
              buffer
            );
            return new Uint8Array(encrypted);
          },
          rsaEncrypt: async(buffer: any, key: string) => {
            const paddedBuffer = new Uint8Array(128);
            const bufferLen = buffer instanceof Uint8Array ? buffer.length : new TextEncoder().encode(String(buffer)).length;
            const startPos = 128 - bufferLen;
            if (buffer instanceof Uint8Array) {
              paddedBuffer.set(buffer, startPos);
            } else {
              const encoded = new TextEncoder().encode(String(buffer));
              paddedBuffer.set(encoded, startPos);
            }
            const cryptoKey = await crypto.subtle.importKey(
              'spki',
              new TextEncoder().encode(key),
              { name: 'RSA-OAEP', hash: 'SHA-1' },
              false,
              ['encrypt']
            );
            const encrypted = await crypto.subtle.encrypt(
              { name: 'RSA-OAEP' },
              cryptoKey,
              paddedBuffer
            );
            return new Uint8Array(encrypted);
          },
          randomBytes: (size: number) => {
            const bytes = new Uint8Array(size);
            crypto.getRandomValues(bytes);
            return bytes;
          },
          md5: (str: string) => {
            const md5 = (str: string): string => {
              const rotateLeft = (lValue: number, iShiftBits: number) => (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
              const addUnsigned = (lX: number, lY: number) => {
                const lX4 = (lX & 0x80000000);
                const lY4 = (lY & 0x80000000);
                const lX8 = (lX & 0x40000000);
                const lY8 = (lY & 0x40000000);
                const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
                if (lX8 & lY8) return (lResult ^ 0x80000000 ^ lX4 ^ lY4);
                if (lX8 | lY8) {
                  if (lResult & 0x40000000) return (lResult ^ 0x40000000 ^ lX4 ^ lY4);
                  else return (lResult ^ 0x80000000 ^ lX4 ^ lY4);
                }
                return lResult;
              };
              const f = (x: number, y: number, z: number) => (x & y) | (~x & z);
              const g = (x: number, y: number, z: number) => (x & z) | (y & ~z);
              const h = (x: number, y: number, z: number) => x ^ y ^ z;
              const iFunc = (x: number, y: number, z: number) => y ^ (x | ~z);
              const FF = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(a, f(b, c, d) + x + ac);
              const GG = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(a, g(b, c, d) + x + ac);
              const HH = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(a, h(b, c, d) + x + ac);
              const II = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(a, iFunc(b, c, d) + x + ac);
              const convertToWordArray = (str: string): number[] => {
                const lWordCount: number = Math.ceil(((str.length + 8) / 64));
                const lWordArray: number[] = new Array(lWordCount * 16);
                let lBytePosition = 0;
                let lByteCount = 0;
                while (lByteCount < str.length) {
                  const lWordCountValue = (lByteCount - (lByteCount % 4)) / 4;
                  const lBytePositionValue = (lByteCount % 4) * 8;
                  lWordArray[lWordCountValue] = (lWordArray[lWordCountValue] | (str.charCodeAt(lByteCount) << lBytePositionValue));
                  lByteCount++;
                }
                const lWordCountValue = (lByteCount - (lByteCount % 4)) / 4;
                const lBytePositionValue = (lByteCount % 4) * 8;
                lWordArray[lWordCountValue] = lWordArray[lWordCountValue] | (0x80 << lBytePositionValue);
                lWordArray[lWordCount * 14 + 2] = str.length << 3;
                lWordArray[lWordCount * 14 + 3] = str.length >>> 29;
                return lWordArray;
              };
              const wordToHex = (lValue: number): string => {
                let wordToHexValue = '';
                let wordToHexValue_temp = '';
                let lByte = 0;
                let lCount = 0;
                for (lCount = 0; lCount <= 3; lCount++) {
                  lByte = (lValue >>> (lCount * 8)) & 255;
                  wordToHexValue_temp = '0' + lByte.toString(16);
                  wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
                }
                return wordToHexValue;
              };
              const x = convertToWordArray(str);
              let a = 0x67452301;
              let b = 0xEFCDAB89;
              let c = 0x98BADCFE;
              let d = 0x10325476;
              for (let k = 0; k < x.length; k += 16) {
                const AA = a;
                const BB = b;
                const CC = c;
                const DD = d;
                a = FF(a, b, c, d, x[k + 0], 7, -680876936);
                d = FF(d, a, b, c, x[k + 1], 12, -389564586);
                c = FF(c, d, a, b, x[k + 2], 17, 606105819);
                b = FF(b, c, d, a, x[k + 3], 22, -1044525330);
                a = FF(a, b, c, d, x[k + 4], 7, -176418897);
                d = FF(d, a, b, c, x[k + 5], 12, 1200080426);
                c = FF(c, d, a, b, x[k + 6], 17, -1473231341);
                b = FF(b, c, d, a, x[k + 7], 22, -45705983);
                a = FF(a, b, c, d, x[k + 8], 7, 1770035416);
                d = FF(d, a, b, c, x[k + 9], 12, -1958414417);
                c = FF(c, d, a, b, x[k + 10], 17, -42063);
                b = FF(b, c, d, a, x[k + 11], 22, -1990404162);
                a = FF(a, b, c, d, x[k + 12], 7, 1804603682);
                d = FF(d, a, b, c, x[k + 13], 12, -40341101);
                c = FF(c, d, a, b, x[k + 14], 17, -1502002290);
                b = FF(b, c, d, a, x[k + 15], 22, 1236535329);
                a = GG(a, b, c, d, x[k + 1], 5, -165796510);
                d = GG(d, a, b, c, x[k + 6], 9, -1069501632);
                c = GG(c, d, a, b, x[k + 11], 14, 643717713);
                b = GG(b, c, d, a, x[k + 0], 20, -373897302);
                a = GG(a, b, c, d, x[k + 5], 5, -701558691);
                d = GG(d, a, b, c, x[k + 10], 9, 38016083);
                c = GG(c, d, a, b, x[k + 15], 14, -660478335);
                b = GG(b, c, d, a, x[k + 4], 20, -405537848);
                a = GG(a, b, c, d, x[k + 9], 5, 568446438);
                d = GG(d, a, b, c, x[k + 14], 9, -1019803690);
                c = GG(c, d, a, b, x[k + 3], 14, -187363961);
                b = GG(b, c, d, a, x[k + 8], 20, 1163531501);
                a = GG(a, b, c, d, x[k + 13], 5, -1444681467);
                d = GG(d, a, b, c, x[k + 2], 9, -51403784);
                c = GG(c, d, a, b, x[k + 7], 14, 1735328473);
                b = GG(b, c, d, a, x[k + 12], 20, -1926607734);
                a = HH(a, b, c, d, x[k + 5], 4, -378558);
                d = HH(d, a, b, c, x[k + 8], 11, -2022574463);
                c = HH(c, d, a, b, x[k + 11], 16, 1839030562);
                b = HH(b, c, d, a, x[k + 14], 23, -35309556);
                a = HH(a, b, c, d, x[k + 1], 4, -1530992060);
                d = HH(d, a, b, c, x[k + 4], 11, 1272893353);
                c = HH(c, d, a, b, x[k + 7], 16, -155497632);
                b = HH(b, c, d, a, x[k + 10], 23, -1094730640);
                a = HH(a, b, c, d, x[k + 13], 4, 681279174);
                d = HH(d, a, b, c, x[k + 0], 11, -358537222);
                c = HH(c, d, a, b, x[k + 3], 16, -722521979);
                b = HH(b, c, d, a, x[k + 6], 23, 76029189);
                a = HH(a, b, c, d, x[k + 9], 4, -640364487);
                d = HH(d, a, b, c, x[k + 12], 11, -421815835);
                c = HH(c, d, a, b, x[k + 15], 16, 530742520);
                b = HH(b, c, d, a, x[k + 2], 23, -995338651);
                a = II(a, b, c, d, x[k + 0], 6, -198630844);
                d = II(d, a, b, c, x[k + 7], 10, 1126891415);
                c = II(c, d, a, b, x[k + 14], 15, -1416354905);
                b = II(b, c, d, a, x[k + 5], 21, -57434055);
                a = II(a, b, c, d, x[k + 12], 6, 1700485571);
                d = II(d, a, b, c, x[k + 3], 10, -1894986606);
                c = II(c, d, a, b, x[k + 10], 15, -1051523);
                b = II(b, c, d, a, x[k + 1], 21, -2054922799);
                a = II(a, b, c, d, x[k + 8], 6, 1873313359);
                d = II(d, a, b, c, x[k + 15], 10, -30611744);
                c = II(c, d, a, b, x[k + 6], 15, -1560198380);
                b = II(b, c, d, a, x[k + 13], 21, 1309151649);
                a = II(a, b, c, d, x[k + 4], 6, -145523070);
                d = II(d, a, b, c, x[k + 11], 10, -1120210379);
                c = II(c, d, a, b, x[k + 2], 15, 718787259);
                b = II(b, c, d, a, x[k + 9], 21, -343485551);
                a = addUnsigned(a, AA);
                b = addUnsigned(b, BB);
                c = addUnsigned(c, CC);
                d = addUnsigned(d, DD);
              }
              return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
            };
            return md5(str);
          },
        },
        buffer: {
          from(...args: any[]) {
            return Buffer.from(...args);
          },
          bufToString(buf: any, format: string) {
            return Buffer.from(buf, 'binary').toString(format);
          },
        },
        zlib: {
          inflate: (buf: any) => {
            return new Promise((resolve, reject) => {
              try {
                const inflated = pako.inflate(buf);
                resolve(inflated);
              } catch (err: any) {
                reject(new Error(err.message));
              }
            });
          },
          deflate: (data: any) => {
            return new Promise((resolve, reject) => {
              try {
                const deflated = pako.deflate(data);
                resolve(deflated);
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
        proxy: {
          host: '',
          port: '',
        },
        getConsole: () => {
          return {
            log: (...args: any[]) => console.log('[Console]', ...args),
            error: (...args: any[]) => console.error('[Console]', ...args),
            warn: (...args: any[]) => console.warn('[Console]', ...args),
            info: (...args: any[]) => console.info('[Console]', ...args),
          };
        },
        createMainWindow: () => {},
        getSystemFonts: async () => [],
        sendMessage: (action: string, data: any, status: boolean, message?: string) => {
          this.sendMessage(action, data, status, message);
        },
      };

      const __lx_init_error_handler__: any = {
        sendError: (errorMessage: string) => {
          console.log('[Sandbox] __lx_init_error_handler__.sendError called with:', errorMessage);
          onError(errorMessage);
        },
      };

      (globalThis as any).__lx_init_error_handler__ = __lx_init_error_handler__;

      // 在脚本上下文中设置错误监听器，参照桌面版实现
      // 这样可以捕获脚本内部的错误，包括 unhandledrejection
      const errorHandlerScript = `
        (() => {
          // 捕获所有的 Promise rejection
          const originalThen = Promise.prototype.then;
          const originalCatch = Promise.prototype.catch;
          
          // 阻止所有的 unhandledrejection 事件
          globalThis.addEventListener('unhandledrejection', (event) => {
            event.preventDefault();
          });
          
          globalThis.addEventListener('error', (event) => {
            if (event.isTrusted) {
              globalThis.__lx_init_error_handler__.sendError(event.message.replace(/^Uncaught\\\\sError:\\\\s/, ''));
            }
          });
          globalThis.addEventListener('unhandledrejection', (event) => {
            if (!event.isTrusted) return;
            const message = typeof event.reason === 'string' 
              ? event.reason 
              : event.reason?.message ?? String(event.reason);
            globalThis.__lx_init_error_handler__.sendError(message.replace(/^Error:\\\\s/, ''));
            event.preventDefault();
          });
        })()
      `;
      
      // 先执行错误监听器设置脚本
      try {
        const errorHandlerFn = new Function(errorHandlerScript);
        errorHandlerFn();
        console.log('[Sandbox] 错误监听器已设置');
      } catch (error: any) {
        console.error('[Sandbox] 错误监听器设置失败:', error.message);
        throw error;
      }
      
      // 不在 Deno 级别设置 unhandledrejection 监听器
      // 让脚本内部的错误监听器来处理所有的错误
      // globalThis.addEventListener('unhandledrejection', ...);

      // 不在 Node.js 级别设置 unhandledrejection 监听器
      // 让脚本内部的错误在脚本上下文中处理
      // 但是 Deno 会在运行时级别报告未处理的 Promise rejection
      // 我们需要在脚本执行完成后、初始化完成前，临时添加一个监听器来阻止错误报告
      // globalThis.addEventListener('unhandledrejection', ...);

      (globalThis as any).lx = lx;

      // 预加载 CommonJS 模块，暴露为全局变量
      console.log('[Sandbox] 预加载 CommonJS 模块...');
      
      const preloadedModules: Record<string, any> = {};
      
      // 加载 buffer 模块
      const BufferFrom = (value: any, encoding?: string): Uint8Array => {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (Array.isArray(value)) return new Uint8Array(value);
        if (typeof value === 'string') {
          const enc = encoding || 'utf8';
          if (enc === 'utf8' || enc === 'utf-8') {
            return new TextEncoder().encode(value);
          } else if (enc === 'latin1' || enc === 'binary') {
            const bytes = new Uint8Array(value.length);
            for (let i = 0; i < value.length; i++) {
              bytes[i] = value.charCodeAt(i) & 0xff;
            }
            return bytes;
          }
        }
        return new Uint8Array(0);
      };
      
      preloadedModules.buffer = {
        Buffer: {
          ...Buffer,
          from: BufferFrom,
          isBuffer: (obj: any) => obj instanceof Uint8Array,
          alloc: (size: number, fill?: number) => new Uint8Array(size),
          allocUnsafe: (size: number) => new Uint8Array(size),
          concat: (list: Uint8Array[], totalLength?: number) => {
            if (list.length === 0) return new Uint8Array(0);
            if (list.length === 1) return list[0];
            totalLength = totalLength || list.reduce((acc, buf) => acc + buf.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const buf of list) {
              result.set(buf, offset);
              offset += buf.length;
            }
            return result;
          },
        },
      };
      
      // 加载 crypto 模块 (使用 Web Crypto API 兼容实现，存放在 _crypto)
      preloadedModules._crypto = {
        createCipheriv: (algorithm: string, key: any, iv: any) => {
          return {
            update: (data: any) => data,
            final: () => new Uint8Array(0),
          };
        },
        createDecipheriv: (algorithm: string, key: any, iv: any) => {
          return {
            update: (data: any) => data,
            final: () => new Uint8Array(0),
          };
        },
        publicEncrypt: async (options: any, buffer: Uint8Array) => {
          const key = await crypto.subtle.importKey(
            'spki',
            Buffer.from(options.key),
            { name: 'RSA-OAEP', hash: 'SHA-1' },
            false,
            ['encrypt']
          );
          const encrypted = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            key,
            buffer
          );
          return new Uint8Array(encrypted);
        },
        privateDecrypt: async (options: any, buffer: Uint8Array) => {
          const key = await crypto.subtle.importKey(
            'pkcs8',
            Buffer.from(options.key),
            { name: 'RSA-OAEP', hash: 'SHA-1' },
            false,
            ['decrypt']
          );
          const decrypted = await crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            key,
            buffer
          );
          return new Uint8Array(decrypted);
        },
        randomBytes: (size: number) => {
          const bytes = new Uint8Array(size);
          crypto.getRandomValues(bytes);
          return bytes;
        },
        createHash: (algorithm: string) => {
          return {
            update: (data: any) => {
              return {
                digest: (encoding: string) => {
                  if (encoding === 'hex') {
                    const hashBuffer = new TextEncoder().encode(data);
                    return Array.from(hashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
                  }
                  return data;
                },
              };
            },
          };
        },
        createHmac: (algorithm: string, key: any) => {
          return {
            update: (data: any) => {
              return {
                digest: (encoding: string) => data,
              };
            },
          };
        },
        constants: {
          RSA_NO_PADDING: 3,
        },
      };
      
      // 加载 zlib 模块 (使用 pako)
      preloadedModules.zlib = {
        gzip: async (data: Uint8Array): Promise<Uint8Array> => {
          return pako.gzip(data);
        },
        gunzip: async (data: Uint8Array): Promise<Uint8Array> => {
          return pako.ungzip(data);
        },
        deflate: async (data: Uint8Array): Promise<Uint8Array> => {
          return pako.deflate(data);
        },
        inflate: async (data: Uint8Array): Promise<Uint8Array> => {
          return pako.inflate(data);
        },
      };
      
      // 加载 needle 模块 (HTTP 客户端模拟)
      preloadedModules.needle = {
        request: (method: string, url: string, data: any, options: any, callback: any) => {
          const controller = new AbortController();
          const timeout = options?.response_timeout || 60000;
          const followMax = options?.follow_max ?? 5; // 默认跟随 5 次重定向
          
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, timeout);
          
          // 处理 headers - 移除 GET 请求中的 Content-Type
          let headers: any = { ...options?.headers } || {};
          if (method.toLowerCase() === 'get' && headers['Content-Type']) {
            delete headers['Content-Type'];
          }
          
          const doFetch = async (currentUrl: string, redirectCount: number): Promise<Response> => {
            const fetchOptions: any = {
              method,
              signal: controller.signal,
              headers,
              redirect: 'manual', // 手动处理重定向以支持 follow_max
            };
            
            if (data && !options?.json) {
              fetchOptions.body = data;
              fetchOptions.headers = { ...fetchOptions.headers, 'Content-Type': 'application/x-www-form-urlencoded' };
            } else if (data) {
              fetchOptions.body = JSON.stringify(data);
              fetchOptions.headers = { ...fetchOptions.headers, 'Content-Type': 'application/json' };
            }
            
            const response = await fetch(currentUrl, fetchOptions);
            
            // 处理重定向
            if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
              if (redirectCount >= followMax) {
                throw new Error(`Maximum redirect count (${followMax}) exceeded`);
              }
              const newUrl = response.headers.get('location')!;
              // 解析相对 URL
              const resolvedUrl = newUrl.startsWith('http') ? newUrl : new URL(newUrl, currentUrl).href;
              return doFetch(resolvedUrl, redirectCount + 1);
            }
            
            return response;
          };
          
          doFetch(url, 0)
            .then(async (response) => {
              clearTimeout(timeoutId);
              const responseBody = await response.arrayBuffer();
              const bodyStr = new TextDecoder().decode(responseBody);
              let body = bodyStr;
              try { body = JSON.parse(bodyStr); } catch (e) {}
              
              const respObj = {
                statusCode: response.status,
                statusMessage: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                bytes: responseBody.byteLength,
                raw: Buffer.from(responseBody),
                body,
              };
              
              if (callback) {
                callback(null, respObj, body);
              }
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              if (callback) {
                callback(error, null, null);
              }
            });
          
          return { aborted: false };
        },
      };
      
      // 加载 tunnel 模块 (代理支持)
      preloadedModules.tunnel = {
        httpOverHttp: (options: any) => {
          return (req: any) => req;
        },
        httpsOverHttp: (options: any) => {
          return (req: any) => req;
        },
      };
      
      // 暴露预加载的模块到全局作用域
      // 注意：crypto 是只读的全局属性，不能直接覆盖，只使用 _crypto 作为别名
      (globalThis as any).buffer = preloadedModules.buffer;
      (globalThis as any)._crypto = preloadedModules._crypto;
      (globalThis as any).zlib = preloadedModules.zlib;
      (globalThis as any).needle = preloadedModules.needle;
      (globalThis as any).tunnel = preloadedModules.tunnel;
      
      console.log('[Sandbox] CommonJS 模块预加载完成');
      
      // 添加同步 require 函数 (直接返回预加载的模块)
      const require = (moduleName: string): any => {
        console.log('[Sandbox require] Called with module:', moduleName);
        
        // 处理 crypto 模块名映射 (返回 _crypto)
        if (moduleName === 'crypto') {
          return preloadedModules._crypto;
        }
        
        // 返回预加载的模块
        if (preloadedModules[moduleName]) {
          return preloadedModules[moduleName];
        }
        
        // 对于其他模块，返回 undefined
        console.log('[Sandbox require] Module not preloaded:', moduleName);
        return undefined;
      };
      
      (globalThis as any).require = require;
      console.log('[Sandbox] CommonJS require polyfill 已添加 (同步模式)');

      console.log('[Sandbox] 开始执行脚本...');
      console.log('[Sandbox] proxy.host:', proxy.host);
      console.log('[Sandbox] proxy.port:', proxy.port);
      console.log('[Sandbox] lx.proxy.host:', lx.proxy.host);
      console.log('[Sandbox] lx.proxy.port:', lx.proxy.port);
      
      const initEnv = () => {
        lx.proxy.host = proxy.host;
        lx.proxy.port = proxy.port;
        lx.env = 'desktop';
        lx.onWebhook = (listener: any) => {
          console.log('[Sandbox] lx.onWebhook called');
          globalThis.webhookListener = listener;
        };
        console.log('[Sandbox] initEnv completed');
      };
      
      initEnv();
      console.log('[Sandbox] initEnv called');
      console.log('[Sandbox] After initEnv, lx.proxy.host:', lx.proxy.host);
      console.log('[Sandbox] After initEnv, lx.proxy.port:', lx.proxy.port);
      
      const scriptFn = new Function('window', 'self', 'globalThis', 'lx', 'events', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'atob', 'btoa', 'buffer', 'pako', '_crypto', 'fetch', this.scriptInfo.rawScript);
      
      // 完全参照桌面版实现，脚本执行错误被忽略
      // 桌面版使用: webFrame.executeJavaScript(userApi.script).catch(_ => _)
      try {
        scriptFn(globalThis.window, globalThis, globalThis, lx, events, globalThis.setTimeout, globalThis.clearTimeout, globalThis.setInterval, globalThis.clearInterval, lx.atob, lx.btoa, lx.buffer, lx.pako, preloadedModules._crypto, fetch);
        console.log('[Sandbox] 脚本执行完成');
      } catch (error: any) {
        console.error('[Sandbox] 脚本执行失败:', error.message);
        // 忽略脚本执行错误，参照桌面版 .catch(_ => _)
      }

      console.log('[Sandbox] isInitedApi after script:', isInitedApi);
      
      // 等待最多 10 秒，让脚本主动调用 lx.send('inited')
      // 如果 10 秒内脚本没有调用，我们在超时时主动调用
      if (!isInitedApi) {
        console.log('[Sandbox] 等待脚本主动初始化 (最多 10 秒)...');
        
        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(async () => {
            clearInterval(checkInterval);
            console.log('[Sandbox] 等待超时，主动完成初始化...');
            
            // 使用脚本支持的默认音源
            const defaultSources = {
              kw: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              kg: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              tx: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              wy: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              mg: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
            };
            
            // 主动调用初始化，注册默认音源
            try {
              await send('inited', { sources: defaultSources });
              console.log('[Sandbox] 主动初始化成功，已注册默认音源');
            } catch (err: any) {
              console.error('[Sandbox] 主动初始化失败:', err.message);
            }
            
            resolve();
          }, 10000);
          
          // 定期检查 isInitedApi 状态
          const checkInterval = setInterval(() => {
            if (isInitedApi) {
              clearTimeout(timeoutId);
              clearInterval(checkInterval);
              console.log('[Sandbox] 脚本已主动初始化');
              resolve();
            }
          }, 100);
        });
      } else {
        console.log('[Sandbox] 脚本已主动初始化');
      }
      
      // 等待完成后，检查初始化状态
      if (!isInitedApi) {
        // 这不应该发生，因为超时应该已经主动初始化了
        throw new Error('Initialization failed');
      }
      
      // 设置 request handler
      if (events.request) {
        this.requestHandler = events.request;
        console.log('[Sandbox] Sandbox initialization completed successfully');
        console.log('[Sandbox] Registered sources:', Array.from(this.registeredSources.keys()));
      } else {
        console.error('[Sandbox] Request handler not set');
        throw new Error('Request handler not set');
      }

    } catch (error: any) {
      console.error('[Sandbox] 初始化失败:', error.message);
      this.isInitialized = false;
      this.initError = error.message;
      throw error; // 重新抛出错误，让上层知道初始化失败
    }
  }

  async handleMusicUrlRequest(request: MusicUrlRequest): Promise<MusicUrlResponse> {
    console.log('\n========== [Sandbox] handleMusicUrlRequest 开始 ==========');
    console.log('[Sandbox] isInitialized:', this.isInitialized);
    console.log('[Sandbox] requestHandler exists:', !!this.requestHandler);
    console.log('[Sandbox] request:', JSON.stringify(request, null, 2));

    if (!this.isInitialized) {
      console.error('[Sandbox] 抛出异常: Script not initialized');
      console.log('========== [Sandbox] handleMusicUrlRequest 结束 ==========\n');
      throw new Error('Script not initialized');
    }

    if (!this.requestHandler) {
      console.error('[Sandbox] 抛出异常: Request handler not set');
      console.log('========== [Sandbox] handleMusicUrlRequest 结束 ==========\n');
      throw new Error('Request handler not set');
    }

    try {
      console.log('[Sandbox] 调用 requestHandler...');
      const result = await this.requestHandler({
        source: request.source,
        action: 'musicUrl',
        info: {
          type: request.info.type,
          musicInfo: request.info.musicInfo,
        },
      });

      console.log('[Sandbox] requestHandler 返回:', JSON.stringify(result, null, 2));

      if (typeof result !== 'string') {
        console.error('[Sandbox] 抛出异常: Invalid response format');
        console.log('========== [Sandbox] handleMusicUrlRequest 结束 ==========\n');
        throw new Error('Invalid response format');
      }

      if (!/^https?:\/\//.test(result)) {
        console.error('[Sandbox] 抛出异常: Invalid URL format');
        console.log('========== [Sandbox] handleMusicUrlRequest 结束 ==========\n');
        throw new Error('Invalid URL format');
      }

      const response = {
        source: request.source,
        action: 'musicUrl',
        data: {
          type: request.info.type,
          url: result,
        },
      };
      console.log('[Sandbox] 成功返回:', JSON.stringify(response, null, 2));
      console.log('========== [Sandbox] handleMusicUrlRequest 结束 ==========\n');
      return response;
    } catch (error: any) {
      console.error('[Sandbox] handleMusicUrlRequest 捕获到异常:', error.message);
      console.error('[Sandbox] 异常堆栈:', error.stack);
      console.log('========== [Sandbox] handleMusicUrlRequest 结束 ==========\n');
      throw error;
    }
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

  setSourceHandler(source: string, handler: Function): void {
    this.requestHandler = handler;
  }

  async request(request: MusicUrlRequest): Promise<MusicUrlResponse> {
    console.log('\n========== [Sandbox] request 开始 ==========');
    console.log('[Sandbox] scriptInfo.name:', this.scriptInfo.name);
    console.log('[Sandbox] isInitialized:', this.isInitialized);
    console.log('[Sandbox] requestHandler exists:', !!this.requestHandler);
    console.log('[Sandbox] request.source:', request.source);
    console.log('[Sandbox] request.action:', request.action);
    console.log('[Sandbox] request.info.type:', request.info?.type);
    console.log('[Sandbox] request.info.musicInfo:', JSON.stringify(request.info?.musicInfo, null, 2));

    if (!this.isInitialized) {
      console.error('[Sandbox] 抛出异常: Script not initialized');
      console.log('========== [Sandbox] request 结束 ==========\n');
      throw new Error('Script not initialized');
    }

    if (!this.requestHandler) {
      console.error('[Sandbox] 抛出异常: Request handler not set');
      console.log('========== [Sandbox] request 结束 ==========\n');
      throw new Error('Request handler not set');
    }

    console.log('[Sandbox] 即将调用 this.requestHandler...');
    console.log('[Sandbox] requestHandler 参数 - source:', request.source);
    console.log('[Sandbox] requestHandler 参数 - action:', request.action);
    console.log('[Sandbox] requestHandler 参数 - info:', JSON.stringify(request.info, null, 2));

    let response: any;
    try {
      console.log('[Sandbox] 开始等待 requestHandler 返回...');
      response = await this.requestHandler({
        source: request.source,
        action: request.action,
        info: request.info,
      });
      console.log('[Sandbox] requestHandler 执行完成');
      console.log('[Sandbox] requestHandler response 类型:', typeof response);
      console.log('[Sandbox] requestHandler response:', JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error('[Sandbox] requestHandler 抛出异常');
      console.error('[Sandbox] 异常消息:', error.message);
      console.error('[Sandbox] 异常堆栈:', error.stack);
      console.error('[Sandbox] 即将重新抛出异常');
      console.log('========== [Sandbox] request 结束 ==========\n');
      throw error;
    }

    console.log('[Sandbox] 开始处理 response, action:', request.action);
    let resultData: MusicUrlData | LyricData | PicData;

    switch (request.action) {
      case 'musicUrl':
        console.log('[Sandbox] 进入 musicUrl 处理分支');
        console.log('[Sandbox] response 类型:', typeof response);
        console.log('[Sandbox] response 长度:', response?.length);
        console.log('[Sandbox] response 值:', response);
        if (typeof response !== 'string') {
          console.error('[Sandbox] 抛出异常: response 不是字符串');
          console.error('[Sandbox] response 类型:', typeof response);
          console.error('[Sandbox] 即将抛出 Invalid musicUrl response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid musicUrl response: response is not a string');
        }
        if (response.length > 2048) {
          console.error('[Sandbox] 抛出异常: response 长度超过 2048');
          console.error('[Sandbox] response 长度:', response.length);
          console.error('[Sandbox] 即将抛出 Invalid musicUrl response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid musicUrl response: response too long');
        }
        if (!/^https?:/.test(response)) {
          console.error('[Sandbox] 抛出异常: response 不是有效的 HTTP URL');
          console.error('[Sandbox] response:', response);
          console.error('[Sandbox] 即将抛出 Invalid musicUrl response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid musicUrl response: not a valid http(s) url');
        }
        console.log('[Sandbox] musicUrl response 验证通过');
        resultData = {
          type: request.info?.type || 'music',
          url: response,
        };
        console.log('[Sandbox] musicUrl resultData:', JSON.stringify(resultData, null, 2));
        break;

      case 'lyric':
        console.log('[Sandbox] 进入 lyric 处理分支');
        console.log('[Sandbox] response 类型:', typeof response);
        console.log('[Sandbox] response:', JSON.stringify(response, null, 2));
        if (typeof response !== 'object' || response === null) {
          console.error('[Sandbox] 抛出异常: response 不是对象');
          console.error('[Sandbox] 即将抛出 Invalid lyric response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid lyric response: response is not an object');
        }
        if (typeof response.lyric !== 'string') {
          console.error('[Sandbox] 抛出异常: response.lyric 不是字符串');
          console.error('[Sandbox] response.lyric 类型:', typeof response.lyric);
          console.error('[Sandbox] 即将抛出 Invalid lyric response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid lyric response: lyric is not a string');
        }
        console.log('[Sandbox] lyric response 验证通过');
        resultData = {
          type: 'lyric',
          lyric: response.lyric,
          tlyric: (typeof response.tlyric === 'string' && response.tlyric.length < 5120) ? response.tlyric : null,
          rlyric: (typeof response.rlyric === 'string' && response.rlyric.length < 5120) ? response.rlyric : null,
          lxlyric: (typeof response.lxlyric === 'string' && response.lxlyric.length < 8192) ? response.lxlyric : null,
        };
        console.log('[Sandbox] lyric resultData:', JSON.stringify(resultData, null, 2));
        break;

      case 'pic':
        console.log('[Sandbox] 进入 pic 处理分支');
        console.log('[Sandbox] response 类型:', typeof response);
        console.log('[Sandbox] response 长度:', response?.length);
        if (typeof response !== 'string') {
          console.error('[Sandbox] 抛出异常: response 不是字符串');
          console.error('[Sandbox] 即将抛出 Invalid pic response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid pic response: response is not a string');
        }
        if (response.length > 2048) {
          console.error('[Sandbox] 抛出异常: response 长度超过 2048');
          console.error('[Sandbox] 即将抛出 Invalid pic response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid pic response: response too long');
        }
        if (!/^https?:/.test(response)) {
          console.error('[Sandbox] 抛出异常: response 不是有效的 HTTP URL');
          console.error('[Sandbox] 即将抛出 Invalid pic response');
          console.log('========== [Sandbox] request 结束 ==========\n');
          throw new Error('Invalid pic response: not a valid http(s) url');
        }
        console.log('[Sandbox] pic response 验证通过');
        resultData = {
          type: 'pic',
          url: response,
        };
        console.log('[Sandbox] pic resultData:', JSON.stringify(resultData, null, 2));
        break;

      default:
        console.error('[Sandbox] 进入 default 分支，不支持的 action:', request.action);
        console.error('[Sandbox] 抛出异常: Unsupported action');
        console.log('========== [Sandbox] request 结束 ==========\n');
        throw new Error(`Unsupported action: ${request.action}`);
    }

    console.log('[Sandbox] 构建最终 result');
    const result = {
      source: request.source,
      action: request.action,
      data: resultData,
    };
    console.log('[Sandbox] 最终 result:', JSON.stringify(result, null, 2));
    console.log('[Sandbox] 成功返回 result');
    console.log('========== [Sandbox] request 结束 ==========\n');
    return result;
  }

  async terminate(): Promise<void> {
    console.log('[Sandbox] 终止沙箱:', this.scriptInfo.name);
    
    this.registeredSources.clear();
    this.requestCallbacks.forEach((callback, requestKey) => {
      callback.reject(new Error('Sandbox terminated'));
    });
    this.requestCallbacks.clear();
    this.requestHandler = null;
    this.isInitialized = false;
    this.initError = 'Sandbox terminated';
    this.initResult = null;
    
    console.log('[Sandbox] 沙箱已终止:', this.scriptInfo.name);
  }
}
