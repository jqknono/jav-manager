using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using System.Runtime.InteropServices;
using System.Text;

namespace JavManager.DataProviders.JavDb;

public sealed class CurlImpersonateHttpFetcher : IJavDbHttpFetcher
{
    private readonly JavDbConfig _config;

    private readonly object _initLock = new();
    private bool _initialized;
    private nint _libHandle;

    private CurlGlobalInit? _curl_global_init;
    private CurlEasyInit? _curl_easy_init;
    private CurlEasyCleanup? _curl_easy_cleanup;
    private CurlEasySetopt? _curl_easy_setopt;
    private CurlEasyPerform? _curl_easy_perform;
    private CurlEasyGetinfoLong? _curl_easy_getinfo_long;
    private CurlEasyStrerror? _curl_easy_strerror;
    private CurlEasyImpersonate? _curl_easy_impersonate;

    public CurlImpersonateHttpFetcher(JavDbConfig config)
    {
        _config = config;
    }

    public Task<(int StatusCode, string Body, string? Error)> GetAsync(
        string url,
        string? referer,
        string? cookieHeader,
        int timeoutMs,
        CancellationToken cancellationToken = default)
    {
        if (!_config.CurlImpersonate.Enabled)
            return Task.FromResult<(int StatusCode, string Body, string? Error)>((0, string.Empty, "curl-impersonate disabled"));

        if (cancellationToken.IsCancellationRequested)
            return Task.FromResult<(int StatusCode, string Body, string? Error)>((0, string.Empty, "Cancelled"));

        EnsureInitialized();
        if (!_initialized)
            return Task.FromResult<(int StatusCode, string Body, string? Error)>((0, string.Empty, "libcurl-impersonate not available"));

        var target = string.IsNullOrWhiteSpace(_config.CurlImpersonate.Target)
            ? "chrome116"
            : _config.CurlImpersonate.Target.Trim();
        var defaultHeaders = _config.CurlImpersonate.DefaultHeaders ? 1 : 0;

        // curl is synchronous here; enforce timeout via CURLOPT_TIMEOUT_MS.
        var timeout = Math.Max(1000, timeoutMs);

        var curl = _curl_easy_init!.Invoke();
        if (curl == IntPtr.Zero)
            return Task.FromResult<(int StatusCode, string Body, string? Error)>((0, string.Empty, "curl_easy_init failed"));

        var bodyStream = new MemoryStream();
        var bodyHandle = GCHandle.Alloc(bodyStream);
        var bodyHandlePtr = GCHandle.ToIntPtr(bodyHandle);

        var writeCallback = new CurlWriteCallback(WriteToStream);
        var writeCallbackPtr = Marshal.GetFunctionPointerForDelegate(writeCallback);

        var errorBufferPtr = Marshal.AllocHGlobal(ErrorBufferSize);
        InitErrorBuffer(errorBufferPtr, ErrorBufferSize);

        IntPtr urlPtr = IntPtr.Zero;
        IntPtr refererPtr = IntPtr.Zero;
        IntPtr cookiePtr = IntPtr.Zero;
        IntPtr acceptEncodingPtr = IntPtr.Zero;
        IntPtr caInfoPtr = IntPtr.Zero;

        try
        {
            // Apply browser impersonation (TLS/HTTP2 + (optional) default headers)
            var imp = _curl_easy_impersonate!.Invoke(curl, target, defaultHeaders);
            if (imp != CurlCode.Ok)
                return Task.FromResult<(int StatusCode, string Body, string? Error)>((0, string.Empty, GetErrorText(imp, errorBufferPtr)));

            // Basic options
            urlPtr = Marshal.StringToHGlobalAnsi(url);
            if (_curl_easy_setopt!.Invoke(curl, CurlOption.Url, urlPtr) != CurlCode.Ok)
                return Task.FromResult<(int StatusCode, string Body, string? Error)>((0, string.Empty, "Failed to set CURLOPT_URL"));

            _curl_easy_setopt.Invoke(curl, CurlOption.FollowLocation, new IntPtr(1));
            _curl_easy_setopt.Invoke(curl, CurlOption.TimeoutMs, new IntPtr(timeout));
            _curl_easy_setopt.Invoke(curl, CurlOption.ConnectTimeoutMs, new IntPtr(Math.Min(timeout, 10_000)));
            _curl_easy_setopt.Invoke(curl, CurlOption.ErrorBuffer, errorBufferPtr);

            // Mimic wrapper script's "--compressed"
            acceptEncodingPtr = Marshal.StringToHGlobalAnsi("gzip, deflate, br");
            _curl_easy_setopt.Invoke(curl, CurlOption.AcceptEncoding, acceptEncodingPtr);

            // CA bundle (required for some Windows builds that do not use the OS cert store)
            var caBundlePath = ResolveCaBundlePath(_config.CurlImpersonate.CaBundlePath);
            if (!string.IsNullOrWhiteSpace(caBundlePath) && File.Exists(caBundlePath))
            {
                caInfoPtr = Marshal.StringToHGlobalAnsi(caBundlePath);
                _curl_easy_setopt.Invoke(curl, CurlOption.CaInfo, caInfoPtr);
            }

            // Cookie / Referer
            if (!string.IsNullOrWhiteSpace(referer))
            {
                refererPtr = Marshal.StringToHGlobalAnsi(referer);
                _curl_easy_setopt.Invoke(curl, CurlOption.Referer, refererPtr);
            }

            if (!string.IsNullOrWhiteSpace(cookieHeader))
            {
                cookiePtr = Marshal.StringToHGlobalAnsi(cookieHeader);
                _curl_easy_setopt.Invoke(curl, CurlOption.Cookie, cookiePtr);
            }

            // Capture response body
            _curl_easy_setopt.Invoke(curl, CurlOption.WriteData, bodyHandlePtr);
            _curl_easy_setopt.Invoke(curl, CurlOption.WriteFunction, writeCallbackPtr);

            var perf = _curl_easy_perform!.Invoke(curl);

            long httpCode = 0;
            _curl_easy_getinfo_long!.Invoke(curl, CurlInfo.ResponseCode, out httpCode);

            var body = Encoding.UTF8.GetString(bodyStream.ToArray());

            if (perf != CurlCode.Ok)
                return Task.FromResult<(int StatusCode, string Body, string? Error)>(((int)httpCode, body, GetErrorText(perf, errorBufferPtr)));

            return Task.FromResult<(int StatusCode, string Body, string? Error)>(((int)httpCode, body, null));
        }
        finally
        {
            if (urlPtr != IntPtr.Zero) Marshal.FreeHGlobal(urlPtr);
            if (refererPtr != IntPtr.Zero) Marshal.FreeHGlobal(refererPtr);
            if (cookiePtr != IntPtr.Zero) Marshal.FreeHGlobal(cookiePtr);
            if (acceptEncodingPtr != IntPtr.Zero) Marshal.FreeHGlobal(acceptEncodingPtr);
            if (caInfoPtr != IntPtr.Zero) Marshal.FreeHGlobal(caInfoPtr);

            Marshal.FreeHGlobal(errorBufferPtr);

            if (bodyHandle.IsAllocated) bodyHandle.Free();
            _curl_easy_cleanup!.Invoke(curl);
        }
    }

