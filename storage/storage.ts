import { ScriptInfo } from "../engine/script_engine.ts";
import pako from "npm:pako";
import { Buffer } from "npm:buffer";

interface ScriptStorageItem {
  id: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  version: string;
  script: string;
  allowShowUpdateAlert: boolean;
  isDefault: boolean;
  supportedSources: string[];
  createdAt: number;
  updatedAt: number;
}

interface StorageData {
  scripts: ScriptStorageItem[];
  defaultSourceId: string | null;
}

const STORAGE_KEY = "dn_music_scripts";
const STORAGE_FILE = "./data/scripts.json";
const CACHE_FILE = "./data/music_url_cache.json";
const SOURCE_STATS_FILE = "./data/source_stats.json";
const API_KEY_FILE = "./data/api_key.json";
const API_KEY_KV_KEY = ["api_key"];

const DEFAULT_SCRIPT_INFO: Partial<ScriptInfo> = {
  name: "",
  description: "",
  author: "",
  homepage: "",
  version: "",
};

// 检查是否在 Deno Deploy 环境
const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

export class ScriptStorage {
  private scripts: Map<string, ScriptStorageItem> = new Map();
  private defaultSourceId: string | null = null;
  private readyPromise: Promise<void>;
  private kv: Deno.Kv | null = null;

  constructor() {
    this.readyPromise = this.loadFromStorage().catch((error) => {
      console.error("加载脚本存储失败:", error);
    });
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  private async initKv(): Promise<Deno.Kv | null> {
    try {
      return await Deno.openKv();
    } catch (error) {
      console.error("[Storage] Failed to open KV:", error);
      return null;
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      // 初始化 KV（用于缓存功能）
      this.kv = await this.initKv();
      if (this.kv) {
        console.log("[Storage] KV initialized successfully");
      } else {
        console.log("[Storage] KV not available, caching will be disabled");
      }

      // Deno Deploy 环境使用 KV 存储脚本
      if (isDenoDeploy) {
        if (this.kv) {
          const result = await this.kv.get<StorageData>([STORAGE_KEY]);
          if (result.value) {
            const data = result.value;
            if (data.scripts) {
              for (const item of data.scripts) {
                this.scripts.set(item.id, item);
              }
            }
            this.defaultSourceId = data.defaultSourceId || null;
            console.log(`[Storage] Loaded ${this.scripts.size} scripts from KV`);
          }
          return;
        }
      }

      // 本地环境使用文件
      let storedData: string | null = null;
      
      try {
        storedData = await Deno.readTextFile(STORAGE_FILE);
      } catch {
        return;
      }
      
      if (storedData) {
        const data: StorageData = JSON.parse(storedData);
        
        if (data.scripts) {
          for (const item of data.scripts) {
            this.scripts.set(item.id, item);
          }
        }
        
        this.defaultSourceId = data.defaultSourceId || null;
        
        const scriptCount = this.scripts.size;
        console.log(`[Storage] Loaded ${scriptCount} scripts from file`);
      }
    } catch (error) {
      console.error("加载脚本存储失败:", error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const items = Array.from(this.scripts.values());
      const data: StorageData = {
        scripts: items,
        defaultSourceId: this.defaultSourceId,
      };
      
      // Deno Deploy 环境使用 KV
      if (isDenoDeploy && this.kv) {
        await this.kv.set([STORAGE_KEY], data);
        console.log("[Storage] Saved to KV");
        return;
      }

      // 本地环境使用文件
      const jsonData = JSON.stringify(data, null, 2);
      await Deno.writeTextFile(STORAGE_FILE, jsonData);
    } catch (error) {
      console.error("保存脚本存储失败:", error);
    }
  }

  private parseSupportedSources(script: string): string[] {
    const sources: string[] = [];
    const patterns = [
      /['"]?(kw|kg|tx|wy|mg|xm)['"]?\s*:/g,
      /source[s]?\s*[:=]\s*\[([^\]]+)\]/g,
      /MUSIC_SOURCE\s*[=:]\s*Object\.keys\s*\(\s*MUSIC_QUALITY\s*\)/g,
    ];

    for (const pattern of patterns) {
      const matches = script.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const sourcesStr = match[1];
          const sourceList = sourcesStr.match(/['"]?(kw|kg|tx|wy|mg|xm)['"]?/g);
          if (sourceList) {
            for (const s of sourceList) {
              const cleanSource = s.replace(/['"]/g, '').trim();
              if (!sources.includes(cleanSource)) {
                sources.push(cleanSource);
              }
            }
          }
        }
      }
    }

    return sources.length > 0 ? sources : ['unknown'];
  }

  private async deflateScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const buffer = Buffer.from(script, 'utf8');
        const compressed = pako.deflate(buffer);
        resolve('gz_' + Buffer.from(compressed).toString('base64'));
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private async inflateScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (script.startsWith('gz_')) {
          const compressed = Buffer.from(script.substring(3), 'base64');
          const decompressed = pako.inflate(compressed);
          resolve(Buffer.from(decompressed).toString('utf8'));
        } else {
          resolve(script);
        }
      } catch (err: any) {
        reject(err);
      }
    });
  }

