// 代理缓存摘要与 App API 签名所用的纯 Worker 加密辅助函数。

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}

async function sha256HexText(text: string): Promise<string> {
  return sha256HexBytes(new TextEncoder().encode(text));
}

// 纯 TS 实现 MD5（用于生成 JavDB App API 的 jdsignature）
// 仅依赖 JS 位运算，避免使用 Node crypto（Workers 不支持）。
function md5HexText(text: string): string {
  const bytes = new TextEncoder().encode(text);

  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] = (words[i >> 2] ?? 0) | (bytes[i] << ((i % 4) * 8));
  }

  const bitLen = bytes.length * 8;
  words[bitLen >> 5] = (words[bitLen >> 5] ?? 0) | (0x80 << (bitLen % 32));
  words[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < words.length; i += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    const x0 = words[i + 0] ?? 0;
    const x1 = words[i + 1] ?? 0;
    const x2 = words[i + 2] ?? 0;
    const x3 = words[i + 3] ?? 0;
    const x4 = words[i + 4] ?? 0;
    const x5 = words[i + 5] ?? 0;
    const x6 = words[i + 6] ?? 0;
    const x7 = words[i + 7] ?? 0;
    const x8 = words[i + 8] ?? 0;
    const x9 = words[i + 9] ?? 0;
    const x10 = words[i + 10] ?? 0;
    const x11 = words[i + 11] ?? 0;
    const x12 = words[i + 12] ?? 0;
    const x13 = words[i + 13] ?? 0;
    const x14 = words[i + 14] ?? 0;
    const x15 = words[i + 15] ?? 0;

    const add32 = (x: number, y: number) => (x + y) | 0;
    const rol = (num: number, cnt: number) => (num << cnt) | (num >>> (32 - cnt));
    const cmn = (q: number, a0: number, b0: number, x0: number, s: number, t: number) =>
      add32(rol(add32(add32(a0, q), add32(x0, t)), s), b0);
    const ff = (a0: number, b0: number, c0: number, d0: number, x0: number, s: number, t: number) =>
      cmn((b0 & c0) | (~b0 & d0), a0, b0, x0, s, t);
    const gg = (a0: number, b0: number, c0: number, d0: number, x0: number, s: number, t: number) =>
      cmn((b0 & d0) | (c0 & ~d0), a0, b0, x0, s, t);
    const hh = (a0: number, b0: number, c0: number, d0: number, x0: number, s: number, t: number) =>
      cmn(b0 ^ c0 ^ d0, a0, b0, x0, s, t);
    const ii = (a0: number, b0: number, c0: number, d0: number, x0: number, s: number, t: number) =>
      cmn(c0 ^ (b0 | ~d0), a0, b0, x0, s, t);

    a = ff(a, b, c, d, x0, 7, -680876936);
    d = ff(d, a, b, c, x1, 12, -389564586);
    c = ff(c, d, a, b, x2, 17, 606105819);
    b = ff(b, c, d, a, x3, 22, -1044525330);
    a = ff(a, b, c, d, x4, 7, -176418897);
    d = ff(d, a, b, c, x5, 12, 1200080426);
    c = ff(c, d, a, b, x6, 17, -1473231341);
    b = ff(b, c, d, a, x7, 22, -45705983);
    a = ff(a, b, c, d, x8, 7, 1770035416);
    d = ff(d, a, b, c, x9, 12, -1958414417);
    c = ff(c, d, a, b, x10, 17, -42063);
    b = ff(b, c, d, a, x11, 22, -1990404162);
    a = ff(a, b, c, d, x12, 7, 1804603682);
    d = ff(d, a, b, c, x13, 12, -40341101);
    c = ff(c, d, a, b, x14, 17, -1502002290);
    b = ff(b, c, d, a, x15, 22, 1236535329);

    a = gg(a, b, c, d, x1, 5, -165796510);
    d = gg(d, a, b, c, x6, 9, -1069501632);
    c = gg(c, d, a, b, x11, 14, 643717713);
    b = gg(b, c, d, a, x0, 20, -373897302);
    a = gg(a, b, c, d, x5, 5, -701558691);
    d = gg(d, a, b, c, x10, 9, 38016083);
    c = gg(c, d, a, b, x15, 14, -660478335);
    b = gg(b, c, d, a, x4, 20, -405537848);
    a = gg(a, b, c, d, x9, 5, 568446438);
    d = gg(d, a, b, c, x14, 9, -1019803690);
    c = gg(c, d, a, b, x3, 14, -187363961);
    b = gg(b, c, d, a, x8, 20, 1163531501);
    a = gg(a, b, c, d, x13, 5, -1444681467);
    d = gg(d, a, b, c, x2, 9, -51403784);
    c = gg(c, d, a, b, x7, 14, 1735328473);
    b = gg(b, c, d, a, x12, 20, -1926607734);

    a = hh(a, b, c, d, x5, 4, -378558);
    d = hh(d, a, b, c, x8, 11, -2022574463);
    c = hh(c, d, a, b, x11, 16, 1839030562);
    b = hh(b, c, d, a, x14, 23, -35309556);
    a = hh(a, b, c, d, x1, 4, -1530992060);
    d = hh(d, a, b, c, x4, 11, 1272893353);
    c = hh(c, d, a, b, x7, 16, -155497632);
    b = hh(b, c, d, a, x10, 23, -1094730640);
    a = hh(a, b, c, d, x13, 4, 681279174);
    d = hh(d, a, b, c, x0, 11, -358537222);
    c = hh(c, d, a, b, x3, 16, -722521979);
    b = hh(b, c, d, a, x6, 23, 76029189);
    a = hh(a, b, c, d, x9, 4, -640364487);
    d = hh(d, a, b, c, x12, 11, -421815835);
    c = hh(c, d, a, b, x15, 16, 530742520);
    b = hh(b, c, d, a, x2, 23, -995338651);

    a = ii(a, b, c, d, x0, 6, -198630844);
    d = ii(d, a, b, c, x7, 10, 1126891415);
    c = ii(c, d, a, b, x14, 15, -1416354905);
    b = ii(b, c, d, a, x5, 21, -57434055);
    a = ii(a, b, c, d, x12, 6, 1700485571);
    d = ii(d, a, b, c, x3, 10, -1894986606);
    c = ii(c, d, a, b, x10, 15, -1051523);
    b = ii(b, c, d, a, x1, 21, -2054922799);
    a = ii(a, b, c, d, x8, 6, 1873313359);
    d = ii(d, a, b, c, x15, 10, -30611744);
    c = ii(c, d, a, b, x6, 15, -1560198380);
    b = ii(b, c, d, a, x13, 21, 1309151649);
    a = ii(a, b, c, d, x4, 6, -145523070);
    d = ii(d, a, b, c, x11, 10, -1120210379);
    c = ii(c, d, a, b, x2, 15, 718787259);
    b = ii(b, c, d, a, x9, 21, -343485551);

    a = add32(a, aa);
    b = add32(b, bb);
    c = add32(c, cc);
    d = add32(d, dd);
  }

  const out = new Uint8Array(16);
  const wordsOut = [a, b, c, d];
  for (let i = 0; i < wordsOut.length; i++) {
    const w = wordsOut[i];
    out[i * 4 + 0] = w & 0xff;
    out[i * 4 + 1] = (w >>> 8) & 0xff;
    out[i * 4 + 2] = (w >>> 16) & 0xff;
    out[i * 4 + 3] = (w >>> 24) & 0xff;
  }
  return toHex(out);
}

export { md5HexText, sha256HexBytes, sha256HexText };
