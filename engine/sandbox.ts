import { ScriptInfo, MusicUrlRequest, MusicUrlResponse } from "./script_engine.ts";
import { RequestManager } from "./request_manager.ts";
import { LXGlobal } from "./lx_global.ts";

export class Sandbox {
  private scriptInfo: ScriptInfo;
  private requestManager: RequestManager;
  private lxGlobal: LXGlobal;
  private sourceHandlers: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  constructor(scriptInfo: ScriptInfo, requestManager: RequestManager) {
    this.scriptInfo = scriptInfo;
    this.requestManager = requestManager;
    this.lxGlobal = new LXGlobal(scriptInfo, requestManager);
  }

  async initialize(): Promise<void> {
    try {
      const lxObject = this.lxGlobal.createGlobalObject();
      await this.executeScript(this.scriptInfo.rawScript, lxObject);
      
      console.log(`🔍 脚本执行完成`);
      
      const registeredSources = this.lxGlobal.getRegisteredSourceList();
      console.log(`🔍 脚本注册的音源: ${registeredSources.join(', ') || '无'}`);
      
      if (registeredSources.length > 0) {
        registeredSources.forEach((source: string) => {
          this.setSourceHandler(source, this.handleRequest.bind(this));
        });
        console.log(`📋 已注册音源: ${registeredSources.join(', ')}`);
      } else {
        console.warn(`⚠️ 脚本未注册任何音源: ${this.scriptInfo.name}`);
      }
      
      this.isInitialized = true;
      console.log(`🔒 Sandbox 初始化完成: ${this.scriptInfo.name}`);
    } catch (error) {
      console.error(`❌ Sandbox 初始化失败: ${this.scriptInfo.name}`, error);
      console.log(`⚠️ 脚本初始化时出现错误，但服务器将继续运行`);
    }
  }

