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

const DEFAULT_SCRIPT_INFO: Partial<ScriptInfo> = {
  name: "",
  description: "",
  author: "",
  homepage: "",
  version: "",
};

export class ScriptStorage {
  private scripts: Map<string, ScriptStorageItem> = new Map();
  private defaultSourceId: string | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.loadFromStorage().catch((error) => {
      console.error("加载脚本存储失败:", error);
    });
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  private async loadFromStorage(): Promise<void> {
    try {
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

  getLoadedScripts(): Array<{ id: string; name: string; supportedSources: string[]; isDefault: boolean }> {
    const result: Array<{ id: string; name: string; supportedSources: string[]; isDefault: boolean }> = [];
    for (const item of this.scripts.values()) {
      result.push({
        id: item.id,
        name: item.name,
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
      if (defaultItem && defaultItem.supportedSources.includes(source)) {
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
}
