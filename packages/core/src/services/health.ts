import { HealthCheckResult, IHealthChecker } from "@jav-manager/domain";
import { LocalizationService } from "../localization";

export class ServiceAvailability {
  javDbKnown = false;
  javDbHealthy = false;
  subtitleKnown = false;
  subtitleHealthy = false;

  get remoteSearchAvailable(): boolean {
    return !this.javDbKnown || this.javDbHealthy;
  }

  get subtitleAvailable(): boolean {
    return !this.subtitleKnown || this.subtitleHealthy;
  }

  updateFrom(results: HealthCheckResult[]): void {
    if (!results) {
      return;
    }

    const javDb = results.find((r) => r.serviceName.toLowerCase().includes("javdb"));
    if (javDb) {
      this.javDbKnown = true;
      this.javDbHealthy = javDb.isHealthy;
    }

    const subtitle = results.find((r) => r.serviceName.toLowerCase().includes("subtitle"));
    if (subtitle) {
      this.subtitleKnown = true;
      this.subtitleHealthy = subtitle.isHealthy;
    }
  }
}

export class HealthCheckService {
  private checkers: IHealthChecker[];
  private loc: LocalizationService;

  constructor(checkers: IHealthChecker[], loc: LocalizationService) {
    this.checkers = checkers;
    this.loc = loc;
  }

  async checkAll(): Promise<HealthCheckResult[]> {
    const tasks = this.checkers.map(async (checker) => {
      try {
        return await checker.checkHealth();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { serviceName: checker.serviceName, isHealthy: false, message: message || this.loc.get("health_fail") };
      }
    });
    return Promise.all(tasks);
  }
}
