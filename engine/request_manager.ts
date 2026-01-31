import { type BodyData } from "node:crypto";
import { HttpsProxyAgent } from "npm:https-proxy-agent";
import { HttpProxyAgent } from "npm:http-proxy-agent";

export const requestMsg = {
  fail: '请求异常😮，可以多试几次，若还是不行就换一首吧。。。',
  unachievable: '哦No😱...接口无法访问了！',
  timeout: '请求超时',
  notConnectNetwork: '无法连接到服务器',
  cancelRequest: '取消http请求',
} as const;

interface RequestOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  timeout: number;
  body?: any;
  form?: Record<string, any>;
  formData?: Record<string, any>;
  agent?: any;
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

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';

const httpsRxp = /^https:/;

export class RequestManager {
  private activeRequests: Map<string, AbortController> = new Map();
  private proxyHost: string | null = null;
  private proxyPort: number | null = null;

  setProxy(host: string, port: number): void {
    this.proxyHost = host;
    this.proxyPort = port;
  }

  private getRequestAgent(url: string): any {
    if (this.proxyHost && this.proxyPort) {
      const proxyOptions = {
        host: this.proxyHost,
        port: this.proxyPort,
      };
      return httpsRxp.test(url) ? new HttpsProxyAgent(`http://${this.proxyHost}:${this.proxyPort}`) : new HttpProxyAgent(`http://${this.proxyHost}:${this.proxyPort}`);
    }
    return undefined;
  }

  addRequest(options: RequestOptions, callback?: RequestCallback): void {
    const requestKey = this.generateRequestKey(options);
    const controller = new AbortController();

    this.activeRequests.set(requestKey, controller);

    this.executeRequest(options, controller.signal, callback, requestKey);
  }

  private async executeRequest(
    options: RequestOptions,
    signal: AbortSignal,
    callback?: RequestCallback,
    requestKey?: string
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
        'User-Agent': DEFAULT_USER_AGENT,
        ...options.headers,
      };

      if (contentType && !headers['Content-Type']) {
        headers['Content-Type'] = contentType;
      }

      const fetchOptions: RequestInit = {
        method: options.method.toUpperCase(),
        headers,
        signal,
      };

      if (requestBody) {
        fetchOptions.body = requestBody as BodyInit;
      }

      const agent = options.agent || this.getRequestAgent(options.url);
      if (agent) {
        (fetchOptions as any).agent = agent;
      }

      const response = await fetch(options.url, fetchOptions);
      const responseBody = await response.arrayBuffer();
      const bytes = responseBody.byteLength;

      const rawUint8Array = new Uint8Array(responseBody);
      const rawString = new TextDecoder().decode(responseBody);
      
      let body: any = rawString;

      try {
        body = JSON.parse(rawString);
      } catch (e) {
        body = rawString;
      }

      const resp: Response = {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bytes,
        raw: rawUint8Array,
        body: body,
      };

      if (callback) {
        try {
          callback(null, resp, body);
        } catch (callbackError: any) {
          throw callbackError;
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (callback) {
          const errorResponse: Response = {
            statusCode: 0,
            statusMessage: 'Request cancelled',
            headers: {},
            bytes: 0,
            raw: new Uint8Array(0),
            body: null,
          };
          callback(new Error(requestMsg.cancelRequest), errorResponse, null);
        }
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
          callback(error, errorResponse, null);
        }
      }
    }
  }

  cancelRequest(url: string): void {
    for (const [key, controller] of this.activeRequests) {
      if (key.includes(url)) {
        controller.abort();
        this.activeRequests.delete(key);
      }
    }
  }

  private generateRequestKey(options: RequestOptions): string {
    return `${options.method}_${options.url}_${Date.now()}`;
  }

  async clearAllRequests(): Promise<void> {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
}
