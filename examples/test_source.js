/**
 * @name 测试音乐源
 * @description 这是一个测试用的第三方音乐源脚本
 * @author 测试作者
 * @version 1.0.0
 * @homepage https://example.com
 */

const testApi = {
  // 支持的音乐源
  sources: ['kw', 'kg', 'tx', 'wy', 'mg'],

  // 获取音乐URL
  async getMusicUrl(songInfo, type) {
    const { songmid, name, singer } = songInfo;
    
    console.log(`获取音乐URL: ${name} - ${singer}, 音质: ${type}`);
    
    // 返回模拟的音乐URL
    const mockUrl = `https://music.example.com/${songmid}.${type === 'flac' ? 'flac' : 'mp3'}`;
    console.log(`返回模拟URL: ${mockUrl}`);
    
    return {
      type,
      url: mockUrl,
    };
  },

  // 获取歌词
  async getLyric(songInfo) {
    const { songmid } = songInfo;
    
    console.log(`获取歌词: ${songmid}`);
    
    const lyricData = await this.request(
      `https://api.example.com/lyric?songmid=${songmid}`
    );

    return {
      lyric: lyricData.lyric || '',
      tlyric: lyricData.tlyric || '',
      rlyric: lyricData.rlyric || '',
    };
  },

  // 获取封面图
  async getPic(songInfo) {
    const { songmid } = songInfo;
    
    console.log(`获取封面: ${songmid}`);
    
    return `https://api.example.com/pic/${songmid}.jpg`;
  },
};

// 注册请求处理函数
console.log('开始注册请求处理函数...');
lx.on('request', async(data) => {
  console.log(`收到请求: ${data.source} - ${data.action}`);
  
  const { source, action, info } = data;
  
  console.log(`收到请求: ${source} - ${action}`);
  
  try {
    let result;
    
    switch (action) {
      case 'musicUrl':
        result = await testApi.getMusicUrl(info.musicInfo, info.type);
        return result.url;
        
      case 'lyric':
        result = await testApi.getLyric(info.musicInfo);
        return result;
        
      case 'pic':
        console.log(`处理封面请求: ${source}`);
        result = await testApi.getPic(info.musicInfo);
        console.log(`封面结果: ${result}`);
        return result;
        
      default:
        throw new Error(`不支持的 action: ${action}`);
    }
  } catch (error) {
    console.error(`请求处理失败: ${error.message}`);
    throw error;
  }
});

console.log('请求处理函数注册完成');

// 初始化脚本
console.log('开始初始化脚本...');
lx.send('inited', {
  sources: {
    kw: {
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    },
    kg: {
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    },
    tx: {
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    },
    wy: {
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    },
    mg: {
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    },
  },
}).then(() => {
  console.log('测试音乐源初始化成功');
}).catch((error) => {
  console.error('脚本初始化失败:', error);
});
