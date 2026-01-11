/**
 * 洛雪音乐代理适配器
 * 
 * 此脚本用于拦截洛雪音乐的 userApi 请求，
 * 并将其转发到 Deno Deploy 后台服务器
 * 
 * 使用方法:
 * 1. 在洛雪音乐中打开开发者工具
 * 2. 粘贴此脚本到控制台执行
 * 3. 配置后台服务器地址
 */

// 洛雪音乐代理适配器配置
const PROXY_CONFIG = {
  serverUrl: 'http://localhost:8080', // Deno Deploy 后台地址
  apiId: null, // 可选，指定使用的音源ID
  timeout: 20000,
  enabled: true,
};

// 当前加载的音源信息
let currentApiInfo = null;
let requestQueue = new Map();

// 拦截并重写 lx.request
const originalRequest = lx.request;
lx.request = function(url, options = {}, callback) {
  if (!PROXY_CONFIG.enabled) {
    return originalRequest.call(this, url, options, callback);
  }

  const requestKey = `proxy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  // 转发请求到后台
  fetch(`${PROXY_CONFIG.serverUrl}/api/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestKey,
      data: {
        source: 'proxy',
        action: 'customRequest',
        info: {
          url,
          options: {
            method: options.method || 'get',
            timeout: options.timeout,
            headers: options.headers,
            body: options.body,
            form: options.form,
            formData: options.formData,
          },
        },
      },
    }),
  })
    .then(resp => resp.json())
    .then(data => {
      if (data.status && data.data) {
        const response = data.data.result;
        if (callback) {
          callback.call(this, null, {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            bytes: 0,
            raw: null,
            body: response.body,
          }, response.body);
        }
      } else {
        if (callback) {
          callback.call(this, new Error(data.message || 'Request failed'), null, null);
        }
      }
    })
    .catch(err => {
      console.error('代理请求失败:', err);
      if (callback) {
        callback.call(this, err, null, null);
      }
    });

  // 返回取消函数
  return () => {
    fetch(`${PROXY_CONFIG.serverUrl}/api/request/${requestKey}`, {
      method: 'DELETE',
    });
  };
};

