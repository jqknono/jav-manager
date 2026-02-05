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
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