  parseScriptInfo(script: string): ScriptInfo {
    const commentMatch = /^\/\*[\s\S]+?\*\//.exec(script);
    console.log('[Storage] Script first 200 chars:', script.substring(0, 200));
    console.log('[Storage] Comment match:', commentMatch ? commentMatch[0].substring(0, 100) : 'No match');
    if (!commentMatch) {
      throw new Error("无效的自定义源文件：缺少注释头部");
    }

    const commentBlock = commentMatch[0];
    const info = this.parseCommentBlock(commentBlock);
    const supportedSources = this.parseSupportedSources(script);

    return {
      id: `user_api_${Math.random().toString().substring(2, 5)}_${Date.now()}`,
      name: info.name || `user_api_${new Date().toLocaleString()}`,
      description: info.description || "",
      author: info.author || "",
      homepage: info.homepage || "",
      version: info.version || "",
      rawScript: script,
      supportedSources,
    };
  }

  private parseCommentBlock(commentBlock: string): Record<string, string> {
    const INFO_NAMES = {
      name: 24,
      description: 36,
      author: 56,
      homepage: 1024,
      version: 36,
    } as const;
    type INFO_NAMES_Type = typeof INFO_NAMES;

    const infoArr = commentBlock.split(/\r?\n/);
    const rxp = /^\s?\*\s?@(\w+)\s(.+)$/;
    const infos: Partial<Record<keyof typeof INFO_NAMES, string>> = {};

    for (const info of infoArr) {
      const result = rxp.exec(info);
      if (!result) continue;
      const key = result[1] as keyof typeof INFO_NAMES;
      if (INFO_NAMES[key] == null) continue;
      infos[key] = result[2].trim();
    }

    for (const [key, len] of Object.entries(INFO_NAMES) as Array<{ [K in keyof INFO_NAMES_Type]: [K, INFO_NAMES_Type[K]] }[keyof INFO_NAMES_Type]>) {
      infos[key] ||= '';
      if (infos[key] == null) infos[key] = '';
      else if (infos[key].length > len) infos[key] = infos[key].substring(0, len) + '...';
    }

    return infos as Record<keyof typeof INFO_NAMES, string>;
  }

