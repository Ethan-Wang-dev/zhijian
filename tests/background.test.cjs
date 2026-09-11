const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadBackground() {
  const event = { addListener() {} };
  const chrome = {
    runtime: { onInstalled: event, onStartup: event, onMessage: event },
    alarms: { create() {}, onAlarm: event },
    notifications: { create() {}, clear() {}, onClicked: event },
    storage: { local: { get: async (defaults) => defaults, set: async () => {}, remove: async () => {} } },
    tabs: { query: async () => [], create: async () => ({}), get: async () => ({}), remove: async () => {}, sendMessage: async () => ({}) }
  };
  const context = vm.createContext({ chrome, URL, AbortController, fetch, setTimeout, clearTimeout, console });
  const code = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  vm.runInContext(code, context);
  return context;
}

test("parses RSS items into normalized candidates", () => {
  const context = loadBackground();
  const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[一条重要更新]]></title><link>https://example.com/post-1</link><description><![CDATA[<p>包含真实细节的摘要。</p>]]></description><pubDate>Wed, 09 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const result = context.parseFeed(xml, new URL("https://example.com/feed.xml"));
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "一条重要更新");
  assert.equal(result[0].url, "https://example.com/post-1");
  assert.match(result[0].text, /包含真实细节/);
  assert.equal(result[0].sourceType, "rss");
});

test("parses Atom link attributes", () => {
  const context = loadBackground();
  const xml = `<feed><entry><title>Agent 研究</title><link href="https://example.org/agent"/><summary>New evidence &amp; analysis</summary><updated>2026-09-09T10:00:00Z</updated></entry></feed>`;
  const result = context.parseFeed(xml, new URL("https://example.org/atom.xml"));
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://example.org/agent");
  assert.match(result[0].text, /New evidence & analysis/);
});

test("deduplicates candidates by id", () => {
  const context = loadBackground();
  const result = context.deduplicateTweets([
    { id: "1", text: "first" },
    { id: "1", text: "duplicate" },
    { id: "2", text: "second" }
  ]);
  assert.deepEqual(result.map((item) => item.id), ["1", "2"]);
});

test("normalizes TwitterAPI.io tweets", () => {
  const context = loadBackground();
  const result = context.normalizeXApiTweet({
    id: "123",
    text: "A useful update",
    createdAt: "2026-09-11T10:00:00Z",
    author: { userName: "builder" },
    likeCount: 12,
    retweetCount: 3,
    replyCount: 4,
    viewCount: 900
  }, "X 全站发现");
  assert.equal(result.url, "https://x.com/builder/status/123");
  assert.equal(result.author, "@builder");
  assert.equal(result.metrics.likes, 12);
  assert.equal(result.metrics.reposts, 3);
  assert.equal(result.sourceType, "x-api");
});

test("builds bounded literal discovery queries", () => {
  const context = loadBackground();
  const result = context.buildLiteralOrQuery(["AI agents", "#opensource", "AI agents"]);
  assert.equal(result, '"AI agents" OR #opensource');
  assert.ok(context.buildLiteralOrQuery(["a", "b", "c"], 8).length <= 8);
});

test("limits candidates without starving later sources", () => {
  const context = loadBackground();
  const result = context.limitCandidatesFairly([
    { id: "a1", sourceName: "A" },
    { id: "a2", sourceName: "A" },
    { id: "a3", sourceName: "A" },
    { id: "b1", sourceName: "B" },
    { id: "b2", sourceName: "B" }
  ], 4);
  assert.deepEqual(Array.from(result, (item) => item.id), ["a1", "b1", "a2", "b2"]);
});
