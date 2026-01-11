interface LXMusicInfo {
  id: string;
  name: string;
  singer: string;
  albumName?: string;
  songmid: string;
  source: string;
}

interface SourceQuality {
  type: string;
  actions: string[];
  qualitys: string[];
}

interface APIConfig {
  serverUrl: string;
  apiId?: string;
  timeout?: number;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  body?: any;
  form?: Record<string, any>;
  formData?: Record<string, any>;
}

interface LXRequestResult {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  bytes: number;
  raw: Uint8Array;
  body: any;
}

export class LXMusicClientAdapter {
  private serverUrl: string;
  private apiId: string | null;
  private timeout: number;
  private sources: Map<string, SourceQuality> = new Map();
  private isInitialized: boolean = false;

  constructor(config: APIConfig) {
    this.serverUrl = config.serverUrl.replace(/\/$/, '');
    this.apiId = config.apiId || null;
    this.timeout = config.timeout || 30000;
  }

  async initialize(): Promise<boolean> {
    try {
      const statusRes = await this.request('/api/status', { method: 'GET' });
      console.log('✅ 后台服务连接成功:', statusRes.body);
      
      if (this.apiId) {
        const scriptRes = await this.request(`/api/scripts/${this.apiId}`, { method: 'GET' });
        if (scriptRes.statusCode === 200) {
          this.sources = this.parseSources(scriptRes.body);
        }
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ 后台服务连接失败:', error);
      return false;
    }
  }

  private parseSources(apiInfo: any): Map<string, SourceQuality> {
    const sources = new Map<string, SourceQuality>();

    if (apiInfo.sources) {
      for (const [source, info] of Object.entries(apiInfo.sources)) {
        sources.set(source, info as SourceQuality);
      }
    }

    return sources;
  }

  async loadScript(scriptContent: string): Promise<boolean> {
    try {
      const importRes = await this.request('/api/scripts', {
        method: 'POST',
        body: { script: scriptContent },
      });

      if (importRes.statusCode === 200 && importRes.body.loaded) {
        const apiInfo = importRes.body.apiInfo;
        this.apiId = apiInfo.id;
        console.log(`✅ 脚本加载成功: ${apiInfo.name}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ 脚本加载失败:', error);
      return false;
    }
  }

  async getMusicUrl(
    musicInfo: LXMusicInfo,
    quality: string
  ): Promise<{ url: string; type: string } | null> {
    if (!this.apiId) {
      throw new Error('未加载任何音源脚本');
    }

    try {
      const requestKey = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const response = await this.request('/api/request', {
        method: 'POST',
        body: {
          requestKey,
          data: {
            source: musicInfo.source,
            action: 'musicUrl',
            info: {
              type: quality,
              musicInfo: {
                id: musicInfo.id,
                name: musicInfo.name,
                singer: musicInfo.singer,
                albumName: musicInfo.albumName,
                songmid: musicInfo.songmid,
                source: musicInfo.source,
              },
            },
          },
        },
        timeout: this.timeout,
      });

      if (response.statusCode === 200 && response.body.status) {
        return response.body.data.result;
      }

      throw new Error(response.body.message || '获取音乐URL失败');
    } catch (error) {
      console.error(`❌ 获取音乐URL失败 [${musicInfo.source}]:`, error);
      return null;
    }
  }

  async getLyric(musicInfo: LXMusicInfo): Promise<{
    lyric: string;
    tlyric?: string;
    rlyric?: string;
    lxlyric?: string;
  } | null> {
    if (!this.apiId) {
      throw new Error('未加载任何音源脚本');
    }

    try {
      const requestKey = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const response = await this.request('/api/request', {
        method: 'POST',
        body: {
          requestKey,
          data: {
            source: musicInfo.source,
            action: 'lyric',
            info: {
              musicInfo: {
                id: musicInfo.id,
                name: musicInfo.name,
                singer: musicInfo.singer,
                songmid: musicInfo.songmid,
                source: musicInfo.source,
              },
            },
          },
        },
        timeout: this.timeout,
      });

      if (response.statusCode === 200 && response.body.status) {
        return response.body.data.result;
      }

      throw new Error(response.body.message || '获取歌词失败');
    } catch (error) {
      console.error(`❌ 获取歌词失败 [${musicInfo.source}]:`, error);
      return null;
    }
  }

  async getPic(musicInfo: LXMusicInfo): Promise<string | null> {
    if (!this.apiId) {
      throw new Error('未加载任何音源脚本');
    }

    try {
      const requestKey = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const response = await this.request('/api/request', {
        method: 'POST',
        body: {
          requestKey,
          data: {
            source: musicInfo.source,
            action: 'pic',
            info: {
              musicInfo: {
                id: musicInfo.id,
                name: musicInfo.name,
                singer: musicInfo.singer,
                songmid: musicInfo.songmid,
                source: musicInfo.source,
              },
            },
          },
        },
        timeout: this.timeout,
      });

      if (response.statusCode === 200 && response.body.status) {
        return response.body.data.result;
      }

      throw new Error(response.body.message || '获取图片URL失败');
    } catch (error) {
      console.error(`❌ 获取图片URL失败 [${musicInfo.source}]:`, error);
      return null;
    }
  }

  private async request(
    path: string,
    options: RequestOptions = {}
  ): Promise<LXRequestResult> {
    const url = `${this.serverUrl}${path}`;
    const method = options.method || 'GET';
    const timeout = options.timeout || this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      let body: BodyInit | undefined;

      if (options.body) {
        body = JSON.stringify(options.body);
      } else if (options.form) {
        body = new URLSearchParams(options.form).toString();
      } else if (options.formData) {
        const form = new FormData();
        for (const [key, value] of Object.entries(options.formData)) {
          form.append(key, value);
        }
        body = form;
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('Content-Type') || '';
      let responseBody: any = response.body;

      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else if (contentType.includes('text/')) {
        responseBody = await response.text();
      }

      return {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bytes: 0,
        raw: new Uint8Array(),
        body: responseBody,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`);
      }

      throw error;
    }
  }

  getSources(): Map<string, SourceQuality> {
    return this.sources;
  }

  getApiId(): string | null {
    return this.apiId;
  }

  isReady(): boolean {
    return this.isInitialized && this.apiId !== null;
  }

  async listScripts(): Promise<any[]> {
    try {
      const response = await this.request('/api/scripts', { method: 'GET' });
      if (response.statusCode === 200) {
        return response.body;
      }
      return [];
    } catch (error) {
      console.error('❌ 获取脚本列表失败:', error);
      return [];
    }
  }

  async removeScript(scriptId: string): Promise<boolean> {
    try {
      const response = await this.request(`/api/scripts/${scriptId}`, {
        method: 'DELETE',
      });
      return response.statusCode === 200 && response.body.success;
    } catch (error) {
      console.error('❌ 删除脚本失败:', error);
      return false;
    }
  }

  async cancelRequest(requestKey: string): Promise<void> {
    try {
      await this.request(`/api/request/${requestKey}`, { method: 'DELETE' });
    } catch (error) {
      console.warn('取消请求失败:', error);
    }
  }

  getStatus(): any {
    return this.request('/api/status', { method: 'GET' })
      .then(res => res.body)
      .catch(() => null);
  }
}

export function createLXMusicAdapter(config: APIConfig): LXMusicClientAdapter {
  return new LXMusicClientAdapter(config);
}
