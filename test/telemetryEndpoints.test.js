const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getBaseEndpoint,
  getTelemetryPostUrl,
  getJavInfoPostUrl,
  normalizeBaseEndpointOrNull,
} = require("../dist/utils/telemetryEndpoints");

test("normalizeBaseEndpointOrNull trims /api/telemetry", () => {
  assert.equal(
    normalizeBaseEndpointOrNull("https://example.com/api/telemetry"),
    "https://example.com"
  );
});

test("normalizeBaseEndpointOrNull trims /api/javinfo", () => {
  assert.equal(
    normalizeBaseEndpointOrNull("https://example.com/api/javinfo"),
    "https://example.com"
  );
});

test("getTelemetryPostUrl appends /api/telemetry", () => {
  assert.equal(
    getTelemetryPostUrl("https://example.com/api"),
    "https://example.com/api/telemetry"
  );
});

test("getJavInfoPostUrl appends /api/javinfo", () => {
  assert.equal(
    getJavInfoPostUrl("https://example.com"),
    "https://example.com/api/javinfo"
  );
});

test("getBaseEndpoint falls back to default when input empty", () => {
  assert.equal(getBaseEndpoint(""), "https://jav-manager.techfetch.dev");
});
