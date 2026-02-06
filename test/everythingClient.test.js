const test = require("node:test");
const assert = require("node:assert/strict");

const { EverythingHttpClient } = require("../dist/data/everything");

function createClientWithResponse(jsonResponse) {
  const http = {
    get: async () => jsonResponse,
    setBasicAuth: () => undefined,
    removeDefaultHeader: () => undefined,
  };

  return new EverythingHttpClient(
    {
      baseUrl: "http://localhost:8080",
      userName: null,
      password: null,
    },
    http,
  );
}

test("EverythingHttpClient.search parses numeric string size", async () => {
  const client = createClientWithResponse(
    JSON.stringify({
      results: [
        {
          name: "MIAA-710.mp4",
          path: "D:\\Videos",
          size: "6893422510",
        },
      ],
    }),
  );

  const results = await client.search("MIAA-710");
  assert.equal(results.length, 1);
  assert.equal(results[0].size, 6893422510);
});

test("EverythingHttpClient.search keeps size as 0 when missing or invalid", async () => {
  const client = createClientWithResponse(
    JSON.stringify({
      results: [
        {
          name: "MIAA-710",
          path: "D:\\Videos",
        },
        {
          name: "MIAA-710-2",
          path: "D:\\Videos",
          size: "unknown",
        },
      ],
    }),
  );

  const results = await client.search("MIAA-710");
  assert.equal(results.length, 2);
  assert.equal(results[0].size, 0);
  assert.equal(results[1].size, 0);
});
