const test = require("node:test");
const assert = require("node:assert/strict");
const { HealthCheckService, ServiceAvailability, TorrentSelectionService } = require("@jav-manager/core/services");
const core = require("@jav-manager/core");

// 拆分后两个既有公开入口继续暴露相同服务，调用者按原接口构造并获取健康检查结果。
test("core 服务导出兼容，健康状态由 provider 结果更新", async () => {
  assert.equal(core.HealthCheckService, HealthCheckService);
  assert.equal(core.ServiceAvailability, ServiceAvailability);
  const expected = [
    { serviceName: "JavDB", isHealthy: true, message: "ready" },
    { serviceName: "SubtitleCat", isHealthy: true, message: "ready" },
  ];
  const checkers = expected.map((result) => ({ serviceName: result.serviceName, checkHealth: async () => result }));
  const health = new HealthCheckService(checkers, { get: (key) => key });
  const results = await health.checkAll();
  assert.deepEqual(results, expected);
  const availability = new ServiceAvailability();
  availability.updateFrom(results);
  assert.equal(availability.remoteSearchAvailable, true);
  assert.equal(availability.subtitleAvailable, true);
});

// 用已定义的标记权重验证选种主路径，断言用户最终得到的磁力链接。
test("选种服务通过公共入口返回最高权重磁力链接", () => {
  assert.equal(core.TorrentSelectionService, TorrentSelectionService);
  const service = new TorrentSelectionService(false);
  const torrents = [
    { title: "ABC-001 HD", magnetLink: "magnet:?xt=urn:btih:hd", hasHd: true, hasSubtitle: false, hasUncensoredMarker: false },
    { title: "ABC-001-UC", magnetLink: "magnet:?xt=urn:btih:uc", hasHd: false, hasSubtitle: true, hasUncensoredMarker: true },
  ];
  assert.equal(service.selectBest(torrents).magnetLink, "magnet:?xt=urn:btih:uc");
});
