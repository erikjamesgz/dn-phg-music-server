const log = (message: string, ...args: any[]) => {
  console.log(`[SearchService] ${message}`, ...args);
};

// MD5 实现 - 用于咪咕音乐签名
function md5(text: string): string {
  // 基于 https://github.com/blueimp/JavaScript-MD5 的简化实现
  const safeAdd = (x: number, y: number): number => {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  };

  const bitRotateLeft = (num: number, cnt: number): number => {
    return (num << cnt) | (num >>> (32 - cnt));
  };

  const md5cmn = (q: number, a: number, b: number, x: number, s: number, t: number): number => {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  };

  const md5ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  };

  const md5gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  };

  const md5hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  };

  const md5ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  };

  const binlMD5 = (x: number[], len: number): number[] => {
    x[len >> 5] |= 0x80 << len % 32;
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;

    for (let i = 0; i < x.length; i += 16) {
      const olda = a;
      const oldb = b;
      const oldc = c;
      const oldd = d;

      a = md5ff(a, b, c, d, x[i], 7, -680876936);
      d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
      b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

      a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = md5gg(b, c, d, a, x[i], 20, -373897302);
      a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

      a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
      d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = md5hh(d, a, b, c, x[i], 11, -358537222);
      c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

      a = md5ii(a, b, c, d, x[i], 6, -198630844);
      d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

      a = safeAdd(a, olda);
      b = safeAdd(b, oldb);
      c = safeAdd(c, oldc);
      d = safeAdd(d, oldd);
    }

    return [a, b, c, d];
  };

  const rstr2hex = (input: string): string => {
    const hexTab = '0123456789abcdef';
    let output = '';
    for (let i = 0; i < input.length; i++) {
      const x = input.charCodeAt(i);
      output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f);
    }
    return output;
  };

  const str2rstrUTF8 = (input: string): string => {
    return decodeURIComponent(encodeURIComponent(input));
  };

  const rstr2binl = (input: string): number[] => {
    const output: number[] = [];
    for (let i = 0; i < input.length * 8; i += 8) {
      output[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << i % 32;
    }
    return output;
  };

  const binl2rstr = (input: number[]): string => {
    let output = '';
    for (let i = 0; i < input.length * 32; i += 8) {
      output += String.fromCharCode((input[i >> 5] >>> i % 32) & 0xff);
    }
    return output;
  };

  return rstr2hex(binl2rstr(binlMD5(rstr2binl(str2rstrUTF8(text)), text.length * 8)));
}

interface MusicInfo {
  id?: string;
  name?: string;
  singer?: string;
  album?: string;
  source?: string;
  interval?: number;
  duration?: number;
  hash?: string;
  songmid?: string;
  songId?: string;
  FileHash?: string;
  artistids?: string[];
  albumid?: string;
  singerid?: string[];
  copyrightId?: string;
  lrcUrl?: string;
  mrcUrl?: string;
  trcUrl?: string;
  img?: string | null;
}

interface SearchResult {
  id: string;
  name: string;
  singer: string;
  album: string;
  source: string;
  interval: number;
  hash: string;
  musicInfo: MusicInfo;
}

interface SearchResponse {
  platform: string;
  name: string;
  keyword: string;
  page: number;
  results: SearchResult[];
  error?: string;
}

export class SearchService {
  private platforms = {
    kw: { name: '酷我音乐', enabled: true },
    kg: { name: '酷狗音乐', enabled: true },
    tx: { name: 'QQ音乐', enabled: true },
    wy: { name: '网易云音乐', enabled: true },
    mg: { name: '咪咕音乐', enabled: true }
  };

  getSupportedPlatforms() {
    return Object.entries(this.platforms).map(([id, info]) => ({
      id,
      name: info.name,
      enabled: info.enabled
    }));
  }

