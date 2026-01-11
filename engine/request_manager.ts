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
    const controller = new AbortController();
    const requestKey = this.generateRequestKey(options);

    this.activeRequests.set(requestKey, controller);

    this.executeRequest(options, controller.signal, callback);
  }

  private async executeRequest(
    options: RequestOptions,
    signal: AbortSignal,
    callback?: RequestCallback
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

      let parsedBody: any = responseBody;
      const responseContentType = response.headers.get('Content-Type') || '';

      try {
        if (responseContentType.includes('application/json')) {
          parsedBody = JSON.parse(new TextDecoder().decode(responseBody));
        } else if (responseContentType.includes('text/')) {
          parsedBody = new TextDecoder().decode(responseBody);
        }
      } catch (e) {
        parsedBody = new TextDecoder().decode(responseBody);
      }

      const resp: Response = {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bytes,
        raw: new Uint8Array(responseBody),
        body: parsedBody,
      };

      const duration = Date.now() - startTime;
      console.log(`🌐 请求完成: ${options.method} ${options.url} [${response.status}] ${duration}ms`);

      if (callback) {
        callback(null, resp, parsedBody);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`⏹️ 请求已取消: ${options.url}`);
        if (callback) {
          callback(new Error('Request cancelled'), null, null);
        }
      } else {
        console.error(`❌ 请求失败: ${options.url}`, error.message);
        if (callback) {
          callback(error, null, null);
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
