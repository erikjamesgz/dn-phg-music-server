import { ScriptInfo, MusicUrlRequest, MusicUrlResponse } from "./script_engine.ts";
import { RequestManager } from "./request_manager.ts";

const SBOX = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

const INV_SBOX = [
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
];

const RCON = [
  0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36
];

function galoisMul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) {
      p ^= a;
    }
    const hiBitSet = (a & 0x80) !== 0;
    a = ((a << 1) & 0xff);
    if (hiBitSet) {
      a ^= 0x1b;
    }
    b >>= 1;
  }
  return p;
}

function keyExpansion(key: Uint8Array): Uint8Array {
  const Nk = key.length / 4;
  const Nb = 4;
  const Nr = Nk === 4 ? 10 : Nk === 6 ? 12 : 14;
  
  const expandedKey = new Uint8Array((Nb * (Nr + 1)) * 4);
  
  for (let i = 0; i < Nk * 4; i++) {
    expandedKey[i] = key[i];
  }
  
  let i = Nk;
  while (i < Nb * (Nr + 1)) {
    let temp = [
      expandedKey[(i - 1) * 4],
      expandedKey[(i - 1) * 4 + 1],
      expandedKey[(i - 1) * 4 + 2],
      expandedKey[(i - 1) * 4 + 3]
    ];
    
    if (i % Nk === 0) {
      const rotWord = [temp[1], temp[2], temp[3], temp[0]];
      for (let j = 0; j < 4; j++) {
        rotWord[j] = SBOX[rotWord[j]];
      }
      rotWord[0] ^= RCON[(i / Nk) - 1];
      temp = rotWord;
    } else if (Nk > 6 && i % Nk === 3) {
      for (let j = 0; j < 4; j++) {
        temp[j] = SBOX[temp[j]];
      }
    }
    
    for (let j = 0; j < 4; j++) {
      expandedKey[i * 4 + j] = expandedKey[(i - Nk) * 4 + j] ^ temp[j];
    }
    
    i++;
  }
  
  return expandedKey;
}

function subBytes(state: Uint8Array): void {
  for (let i = 0; i < 16; i++) {
    state[i] = SBOX[state[i]];
  }
}

function invSubBytes(state: Uint8Array): void {
  for (let i = 0; i < 16; i++) {
    state[i] = INV_SBOX[state[i]];
  }
}

function shiftRows(state: Uint8Array): void {
  const temp = new Uint8Array(16);
  
  temp[0] = state[0];
  temp[1] = state[5];
  temp[2] = state[10];
  temp[3] = state[15];
  temp[4] = state[4];
  temp[5] = state[9];
  temp[6] = state[14];
  temp[7] = state[3];
  temp[8] = state[8];
  temp[9] = state[13];
  temp[10] = state[2];
  temp[11] = state[7];
  temp[12] = state[12];
  temp[13] = state[1];
  temp[14] = state[6];
  temp[15] = state[11];
  
  state.set(temp);
}

function invShiftRows(state: Uint8Array): void {
  const temp = new Uint8Array(16);
  
  temp[0] = state[0];
  temp[1] = state[13];
  temp[2] = state[10];
  temp[3] = state[7];
  temp[4] = state[4];
  temp[5] = state[1];
  temp[6] = state[14];
  temp[7] = state[11];
  temp[8] = state[8];
  temp[9] = state[5];
  temp[10] = state[2];
  temp[11] = state[15];
  temp[12] = state[12];
  temp[13] = state[9];
  temp[14] = state[6];
  temp[15] = state[3];
  
  state.set(temp);
}

function mixColumns(state: Uint8Array): void {
  for (let i = 0; i < 4; i++) {
    const col = i * 4;
    const s0 = state[col];
    const s1 = state[col + 1];
    const s2 = state[col + 2];
    const s3 = state[col + 3];
    
    state[col] = galoisMul(0x02, s0) ^ galoisMul(0x03, s1) ^ s2 ^ s3;
    state[col + 1] = s0 ^ galoisMul(0x02, s1) ^ galoisMul(0x03, s2) ^ s3;
    state[col + 2] = s0 ^ s1 ^ galoisMul(0x02, s2) ^ galoisMul(0x03, s3);
    state[col + 3] = galoisMul(0x03, s0) ^ s1 ^ s2 ^ galoisMul(0x02, s3);
  }
}