  async importScript(script: string): Promise<ScriptInfo> {
    const scriptInfo = this.parseScriptInfo(script);
    const supportedSources = this.parseSupportedSources(script);

    const storageItem: ScriptStorageItem = {
      ...scriptInfo,
      script: await this.deflateScript(script),
      allowShowUpdateAlert: true,
      isDefault: false,
      supportedSources,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const isFirstScript = this.scripts.size === 0;
    this.scripts.set(scriptInfo.id, storageItem);
    await this.saveToStorage();

    if (isFirstScript) {
      await this.setDefaultSource(scriptInfo.id);
    }

    return scriptInfo;
  }

  async importScriptFromUrl(url: string): Promise<ScriptInfo> {
    console.log('[Storage] importScriptFromUrl called with URL:', url);
    if (!/^https?:\/\//.test(url)) {
      throw new Error("无效的URL格式");
    }

    const MAX_SCRIPT_SIZE = 9_000_000;
    const TIMEOUT = 30_000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      console.log('[Storage] Fetching URL:', url);
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_SCRIPT_SIZE) {
        throw new Error(`脚本过大: ${contentLength} 字节 (最大 ${MAX_SCRIPT_SIZE} 字节)`);
      }

      const script = await response.text();
      console.log('[Storage] Script downloaded, length:', script.length);
      console.log('[Storage] Script first 100 chars:', script.substring(0, 100));
      
      if (script.length > MAX_SCRIPT_SIZE) {
        throw new Error(`脚本过大: ${script.length} 字节 (最大 ${MAX_SCRIPT_SIZE} 字节)`);
      }
      
      const scriptInfo = await this.importScript(script);
      
      // 如果是第一个脚本，自动设置为默认
      if (this.scripts.size === 1) {
        await this.setDefaultSource(scriptInfo.id);
      }
      
      return scriptInfo;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('[Storage] importScriptFromUrl error:', error);
      if (error.name === 'AbortError') {
        throw new Error('请求超时');
      }
      throw error;
    }
  }

  async importScriptFromFile(fileContent: string, fileName?: string): Promise<ScriptInfo> {
    const script = fileContent.trim();
    if (!script) {
      throw new Error("文件内容为空");
    }

    return this.importScript(script);
  }

  async updateScript(id: string, script: string): Promise<ScriptInfo | null> {
    const existingItem = this.scripts.get(id);
    if (!existingItem) {
      return null;
    }

    const scriptInfo = this.parseScriptInfo(script);
    scriptInfo.id = id;
    const supportedSources = this.parseSupportedSources(script);

    const updatedItem: ScriptStorageItem = {
      ...scriptInfo,
      script: await this.deflateScript(script),
      allowShowUpdateAlert: existingItem.allowShowUpdateAlert,
      isDefault: existingItem.isDefault,
      supportedSources,
      createdAt: existingItem.createdAt,
      updatedAt: Date.now(),
    };

    this.scripts.set(id, updatedItem);
    await this.saveToStorage();

    return scriptInfo;
  }

  async getScript(id: string): Promise<ScriptInfo | null> {
    const item = this.scripts.get(id);
    if (!item) {
      return null;
    }

    const decompressedScript = await this.inflateScript(item.script);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      author: item.author,
      homepage: item.homepage,
      version: item.version,
      rawScript: decompressedScript,
      supportedSources: item.supportedSources,
    };
  }

  async getScriptRaw(id: string): Promise<string | null> {
    const item = this.scripts.get(id);
    if (!item) {
      return null;
    }

    return await this.inflateScript(item.script);
  }

  getScripts(): ScriptInfo[] {
    const result: ScriptInfo[] = [];
    for (const item of this.scripts.values()) {
      result.push({
        id: item.id,
        name: item.name,
        description: item.description,
        author: item.author,
        homepage: item.homepage,
        version: item.version,
        rawScript: "",
        supportedSources: item.supportedSources,
      });
    }
    return result;
  }

  async getAllScripts(): Promise<ScriptInfo[]> {
    const result: ScriptInfo[] = [];
    for (const item of this.scripts.values()) {
      const decompressedScript = await this.inflateScript(item.script);
      result.push({
        id: item.id,
        name: item.name,
        description: item.description,
        author: item.author,
        homepage: item.homepage,
        version: item.version,
        rawScript: decompressedScript,
        supportedSources: item.supportedSources,
      });
    }
    return result;
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  getLoadedScripts(): Array<{ id: string; name: string; description: string; author: string; homepage: string; version: string; createdAt: string; supportedSources: string[]; isDefault: boolean }> {
    const result: Array<{ id: string; name: string; description: string; author: string; homepage: string; version: string; createdAt: string; supportedSources: string[]; isDefault: boolean }> = [];
    for (const item of this.scripts.values()) {
      result.push({
        id: item.id,
        name: item.name,
        description: item.description,
        author: item.author,
        homepage: item.homepage,
        version: item.version,
        createdAt: this.formatDate(item.createdAt),
        supportedSources: item.supportedSources,
        isDefault: item.id === this.defaultSourceId,
      });
    }
    return result;
  }

  async removeScript(id: string): Promise<boolean> {
    const deleted = this.scripts.delete(id);
    if (deleted) {
      const wasDefault = this.defaultSourceId === id;
      
      if (wasDefault) {
        const remainingScripts = Array.from(this.scripts.keys());
        if (remainingScripts.length > 0) {
          this.defaultSourceId = remainingScripts[0];
        } else {
          this.defaultSourceId = null;
        }
      }
      
      await this.saveToStorage();
    }
    return deleted;
  }

  async removeScripts(ids: string[]): Promise<number> {
    let removed = 0;
    for (const id of ids) {
      if (this.scripts.delete(id)) {
        removed++;
        if (this.defaultSourceId === id) {
          this.defaultSourceId = null;
        }
      }
    }
    if (removed > 0) {
      await this.saveToStorage();
    }
    return removed;
  }

  async setAllowShowUpdateAlert(id: string, enable: boolean): Promise<boolean> {
    const item = this.scripts.get(id);
    if (!item) {
      return false;
    }

    item.allowShowUpdateAlert = enable;
    item.updatedAt = Date.now();
    await this.saveToStorage();

    return true;
  }

  getAllowShowUpdateAlert(id: string): boolean {
    return this.scripts.get(id)?.allowShowUpdateAlert ?? false;
  }

  async setDefaultSource(id: string): Promise<boolean> {
    if (!this.scripts.has(id)) {
      return false;
    }

    for (const [scriptId, item] of this.scripts) {
      item.isDefault = scriptId === id;
    }

    this.defaultSourceId = id;
    await this.saveToStorage();

    return true;
  }

  getDefaultSource(): string | null {
    return this.defaultSourceId;
  }

  getDefaultSourceInfo(): { id: string | null; name: string; supportedSources: string[] } | null {
    if (!this.defaultSourceId) {
      return null;
    }

    const item = this.scripts.get(this.defaultSourceId);
    if (!item) {
      return null;
    }

    return {
      id: this.defaultSourceId,
      name: item.name,
      supportedSources: item.supportedSources,
    };
  }

  clearDefaultSource(): void {
    this.defaultSourceId = null;
    for (const item of this.scripts.values()) {
      item.isDefault = false;
    }
    this.saveToStorage();
  }

  getScriptCount(): number {
    return this.scripts.size;
  }

  clearAllScripts(): void {
    this.scripts.clear();
    this.defaultSourceId = null;
    this.saveToStorage();
  }

  async exportScript(id: string): Promise<string | null> {
    return this.getScriptRaw(id);
  }

  async exportAllScripts(): Promise<string[]> {
    const scripts: string[] = [];
    for (const item of this.scripts.values()) {
      const rawScript = await this.inflateScript(item.script);
      scripts.push(rawScript);
    }
    return scripts;
  }

  getSupportedSources(scriptId?: string): string[] {
    if (scriptId) {
      const item = this.scripts.get(scriptId);
      return item?.supportedSources || [];
    }

    const allSources = new Set<string>();
    for (const item of this.scripts.values()) {
      for (const source of item.supportedSources) {
        allSources.add(source);
      }
    }
    return Array.from(allSources);
  }

  findScriptBySource(source: string): string | null {
    for (const [id, item] of this.scripts) {
      if (item.supportedSources.includes(source)) {
        return id;
      }
    }

    if (this.defaultSourceId) {
      const defaultItem = this.scripts.get(this.defaultSourceId);
      if (defaultItem?.supportedSources.includes(source)) {
        return this.defaultSourceId;
      }
    }

    return null;
  }

  async updateScriptSupportedSources(id: string, supportedSources: string[]): Promise<boolean> {
    const item = this.scripts.get(id);
    if (!item) {
      return false;
    }

    item.supportedSources = supportedSources;
    item.updatedAt = Date.now();
    await this.saveToStorage();

    return true;
  }

  private static MUSIC_URL_CACHE_KEY = ["music_url_cache"];
  private static CACHE_ENABLED_KEY = ["cache_enabled"];
  private static SOURCE_STATS_KEY = ["source_stats"];

  private musicUrlCacheEnabled: boolean | null = null;
  private sourceStatsCache: ScriptSourceStats | null = null;

  async isMusicUrlCacheEnabled(): Promise<boolean> {
    if (this.musicUrlCacheEnabled !== null) {
      return this.musicUrlCacheEnabled ?? false;
    }

    if (this.kv) {
      const result = await this.kv.get<{ enabled: boolean }>(ScriptStorage.CACHE_ENABLED_KEY);
      if (result.value) {
        this.musicUrlCacheEnabled = result.value.enabled;
      } else {
        this.musicUrlCacheEnabled = false;
        await this.setMusicUrlCacheEnabled(false);
      }
    } else {
      this.musicUrlCacheEnabled = false;
    }

    return this.musicUrlCacheEnabled;
  }

  async setMusicUrlCacheEnabled(enabled: boolean): Promise<void> {
    this.musicUrlCacheEnabled = enabled;

    if (this.kv) {
      await this.kv.set(ScriptStorage.CACHE_ENABLED_KEY, { enabled, updatedAt: Date.now() });
    }
  }

  async setMusicUrlCache(source: string, songId: string, url: string, quality: string): Promise<void> {
    const cacheKey = `${source}_${songId}_${quality}`;
    const cacheEntry: MusicUrlCacheEntry = {
      url,
      cachedAt: Date.now(),
      source,
      songId,
      quality,
    };

    if (this.kv) {
      console.log(`[Storage] Setting cache in KV for key: ${cacheKey}`);
      await this.kv.set([...ScriptStorage.MUSIC_URL_CACHE_KEY, source, songId, quality], cacheEntry);
      console.log(`[Storage] Cache set successfully in KV for key: ${cacheKey}`);
    } else {
      console.log(`[Storage] Setting cache in file for key: ${cacheKey}`);
      try {
        let cacheData: Record<string, MusicUrlCacheEntry> = {};
        try {
          const data = await Deno.readTextFile(CACHE_FILE);
          cacheData = JSON.parse(data);
        } catch {
        }
        cacheData[cacheKey] = cacheEntry;
        await Deno.writeTextFile(CACHE_FILE, JSON.stringify(cacheData, null, 2));
        console.log(`[Storage] Cache set successfully in file for key: ${cacheKey}`);
      } catch (error) {
        console.error(`[Storage] Failed to set cache in file: ${error}`);
      }
    }
  }

  async getMusicUrlCache(source: string, songId: string, quality: string): Promise<MusicUrlCacheEntry | null> {
    const cacheKey = `${source}_${songId}_${quality}`;

    if (this.kv) {
      console.log(`[Storage] Getting cache from KV for key: ${cacheKey}`);
      const result = await this.kv.get<MusicUrlCacheEntry>([...ScriptStorage.MUSIC_URL_CACHE_KEY, source, songId, quality]);

      if (result.value) {
        const cacheEntry = result.value as MusicUrlCacheEntry;
        console.log(`[Storage] Cache hit in KV for ${source}/${songId}/${quality}: ${cacheEntry.url?.substring(0, 80)}...`);
        return cacheEntry;
      }

      console.log(`[Storage] Cache miss in KV for ${source}/${songId}/${quality}`);
      return null;
    } else {
      console.log(`[Storage] Getting cache from file for key: ${cacheKey}`);
      try {
        const data = await Deno.readTextFile(CACHE_FILE);
        const cacheData: Record<string, MusicUrlCacheEntry> = JSON.parse(data);
        const cacheEntry = cacheData[cacheKey];

        if (cacheEntry) {
          console.log(`[Storage] Cache hit in file for ${source}/${songId}/${quality}: ${cacheEntry.url?.substring(0, 80)}...`);
          return cacheEntry;
        }

        console.log(`[Storage] Cache miss in file for ${source}/${songId}/${quality}`);
        return null;
      } catch (error) {
        console.log(`[Storage] Failed to read cache from file: ${error}`);
        return null;
      }
    }
  }

  async clearMusicUrlCache(): Promise<void> {
    if (this.kv) {
      const iterator = this.kv.list<MusicUrlCacheEntry>({ prefix: ScriptStorage.MUSIC_URL_CACHE_KEY });
      const keysToDelete: Deno.KvKey[] = [];

      for await (const res of iterator) {
        keysToDelete.push(res.key);
      }

      if (keysToDelete.length > 0) {
        await this.kv.deleteMany(keysToDelete);
        console.log(`[Storage] Cleared ${keysToDelete.length} cached music URLs from KV`);
      }
    } else {
      try {
        await Deno.writeTextFile(CACHE_FILE, "{}");
        console.log("[Storage] Cleared all cached music URLs from file");
      } catch (error) {
        console.error(`[Storage] Failed to clear cache from file: ${error}`);
      }
    }
  }

  async getMusicUrlCacheCount(): Promise<number> {
    if (this.kv) {
      let count = 0;
      const iterator = this.kv.list<MusicUrlCacheEntry>({ prefix: ScriptStorage.MUSIC_URL_CACHE_KEY });

      for await (const _res of iterator) {
        count++;
      }

      return count;
    } else {
      try {
        const data = await Deno.readTextFile(CACHE_FILE);
        const cacheData: Record<string, MusicUrlCacheEntry> = JSON.parse(data);
        return Object.keys(cacheData).length;
      } catch {
        return 0;
      }
    }
  }

  private static readonly ALL_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg'] as const;
  private static readonly MIN_SAMPLES = 5;
  private static readonly EPSILON = 0.05;

  async getSourceStats(): Promise<ScriptSourceStats> {
    if (this.sourceStatsCache !== null) {
      return this.sourceStatsCache;
    }

    if (this.kv) {
      const result = await this.kv.get<ScriptSourceStats>(ScriptStorage.SOURCE_STATS_KEY);
      if (result.value) {
        this.sourceStatsCache = result.value;
      } else {
        this.sourceStatsCache = {};
      }
    } else {
      try {
        const data = await Deno.readTextFile(SOURCE_STATS_FILE);
        this.sourceStatsCache = JSON.parse(data);
      } catch {
        this.sourceStatsCache = {};
      }
    }

    return this.sourceStatsCache;
  }

  private async saveSourceStats(): Promise<void> {
    if (!this.sourceStatsCache) return;

    if (this.kv) {
      await this.kv.set(ScriptStorage.SOURCE_STATS_KEY, this.sourceStatsCache);
    } else {
      try {
        await Deno.writeTextFile(SOURCE_STATS_FILE, JSON.stringify(this.sourceStatsCache, null, 2));
      } catch (error) {
        console.error(`[Storage] Failed to save source stats: ${error}`);
      }
    }
  }

  async updateSourceStats(scriptId: string, source: string, success: boolean): Promise<void> {
    const stats = await this.getSourceStats();

    if (!stats[scriptId]) {
      stats[scriptId] = {};
    }
    if (!stats[scriptId][source]) {
      stats[scriptId][source] = { success: 0, fail: 0 };
    }

    if (success) {
      stats[scriptId][source].success++;
    } else {
      stats[scriptId][source].fail++;
    }

    console.log(`[Storage] Updated stats for script ${scriptId}, source ${source}: success=${stats[scriptId][source].success}, fail=${stats[scriptId][source].fail}`);
    await this.saveSourceStats();
  }

  private getSuccessRate(stats: SourceStats): number {
    const total = stats.success + stats.fail;
    if (total < ScriptStorage.MIN_SAMPLES) return -1;
    return stats.success / total;
  }

  async getSortedSourcesBySuccessRate(scriptId: string, excludeSources: string[] = []): Promise<string[]> {
    const stats = await this.getSourceStats();
    const scriptStats = stats[scriptId] || {};

    const sources = [...ScriptStorage.ALL_SOURCES].filter(s => !excludeSources.includes(s));

    if (Math.random() < ScriptStorage.EPSILON) {
      for (let i = sources.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sources[i], sources[j]] = [sources[j], sources[i]];
      }
      console.log(`[Storage] ε-greedy random exploration: ${sources.join(', ')}`);
      return sources;
    }

    return sources.sort((a, b) => {
      const rateA = this.getSuccessRate(scriptStats[a] || { success: 0, fail: 0 });
      const rateB = this.getSuccessRate(scriptStats[b] || { success: 0, fail: 0 });

      if (rateA === -1 && rateB === -1) {
        return Math.random() - 0.5;
      }
      if (rateA === -1) return 1;
      if (rateB === -1) return -1;

      if (Math.abs(rateA - rateB) < 0.01) {
        return Math.random() - 0.5;
      }

      return rateB - rateA;
    });
  }

  async getSourceStatsForScript(scriptId: string): Promise<{ [source: string]: SourceStats }> {
    const stats = await this.getSourceStats();
    return stats[scriptId] || {};
  }

  private generateApiKey(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async getApiKey(): Promise<string> {
    const envKey = Deno.env.get("API_KEY") || Deno.env.get("api_key");
    if (envKey) {
      console.log("[Storage] Using API_KEY from environment variable:", envKey);
      await this.saveApiKey(envKey);
      return envKey;
    }

    if (this.kv) {
      try {
        const result = await this.kv.get<string>(API_KEY_KV_KEY);
        if (result.value) {
          console.log("[Storage] Loaded API key from KV");
          return result.value;
        }
      } catch (error) {
        console.error("[Storage] Failed to read API key from KV:", error);
      }
    }

    if (!isDenoDeploy) {
      try {
        const fileContent = await Deno.readTextFile(API_KEY_FILE);
        const data = JSON.parse(fileContent);
        if (data.apiKey) {
          console.log("[Storage] Loaded API key from file");
          return data.apiKey;
        }
      } catch {
        // 文件不存在
      }
    }

    const newKey = this.generateApiKey();
    console.log("[Storage] Generated new API key:", newKey);
    await this.saveApiKey(newKey);
    return newKey;
  }

  private async saveApiKey(key: string): Promise<void> {
    if (this.kv) {
      try {
        await this.kv.set(API_KEY_KV_KEY, key);
        console.log("[Storage] API key saved to KV");
      } catch (error) {
        console.error("[Storage] Failed to save API key to KV:", error);
      }
    }

    if (!isDenoDeploy) {
      try {
        await Deno.writeTextFile(API_KEY_FILE, JSON.stringify({ apiKey: key, updatedAt: Date.now() }, null, 2));
        console.log("[Storage] API key saved to file");
      } catch (error) {
        console.error("[Storage] Failed to save API key to file:", error);
      }
    }
  }
}

interface MusicUrlCacheEntry {
  url: string;
  cachedAt: number;
  source: string;
  songId: string;
  quality: string;
}

interface SourceStats {
  success: number;
  fail: number;
}

interface ScriptSourceStats {
  [scriptId: string]: {
    [source: string]: SourceStats;
  };
}