// 代理适配器 API
const LXMUSIC_PROXY = {
  // 初始化连接
  async connect(serverUrl = PROXY_CONFIG.serverUrl) {
    PROXY_CONFIG.serverUrl = serverUrl.replace(/\/$/, '');
    
    try {
      const statusRes = await fetch(`${PROXY_CONFIG.serverUrl}/api/status`);
      const status = await statusRes.json();
      
      if (status.scriptCount !== undefined) {
        console.log('✅ 后台连接成功');
        console.log(`   已加载脚本: ${status.scriptCount}`);
        console.log(`   运行时间: ${Math.floor(status.uptime / 60)}分钟`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ 后台连接失败:', error.message);
      return false;
    }
  },

  // 加载脚本
  async loadScript(scriptContent) {
    try {
      const res = await fetch(`${PROXY_CONFIG.serverUrl}/api/scripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script: scriptContent }),
      });
      
      const data = await res.json();
      
      if (data.loaded) {
        currentApiInfo = data.apiInfo;
        PROXY_CONFIG.apiId = data.apiInfo.id;
        console.log(`✅ 脚本加载成功: ${data.apiInfo.name}`);
        return data.apiInfo;
      }
      
      throw new Error(data.error || '加载失败');
    } catch (error) {
      console.error('❌ 脚本加载失败:', error.message);
      throw error;
    }
  },

  // 获取音乐URL
  async getMusicUrl(musicInfo, quality) {
    if (!currentApiInfo) {
      throw new Error('请先加载音源脚本');
    }

    const requestKey = `music_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const res = await fetch(`${PROXY_CONFIG.serverUrl}/api/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestKey,
          data: {
            source: musicInfo.source,
            action: 'musicUrl',
            info: {
              type: quality,
              musicInfo: {
                id: musicInfo.id || musicInfo.songmid,
                name: musicInfo.name,
                singer: musicInfo.singer,
                albumName: musicInfo.albumName,
                songmid: musicInfo.songmid,
                source: musicInfo.source,
              },
            },
          },
        }),
      });

      const data = await res.json();

      if (data.status) {
        return {
          type: data.data.result.type,
          url: data.data.result.url,
        };
      }

      throw new Error(data.message || '获取失败');
    } catch (error) {
      console.error('❌ 获取音乐URL失败:', error.message);
      throw error;
    }
  },

  // 获取歌词
  async getLyric(musicInfo) {
    if (!currentApiInfo) {
      throw new Error('请先加载音源脚本');
    }

    const requestKey = `lyric_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const res = await fetch(`${PROXY_CONFIG.serverUrl}/api/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestKey,
          data: {
            source: musicInfo.source,
            action: 'lyric',
            info: {
              musicInfo: {
                id: musicInfo.id || musicInfo.songmid,
                name: musicInfo.name,
                singer: musicInfo.singer,
                songmid: musicInfo.songmid,
                source: musicInfo.source,
              },
            },
          },
        }),
      });

      const data = await res.json();

      if (data.status) {
        return data.data.result;
      }

      throw new Error(data.message || '获取失败');
    } catch (error) {
      console.error('❌ 获取歌词失败:', error.message);
      throw error;
    }
  },

  // 获取封面图
  async getPic(musicInfo) {
    if (!currentApiInfo) {
      throw new Error('请先加载音源脚本');
    }

    const requestKey = `pic_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const res = await fetch(`${PROXY_CONFIG.serverUrl}/api/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestKey,
          data: {
            source: musicInfo.source,
            action: 'pic',
            info: {
              musicInfo: {
                id: musicInfo.id || musicInfo.songmid,
                name: musicInfo.name,
                singer: musicInfo.singer,
                songmid: musicInfo.songmid,
                source: musicInfo.source,
              },
            },
          },
        }),
      });

      const data = await res.json();

      if (data.status) {
        return data.data.result;
      }

      throw new Error(data.message || '获取失败');
    } catch (error) {
      console.error('❌ 获取封面图失败:', error.message);
      throw error;
    }
  },

  // 列出所有脚本
  async listScripts() {
    try {
      const res = await fetch(`${PROXY_CONFIG.serverUrl}/api/scripts`);
      return await res.json();
    } catch (error) {
      console.error('❌ 获取脚本列表失败:', error.message);
      return [];
    }
  },

  // 获取后台状态
  async getStatus() {
    try {
      const res = await fetch(`${PROXY_CONFIG.serverUrl}/api/status`);
      return await res.json();
    } catch (error) {
      console.error('❌ 获取状态失败:', error.message);
      return null;
    }
  },

  // 设置启用/禁用
  setEnabled(enabled) {
    PROXY_CONFIG.enabled = enabled;
    console.log(`代理已${enabled ? '启用' : '禁用'}`);
  },

  // 获取当前配置
  getConfig() {
    return { ...PROXY_CONFIG, currentApiInfo };
  },
};

// 导出到全局
window.LXMUSIC_PROXY = LXMUSIC_PROXY;

console.log(`
🎵 洛雪音乐代理适配器已加载

使用方法:
1. LXMUSIC_PROXY.connect('http://localhost:8080') - 连接到后台
2. LXMUSIC_PROXY.loadScript(scriptContent) - 加载音源脚本
3. LXMUSIC_PROXY.getMusicUrl(musicInfo, quality) - 获取音乐URL
4. LXMUSIC_PROXY.getLyric(musicInfo) - 获取歌词
5. LXMUSIC_PROXY.getPic(musicInfo) - 获取封面图

当前配置: ${JSON.stringify(LXMUSIC_PROXY.getConfig(), null, 2)}
`);
