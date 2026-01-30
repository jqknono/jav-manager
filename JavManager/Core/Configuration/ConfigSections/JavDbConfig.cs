namespace JavManager.Core.Configuration.ConfigSections;

public class JavDbConfig
{
    public string BaseUrl { get; set; } = "https://javdb.com";
    public List<string> MirrorUrls { get; set; } = new();
    public int RequestTimeout { get; set; } = 30000;
    
    /// <summary>
    /// User-Agent string to use for requests.
    /// </summary>
    public string? UserAgent { get; set; }

    /// <summary>
    /// Use curl-impersonate to mimic real browser TLS/HTTP2 fingerprints (no browser automation).
    /// Requires curl-impersonate to be installed on the machine.
    /// </summary>
    public CurlImpersonateConfig CurlImpersonate { get; set; } = new();

    public sealed class CurlImpersonateConfig
    {
        /// <summary>
        /// Enable curl-impersonate for JavDB requests (default: true).
        /// </summary>
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Target name for curl_easy_impersonate(), e.g. "chrome116", "edge101", "ff117".
        /// See the official list in the curl-impersonate project.
        /// </summary>
        public string Target { get; set; } = "chrome116";

        /// <summary>
        /// Path to libcurl-impersonate (or library name resolvable via system loader paths).
        /// Examples:
        /// - Linux: "libcurl-impersonate.so"
        /// - macOS: "libcurl-impersonate.dylib"
        /// - Windows (if you build one): "libcurl-impersonate.dll"
        /// </summary>
        public string LibraryPath { get; set; } = string.Empty;

        /// <summary>
        /// CA bundle path for libcurl (PEM format). If empty, the app will try to find
        /// a bundled `cacert.pem` next to the vendored native library.
        /// </summary>
        public string CaBundlePath { get; set; } = string.Empty;

        /// <summary>
        /// Whether to apply built-in default HTTP headers from curl-impersonate.
        /// If false, the app will provide its own headers via libcurl.
        /// </summary>
        public bool DefaultHeaders { get; set; } = true;
    }
}
