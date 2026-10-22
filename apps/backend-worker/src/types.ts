import type { Env } from './env';
import type { PageLang } from './i18n';

// 遥测与 JavInfo 的请求、存储数据结构。

interface TelemetryPayload {
  machine_name: string;
  user_name: string;
  app_version?: string;
  os_info?: string;
  event_type?: string;
  event_data?: string;
}

interface UserRecord {
  id: number;
  user_id: string | null;
  machine_name: string;
  user_name: string;
  app_version: string | null;
  os_info: string | null;
  event_type: string;
  event_data: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
}

interface JavInfoRecord {
  jav_id: string;
  title: string | null;
  title_zh: string | null;
  cover_url: string | null;
  release_date: string | null;
  duration: number | null;
  director: string | null;
  maker: string | null;
  publisher: string | null;
  series: string | null;
  actors_json: string | null;
  categories_json: string | null;
  torrents_json: string | null;
  detail_url: string | null;
  search_count: number | null;
  created_at: string;
  updated_at: string;
}

type JavInfoPayload = {
  jav_id?: string;
  javId?: string;
  title?: string;
  title_zh?: string;
  titleZh?: string;
  cover_url?: string;
  coverUrl?: string;
  release_date?: string;
  releaseDate?: string;
  duration?: number;
  director?: string;
  maker?: string;
  publisher?: string;
  series?: string;
  actors?: string[];
  categories?: string[];
  torrents?: unknown[];
  detail_url?: string;
  detailUrl?: string;
};

// 路由共用入口已解析的上下文，统一语言 Cookie 的附加时机。
export interface RouteContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  url: URL;
  path: string;
  lang: PageLang;
  admin: boolean;
  corsHeaders: Record<string, string>;
  javdbCorsHeaders: Record<string, string>;
  respond: (response: Response) => Response;
}

export { JavInfoPayload, JavInfoRecord, TelemetryPayload, UserRecord };