  private async executeScript(script: string, lxObject: any): Promise<void> {
    try {
      console.log(`🔍 开始执行脚本，脚本长度: ${script.length}`);
      console.log(`🔍 脚本前500字符: ${script.substring(0, 500)}`);
      console.log(`🔍 脚本包含 lx.on: ${script.includes('lx.on')}`);
      console.log(`🔍 脚本包含 lx.on('request': ${script.includes("lx.on('request'")}`);
      console.log(`🔍 lxObject.on 函数: ${typeof lxObject.on}`);
      console.log(`🔍 lxObject.send 函数: ${typeof lxObject.send}`);
      
      const originalConsole = globalThis.console;
      
      const scriptConsole = {
        log: (...args: any[]) => originalConsole.log('[Script]', ...args),
        error: (...args: any[]) => originalConsole.error('[Script]', ...args),
        warn: (...args: any[]) => originalConsole.warn('[Script]', ...args),
        info: (...args: any[]) => originalConsole.info('[Script]', ...args),
      };
      
      globalThis.console = scriptConsole as any;
      
      try {
        console.log(`🔍 设置全局 lx 对象`);
        
        (globalThis as any).lx = lxObject;
        
        console.log(`🔍 设置浏览器 API 模拟`);
        
        const originalWindow = (globalThis as any).window;
        const originalDocument = (globalThis as any).document;
        const originalNavigator = (globalThis as any).navigator;
        const originalLocation = (globalThis as any).location;
        const originalHistory = (globalThis as any).history;
        const originalXMLHttpRequest = (globalThis as any).XMLHttpRequest;
        const originalWebSocket = (globalThis as any).WebSocket;
        
        const mockWindow = {
          ...globalThis,
          location: {
            href: 'http://localhost:8080',
            protocol: 'http:',
            host: 'localhost:8080',
            hostname: 'localhost',
            port: '8080',
            pathname: '/',
            search: '',
            hash: '',
            origin: 'http://localhost:8080',
          },
          history: {
            pushState: () => {},
            replaceState: () => {},
            go: () => {},
            back: () => {},
            forward: () => {},
          },
          screen: {
            width: 1920,
            height: 1080,
            availWidth: 1920,
            availHeight: 1080,
          },
          devicePixelRatio: 1,
          innerWidth: 1920,
          innerHeight: 1080,
          outerWidth: 1920,
          outerHeight: 1080,
          scrollX: 0,
          scrollY: 0,
          pageXOffset: 0,
          pageYOffset: 0,
          scrollTo: () => {},
          scrollBy: () => {},
          getComputedStyle: () => ({
            getPropertyValue: () => '',
          }),
          requestAnimationFrame: (callback: Function) => setTimeout(callback, 16),
          cancelAnimationFrame: (id: number) => clearTimeout(id),
          setTimeout: (callback: Function, delay: number) => setTimeout(callback, delay),
          setInterval: (callback: Function, delay: number) => setInterval(callback, delay),
          clearTimeout: clearTimeout,
          clearInterval: clearInterval,
          atob: (str: string) => {
            const binaryString = atob(str);
            return binaryString;
          },
          btoa: (str: string) => {
            return btoa(str);
          },
          encodeURIComponent: encodeURIComponent,
          decodeURIComponent: decodeURIComponent,
          encodeURI: encodeURI,
          decodeURI: decodeURI,
          escape: escape,
          unescape: unescape,
          isFinite: isFinite,
          isNaN: isNaN,
          parseFloat: parseFloat,
          parseInt: parseInt,
          JSON: JSON,
          Math: Math,
          Date: Date,
          Array: Array,
          Object: Object,
          String: String,
          Number: Number,
          Boolean: Boolean,
          RegExp: RegExp,
          Error: Error,
          TypeError: TypeError,
          ReferenceError: ReferenceError,
          SyntaxError: SyntaxError,
          URIError: URIError,
          EvalError: EvalError,
          Map: Map,
          Set: Set,
          WeakMap: WeakMap,
          WeakSet: WeakSet,
          Promise: Promise,
          Proxy: Proxy,
          Reflect: Reflect,
          Symbol: Symbol,
          BigInt: BigInt,
          Int8Array: Int8Array,
          Uint8Array: Uint8Array,
          Uint8ClampedArray: Uint8ClampedArray,
          Int16Array: Int16Array,
          Uint16Array: Uint16Array,
          Int32Array: Int32Array,
          Uint32Array: Uint32Array,
          Float32Array: Float32Array,
          Float64Array: Float64Array,
          DataView: DataView,
          ArrayBuffer: ArrayBuffer,
          SharedArrayBuffer: SharedArrayBuffer,
          Atomics: Atomics,
          console: console,
        };
        
        (globalThis as any).window = mockWindow;
        (globalThis as any).self = mockWindow;
        (globalThis as any).top = mockWindow;
        (globalThis as any).parent = mockWindow;
        (globalThis as any).document = {
          createElement: (tagName: string) => {
            const element: any = {
              tagName: tagName.toUpperCase(),
              attributes: {},
              style: {},
              classList: {
                add: () => {},
                remove: () => {},
                contains: () => false,
                toggle: () => {},
              },
              setAttribute: (name: string, value: string) => {
                element.attributes[name] = value;
              },
              getAttribute: (name: string) => element.attributes[name] || null,
              removeAttribute: (name: string) => {
                delete element.attributes[name];
              },
              appendChild: () => {},
              removeChild: () => {},
              insertBefore: () => {},
              replaceChild: () => {},
              cloneNode: () => element,
              querySelector: () => null,
              querySelectorAll: () => [],
              getElementById: () => null,
              getElementsByClassName: () => [],
              getElementsByTagName: () => [],
              getElementsByName: () => [],
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => true,
            };
            return element;
          },
          createTextNode: () => ({
            nodeValue: '',
            data: '',
          }),
          createDocumentFragment: () => ({
            appendChild: () => {},
            removeChild: () => {},
          }),
          getElementById: () => null,
          getElementsByClassName: () => [],
          getElementsByTagName: () => [],
          getElementsByName: () => [],
          querySelector: () => null,
          querySelectorAll: () => [],
          body: {
            appendChild: () => {},
            removeChild: () => {},
          },
          head: {
            appendChild: () => {},
            removeChild: () => {},
          },
          documentElement: {
            appendChild: () => {},
            removeChild: () => {},
          },
          readyState: 'complete',
          cookie: '',
          title: '',
          URL: 'http://localhost:8080/',
          domain: 'localhost',
          referrer: '',
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        };
        (globalThis as any).navigator = {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          platform: 'MacIntel',
          appName: 'Netscape',
          appVersion: '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          language: 'zh-CN',
          languages: ['zh-CN', 'zh', 'en'],
          vendor: 'Google Inc.',
          vendorSub: '',
          product: 'Gecko',
          productSub: '20030107',
          hardwareConcurrency: 8,
          maxTouchPoints: 0,
          cookieEnabled: true,
          onLine: true,
          javaEnabled: () => false,
          sendBeacon: () => true,
        };
        (globalThis as any).location = mockWindow.location;
        (globalThis as any).history = mockWindow.history;
        (globalThis as any).XMLHttpRequest = (() => {
          const requestManager = this.requestManager;
          
          return class {
            private readyState: number = 0;
            private status: number = 0;
            private statusText: string = '';
            private responseHeaders: Record<string, string> = {};
            private responseText: string = '';
            private response: any = null;
            private _method: string = '';
            private _url: string = '';
            private _async: boolean = true;
            private _requestHeaders: Record<string, string> = {};
            private _onreadystatechange: Function | null = null;
            private _onload: Function | null = null;
            private _onerror: Function | null = null;
            private _ontimeout: Function | null = null;
            private _timeout: number = 0;
            private _abortController: AbortController | null = null;

            open(method: string, url: string, async: boolean = true) {
              this._method = method;
              this._url = url;
              this._async = async;
              this.readyState = 1;
              this._triggerReadyStateChange();
            }

            send(body?: any) {
              if (!this._url) {
                throw new Error('URL not set');
              }

              this._abortController = new AbortController();
              
              const headers: Record<string, string> = { ...this._requestHeaders };
              
              const requestOptions = {
                url: this._url,
                method: this._method,
                headers,
                timeout: this._timeout || 60000,
                body,
              };

              requestManager.addRequest(requestOptions, (error: Error | null, response: any | null, responseBody: any) => {
                if (error) {
                  this.readyState = 4;
                  this.status = 0;
                  this.statusText = error.message || 'Error';
                  if (this._onerror) {
                    this._onerror.call(this, error);
                  }
                  this._triggerReadyStateChange();
                  return;
                }

                if (response) {
                  this.status = response.statusCode;
                  this.statusText = response.statusMessage;
                  this.responseHeaders = response.headers || {};
                  this.responseText = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
                  this.response = responseBody;
                  this.readyState = 4;
                  
                  if (this._onload) {
                    this._onload.call(this, { target: this });
                  }
                  this._triggerReadyStateChange();
                }
              });
            }

            setRequestHeader(name: string, value: string) {
              this._requestHeaders[name] = value;
            }

            getResponseHeader(name: string): string | null {
              return this.responseHeaders[name.toLowerCase()] || null;
            }

            getAllResponseHeaders(): string {
              return Object.entries(this.responseHeaders)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\r\n');
            }

            abort() {
              if (this._abortController) {
                this._abortController.abort();
              }
              this.readyState = 0;
            }

            get onreadystatechange() {
              return this._onreadystatechange;
            }

            set onreadystatechange(handler: Function | null) {
              this._onreadystatechange = handler;
            }

            get onload() {
              return this._onload;
            }

            set onload(handler: Function | null) {
              this._onload = handler;
            }

            get onerror() {
              return this._onerror;
            }

            set onerror(handler: Function | null) {
              this._onerror = handler;
            }

            get ontimeout() {
              return this._ontimeout;
            }

            set ontimeout(handler: Function | null) {
              this._ontimeout = handler;
            }

            get timeout() {
              return this._timeout;
            }

            set timeout(value: number) {
              this._timeout = value;
            }

            private _triggerReadyStateChange() {
              if (this._onreadystatechange) {
                this._onreadystatechange.call(this);
              }
            }
          };
        })();
        (globalThis as any).WebSocket = class {
          constructor() {}
          send() {}
          close() {}
        };
        (globalThis as any).localStorage = {
          getItem: (key: string) => null,
          setItem: (key: string, value: string) => {},
          removeItem: (key: string) => {},
          clear: () => {},
          key: (index: number) => null,
          length: 0,
        };
        (globalThis as any).sessionStorage = {
          getItem: (key: string) => null,
          setItem: (key: string, value: string) => {},
          removeItem: (key: string) => {},
          clear: () => {},
          key: (index: number) => null,
          length: 0,
        };
        
        const originalUnhandledRejection = (globalThis as any).onunhandledrejection;
        (globalThis as any).onunhandledrejection = (event: any) => {
          console.error(`🔍 脚本中未捕获的 Promise 错误:`, event.reason);
          console.error(`🔍 Promise 错误堆栈:`, event.reason?.stack);
          event.preventDefault();
        };
        
        const originalUncaughtException = (globalThis as any).onuncaughtException;
        (globalThis as any).onuncaughtException = (error: any) => {
          console.error(`🔍 脚本中未捕获的异常:`, error);
          console.error(`🔍 异常堆栈:`, error?.stack);
        };
        
        console.log(`🔍 开始执行脚本（直接执行，不包装）`);
        
        try {
          const result = eval(script);
          console.log(`🔍 脚本执行完成，返回值: ${typeof result}`);
          
          if (result instanceof Promise) {
            console.log(`🔍 脚本返回 Promise，等待完成`);
            try {
              await result;
              console.log(`🔍 脚本 Promise 完成`);
            } catch (promiseError) {
              console.error(`🔍 脚本 Promise 执行错误:`, promiseError);
              console.log(`⚠️ 脚本初始化时出现错误，但服务器将继续运行`);
            }
          }
          
          console.log(`🔍 等待 500ms 让所有异步操作完成`);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`🔍 异步操作等待完成`);
        
        console.log(`🔍 检查 lx.send 是否被调用: isInited=${this.lxGlobal['isInited']}`);
        console.log(`🔍 检查注册的音源数量: ${this.lxGlobal.getRegisteredSourceList().length}`);
        
        if (!this.lxGlobal['isInited']) {
          console.warn(`⚠️ 脚本未调用 lx.send('inited', ...)，音源可能未正确注册`);
        }
      } catch (error) {
        console.error(`🔍 脚本执行错误:`, error);
        console.log(`⚠️ 脚本初始化时出现错误，但服务器将继续运行`);
      }
        
        (globalThis as any).onunhandledrejection = originalUnhandledRejection;
        (globalThis as any).onuncaughtException = originalUncaughtException;
        
        console.log(`🔍 检查 lx 对象上的属性:`);
        console.log(`🔍 lx.requestHandler: ${typeof lxObject.requestHandler}`);
        console.log(`🔍 lx.on: ${typeof lxObject.on}`);
        
        if (typeof lxObject.requestHandler === 'function') {
          console.log(`🔍 找到 lx.requestHandler，设置为 events.request`);
          this.lxGlobal.registerRequestHandler(lxObject.requestHandler);
        }
        
        console.log(`🔍 检查 lx 对象上的所有属性:`);
        for (const key in lxObject) {
          if (typeof lxObject[key] === 'function' && key !== 'on' && key !== 'send' && key !== 'request') {
            console.log(`🔍 lx.${key}: ${typeof lxObject[key]}`);
          }
        }
        
        if (originalWindow !== undefined) {
          (globalThis as any).window = originalWindow;
        }
        if (originalDocument !== undefined) {
          (globalThis as any).document = originalDocument;
        }
        if (originalNavigator !== undefined) {
          (globalThis as any).navigator = originalNavigator;
        }
      } finally {
        globalThis.console = originalConsole;
      }
    } catch (error) {
      console.error("脚本执行错误:", error);
      throw error;
    }
  }

  private async handleRequest(data: MusicUrlRequest): Promise<any | null> {
    console.log(`🔍 Sandbox.handleRequest 被调用: source=${data.source}, action=${data.action}`);
    
    try {
      const result = await this.lxGlobal.handleRequest(data);
      return this.validateResponse(result, data.action);
    } catch (error) {
      console.error(`❌ 请求处理错误: ${this.scriptInfo.name}`, error);
      
      // 根据不同的操作类型返回错误响应
      switch (data.action) {
        case 'musicUrl':
          return {
            source: this.getCurrentSource(),
            action: data.action,
            data: {
              type: 'musicUrl',
              url: null,
            },
          };
        case 'lyric':
          return {
            source: this.getCurrentSource(),
            action: data.action,
            data: {
              type: 'lyric',
              lyric: null,
              tlyric: null,
              rlyric: null,
              lxlyric: null,
            },
          };
        case 'pic':
          return {
            source: this.getCurrentSource(),
            action: data.action,
            data: {
              type: 'pic',
              url: null,
            },
          };
        default:
          return null;
      }
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
          data: {
            type: 'pic',
            url: result,
          },
        };

      default:
        return null;
    }
  }

  private getCurrentSource(): string {
    return this.scriptInfo.id;
  }

  async request(request: MusicUrlRequest): Promise<MusicUrlResponse | null> {
    console.log(`🔍 sandbox.request 被调用: ${this.scriptInfo.name}, action=${request.action}`);
    
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

  getRegisteredSourceList(): string[] {
    return this.lxGlobal.getRegisteredSourceList();
  }
}
