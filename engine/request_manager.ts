interface RequestOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  timeout: number;
  body?: any;
  form?: Record<string, any>;
  formData?: Record<string, any>;
}

interface Response {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  bytes: number;
  raw: Uint8Array;
  body: any;
}

interface RequestCallback {
  (error: Error | null, response: Response | null, body: any): void;
}

export class RequestManager {
  private activeRequests: Map<string, AbortController> = new Map();
  private proxyConfig: { host: string; port: string } = { host: '', port: '' };

  setProxy(host: string, port: string): void {
    this.proxyConfig = { host, port };
  }

  addRequest(options: RequestOptions, callback?: RequestCallback): void {
    const requestKey = this.generateRequestKey(options);
    
    console.log(`🔍 RequestManager.addRequest 被调用 [${requestKey}]:`, {
      url: options.url,
      method: options.method,
      headers: options.headers,
      hasBody: !!options.body,
      hasForm: !!options.form,
      hasFormData: !!options.formData,
      timeout: options.timeout,
    });
    
    const controller = new AbortController();

    this.activeRequests.set(requestKey, controller);

    this.executeRequest(options, controller.signal, callback, requestKey);
  }

  private async executeRequest(
    options: RequestOptions,
    signal: AbortSignal,
    callback?: RequestCallback,
    requestKey?: string,
    retryCount: number = 0
  ): Promise<void> {
    const startTime = Date.now();

    try {
      let requestBody: string | FormData | undefined;
      let contentType: string | undefined;

      if (options.body) {
        requestBody = typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
        contentType = 'application/json';
      } else if (options.form) {
        requestBody = new URLSearchParams(options.form).toString();
        contentType = 'application/x-www-form-urlencoded';
      } else if (options.formData) {
        const form = new FormData();
        for (const [key, value] of Object.entries(options.formData)) {
          form.append(key, value);
        }
        requestBody = form;
      }

      const headers: Record<string, string> = {
        ...options.headers,
      };

      const requestContentType = contentType || '';

      if (requestContentType && !headers['Content-Type']) {
        headers['Content-Type'] = requestContentType;
      }

      if (this.proxyConfig.host && !this.isLocalUrl(options.url)) {
        const proxyUrl = `http://${this.proxyConfig.host}:${this.proxyConfig.port}`;
        headers['Proxy-Authorization'] = `Basic ${btoa(`${this.proxyConfig.host}:${this.proxyConfig.port}`)}`;
      }

      const fetchOptions: RequestInit = {
        method: options.method.toUpperCase(),
        headers,
        signal,
      };

      if (requestBody) {
        fetchOptions.body = requestBody as BodyInit;
      }

      const response = await fetch(options.url, fetchOptions);
      const responseBody = await response.arrayBuffer();
      const bytes = responseBody.byteLength;

      const rawUint8Array = new Uint8Array(responseBody);
      const rawString = new TextDecoder().decode(responseBody);
      let parsedBody: any = rawString;

      try {
        parsedBody = JSON.parse(rawString);
      } catch (e) {
        parsedBody = rawString;
      }

      const resp: Response = {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bytes,
        raw: rawUint8Array,
        body: parsedBody,
      };

      const duration = Date.now() - startTime;
      console.log(`🌐 请求完成 [${requestKey}]: ${options.method} ${options.url} [${response.status}] ${duration}ms`);
      console.log(`🔍 响应数据 [${requestKey}]:`, {
        statusCode: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyLength: bytes,
        bodyType: typeof parsedBody,
        bodyPreview: typeof parsedBody === 'string' ? parsedBody.substring(0, 100) : JSON.stringify(parsedBody).substring(0, 100),
      });
      console.log(`🔍 原始响应字符串长度 [${requestKey}]: ${rawString.length}`);
      console.log(`🔍 原始响应字符串前200字符 [${requestKey}]: ${rawString.substring(0, 200)}`);

      if (callback) {
        console.log(`🔍 调用回调函数 [${requestKey}]`);
        console.log(`🔍 回调函数参数:`, {
          error: null,
          response: {
            statusCode: resp.statusCode,
            statusMessage: resp.statusMessage,
            headers: resp.headers,
            bytes: resp.bytes,
            rawLength: resp.raw.length,
            bodyType: typeof parsedBody,
            bodyValue: parsedBody,
          },
          body: parsedBody,
        });
        
        try {
          callback(null, resp, parsedBody);
          console.log(`🔍 回调函数执行完成 [${requestKey}]`);
        } catch (callbackError: any) {
          console.error(`❌ 回调函数执行出错 [${requestKey}]:`, callbackError);
          console.error(`❌ 回调函数错误堆栈 [${requestKey}]:`, callbackError.stack);
          throw callbackError;
        }
      } else {
        console.log(`🔍 没有回调函数 [${requestKey}]`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`⏹️ 请求已取消 [${requestKey}]: ${options.url}`);
        if (callback) {
          const errorResponse: Response = {
            statusCode: 0,
            statusMessage: 'Request cancelled',
            headers: {},
            bytes: 0,
            raw: new Uint8Array(0),
            body: null,
          };
          callback(new Error('Request cancelled'), errorResponse, null);
        }
      } else {
        console.error(`❌ 请求失败 [${requestKey}]: ${options.url}`, error.message);
        console.error(`❌ 错误详情 [${requestKey}]:`, error);
        console.error(`❌ 错误堆栈 [${requestKey}]:`, error.stack);
        
        const mirrorUrl = this.getMirrorUrl(options.url);
        if (mirrorUrl && retryCount === 0) {
          console.log(`🔄 尝试使用镜像URL重试: ${mirrorUrl}`);
          const mirroredOptions = { ...options, url: mirrorUrl };
          await this.executeRequest(mirroredOptions, signal, callback, requestKey, retryCount + 1);
        } else {
          if (callback) {
            const errorResponse: Response = {
              statusCode: 0,
              statusMessage: error.message || 'Request failed',
              headers: {},
              bytes: 0,
              raw: new Uint8Array(0),
              body: null,
            };
            console.log(`🔍 调用错误回调函数 [${requestKey}]`);
            callback(error, errorResponse, null);
          }
        }
      }
    }
  }

  cancelRequest(url: string): void {
    for (const [key, controller] of this.activeRequests) {
      if (key.includes(url)) {
        controller.abort();
        this.activeRequests.delete(key);
        console.log(`⏹️ 请求已取消: ${key}`);
      }
    }
  }

  private generateRequestKey(options: RequestOptions): string {
    return `${options.method}_${options.url}_${Date.now()}`;
  }

  private getMirrorUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname === 'registry.npmjs.org') {
        const mirrorUrl = new URL(url);
        mirrorUrl.hostname = 'registry.npmmirror.com';
        console.log(`🔄 检测到 npm registry，使用镜像: ${mirrorUrl.toString()}`);
        return mirrorUrl.toString();
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private isLocalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['localhost', '127.0.0.1', '::1'].includes(urlObj.hostname) ||
             urlObj.hostname.startsWith('192.168.') ||
             urlObj.hostname.startsWith('10.') ||
             urlObj.hostname.endsWith('.local');
    } catch {
      return false;
    }
  }

  async clearAllRequests(): Promise<void> {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
}
