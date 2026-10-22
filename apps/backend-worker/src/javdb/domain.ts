import { jsonResponse } from '../http';
import { memCacheGet, memCacheSet } from '../storage/memory';

// 现有最新域名查询及其内存缓存。

async function getJavDbDomain(corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const cacheKey = 'javdb:domain';
    const cached = memCacheGet<unknown>(cacheKey, 60 * 60_000);
    if (cached) {
      return jsonResponse(cached, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=3600' } });
    }
    // 从 javdb.com 获取 HTML
    const response = await fetch('https://javdb.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // 只提取"最新域名"
    const latestDomainMatch = html.match(/最新域名:\s*<a[^>]+href="https:\/\/([^"]+)"[^>]*>([^<]+)<\/a>/);

    if (!latestDomainMatch) {
      throw new Error('Could not extract latest domain from javdb.com');
    }

    const latestDomain = latestDomainMatch[2];

    const payload = {
      success: true,
      domains: [latestDomain],
    };
    memCacheSet(cacheKey, payload);
    return jsonResponse(payload, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=3600' } });
  } catch (error) {
    console.error('Failed to get JavDB domain:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to fetch domains from javdb.com',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500, headers: corsHeaders });
  }
}

export { getJavDbDomain };