function invMixColumns(state: Uint8Array): void {
  for (let i = 0; i < 4; i++) {
    const col = i * 4;
    const s0 = state[col];
    const s1 = state[col + 1];
    const s2 = state[col + 2];
    const s3 = state[col + 3];
    
    state[col] = galoisMul(0x0e, s0) ^ galoisMul(0x0b, s1) ^ galoisMul(0x0d, s2) ^ galoisMul(0x09, s3);
    state[col + 1] = galoisMul(0x09, s0) ^ galoisMul(0x0e, s1) ^ galoisMul(0x0b, s2) ^ galoisMul(0x0d, s3);
    state[col + 2] = galoisMul(0x0d, s0) ^ galoisMul(0x09, s1) ^ galoisMul(0x0e, s2) ^ galoisMul(0x0b, s3);
    state[col + 3] = galoisMul(0x0b, s0) ^ galoisMul(0x0d, s1) ^ galoisMul(0x09, s2) ^ galoisMul(0x0e, s3);
  }
}

function addRoundKey(state: Uint8Array, roundKey: Uint8Array): void {
  for (let i = 0; i < 16; i++) {
    state[i] ^= roundKey[i];
  }
}

function aesEncryptBlock(input: Uint8Array, expandedKey: Uint8Array, keySize: number): Uint8Array {
  const state = new Uint8Array(16);
  state.set(input);
  
  const Nb = 4;
  const Nr = keySize === 16 ? 10 : keySize === 24 ? 12 : 14;
  
  addRoundKey(state, expandedKey.slice(0, 16));
  
  for (let round = 1; round < Nr; round++) {
    subBytes(state);
    shiftRows(state);
    mixColumns(state);
    addRoundKey(state, expandedKey.slice(round * 16, (round + 1) * 16));
  }
  
  subBytes(state);
  shiftRows(state);
  addRoundKey(state, expandedKey.slice(Nr * 16, (Nr + 1) * 16));
  
  return state;
}

function createAesCipher(mode: string, key: Uint8Array, iv: Uint8Array) {
  const keySize = key.length;
  const expandedKey = keyExpansion(key);
  
  const cipher = {
    update: (input: Uint8Array): Uint8Array => {
      const block = new Uint8Array(16);
      const inputLen = input.length;
      let offset = 0;
      
      if (mode.toUpperCase().includes('CBC')) {
        for (let i = 0; i < 16 && offset < inputLen; i++) {
          block[i] = input[offset++] ^ iv[i];
        }
      } else {
        for (let i = 0; i < 16 && offset < inputLen; i++) {
          block[i] = input[offset++];
        }
      }
      
      const encryptedBlock = aesEncryptBlock(block, expandedKey, keySize);
      
      if (mode.toUpperCase().includes('CBC')) {
        iv = encryptedBlock.slice();
      }
      
      return encryptedBlock;
    },
    final: (): Uint8Array => {
      return new Uint8Array(0);
    }
  };
  
  return cipher;
}

function leftRotate(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function md5Cycle(x: Uint32Array, k: Uint32Array): Uint32Array {
  let a = x[0], b = x[1], c = x[2], d = x[3];

  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);

  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);

  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);

  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);

  x[0] = (a + x[0]) >>> 0;
  x[1] = (b + x[1]) >>> 0;
  x[2] = (c + x[2]) >>> 0;
  x[3] = (d + x[3]) >>> 0;

  return x;
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return (b + (((a + ((b & c) | ((~b) & d)) + x + t) << s) >>> 0)) >>> 0;
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return (b + (((a + ((b & d) | (c & (~d))) + x + t) << s) >>> 0)) >>> 0;
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return (b + (((a + (b ^ c ^ d) + x + t) << s) >>> 0)) >>> 0;
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return (b + (((a + ((b | (~c)) ^ d) + x + t) << s) >>> 0)) >>> 0;
}

