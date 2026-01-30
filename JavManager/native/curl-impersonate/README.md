## curl-impersonate native libs

This folder is used to vendor **libcurl-impersonate** into the JavManager single-file release.

### Layout (expected)

- `JavManager/native/curl-impersonate/win-x64/libcurl.dll`
- `JavManager/native/curl-impersonate/win-x64/zlib.dll`
- `JavManager/native/curl-impersonate/win-x64/cacert.pem`
- `JavManager/native/curl-impersonate/linux-x64/libcurl-impersonate.so`
- `JavManager/native/curl-impersonate/osx-x64/libcurl-impersonate.dylib`

The app will try to load these libraries automatically when `JavDb.CurlImpersonate.Enabled = true`.
On Windows, `cacert.pem` is used as the CA bundle for TLS verification.

### Where to get the library

Recommended fork (more prebuilt binaries): `https://github.com/lexiforest/curl-impersonate`

Notes:
- The Windows release artifact provides a patched `libcurl.dll` (not `libcurl-impersonate.dll`).
- Use `scripts/fetch-curl-impersonate-libs.ps1` to download and vendor these files.

