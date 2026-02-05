"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpHelper = void 0;
class HttpHelper {
    defaultHeaders = new Map();
    setDefaultHeader(name, value) {
        this.defaultHeaders.set(name, value);
    }
    removeDefaultHeader(name) {
        this.defaultHeaders.delete(name);
    }
    setBasicAuth(userName, password) {
        const credentials = Buffer.from(`${userName}:${password}`).toString("base64");
        this.setDefaultHeader("Authorization", `Basic ${credentials}`);
    }
    async get(url, headers, timeoutMs) {
        const response = await this.request("GET", url, { headers, timeoutMs });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.text;
    }
    async post(url, formData, headers, timeoutMs) {
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
    async postMultipart(url, formData, headers, timeoutMs) {
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
    async request(method, url, options = {}) {
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
        }
        finally {
            if (timeout) {
                clearTimeout(timeout);
            }
        }
    }
}
exports.HttpHelper = HttpHelper;