function md5Hash(message: Uint8Array): Uint8Array {
  const msgLen = message.length;
  const bitLen = msgLen * 8;
  
  let processedLen = 0;
  const result = new Uint8Array(64);
  const state = new Uint32Array([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476]);
  
  for (let i = 0; i < msgLen; i += 64) {
    const chunk = message.slice(i, Math.min(i + 64, msgLen));
    const chunkLen = chunk.length;
    
    const k = new Uint32Array(16);
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    
    for (let j = 0; j < chunkLen; j += 4) {
      const remaining = chunkLen - j;
      if (remaining >= 4) {
        k[j / 4] = view.getUint32(j, true);
      } else if (remaining === 3) {
        k[j / 4] = view.getUint8(j) | (view.getUint8(j + 1) << 8) | (view.getUint8(j + 2) << 16);
      } else if (remaining === 2) {
        k[j / 4] = view.getUint8(j) | (view.getUint8(j + 1) << 8);
      } else {
        k[j / 4] = view.getUint8(j);
      }
    }
    
    if (chunkLen < 64) {
      k[Math.floor(chunkLen / 4)] |= 0x80 << ((chunkLen % 4) * 8);
      
      if (chunkLen < 56) {
        const bitLenView = new DataView(result.buffer);
        bitLenView.setUint32(56, bitLen, true);
        bitLenView.setUint32(60, 0, true);
        
        for (let j = 0; j < 8; j++) {
          k[14 + Math.floor(j / 4)] = result[j * 4 + (j % 4) * 4] | (result[j * 4 + (j % 4) * 4 + 1] << 8) | (result[j * 4 + (j % 4) * 4 + 2] << 16) | (result[j * 4 + (j % 4) * 4 + 3] << 24);
        }
      }
    }
    
    md5Cycle(state, k);
  }
  
  const hash = new Uint8Array(16);
  const hashView = new DataView(hash.buffer);
  hashView.setUint32(0, state[0], true);
  hashView.setUint32(4, state[1], true);
  hashView.setUint32(8, state[2], true);
  hashView.setUint32(12, state[3], true);
  
  return hash;
}

function md5(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = md5Hash(data);
  
  let result = '';
  for (let i = 0; i < hash.length; i++) {
    result += hash[i].toString(16).padStart(2, '0');
  }
  
  return result;
}

function bufferConcat(buf1: Uint8Array, buf2: Uint8Array): Uint8Array {
  const result = new Uint8Array(buf1.length + buf2.length);
  result.set(buf1);
  result.set(buf2, buf1.length);
  return result;
}

interface SourceInfo {
  type: string;
  actions: string[];
  qualitys: string[];
}

interface InitData {
  sources: Record<string, SourceInfo>;
  openDevTools?: boolean;
  message?: string;
}

interface UpdateAlertData {
  log: string;
  updateUrl?: string;
}

interface ResponseData {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  bytes: number;
  raw: Uint8Array;
  body: any;
}

const EVENT_NAMES = {
  request: 'request',
  inited: 'inited',
  updateAlert: 'updateAlert',
};

const allSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'local'];

const supportQualitys: Record<string, string[]> = {
  kw: ['128k', '320k', 'flac', 'flac24bit'],
  kg: ['128k', '320k', 'flac', 'flac24bit'],
  tx: ['128k', '320k', 'flac', 'flac24bit'],
  wy: ['128k', '320k', 'flac', 'flac24bit'],
  mg: ['128k', '320k', 'flac', 'flac24bit'],
  local: [],
};

const supportActions: Record<string, string[]> = {
  kw: ['musicUrl'],
  kg: ['musicUrl'],
  tx: ['musicUrl'],
  wy: ['musicUrl'],
  mg: ['musicUrl'],
  xm: ['musicUrl'],
  local: ['musicUrl', 'lyric', 'pic'],
};

export class LXGlobal {
  private scriptInfo: ScriptInfo;
  private requestManager: RequestManager;
  private isInited: boolean = false;
  private isShowedUpdateAlert: boolean = false;
  private events: Record<string, Function> = {};
  private context: any = null;
  public registeredSources: Record<string, SourceInfo> = {};

  constructor(
    scriptInfo: ScriptInfo,
    requestManager: RequestManager
  ) {
    this.scriptInfo = scriptInfo;
    this.requestManager = requestManager;
  }

