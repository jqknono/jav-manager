export interface HttpResponse {
  status: number;
  text: string;
  headers: Headers;
}

export class HttpHelper {
  private defaultHeaders = new Map<string, string>();

  setDefaultHeader(name: string, value: string): void {
    this.defaultHeaders.set(name, value);
  }

  removeDefaultHeader(name: string): void {
    this.defaultHeaders.delete(name);
  }

  setBasicAuth(userName: string, password: string): void {
    const credentials = Buffer.from(`${userName}:${password}`).toString("base64");
    this.setDefaultHeader("Authorization", `Basic ${credentials}`);
  }

  async get(url: string, headers?: Record<string, string>, timeoutMs?: number): Promise<string> {
    const response = await this.request("GET", url, { headers, timeoutMs });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text;
  }

  async post(url: string, formData: Record<string, string>, headers?: Record<string, string>, timeoutMs?: number): Promise<string> {
    const body = new URLSearchParams(formData).toString();
    const response = await this.request("POST", url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(headers ?? {}),
      },
      body,
      timeoutMs,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text;
  }

  async postMultipart(
    url: string,
    formData: Record<string, string>,
    headers?: Record<string, string>,
    timeoutMs?: number
  ): Promise<string> {
    const data = new FormData();
    for (const [key, value] of Object.entries(formData)) {
      data.append(key, value ?? "");
    }
    const response = await this.request("POST", url, { headers, body: data, timeoutMs });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text;
  }

  async request(
    method: string,
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: BodyInit;
      timeoutMs?: number;
    } = {}
  ): Promise<HttpResponse> {
    const headers = new Headers();
    for (const [key, value] of this.defaultHeaders.entries()) {
      headers.set(key, value);
    }
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeout = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : null;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body,
        signal: controller.signal,
      });
      const text = await response.text();
      return { status: response.status, text, headers: response.headers };
    } catch (error: unknown) {
      throw new Error(extractFetchErrorMessage(error, url));
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}

/**
 * Node.js built-in fetch wraps network errors in a generic TypeError
 * with message "fetch failed". The actual reason (DNS failure, connection
 * refused, TLS error, etc.) is stored in `error.cause`. This helper
 * extracts the deepest meaningful message so callers see actionable info.
 */
function extractFetchErrorMessage(error: unknown, url: string): string {
  if (!(error instanceof Error)) {
    return `Request to ${url} failed`;
  }

  // Dig into cause chain for the real error.
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    const hostname = (cause as { hostname?: string }).hostname;
    if (code === "ENOTFOUND") {
      return `DNS lookup failed for ${hostname || url} (ENOTFOUND)`;
    }
    if (code === "ECONNREFUSED") {
      return `Connection refused: ${url} (ECONNREFUSED)`;
    }
    if (code === "ECONNRESET") {
      return `Connection reset: ${url} (ECONNRESET)`;
    }
    if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
      return `Connection timed out: ${url} (${code})`;
    }
    if (cause.message && cause.message !== "fetch failed") {
      return `${cause.message} (${url})`;
    }
  }

  if (error.name === "AbortError") {
    return `Request timed out: ${url}`;
  }

  return error.message !== "fetch failed"
    ? `${error.message} (${url})`
    : `Request to ${url} failed`;
}