    private void EnsureInitialized()
    {
        if (_initialized)
            return;

        lock (_initLock)
        {
            if (_initialized)
                return;

            var libraryCandidates = BuildLibraryCandidates(_config.CurlImpersonate.LibraryPath);
            foreach (var candidate in libraryCandidates)
            {
                if (string.IsNullOrWhiteSpace(candidate))
                    continue;

                if (!NativeLibrary.TryLoad(candidate, out _libHandle))
                    continue;

                if (!TryBindExports(_libHandle))
                {
                    NativeLibrary.Free(_libHandle);
                    _libHandle = IntPtr.Zero;
                    continue;
                }

                var global = _curl_global_init!.Invoke((long)CurlGlobalFlags.All);
                if (global != CurlCode.Ok)
                {
                    NativeLibrary.Free(_libHandle);
                    _libHandle = IntPtr.Zero;
                    continue;
                }

                _initialized = true;
                return;
            }

            _initialized = false;
        }
    }

    private static IEnumerable<string> BuildLibraryCandidates(string configured)
    {
        var configuredPath = configured?.Trim();
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            // Absolute or relative path
            yield return configuredPath;

            // Also try relative to app base directory
            yield return Path.Combine(AppContext.BaseDirectory, configuredPath);
        }

        var (rid, libFileNames) = GetCurrentRidAndLibraryFileNames();
        var baseDirs = GetCandidateBaseDirectories();

        // Prefer embedded locations first (avoid accidentally loading a system libcurl).
        if (!string.IsNullOrWhiteSpace(rid))
        {
            foreach (var libFileName in libFileNames)
            {
                if (string.IsNullOrWhiteSpace(libFileName))
                    continue;

                foreach (var baseDir in baseDirs)
                {
                    yield return Path.Combine(baseDir, "native", "curl-impersonate", rid, libFileName);
                    yield return Path.Combine(baseDir, "runtimes", rid, "native", libFileName);
                }
            }
        }

        foreach (var libFileName in libFileNames)
        {
            if (string.IsNullOrWhiteSpace(libFileName))
                continue;

            foreach (var baseDir in baseDirs)
            {
                yield return Path.Combine(baseDir, libFileName);
            }
        }