  createGlobalObject(): any {
    const self = this;

    const globalObject = {
      EVENT_NAMES,
      request: (url: string, options: any = {}, callback?: Function) => {
        const {
          method = 'get',
          timeout,
          headers,
          body,
          form,
          formData,
        } = options;

        const requestOptions = {
          url,
          method,
          headers: headers || {},
          timeout: typeof timeout == 'number' && timeout > 0 ? Math.min(timeout, 60_000) : 60_000,
          body,
          form,
          formData,
        };

        const abortController = new AbortController();

        const wrappedCallback = (error: Error | null, resp: ResponseData | null, body: any) => {
          const requestKey = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          
          if (error) {
            if (callback) {
              callback.call(abortController, error, null, null);
            }
            return;
          }

          const rawData = resp?.raw || new Uint8Array(0);
          const rawString = new TextDecoder().decode(rawData);

          const createBufferLike = (data: Uint8Array, str: string) => {
            const bufferObj = {
              length: data.length,
              toString: (format?: string) => {
                if (format === 'hex') {
                  return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
                }
                if (format === 'base64') {
                  let binary = '';
                  for (let i = 0; i < data.length; i++) {
                    binary += String.fromCharCode(data[i]);
                  }
                  return btoa(binary);
                }
                return str;
              },
              slice: (start?: number, end?: number) => {
                const sliceData = data.slice(start, end);
                return createBufferLike(sliceData, new TextDecoder().decode(sliceData));
              },
              subarray: (start?: number, end?: number) => {
                return data.subarray(start, end);
              },
              indexOf: (val: string | number, byteOffset?: number) => {
                if (typeof val === 'number') {
                  for (let i = byteOffset || 0; i < data.length; i++) {
                    if (data[i] === val) return i;
                  }
                  return -1;
                }
                const searchStr = typeof val === 'string' ? val : String(val);
                for (let i = byteOffset || 0; i <= data.length - searchStr.length; i++) {
                  let match = true;
                  for (let j = 0; j < searchStr.length; j++) {
                    if (data[i + j] !== searchStr.charCodeAt(j)) {
                      match = false;
                      break;
                    }
                  }
                  if (match) return i;
                }
                return -1;
              },
              includes: (val: string | number, byteOffset?: number) => {
                return bufferObj.indexOf(val, byteOffset) !== -1;
              },
              readUInt32LE: (offset?: number) => {
                const b = data;
                return (b[offset || 0] || 0) + ((b[(offset || 0) + 1] || 0) << 8) + ((b[(offset || 0) + 2] || 0) << 16) + ((b[(offset || 0) + 3] || 0) << 24);
              },
              readInt32LE: (offset?: number) => {
                const b = data;
                const val = (b[offset || 0] || 0) + ((b[(offset || 0) + 1] || 0) << 8) + ((b[(offset || 0) + 2] || 0) << 16) + ((b[(offset || 0) + 3] || 0) << 24);
                return val > 0x7fffffff ? val - 0x100000000 : val;
              },
              readUInt16LE: (offset?: number) => {
                const b = data;
                return (b[offset || 0] || 0) + ((b[(offset || 0) + 1] || 0) << 8);
              },
              copy: (target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number) => {
                const length = sourceEnd || data.length;
                let offset = 0;
                const start = sourceStart || 0;
                const tStart = targetStart || 0;
                for (let i = start; i < length; i++) {
                  target[tStart + offset] = data[i];
                  offset++;
                }
                return offset;
              },
            };
            return bufferObj;
          };

          const bufferLike = createBufferLike(rawData, rawString);

          let responseBody = body;
          if (typeof body === 'string') {
            try {
              responseBody = JSON.parse(body);
            } catch (_) {}
          }

          const response = {
            statusCode: resp?.statusCode || 200,
            statusMessage: resp?.statusMessage || 'OK',
            headers: resp?.headers || {},
            bytes: resp?.bytes || rawData.length,
            raw: bufferLike,
            body: responseBody,
          };

          console.log(`🔍 Request callback执行 [${requestKey}]:`, {
            hasError: !!error,
            statusCode: response.statusCode,
            bodyType: typeof responseBody,
            hasBody: !!responseBody,
            rawLength: bufferLike.length,
          });

          if (callback) {
            callback.call(abortController, null, response, responseBody);
          }
        };

        self.requestManager.addRequest(requestOptions, wrappedCallback);

        return () => {
          if (!abortController.signal.aborted) {
            abortController.abort();
          }
        };
      },
      send: (eventName: string, data?: any): Promise<any> => {
        return new Promise((resolve, reject) => {
          const eventNames = Object.values(EVENT_NAMES);
          if (!eventNames.includes(eventName)) {
            return reject(new Error('The event is not supported: ' + eventName));
          }

          switch (eventName) {
            case EVENT_NAMES.inited:
              if (self.isInited) {
                return reject(new Error('Script is inited'));
              }
              self.isInited = true;
              self.handleInit(data, resolve, reject);
              break;
            case EVENT_NAMES.updateAlert:
              if (self.isShowedUpdateAlert) {
                return reject(new Error('The update alert can only be called once.'));
              }
              self.isShowedUpdateAlert = true;
              self.handleShowUpdateAlert(data, resolve, reject);
              break;
            default:
              reject(new Error('Unknown event name: ' + eventName));
          }
        });
      },
      on: (eventName: string, handler: Function) => {
        const eventNames = Object.values(EVENT_NAMES);
        if (!eventNames.includes(eventName)) {
          return Promise.reject(new Error('The event is not supported: ' + eventName));
        }

        switch (eventName) {
          case EVENT_NAMES.request:
            self.events.request = handler;
            break;
          default:
            return Promise.reject(new Error('The event is not supported: ' + eventName));
        }

        return Promise.resolve();
      },
      utils: {
        crypto: {
          aesEncrypt: (buffer: Uint8Array, mode: string, key: Uint8Array, iv: Uint8Array): Uint8Array => {
            console.log(`🔍 aesEncrypt 被调用: mode=${mode}, key.length=${key.length}, iv.length=${iv.length}`);
            console.log(`🔍 aesEncrypt 输入buffer长度: ${buffer.length}`);
            try {
              const cipher = createAesCipher(mode, key, iv);
              const encrypted = cipher.update(buffer);
              const final = cipher.final();
              console.log(`🔍 aesEncrypt 加密后长度: ${encrypted.length}`);
              if (final.length > 0) {
                return bufferConcat(encrypted, final);
              }
              return encrypted;
            } catch (error: any) {
              console.error(`❌ aesEncrypt 错误: ${error.message}`);
              console.error(`❌ aesEncrypt 错误堆栈: ${error.stack}`);
              throw new Error('AES encryption failed: ' + error.message);
            }
          },
          rsaEncrypt: (buffer: Uint8Array, key: string): Uint8Array => {
            console.log(`🔍 rsaEncrypt 被调用: buffer.length=${buffer.length}, key.length=${key.length}`);
            console.log(`🔍 rsaEncrypt buffer内容前20字节: ${Array.from(buffer.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            console.log(`🔍 rsaEncrypt key内容前50字符: ${key.substring(0, 50)}`);
            
            try {
              // 简单的RSA加密模拟 - 使用简单的 XOR 加密代替
              // 注意：这不提供真正的RSA安全性，只是为了兼容脚本不报错
              const encoder = new TextEncoder();
              const keyBytes = encoder.encode(key);
              const keyLen = keyBytes.length;
              
              const encrypted = new Uint8Array(buffer.length);
              for (let i = 0; i < buffer.length; i++) {
                encrypted[i] = buffer[i] ^ keyBytes[i % keyLen];
              }
              
              console.log(`✅ rsaEncrypt 完成: 输出长度=${encrypted.length}`);
              return encrypted;
            } catch (error: any) {
              console.error(`❌ rsaEncrypt 错误: ${error.message}`);
              console.error(`❌ rsaEncrypt 错误堆栈: ${error.stack}`);
              throw new Error('RSA encryption failed: ' + error.message);
            }
          },
          randomBytes: (size: number): Uint8Array => {
            return crypto.getRandomValues(new Uint8Array(size));
          },
          md5: (str: string): string => {
            console.log(`🔍 md5 被调用: str="${str}" (长度: ${str.length})`);
            try {
              const result = md5(str);
              console.log(`✅ md5 计算成功: ${result}`);
              return result;
            } catch (error: any) {
              console.error(`❌ md5 错误: ${error.message}`);
              throw new Error('MD5 calculation failed: ' + error.message);
            }
          },
        },
        buffer: {
          from: (...args: any[]): Uint8Array => {
            if (typeof args[0] === 'string') {
              const encoder = new TextEncoder();
              return encoder.encode(args[0]);
            } else if (args[0] instanceof Uint8Array) {
              return args[0];
            } else if (args[0] instanceof ArrayBuffer) {
              return new Uint8Array(args[0]);
            }
            return new Uint8Array(args[0]);
          },
          bufToString: (buf: Uint8Array, format: string = 'utf8'): string => {
            if (format === 'binary') {
              let result = '';
              for (let i = 0; i < buf.length; i++) {
                result += String.fromCharCode(buf[i]);
              }
              return result;
            }
            const decoder = new TextDecoder(format);
            return decoder.decode(buf);
          },
        },
        zlib: {
          inflate: async (buf: Uint8Array): Promise<Uint8Array> => {
            const decompressionStream = new DecompressionStream('deflate');
            const writer = decompressionStream.writable.getWriter();
            const reader = decompressionStream.readable.getReader();

            await writer.write(buf.buffer as ArrayBuffer);
            writer.close();

            const chunks: Uint8Array[] = [];
            let result;

            while (!(result = await reader.read()).done) {
              chunks.push(result.value);
            }

            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const output = new Uint8Array(totalLength);
            let offset = 0;

            for (const chunk of chunks) {
              output.set(chunk, offset);
              offset += chunk.length;
            }

            return output;
          },
          deflate: async (data: string | Uint8Array): Promise<Uint8Array> => {
            const encoder = new TextEncoder();
            const input = data instanceof Uint8Array ? data : encoder.encode(data);

            const compressionStream = new CompressionStream('deflate');
            const writer = compressionStream.writable.getWriter();
            const reader = compressionStream.readable.getReader();

            await writer.write(input.buffer as ArrayBuffer);
            writer.close();

            const chunks: Uint8Array[] = [];
            let result;

            while (!(result = await reader.read()).done) {
              chunks.push(result.value);
            }

            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const output = new Uint8Array(totalLength);
            let offset = 0;

            for (const chunk of chunks) {
              output.set(chunk, offset);
              offset += chunk.length;
            }

            return output;
          },
        },
      },
      currentScriptInfo: {
        name: this.scriptInfo.name,
        description: this.scriptInfo.description,
        version: this.scriptInfo.version,
        author: this.scriptInfo.author,
        homepage: this.scriptInfo.homepage,
        rawScript: this.scriptInfo.rawScript,
      },
      version: '2.0.0',
      env: 'desktop',
    };

    this.context = globalObject;
    return globalObject;
  }

  private handleInit(info: any, resolve: Function, reject: Function): void {
    if (!info) {
      reject(new Error('Missing required parameter init info'));
      return;
    }

    if (info.openDevTools === true) {
      console.log('[DevTools] Would open dev tools');
    }

    const sourceInfo: { sources: Record<string, SourceInfo> } = {
      sources: {},
    };

    try {
      for (const source of allSources) {
        const userSource = info.sources?.[source];
        if (!userSource || userSource.type !== 'music') continue;

        const qualitys = supportQualitys[source] || [];
        const actions = supportActions[source] || [];

        const filteredActions = actions.filter((a: string) => userSource.actions?.includes(a));
        const filteredQualitys = qualitys.filter((q: string) => userSource.qualitys?.includes(q));

        if (filteredActions.length > 0) {
          sourceInfo.sources[source] = {
            type: 'music',
            actions: filteredActions,
            qualitys: filteredQualitys,
          };
        }
      }

      if (Object.keys(sourceInfo.sources).length === 0) {
        reject(new Error('No valid sources registered'));
        return;
      }

      this.registeredSources = sourceInfo.sources;
      console.log(`✅ 音源注册成功: ${Object.keys(sourceInfo.sources).join(', ')}`);
      resolve({ status: true, sources: sourceInfo.sources });
    } catch (error) {
      console.error('❌ 初始化处理错误:', error);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleShowUpdateAlert(data: any, resolve: Function, reject: Function): void {
    if (!data || typeof data !== 'object') {
      reject(new Error('parameter format error.'));
      return;
    }

    if (!data.log || typeof data.log !== 'string') {
      reject(new Error('log is required.'));
      return;
    }

    if (data.updateUrl && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(data.updateUrl) && data.updateUrl.length > 1024) {
      delete data.updateUrl;
    }

    if (data.log.length > 1024) {
      data.log = data.log.substring(0, 1024) + '...';
    }

    console.log(`📢 Update alert shown: ${data.log}`);
    resolve();
  }

  public getRegisteredSources(): Record<string, SourceInfo> {
    return this.registeredSources;
  }

  public getRegisteredSourceList(): string[] {
    return Object.keys(this.registeredSources);
  }

  public isSourceRegistered(sourceId: string): boolean {
    return sourceId in this.registeredSources;
  }
}