  async searchKw(keyword: string, page = 1, limit = 20): Promise<SearchResponse> {
    try {
      log('[Search] Searching Kuwo Music for:', keyword);
      
      const url = `http://search.kuwo.cn/r.s`;
      const params = new URLSearchParams({
        client: 'kt',
        all: encodeURIComponent(keyword),
        pn: (page - 1).toString(),
        rn: limit.toString(),
        uid: '794762570',
        ver: 'kwplayer_ar_9.2.2.1',
        vipver: '1',
        show_copyright_off: '1',
        newver: '1',
        ft: 'music',
        cluster: '0',
        strategy: '2012',
        encoding: 'utf8',
        rformat: 'json',
        vermerge: '1',
        mobi: '1',
        issubtitle: '1'
      });
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `http://search.kuwo.cn/`,
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      
      const data = await response.json();
      
      if (!data || (data.TOTAL !== '0' && data.SHOW === '0')) {
        return {
          platform: 'kw',
          name: '酷我音乐',
          keyword,
          page,
          results: []
        };
      }
      
      const results: SearchResult[] = (data.abslist || []).map((item: any) => {
        const songId = item.MUSICRID?.replace('MUSIC_', '') || item.SONGID;
        return {
          id: songId,
          name: item.SONGNAME,
          singer: item.ARTIST,
          album: item.ALBUM,
          source: 'kw',
          interval: parseInt(item.DURATION) || 0,
          hash: songId,
          musicInfo: {
            id: songId,
            name: item.SONGNAME,
            singer: item.ARTIST,
            album: item.ALBUM,
            duration: parseInt(item.DURATION) || 0,
            interval: parseInt(item.DURATION) || 0,
            songmid: songId,
            hash: songId,
            albumid: item.ALBUMID
          }
        };
      });
      
      return {
        platform: 'kw',
        name: '酷我音乐',
        keyword,
        page,
        results
      };
    } catch (error: any) {
      log('[Search] Kuwo Music search error:', error);
      return {
        platform: 'kw',
        name: '酷我音乐',
        keyword,
        page,
        results: [],
        error: error.message
      };
    }
  }

  async searchKg(keyword: string, page = 1, limit = 20): Promise<SearchResponse> {
    try {
      log('[Search] Searching Kugou Music for:', keyword);
      
      const url = `https://mobiles.kugou.com/api/v3/search/song`;
      const params = new URLSearchParams({
        format: 'json',
        keyword: keyword,
        page: page.toString(),
        pagesize: limit.toString(),
        showtype: '1'
      });
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.kugou.com/',
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      
      const data = await response.json();
      
      if (!data || !data.data || !data.data.info) {
        return {
          platform: 'kg',
          name: '酷狗音乐',
          keyword,
          page,
          results: []
        };
      }
      
      const results: SearchResult[] = data.data.info.map((item: any) => {
        return {
          id: item.hash,
          name: item.songname,
          singer: item.singername,
          album: item.album_name || '',
          source: 'kg',
          interval: item.duration || 0,
          hash: item.hash,
          musicInfo: {
            id: item.hash,
            name: item.songname,
            singer: item.singername,
            album: item.album_name || '',
            duration: item.duration || 0,
            interval: item.duration || 0,
            hash: item.hash,
            songmid: item.hash,
            FileHash: item.hash,
            albumid: item.album_id
          }
        };
      });
      
      return {
        platform: 'kg',
        name: '酷狗音乐',
        keyword,
        page,
        results
      };
    } catch (error: any) {
      log('[Search] Kugou Music search error:', error);
      return {
        platform: 'kg',
        name: '酷狗音乐',
        keyword,
        page,
        results: [],
        error: error.message
      };
    }
  }

