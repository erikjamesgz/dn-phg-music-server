// 歌词服务 - 支持多平台歌词获取
// 改编自 lx-music-desktop 桌面版实现

// 简单的日志对象
const log = {
  info: (...args: any[]) => console.log("[LyricService:INFO]", ...args),
  debug: (...args: any[]) => console.log("[LyricService:DEBUG]", ...args),
  error: (...args: any[]) => console.error("[LyricService:ERROR]", ...args),
};

// 音乐信息接口
interface MusicInfo {
  source: string;
  songId?: string;
  songmid?: string;
  hash?: string;
  name?: string;
  singer?: string;
  interval?: number;
  copyrightId?: string;
  lrcUrl?: string;
  mrcUrl?: string;
  trcUrl?: string;
}

// 歌词结果接口
interface LyricResult {
  lyric: string;
  tlyric?: string;
  rlyric?: string;
  lxlyric?: string;
}

// base64 编码
function encodeBase64(data: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  while (i < data.length) {
    const byte1 = data[i++];
    const byte2 = i < data.length ? data[i++] : 0;
    const byte3 = i < data.length ? data[i++] : 0;
    const bitmap = (byte1 << 16) | (byte2 << 8) | byte3;
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < data.length ? chars.charAt((bitmap >> 6) & 63) : "=";
    result += i - 1 < data.length ? chars.charAt(bitmap & 63) : "=";
  }
  return btoa(String.fromCharCode(...data));
}

// base64 解码
function decodeBase64(str: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup: { [key: string]: number } = {};
  for (let i = 0; i < chars.length; i++) {
    lookup[chars[i]] = i;
  }

  const len = str.length;
  const bytes: number[] = [];
  let i = 0;

  while (i < len) {
    const c1 = lookup[str[i++]];
    const c2 = lookup[str[i++]];
    const c3 = str[i] === "=" ? 0 : lookup[str[i++]];
    const c4 = str[i] === "=" ? 0 : lookup[str[i++]];

    bytes.push((c1 << 2) | (c2 >> 4));
    if (str[i - 2] !== "=") bytes.push(((c2 & 15) << 4) | (c3 >> 2));
    if (str[i - 1] !== "=") bytes.push(((c3 & 3) << 6) | c4);
  }

  return new Uint8Array(bytes);
}

// 导入 pako 用于解压缩
import { inflate, inflateRaw } from "https://esm.sh/pako@2.1.0";

// 导入 iconv-lite 用于 GB18030 解码
import iconv from "https://esm.sh/iconv-lite@0.6.3";

// ==================== 酷我歌词服务 ====================
class KuwoLyricService {
  private static readonly buf_key = new Uint8Array([0x79, 0x65, 0x65, 0x6c, 0x69, 0x6f, 0x6e]); // 'yeelion'

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    const songId = musicInfo.songmid || musicInfo.songId;
    log.info("开始获取酷我歌词, songId:", songId);

    if (!songId) {
      throw new Error("缺少songmid或songId参数");
    }

    // 使用桌面版相同的API
    const params = this.buildParams(songId, true);
    const url = `http://newlyric.kuwo.cn/newlyric.lrc?${params}`;

