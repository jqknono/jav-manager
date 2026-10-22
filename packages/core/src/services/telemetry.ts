import os from "os";
import { getTelemetryPostUrl } from "@jav-manager/shared-utils";
import { TelemetryConfig } from "../config";
import { getVersion } from "../utils/appInfo";

export class TelemetryService {
  private enabled: boolean;
  private endpoint: string;
  private info: {
    machineName: string;
    userName: string;
    appVersion: string;
    osInfo: string;
  };

  constructor(config: TelemetryConfig) {
    this.enabled = config.enabled;
    this.endpoint = getTelemetryPostUrl(config.endpoint);
    this.info = {
      machineName: getMachineNameSafe(),
      userName: getUserNameSafe(),
      appVersion: getVersion(),
      osInfo: getOsInfo(),
    };
  }

  trackStartup(): void {
    this.sendEvent("startup", null);
  }

  trackSearch(searchTerm?: string): void {
    this.sendEvent("search", searchTerm ? `term:${searchTerm}` : null);
  }

  trackEvent(eventType: string, eventData?: string | null): void {
    this.sendEvent(eventType, eventData ?? null);
  }

  private sendEvent(eventType: string, eventData: string | null): void {
    if (!this.enabled) {
      return;
    }

    const payload = {
      machine_name: this.info.machineName,
      user_name: this.info.userName,
      app_version: this.info.appVersion,
      os_info: this.info.osInfo,
      event_type: eventType,
      event_data: eventData,
    };

    // Fire-and-forget: telemetry should never block main workflow.
    void fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }
}

function getMachineNameSafe(): string {
  const fromEnv = process.env.COMPUTERNAME || process.env.HOSTNAME;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }
  try {
    const host = os.hostname();
    if (host && host.trim()) {
      return host.trim();
    }
  } catch {
    // ignore
  }
  return `machine-${randomId()}`;
}

function getUserNameSafe(): string {
  const fromEnv = process.env.USERNAME || process.env.USER;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }
  try {
    const user = os.userInfo().username;
    if (user && user.trim()) {
      return user.trim();
    }
  } catch {
    // ignore
  }
  return `user-${randomId()}`;
}

function getOsInfo(): string {
  try {
    return `${os.platform()} ${os.release()}`;
  } catch {
    return "unknown";
  }
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10);
}