        foreach (var libFileName in libFileNames)
        {
            if (string.IsNullOrWhiteSpace(libFileName))
                continue;

            // Finally, let the platform loader resolve from its default search paths.
            yield return libFileName;
        }
    }

    private static (string Rid, IReadOnlyList<string> LibraryFileNames) GetCurrentRidAndLibraryFileNames()
    {
        var arch = RuntimeInformation.ProcessArchitecture;

        if (OperatingSystem.IsWindows())
        {
            // lexiforest/curl-impersonate Windows build ships libcurl.dll
            // (with curl_easy_impersonate exported).
            // Keep libcurl-impersonate.dll as a fallback name for other builds.
            var names = new[] { "libcurl.dll", "libcurl-impersonate.dll" };

            return arch switch
            {
                Architecture.X64 => ("win-x64", names),
                Architecture.X86 => ("win-x86", names),
                Architecture.Arm64 => ("win-arm64", names),
                _ => ("", names)
            };
        }

        if (OperatingSystem.IsMacOS())
        {
            var names = new[] { "libcurl-impersonate.dylib", "libcurl-impersonate-chrome.dylib" };
            return arch switch
            {
                Architecture.X64 => ("osx-x64", names),
                Architecture.Arm64 => ("osx-arm64", names),
                _ => ("", names)
            };
        }

        // Linux (default)
        {
            var names = new[] { "libcurl-impersonate.so", "libcurl-impersonate-chrome.so" };
            return arch switch
        {
            Architecture.X64 => ("linux-x64", names),
            Architecture.Arm64 => ("linux-arm64", names),
            _ => ("", names)
        };
        }
    }

    private static string ResolveCaBundlePath(string configured)
    {
        var configuredPath = configured?.Trim();
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            if (Path.IsPathRooted(configuredPath))
                return configuredPath;

            return Path.Combine(AppContext.BaseDirectory, configuredPath);
        }

        var (rid, _) = GetCurrentRidAndLibraryFileNames();
        var baseDirs = GetCandidateBaseDirectories();

        foreach (var baseDir in baseDirs)
        {
            if (!string.IsNullOrWhiteSpace(rid))
            {
                var p1 = Path.Combine(baseDir, "native", "curl-impersonate", rid, "cacert.pem");
                if (File.Exists(p1))
                    return p1;

                var p2 = Path.Combine(baseDir, "runtimes", rid, "native", "cacert.pem");
                if (File.Exists(p2))
                    return p2;
            }

            var p3 = Path.Combine(baseDir, "cacert.pem");
            if (File.Exists(p3))
                return p3;
        }

        return Path.Combine(AppContext.BaseDirectory, "cacert.pem");
    }

    private static IReadOnlyList<string> GetCandidateBaseDirectories()
    {
        var comparer = OperatingSystem.IsWindows()
            ? StringComparer.OrdinalIgnoreCase
            : StringComparer.Ordinal;

        var seen = new HashSet<string>(comparer);
        var result = new List<string>();

        void Add(string? path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return;

            var full = path.Trim().TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (full.Length == 0)
                return;

            if (seen.Add(full))
                result.Add(full);
        }

        // The directory of the running apphost
        Add(AppContext.BaseDirectory);
        Add(Directory.GetCurrentDirectory());

        // Also consider parent directories of the app base directory.
        // This helps `dotnet run` scenarios where vendored native libs live under the project folder.
        var parentDir = Directory.GetParent(AppContext.BaseDirectory)?.FullName;
        for (var i = 0; i < 6 && !string.IsNullOrWhiteSpace(parentDir); i++)
        {
            Add(parentDir);
            parentDir = Directory.GetParent(parentDir!)?.FullName;
        }

        // In single-file apps, native DLLs are extracted elsewhere. The host provides
        // these directories in NATIVE_DLL_SEARCH_DIRECTORIES.
        if (AppContext.GetData("NATIVE_DLL_SEARCH_DIRECTORIES") is string nativeDirs &&
            !string.IsNullOrWhiteSpace(nativeDirs))
        {
            foreach (var dir in nativeDirs.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                Add(dir);

                // Also consider parents (we may store content under subfolders).
                var parent = Directory.GetParent(dir)?.FullName;
                if (!string.IsNullOrWhiteSpace(parent))
                {
                    Add(parent);
                    Add(Directory.GetParent(parent)?.FullName);
                }
            }
        }

        return result;
    }

    private bool TryBindExports(nint library)
    {
        if (!NativeLibrary.TryGetExport(library, "curl_global_init", out var globalInitPtr))
            return false;
        if (!NativeLibrary.TryGetExport(library, "curl_easy_init", out var easyInitPtr))
            return false;
        if (!NativeLibrary.TryGetExport(library, "curl_easy_cleanup", out var easyCleanupPtr))
            return false;
        if (!NativeLibrary.TryGetExport(library, "curl_easy_setopt", out var easySetoptPtr))
            return false;
        if (!NativeLibrary.TryGetExport(library, "curl_easy_perform", out var easyPerformPtr))
            return false;
        if (!NativeLibrary.TryGetExport(library, "curl_easy_getinfo", out var easyGetinfoPtr))
            return false;
        if (!NativeLibrary.TryGetExport(library, "curl_easy_strerror", out var easyStrerrorPtr))
            return false;
        if (!NativeLibrary.TryGetExport(library, "curl_easy_impersonate", out var easyImpersonatePtr))
            return false;

        _curl_global_init = Marshal.GetDelegateForFunctionPointer<CurlGlobalInit>(globalInitPtr);
        _curl_easy_init = Marshal.GetDelegateForFunctionPointer<CurlEasyInit>(easyInitPtr);
        _curl_easy_cleanup = Marshal.GetDelegateForFunctionPointer<CurlEasyCleanup>(easyCleanupPtr);
        _curl_easy_setopt = Marshal.GetDelegateForFunctionPointer<CurlEasySetopt>(easySetoptPtr);
        _curl_easy_perform = Marshal.GetDelegateForFunctionPointer<CurlEasyPerform>(easyPerformPtr);
        _curl_easy_getinfo_long = Marshal.GetDelegateForFunctionPointer<CurlEasyGetinfoLong>(easyGetinfoPtr);
        _curl_easy_strerror = Marshal.GetDelegateForFunctionPointer<CurlEasyStrerror>(easyStrerrorPtr);
        _curl_easy_impersonate = Marshal.GetDelegateForFunctionPointer<CurlEasyImpersonate>(easyImpersonatePtr);
        return true;
    }

    private string GetErrorText(CurlCode code, nint errorBufferPtr)
    {
        var buf = Marshal.PtrToStringAnsi(errorBufferPtr);
        if (!string.IsNullOrWhiteSpace(buf))
            return buf.Trim();

        var s = _curl_easy_strerror!.Invoke(code);
        return s == IntPtr.Zero ? $"curl error {code}" : (Marshal.PtrToStringAnsi(s) ?? $"curl error {code}");
    }

    private static void InitErrorBuffer(nint ptr, int size)
    {
        for (var i = 0; i < size; i++)
            Marshal.WriteByte(ptr, i, 0);
    }

    private static UIntPtr WriteToStream(IntPtr ptr, UIntPtr size, UIntPtr nmemb, IntPtr userdata)
    {
        var bytes = (ulong)size * (ulong)nmemb;
        if (bytes == 0)
            return UIntPtr.Zero;

        if (bytes > int.MaxValue)
            return UIntPtr.Zero;

        var handle = GCHandle.FromIntPtr(userdata);
        if (handle.Target is not MemoryStream stream)
            return UIntPtr.Zero;

        var buffer = new byte[(int)bytes];
        Marshal.Copy(ptr, buffer, 0, buffer.Length);
        stream.Write(buffer, 0, buffer.Length);

        return (UIntPtr)bytes;
    }

    private const int ErrorBufferSize = 256;

    [Flags]
    private enum CurlGlobalFlags : long
    {
        All = 3
    }

    private enum CurlCode : int
    {
        Ok = 0
    }

    private enum CurlOption : int
    {
        Url = 10002,
        FollowLocation = 52,
        TimeoutMs = 155,
        ConnectTimeoutMs = 156,
        ErrorBuffer = 10010,
        AcceptEncoding = 10102,
        CaInfo = 10065,
        Referer = 10016,
        Cookie = 10022,
        WriteData = 10001,
        WriteFunction = 20011
    }

    private enum CurlInfo : int
    {
        ResponseCode = 2097154
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate CurlCode CurlGlobalInit(long flags);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate IntPtr CurlEasyInit();

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate void CurlEasyCleanup(IntPtr curl);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate CurlCode CurlEasySetopt(IntPtr curl, CurlOption option, IntPtr value);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate CurlCode CurlEasyPerform(IntPtr curl);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate CurlCode CurlEasyGetinfoLong(IntPtr curl, CurlInfo info, out long value);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate IntPtr CurlEasyStrerror(CurlCode code);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate CurlCode CurlEasyImpersonate(IntPtr curl, string target, int defaultHeaders);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate UIntPtr CurlWriteCallback(IntPtr ptr, UIntPtr size, UIntPtr nmemb, IntPtr userdata);
}