    log.debug("酷我歌词请求URL:", url);
    log.debug("酷我歌词请求头:", {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
    });

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
        },
      });

      log.debug("酷我歌词响应状态:", response.status);

      if (response.status !== 200) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const buf = new Uint8Array(await response.arrayBuffer());
      log.debug("酷我歌词原始数据长度:", buf.length);

      // 找到 \r\n\r\n 的位置
      const headerStr = new TextDecoder().decode(buf);
      const index = headerStr.indexOf("\r\n\r\n");
      if (index === -1) {
        throw new Error("未找到数据分隔符");
      }

      // 解析头部
      const headerLines = headerStr.slice(0, index).split("\r\n");
      const headers: { [key: string]: string } = {};
      for (const line of headerLines) {
        const colonIndex = line.indexOf("=");
        if (colonIndex !== -1) {
          headers[line.slice(0, colonIndex)] = line.slice(colonIndex + 1);
        }
      }

      const isGetLyricx = headers["lrcx"] === "1";
      log.debug("酷我歌词是否包含逐字歌词:", isGetLyricx);

      const lrcData = buf.slice(index + 4);
      log.debug("酷我歌词压缩数据长度:", lrcData.length);
      log.debug("酷我歌词压缩数据前20字节:", Array.from(lrcData.slice(0, 20)).map(b => b.toString(16).padStart(2, "0")).join(" "));

      // 使用 pako inflate 解压 (数据头部是 78 9c，这是 zlib 格式)
      let result: Uint8Array;

      try {
        result = inflate(lrcData);
        if (!result || result.length === 0) {
          throw new Error("解压结果为空");
        }
        log.debug("酷我歌词解压后长度:", result.length);
        log.debug("酷我歌词解压后前100字符:", new TextDecoder().decode(result.slice(0, 100)));
      } catch (e) {
        log.error("酷我歌词解压失败:", e);
        throw new Error(`解压失败: ${e}`);
      }

      if (!isGetLyricx) {
        // GB18030解码
        const decoded = this.decodeGB18030(result);
        log.debug("酷我歌词解码后前100字符:", decoded.slice(0, 100));
        return { lyric: decoded };
      }

      // 解密：解压后的数据是 base64 字符串，需要先解码，再 XOR 解密
      const base64Str = new TextDecoder().decode(result);
      const buf_str = decodeBase64(base64Str);
      const buf_str_len = buf_str.length;
      const output = new Uint8Array(buf_str_len);
      let i = 0;
      while (i < buf_str_len) {
        let j = 0;
        while (j < KuwoLyricService.buf_key.length && i < buf_str_len) {
          output[i] = KuwoLyricService.buf_key[j] ^ buf_str[i];
          i++;
          j++;
        }
      }

      // GB18030解码
      const decrypted = this.decodeGB18030(output);
      log.debug("酷我歌词解密后前100字符:", decrypted.slice(0, 100));

      // 解析歌词
      const parsed = this.parseLyric(decrypted);
      log.info("酷我歌词获取成功");
      return parsed;
    } catch (error: any) {
      log.error("获取酷我歌词失败:", error.message);
      throw error;
    }
  }

  private buildParams(id: string, isGetLyricx: boolean): string {
    let params = `user=12345,web,web,web&requester=localhost&req=1&rid=MUSIC_${id}`;
    if (isGetLyricx) params += "&lrcx=1";
    const buf_str = new TextEncoder().encode(params);
    const buf_str_len = buf_str.length;
    // 桌面版使用 Uint16Array 存储 XOR 结果，但 Buffer.from(Uint16Array) 只复制低8位
    // 所以我们直接计算 XOR 并只保留低8位
    const output = new Uint8Array(buf_str_len);
    let i = 0;
    while (i < buf_str_len) {
      let j = 0;
      while (j < KuwoLyricService.buf_key.length && i < buf_str_len) {
        output[i] = KuwoLyricService.buf_key[j] ^ buf_str[i];
        i++;
        j++;
      }
    }
    return encodeBase64(output);
  }

  private decrypt(buf: Uint8Array): string {
    const buf_len = buf.length;
    const output = new Uint8Array(buf_len);
    for (let i = 0; i < buf_len; i++) {
      output[i] = KuwoLyricService.buf_key[i % 7] ^ buf[i];
    }
    return new TextDecoder().decode(output);
  }

  private parseLyric(str: string): LyricResult {
    const lines = str.split("\n");
    const lrcLines: string[] = [];
    const lxlrcLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 匹配时间标签 [mm:ss.xxx]
      const timeMatch = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]/.exec(trimmed);
      if (!timeMatch) {
        lrcLines.push(trimmed);
        lxlrcLines.push(trimmed);
        continue;
      }

      const content = trimmed.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]/, "");
      lrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${content.replace(/<\d+,\d+>/g, "")}`);

      // 解析逐字歌词
      const wordMatches = content.match(/<(\d+),(\d+)>([^<]*)/g);
      if (wordMatches) {
        const words = wordMatches.map(match => {
          const m = /<(\d+),(\d+)>([^<]*)/.exec(match);
          if (!m) return "";
          return `<${m[1]},${m[2]}>${m[3]}`;
        }).join("");
        lxlrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${words}`);
      } else {
        lxlrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${content}`);
      }
    }

    return {
      lyric: lrcLines.join("\n"),
      lxlyric: lxlrcLines.join("\n"),
    };
  }

  private decodeGB18030(buf: Uint8Array): string {
    return iconv.decode(buf, 'gb18030');
  }
}

// ==================== 酷狗歌词服务 ====================
class KugouLyricService {
  private static readonly SEARCH_URL = "http://lyrics.kugou.com/search";
  private static readonly DOWNLOAD_URL = "http://lyrics.kugou.com/download";

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    const hash = musicInfo.hash;
    const name = musicInfo.name;

    log.info("开始获取酷狗歌词, hash:", hash, "name:", name);

    if (!hash || !name) {
      throw new Error("缺少hash或name参数");
    }

    // 搜索歌词
    const searchUrl = `${KugouLyricService.SEARCH_URL}?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(name)}&hash=${hash}&timelength=0&lrctxt=1`;

    log.debug("酷狗歌词搜索URL:", searchUrl);
    log.debug("酷狗歌词请求头:", {
      "KG-RC": 1,
      "KG-THash": "expand_search_manager.cpp:852736169:451",
      "User-Agent": "KuGou2012-9020-ExpandSearchManager",
    });

    try {
      const searchResponse = await fetch(searchUrl, {
        headers: {
          "KG-RC": "1",
          "KG-THash": "expand_search_manager.cpp:852736169:451",
          "User-Agent": "KuGou2012-9020-ExpandSearchManager",
        },
      });

      log.debug("酷狗歌词搜索响应状态:", searchResponse.status);

      if (searchResponse.status !== 200) {
        throw new Error(`搜索请求失败: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      log.debug("酷狗歌词搜索结果:", JSON.stringify(searchData).slice(0, 500));

      if (searchData.status !== 200 || !searchData.candidates || searchData.candidates.length === 0) {
        throw new Error("未找到歌词候选");
      }

      const candidate = searchData.candidates[0];
      log.debug("选择歌词候选:", candidate.id, candidate.accesskey);

      // 下载歌词
      const downloadUrl = `${KugouLyricService.DOWNLOAD_URL}?ver=1&client=pc&id=${candidate.id}&accesskey=${candidate.accesskey}&fmt=krc&charset=utf8`;

      log.debug("酷狗歌词下载URL:", downloadUrl);

      const downloadResponse = await fetch(downloadUrl, {
        headers: {
          "User-Agent": "KuGou2012-9020-ExpandSearchManager",
        },
      });

      log.debug("酷狗歌词下载响应状态:", downloadResponse.status);

      if (downloadResponse.status !== 200) {
        throw new Error(`下载请求失败: ${downloadResponse.status}`);
      }

      const downloadData = await downloadResponse.json();
      log.debug("酷狗歌词下载数据fmt:", downloadData.fmt);

      if (downloadData.fmt === "krc") {
        log.debug("开始解密酷狗KRC歌词");
        return await this.decodeKrc(downloadData.content);
      } else if (downloadData.fmt === "lrc") {
        const decoded = decodeBase64(downloadData.content);
        const lyric = new TextDecoder().decode(decoded);
        return { lyric };
      } else {
        throw new Error(`不支持的歌词格式: ${downloadData.fmt}`);
      }
    } catch (error: any) {
      log.error("获取酷狗歌词失败:", error.message);
      throw error;
    }
  }

  private async decodeKrc(content: string): Promise<LyricResult> {
    const enc_key = new Uint8Array([0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69]);

    try {
      const buf_str = decodeBase64(content).slice(4);
      const decrypted = new Uint8Array(buf_str.length);

      for (let i = 0; i < buf_str.length; i++) {
        decrypted[i] = buf_str[i] ^ enc_key[i % 16];
      }

      // 使用 pako inflateRaw 解压 (跳过 zlib 头部 78 9c)
      let result: Uint8Array;

      try {
        result = inflateRaw(decrypted);
      } catch (e) {
        log.error("KRC解压缩失败，使用原始数据");
        result = decrypted;
      }

      const str = new TextDecoder().decode(result);
      return this.parseKrc(str);
    } catch (error: any) {
      log.error("解密KRC失败:", error.message);
      throw error;
    }
  }

  private parseKrc(str: string): LyricResult {
    const lines = str.split("\n");
    const lrcLines: string[] = [];
    const lxlrcLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("[id:") || trimmed.startsWith("[ar:") || trimmed.startsWith("[ti:")) {
        if (trimmed) lrcLines.push(trimmed);
        continue;
      }

      // 匹配时间标签 [mm:ss.xxx]
      const timeMatch = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]/.exec(trimmed);
      if (!timeMatch) {
        lrcLines.push(trimmed);
        lxlrcLines.push(trimmed);
        continue;
      }

      // 解析逐字歌词格式: [mm:ss.xxx]<x,y>word<x,y>word
      const content = trimmed.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]/, "");
      const plainContent = content.replace(/<\d+,\d+>/g, "");
      lrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${plainContent}`);

      // 构建逐字歌词
      const wordMatches = content.match(/<(\d+),(\d+)>([^<]*)/g);
      if (wordMatches) {
        const words = wordMatches.map(match => {
          const m = /<(\d+),(\d+)>([^<]*)/.exec(match);
          if (!m) return "";
          return `<${m[1]},${m[2]}>${m[3]}`;
        }).join("");
        lxlrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${words}`);
      } else {
        lxlrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${content}`);
      }
    }

    return {
      lyric: lrcLines.join("\n"),
      lxlyric: lxlrcLines.join("\n"),
    };
  }
}

// ==================== QQ音乐歌词服务 ====================
class QQMusicLyricService {
  private static readonly LYRIC_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";

  private async getSongId(songmid: string): Promise<number> {
    log.debug("获取QQ音乐歌曲数字ID, songmid:", songmid);

    const requestBody = {
      comm: {
        ct: "19",
        cv: "1859",
        uin: "0",
      },
      req: {
        module: "music.pf_song_detail_svr",
        method: "get_song_detail_yqq",
        param: {
          song_type: 0,
          song_mid: songmid,
        },
      },
    };

    try {
      const response = await fetch(QQMusicLyricService.LYRIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status !== 200) {
        throw new Error(`获取歌曲信息失败: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 0 || data.req?.code !== 0) {
        throw new Error(`获取歌曲信息API错误: code=${data.code}, req.code=${data.req?.code}`);
      }

      const trackInfo = data.req.data?.track_info;
      if (!trackInfo?.id) {
        throw new Error("无法获取歌曲数字ID");
      }

      log.debug("获取到QQ音乐歌曲数字ID:", trackInfo.id);
      return trackInfo.id;
    } catch (error: any) {
      log.error("获取QQ音乐歌曲数字ID失败:", error.message);
      throw error;
    }
  }

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    log.info("开始获取QQ音乐歌词, songId:", musicInfo.songId);

    if (!musicInfo.songId) {
      throw new Error("缺少songId参数");
    }

    // 使用旧版API获取歌词（不需要解密）
    const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${musicInfo.songId}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq`;

    log.debug("QQ音乐歌词请求URL:", url);

    try {
      const response = await fetch(url, {
        headers: {
          "Referer": "https://y.qq.com/portal/player.html",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
        },
      });

      log.debug("QQ音乐歌词响应状态:", response.status);

      if (response.status !== 200) {
        throw new Error(`请求失败: ${response.status}`);
      }

      // 响应是 JSON 格式
      const data = await response.json();
      log.debug("QQ音乐歌词响应code:", data.code);

      if (data.code !== 0) {
        throw new Error(`API返回错误: code=${data.code}`);
      }

      const result: LyricResult = {
        lyric: "",
        tlyric: "",
        rlyric: "",
        lxlyric: "",
      };

      if (data.lyric) {
        result.lyric = this.decodeLyric(data.lyric);
      }
      if (data.trans) {
        result.tlyric = this.decodeLyric(data.trans);
      }

      log.info("QQ音乐歌词获取成功");
      return result;
    } catch (error: any) {
      log.error("获取QQ音乐歌词失败:", error.message);
      throw error;
    }
  }

  private decodeLyric(base64Str: string): string {
    try {
      const decoded = decodeBase64(base64Str);
      return new TextDecoder().decode(decoded);
    } catch (e) {
      log.error("解码歌词失败:", e);
      return "";
    }
  }
}

// ==================== 网易云歌词服务 ====================
class NeteaseLyricService {
  // 使用网易云音乐官方 API
  private static readonly API_URL = "https://music.163.com/api/song/lyric";

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    log.info("开始获取网易云音乐歌词, songId:", musicInfo.songId);

    if (!musicInfo.songId) {
      throw new Error("缺少songId参数");
    }

    const url = `${NeteaseLyricService.API_URL}?id=${musicInfo.songId}&lv=1&kv=1&tv=-1`;

    log.debug("网易云歌词请求URL:", url);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://music.163.com/",
        },
      });

      log.debug("网易云歌词响应状态:", response.status);

      if (response.status !== 200) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const data = await response.json();
      log.debug("网易云歌词响应code:", data.code);

      if (data.code !== 200) {
        throw new Error(`API返回错误: code=${data.code}`);
      }

      const result: LyricResult = {
        lyric: "",
        tlyric: "",
        rlyric: "",
        lxlyric: "",
      };

      if (data.lrc?.lyric) {
        result.lyric = data.lrc.lyric;
      }
      if (data.tlyric?.lyric) {
        result.tlyric = data.tlyric.lyric;
      }
      if (data.romalrc?.lyric) {
        result.rlyric = data.romalrc.lyric;
      }

      log.info("网易云音乐歌词获取成功");
      return result;
    } catch (error: any) {
      log.error("获取网易云音乐歌词失败:", error.message);
      throw error;
    }
  }
}

// ==================== 咪咕歌词服务 ====================
class MiguLyricService {
  private static readonly DELTA = 2654435769n;
  private static readonly MIN_LENGTH = 32;
  private static readonly keyArr = [
    27303562373562475n,
    18014862372307051n,
    22799692160172081n,
    34058940340699235n,
    30962724186095721n,
    27303523720101991n,
    27303523720101998n,
    31244139033526382n,
    28992395054481524n,
  ];

  private static toLong(str: string | bigint): bigint {
    const num = typeof str === "string" ? BigInt("0x" + str) : str;
    const MAX = 9223372036854775807n;
    const MIN = -9223372036854775808n;
    if (num > MAX) return MiguLyricService.toLong(num - (1n << 64n));
    else if (num < MIN) return MiguLyricService.toLong(num + (1n << 64n));
    return num;
  }

  private static longToBytes(l: bigint): Uint8Array {
    const result = new Uint8Array(8);
    let num = l;
    for (let i = 0; i < 8; i++) {
      result[i] = Number(num & 0xffn);
      num >>= 8n;
    }
    return result;
  }

  private static toBigintArray(data: string): bigint[] {
    const length = Math.floor(data.length / 16);
    const jArr: bigint[] = [];
    for (let i = 0; i < length; i++) {
      const hex = data.substring(i * 16, (i * 16) + 16);
      jArr.push(MiguLyricService.toLong(hex));
    }
    return jArr;
  }

  private static teaDecrypt(data: bigint[], key: bigint[]): bigint[] {
    const length = data.length;
    const lengthBitint = BigInt(length);
    if (length >= 1) {
      let j2 = data[0];
      let j3 = MiguLyricService.toLong((6n + (52n / lengthBitint)) * MiguLyricService.DELTA);
      while (true) {
        let j4 = j3;
        if (j4 === 0n) break;
        let j5 = MiguLyricService.toLong(3n & (j4 >> 2n));
        let j6 = lengthBitint;
        while (true) {
          j6--;
          if (j6 > 0n) {
            const j7 = data[Number(j6 - 1n)];
            const i = j6;
            const temp1 = MiguLyricService.toLong(j2 ^ j4) + MiguLyricService.toLong(j7 ^ key[Number(MiguLyricService.toLong(3n & j6) ^ j5)]);
            const temp2 = MiguLyricService.toLong((j7 >> 5n) ^ (j2 << 2n)) + MiguLyricService.toLong((j2 >> 3n) ^ (j7 << 4n));
            j2 = MiguLyricService.toLong(data[Number(i)] - (temp1 ^ temp2));
            data[Number(i)] = j2;
          } else break;
        }
        const j8 = data[Number(lengthBitint - 1n)];
        const temp1 = MiguLyricService.toLong(MiguLyricService.toLong(key[Number(MiguLyricService.toLong(j6 & 3n) ^ j5)] ^ j8) + MiguLyricService.toLong(j2 ^ j4));
        const temp2 = MiguLyricService.toLong((j8 >> 5n) ^ (j2 << 2n)) + MiguLyricService.toLong((j2 >> 3n) ^ (j8 << 4n));
        j2 = MiguLyricService.toLong(data[0] - (temp1 ^ temp2));
        data[0] = j2;
        j3 = MiguLyricService.toLong(j4 - MiguLyricService.DELTA);
      }
    }
    return data;
  }

  private static longArrToString(data: bigint[]): string {
    const result: string[] = [];
    for (const j of data) {
      const bytes = MiguLyricService.longToBytes(j);
      const decoder = new TextDecoder("utf-16le");
      result.push(decoder.decode(bytes));
    }
    return result.join("");
  }

  private static decrypt(data: string): string {
    if (data == null || data.length < MiguLyricService.MIN_LENGTH) {
      return data;
    }
    const bigIntArray = MiguLyricService.toBigintArray(data);
    const decrypted = MiguLyricService.teaDecrypt(bigIntArray, MiguLyricService.keyArr);
    return MiguLyricService.longArrToString(decrypted);
  }

  private async getLyricText(url: string, tryNum = 0): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          "Referer": "https://app.c.nf.migu.cn/",
          "User-Agent": "Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36",
          "channel": "0146921",
        },
      });

      if (response.status === 200) {
        return await response.text();
      }

      if (tryNum > 5 || response.status === 404) {
        throw new Error("歌词获取失败");
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.getLyricText(url, tryNum + 1);
    } catch (error: any) {
      log.error("获取咪咕歌词文本失败:", error.message);
      throw error;
    }
  }

  private parseLyric(str: string): LyricResult {
    const lines = str.replace(/\r/g, "").split("\n");
    const lxlrcLines: string[] = [];
    const lrcLines: string[] = [];

    const lineTimeExp = /^\s*\[(\d+),\d+\]/;
    const wordTimeAllExp = /(\(\d+,\d+\))/g;

    for (const line of lines) {
      if (line.length < 6) continue;

      const result = lineTimeExp.exec(line);
      if (!result) continue;

      const startTime = parseInt(result[1]);
      let time = startTime;
      let ms = time % 1000;
      time = Math.floor(time / 1000);
      const m = Math.floor(time / 60).toString().padStart(2, "0");
      time = time % 60;
      const s = Math.floor(time).toString().padStart(2, "0");
      const timeStr = `${m}:${s}.${ms}`;

      let words = line.replace(lineTimeExp, "");
      lrcLines.push(`[${timeStr}]${words.replace(wordTimeAllExp, "")}`);

      const times = words.match(wordTimeAllExp);
      if (!times) continue;

      const parsedTimes = times.map(time => {
        const m = /\((\d+),(\d+)\)/.exec(time);
        if (!m) return "";
        return `<${parseInt(m[1]) - startTime},${m[2]}>`;
      });

      const wordArr = words.split(/\(\d+,\d+\)/);
      const newWords = parsedTimes.map((time, index) => `${time}${wordArr[index] || ""}`).join("");
      lxlrcLines.push(`[${timeStr}]${newWords}`);
    }

    return {
      lyric: lrcLines.join("\n"),
      lxlyric: lxlrcLines.join("\n"),
    };
  }

  private async getMrc(url: string): Promise<LyricResult> {
    const text = await this.getLyricText(url);
    const decrypted = MiguLyricService.decrypt(text);
    return this.parseLyric(decrypted);
  }

  private async getLrc(url: string): Promise<LyricResult> {
    const text = await this.getLyricText(url);
    return {
      lyric: text,
      tlyric: "",
      rlyric: "",
      lxlyric: "",
    };
  }

  private async getTrc(url: string): Promise<string> {
    if (!url) return "";
    return this.getLyricText(url);
  }

  private async getLyricWeb(musicInfo: MusicInfo, tryNum = 0): Promise<LyricResult> {
    if (musicInfo.lrcUrl) {
      try {
        const text = await this.getLyricText(musicInfo.lrcUrl);
        return {
          lyric: text,
          tlyric: "",
          rlyric: "",
          lxlyric: "",
        };
      } catch (e) {
        if (tryNum > 5) throw e;
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.getLyricWeb(musicInfo, tryNum + 1);
      }
    } else {
      const url = `https://music.migu.cn/v3/api/music/audioPlayer/getLyric?copyrightId=${musicInfo.copyrightId}`;
      try {
        const response = await fetch(url, {
          headers: {
            "Referer": "https://music.migu.cn/v3/music/player/audio?from=migu",
          },
        });
        const data = await response.json();
        if (data.returnCode !== "000000" || !data.lyric) {
          throw new Error("Get lyric failed");
        }
        return {
          lyric: data.lyric,
          tlyric: "",
          rlyric: "",
          lxlyric: "",
        };
      } catch (e) {
        if (tryNum > 5) throw e;
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.getLyricWeb(musicInfo, tryNum + 1);
      }
    }
  }

  // 通过 copyrightId 搜索获取歌曲信息和歌词链接
  private async getMusicInfo(copyrightId: string, name: string, singer: string, tryNum = 0): Promise<{lrcUrl?: string, mrcUrl?: string, trcUrl?: string}> {
    try {
      // 使用搜索接口通过 copyrightId 查找歌曲
      const searchUrl = `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do?isCopyright=1&isCorrect=1&pageNo=1&pageSize=10&searchSwitch=%7B%22song%22%3A1%7D&sort=0&text=${encodeURIComponent(name + ' ' + singer)}`;
      
      log.debug("咪咕搜索请求:", searchUrl);
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (response.status !== 200) {
        throw new Error(`搜索歌曲失败: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code !== '000000' || !data.songResultData || !data.songResultData.resultList) {
        throw new Error('搜索歌曲失败: 无效的响应');
      }

      // 在搜索结果中查找匹配的 copyrightId
      let matchedSong: any = null;
      for (const item of data.songResultData.resultList) {
        const songs = Array.isArray(item) ? item : [item];
        for (const song of songs) {
          if (song.copyrightId === copyrightId) {
            matchedSong = song;
            break;
          }
        }
        if (matchedSong) break;
      }

      if (!matchedSong) {
        throw new Error('未找到匹配的歌曲');
      }

      log.debug("找到匹配歌曲:", matchedSong.name, "lyricUrl:", matchedSong.lyricUrl);
      
      return {
        lrcUrl: matchedSong.lyricUrl,
        mrcUrl: matchedSong.mrcurl,
        trcUrl: matchedSong.trcUrl,
      };
    } catch (error: any) {
      if (tryNum > 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.getMusicInfo(copyrightId, name, singer, tryNum + 1);
    }
  }

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    log.info("开始获取咪咕音乐歌词, copyrightId:", musicInfo.copyrightId, "name:", musicInfo.name, "singer:", musicInfo.singer);

    if (!musicInfo.copyrightId) {
      throw new Error("缺少copyrightId参数");
    }

    try {
      let lyricResult: LyricResult;
      let lrcUrl = musicInfo.lrcUrl;
      let mrcUrl = musicInfo.mrcUrl;
      let trcUrl = musicInfo.trcUrl;

      // 如果没有提供歌词链接，尝试通过搜索 API 获取
      if (!mrcUrl && !lrcUrl && musicInfo.name) {
        log.debug("未提供歌词链接，尝试通过搜索 API 获取...");
        const info = await this.getMusicInfo(musicInfo.copyrightId, musicInfo.name, musicInfo.singer || '');
        lrcUrl = info.lrcUrl;
        mrcUrl = info.mrcUrl;
        trcUrl = info.trcUrl;
        log.debug("获取到歌词链接:", { lrcUrl, mrcUrl, trcUrl });
      }

      if (mrcUrl) {
        log.debug("使用 MRC 歌词:", mrcUrl);
        lyricResult = await this.getMrc(mrcUrl);
      } else if (lrcUrl) {
        log.debug("使用 LRC 歌词:", lrcUrl);
        lyricResult = await this.getLrc(lrcUrl);
      } else {
        throw new Error("未找到歌词链接");
      }

      const tlyric = await this.getTrc(trcUrl || "");
      if (tlyric) {
        lyricResult.tlyric = tlyric;
      }

      log.info("咪咕音乐歌词获取成功");
      return lyricResult;
    } catch (error: any) {
      log.error("获取咪咕音乐歌词失败:", error.message);
      throw error;
    }
  }
}

// ==================== 歌词服务主类 ====================
export class LyricService {
  private kwService = new KuwoLyricService();
  private kgService = new KugouLyricService();
  private txService = new QQMusicLyricService();
  private wyService = new NeteaseLyricService();
  private mgService = new MiguLyricService();

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    log.info("开始获取歌词, source:", musicInfo.source);

    try {
      switch (musicInfo.source) {
        case "kw":
          return await this.kwService.getLyric(musicInfo);
        case "kg":
          return await this.kgService.getLyric(musicInfo);
        case "tx":
          return await this.txService.getLyric(musicInfo);
        case "wy":
          return await this.wyService.getLyric(musicInfo);
        case "mg":
          return await this.mgService.getLyric(musicInfo);
        default:
          throw new Error(`不支持的歌词源: ${musicInfo.source}`);
      }
    } catch (error: any) {
      log.error("获取歌词失败:", error.message);
      throw error;
    }
  }
}