  async searchTx(keyword: string, page = 1, limit = 20): Promise<SearchResponse> {
    try {
      log('[Search] Searching QQ Music for:', keyword);
      
      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg`;
      const requestBody = {
        comm: {
          ct: '19',
          cv: '1859',
          uin: '0',
        },
        req: {
          module: 'music.search.SearchCgiService',
          method: 'DoSearchForQQMusicDesktop',
          param: {
            num_per_page: limit,
            page_num: page,
            query: keyword,
            search_type: 0,
          },
        },
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://y.qq.com/',
          'Accept': 'application/json',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (!data || data.code !== 0 || !data.req || !data.req.data || !data.req.data.body || !data.req.data.body.song || !data.req.data.body.song.list) {
        return {
          platform: 'tx',
          name: 'QQ音乐',
          keyword,
          page,
          results: []
        };
      }
      
      const results: SearchResult[] = data.req.data.body.song.list.map((item: any) => {
        const songmid = item.mid;
        const songId = item.id;
        return {
          id: songmid,
          name: item.title,
          singer: item.singer.map((s: any) => s.name).join(','),
          album: item.album.name,
          source: 'tx',
          interval: item.interval || 0,
          hash: songmid,
          musicInfo: {
            id: songId,
            name: item.title,
            singer: item.singer.map((s: any) => s.name).join(','),
            album: item.album.name,
            duration: item.interval || 0,
            interval: item.interval || 0,
            songmid: songmid,
            songId: songmid,
            hash: songmid,
            albumid: item.album.id
          }
        };
      });
      
      return {
        platform: 'tx',
        name: 'QQ音乐',
        keyword,
        page,
        results
      };
    } catch (error: any) {
      log('[Search] QQ Music search error:', error);
      return {
        platform: 'tx',
        name: 'QQ音乐',
        keyword,
        page,
        results: [],
        error: error.message
      };
    }
  }

  async searchWy(keyword: string, page = 1, limit = 20): Promise<SearchResponse> {
    try {
      log('[Search] Searching Netease Music for:', keyword);
      
      const url = `https://music.163.com/api/search/get`;
      const params = new URLSearchParams({
        s: keyword,
        type: '1',
        offset: ((page - 1) * limit).toString(),
        limit: limit.toString(),
        csrf_token: ''
      });
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://music.163.com/',
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      
      const data = await response.json();
      
      if (!data || !data.result || !data.result.songs) {
        return {
          platform: 'wy',
          name: '网易云音乐',
          keyword,
          page,
          results: []
        };
      }
      
      const results: SearchResult[] = data.result.songs.map((item: any) => {
        const songId = item.id.toString();
        return {
          id: songId,
          name: item.name,
          singer: item.artists.map((a: any) => a.name).join(','),
          album: item.album.name,
          source: 'wy',
          interval: Math.floor(item.duration / 1000) || 0,
          hash: songId,
          musicInfo: {
            id: songId,
            name: item.name,
            singer: item.artists.map((a: any) => a.name).join(','),
            album: item.album.name,
            duration: Math.floor(item.duration / 1000) || 0,
            interval: Math.floor(item.duration / 1000) || 0,
            songmid: songId,
            songId: songId,
            hash: songId,
            albumid: item.album.id?.toString()
          }
        };
      });
      
      return {
        platform: 'wy',
        name: '网易云音乐',
        keyword,
        page,
        results
      };
    } catch (error: any) {
      log('[Search] Netease Music search error:', error);
      return {
        platform: 'wy',
        name: '网易云音乐',
        keyword,
        page,
        results: [],
        error: error.message
      };
    }
  }

