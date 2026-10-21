#!/usr/bin/env python3
"""Decrypt JavDB APK data.txt / remote ds_store site config.

Format observed in jdb_official_v1.9.35:
  Base64( IV[16] || AES-128-CBC(ciphertext) )
Key recovered from libapp.so encrypted constant:
  px0wbsdzxg7f6br9
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import urllib.request
from pathlib import Path

KEY = b"px0wbsdzxg7f6br9"


def pkcs7_unpad(data: bytes) -> bytes:
    if not data:
        return data
    pad = data[-1]
    if 1 <= pad <= 16 and data.endswith(bytes([pad]) * pad):
        return data[:-pad]
    return data


def decrypt_blob(blob: bytes, key: bytes = KEY) -> bytes:
    if len(blob) < 32 or len(blob) % 16 != 0:
        raise ValueError(f"ciphertext length invalid: {len(blob)}")
    iv, ct = blob[:16], blob[16:]
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "需要 cryptography 包：python3 -m pip install cryptography"
        ) from exc

    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    return pkcs7_unpad(decryptor.update(ct) + decryptor.finalize())


def load_input(path: str | None, url: str | None) -> bytes:
    if bool(path) == bool(url):
        raise SystemExit("请指定恰好一个输入：本地文件路径或 --url")
    if url:
        req = urllib.request.Request(url, headers={"User-Agent": "JavDB-App/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8", "replace").strip()
        return base64.b64decode(text)
    raw = Path(path).read_text(encoding="utf-8").strip()
    return base64.b64decode(raw)


def recover_json(plaintext: bytes) -> dict:
    text = plaintext.decode("utf-8")
    candidates = [text]
    if not text.lstrip().startswith("{"):
        # First AES block may start mid-object; common key is apiUrls.
        candidates.extend(
            [
                '{"apiUrls":["' + text,
                "{" + text,
            ]
        )
    last_error: Exception | None = None
    for candidate in candidates:
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict):
                return obj
        except Exception as exc:  # noqa: BLE001 - try next candidate
            last_error = exc
    raise ValueError(f"无法解析 JSON: {last_error}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", help="本地 data.txt / ds_store 文件")
    parser.add_argument("--url", help="远程 backupUrls 地址")
    parser.add_argument(
        "--raw",
        action="store_true",
        help="只打印解密后的原始文本，不做 JSON 修复/解析",
    )
    args = parser.parse_args(argv)

    blob = load_input(args.path, args.url)
    plaintext = decrypt_blob(blob)
    if args.raw:
        sys.stdout.write(plaintext.decode("utf-8", "replace"))
        sys.stdout.write("\n")
        return 0

    obj = recover_json(plaintext)
    json.dump(obj, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