  async searchMg(keyword: string, page = 1, limit = 20): Promise<SearchResponse> {
    try {
      log('[Search] Searching Migu Music for:', keyword);

      // 使用旧版 API，支持中文搜索
      const url = `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do`;
      const queryParams = new URLSearchParams({
        isCopyright: '1',
        isCorrect: '1',
        pageNo: page.toString(),
        pageSize: limit.toString(),
        searchSwitch: '{"song":1,"album":0,"singer":0,"tagSong":0,"mvSong":0,"songlist":0,"bestShow":0}',
        sort: '0',
        text: keyword
      });

      log('[Search] Migu Music request URL:', `${url}?${queryParams.toString()}`);

      const response = await fetch(`${url}?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      log('[Search] Migu Music response code:', data?.code);
      log('[Search] Migu Music response info:', data?.info);
      log('[Search] Migu Music has songResultData:', !!data?.songResultData);

      // 检查响应状态码
      if (!data || data.code !== '000000') {
        log('[Search] Migu Music API error:', data?.info || '未知错误');
        return {
          platform: 'mg',
          name: '咪咕音乐',
          keyword,
          page,
          results: [],
          error: data?.info || '搜索失败'
        };
      }

      const songResultData = data.songResultData || { resultList: [], totalCount: 0 };
      log('[Search] Migu Music resultList length:', songResultData.resultList?.length || 0);
      
      const results: SearchResult[] = [];
      const ids = new Set();
      
      // 处理搜索结果 - 与桌面版 filterData 逻辑一致
      songResultData.resultList?.forEach((item: any) => {
        // 确保 item 是数组
        const items = Array.isArray(item) ? item : [item];
        items.forEach((song: any) => {
          // 旧版 API 使用 id 而不是 songId
          const songId = song.id || song.songId;
          if (!songId || !song.copyrightId || ids.has(song.copyrightId)) return;
          ids.add(song.copyrightId);
          
          const copyrightId = song.copyrightId;
          const singer = song.singers ? song.singers.map((s: any) => s.name).join('、') : '';
          
          // 处理图片 URL - 旧版 API 使用 imgItems
          let img = null;
          if (song.imgItems && song.imgItems.length > 0) {
            // 使用最大的图片
            const imgItem = song.imgItems.find((i: any) => i.imgSizeType === '03') || 
                           song.imgItems.find((i: any) => i.imgSizeType === '02') || 
                           song.imgItems[0];
            img = imgItem?.img;
          }
          
          results.push({
            id: copyrightId,
            name: song.name,
            singer: singer,
            album: song.albums?.[0]?.name || '',
            source: 'mg',
            interval: Math.floor((song.length || 0) / 1000),
            hash: copyrightId,
            musicInfo: {
              copyrightId: copyrightId,
              id: copyrightId,
              name: song.name,
              singer: singer,
              album: song.albums?.[0]?.name || '',
              duration: Math.floor((song.length || 0) / 1000),
              interval: Math.floor((song.length || 0) / 1000),
              songmid: songId,
              hash: copyrightId,
              lrcUrl: song.lyricUrl,
              mrcUrl: song.mrcurl,
              trcUrl: song.trcUrl,
              img: img
            }
          });
        });
      });
      
      return {
        platform: 'mg',
        name: '咪咕音乐',
        keyword,
        page,
        results
      };
    } catch (error: any) {
      log('[Search] Migu Music search error:', error);
      return {
        platform: 'mg',
        name: '咪咕音乐',
        keyword,
        page,
        results: [],
        error: error.message
      };
    }
  }

  async search(keyword: string, source?: string, page = 1, limit = 20): Promise<SearchResponse[]> {
    const sources = source ? [source] : Object.keys(this.platforms);
    const results: SearchResponse[] = [];
    
    for (const src of sources) {
      if (!this.platforms[src as keyof typeof this.platforms]?.enabled) {
        continue;
      }
      
      let result: SearchResponse;
      switch (src) {
        case 'kw':
          result = await this.searchKw(keyword, page, limit);
          break;
        case 'kg':
          result = await this.searchKg(keyword, page, limit);
          break;
        case 'tx':
          result = await this.searchTx(keyword, page, limit);
          break;
        case 'wy':
          result = await this.searchWy(keyword, page, limit);
          break;
        case 'mg':
          result = await this.searchMg(keyword, page, limit);
          break;
        default:
          continue;
      }
      
      results.push(result);
    }
    
    return results;
  }
}
