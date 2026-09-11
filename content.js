(function () {
  if (window.__ZHIJIAN_CONTENT_LOADED__) return;
  window.__ZHIJIAN_CONTENT_LOADED__ = true;
  const ROOT_ID = "zhijian-root";
  let latestResult = null;
  let capturePageKey = getPageKey();
  const capturedTweets = new Map();

  function init() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <button class="zhijian-launcher" title="打开值见">值</button>
      <section class="zhijian-panel" aria-label="值见内容面板" hidden>
        <header class="zhijian-header">
          <div><strong>值见</strong><span>每半小时，找到真正值得看的内容</span></div>
          <button class="zhijian-close" aria-label="关闭">×</button>
        </header>
        <div class="zhijian-toolbar">
          <button class="zhijian-analyze">快速分析已加载内容</button>
          <span class="zhijian-status">只读取当前页，不自动滚动</span>
        </div>
        <div class="zhijian-results"><div class="zhijian-empty">点击后只读取当前页面已经加载的帖子，不会自动滚动、点击或打开新页面。你手动滚动后再次点击即可继续累积。</div></div>
      </section>`;
    document.body.appendChild(root);
    root.querySelector(".zhijian-launcher").addEventListener("click", () => togglePanel(root, true));
    root.querySelector(".zhijian-close").addEventListener("click", () => togglePanel(root, false));
    root.querySelector(".zhijian-analyze").addEventListener("click", () => requestAnalysis(root));
  }

  function togglePanel(root, open) {
    root.querySelector(".zhijian-panel").hidden = !open;
    root.querySelector(".zhijian-launcher").hidden = open;
  }

  function requestAnalysis(root) {
    const status = root.querySelector(".zhijian-status");
    status.textContent = "正在读取当前已加载内容并判断（不会自动滚动）…";
    root.querySelector(".zhijian-analyze").disabled = true;
    const tweets = extractTweets(240);
    status.textContent = `已读取 ${tweets.length} 条，正在判断（不会自动滚动）…`;
    chrome.runtime.sendMessage({
      type: "RUN_ANALYSIS",
      source: "manual",
      tweets,
      capturedCount: tweets.length,
      tabId: null
    }).then((response) => {
      root.querySelector(".zhijian-analyze").disabled = false;
      if (!response?.ok) {
        status.textContent = response?.error || "分析失败";
        return;
      }
      renderResult(root, response);
    }).catch((error) => {
      root.querySelector(".zhijian-analyze").disabled = false;
      status.textContent = error.message || "分析失败";
    });
  }

  function getPageKey() {
    return `${location.pathname}${location.search}`;
  }

  function resetCaptureIfNeeded() {
    const currentPageKey = getPageKey();
    if (currentPageKey !== capturePageKey) {
      capturePageKey = currentPageKey;
      capturedTweets.clear();
    }
  }

  function extractTweets(limit = 240) {
    resetCaptureIfNeeded();
    const seen = new Set();
    const tweets = [];
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      if (tweets.length >= limit) break;
      const text = article.querySelector('[data-testid="tweetText"]')?.innerText?.trim() || "";
      const link = [...article.querySelectorAll('a[href*="/status/"]')]
        .map((anchor) => anchor.href)
        .find((href) => /\/status\/\d+/.test(href));
      const author = article.querySelector('[data-testid="User-Name"]')?.innerText?.split("\n")[0] || "未知作者";
      const id = link?.match(/\/status\/(\d+)/)?.[1] || `${author}|${text.slice(0, 120)}`;
      if (!text || seen.has(id)) continue;
      seen.add(id);
      const metrics = readMetrics(article);
      const tweet = {
        id,
        text,
        url: link || location.href,
        author,
        createdAt: article.querySelector("time")?.dateTime || null,
        metrics
      };
      tweets.push(tweet);
      capturedTweets.set(id, tweet);
    }
    while (capturedTweets.size > 300) capturedTweets.delete(capturedTweets.keys().next().value);
    return [...capturedTweets.values()];
  }

  async function collectSourceTweets() {
    // Browser mode is intentionally passive: do not scroll, click, or trigger more X loading.
    return extractTweets(240);
  }

  function readMetrics(article) {
    const metrics = { likes: 0, reposts: 0, replies: 0, views: 0 };
    for (const element of article.querySelectorAll("[aria-label]")) {
      const label = element.getAttribute("aria-label") || "";
      const value = parseMetric(label);
      if (!value) continue;
      if (/like|赞|喜欢/i.test(label)) metrics.likes = Math.max(metrics.likes, value);
      else if (/repost|retweet|转发/i.test(label)) metrics.reposts = Math.max(metrics.reposts, value);
      else if (/repl|回复|评论/i.test(label)) metrics.replies = Math.max(metrics.replies, value);
      else if (/view|浏览/i.test(label)) metrics.views = Math.max(metrics.views, value);
    }
    return metrics;
  }

  function parseMetric(label) {
    const match = label.replace(/,/g, "").match(/(\d+(?:\.\d+)?)([KMB万亿]?)/i);
    if (!match) return 0;
    const multiplier = { k: 1e3, m: 1e6, b: 1e9, "万": 1e4, "亿": 1e8 }[match[2].toLowerCase()] || 1;
    return Math.round(Number(match[1]) * multiplier);
  }

  function renderResult(root, result) {
    latestResult = result;
    const archive = result.archive || result.others || [];
    root.querySelector(".zhijian-status").textContent = `已读取 ${result.readCount || result.candidateCount || 0} 条，主推荐 ${result.top.length} 条，归档 ${archive.length} 条`;
    const results = root.querySelector(".zhijian-results");
    results.innerHTML = `<p class="zhijian-summary">${escapeHtml(result.summary || "本轮已完成筛选。")}</p>`;
    result.top.forEach((item, index) => results.appendChild(createCard(item, index + 1, "主推荐")));
    if (archive.length) {
      const details = document.createElement("details");
      details.className = "zhijian-others";
      details.innerHTML = `<summary>归档（${archive.length}）</summary>`;
      archive.forEach((item, index) => details.appendChild(createCard(item, index + 1, "归档")));
      results.appendChild(details);
    }
  }

  function createCard(item, rank, label) {
    const card = document.createElement("article");
    card.className = "zhijian-card";
    card.innerHTML = `
      <div class="zhijian-card-meta"><span>${label} ${rank}</span><span>${escapeHtml(item.type || "内容")}</span><span>${Math.round(item.score || 0)} 分</span><span>${escapeHtml(item.sourceName || "X")}</span></div>
      <a class="zhijian-card-text" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.text || "")}</a>
      <p class="zhijian-reason"><b>为什么推荐：</b>${escapeHtml(item.worth_reading_reason || "与当前价值偏好匹配。")}</p>
      <p class="zhijian-reason"><b>互动判断：</b>${escapeHtml(item.worth_interacting_reason || "请阅读原文后自行判断。")}</p>
      <div class="zhijian-feedback"><button data-feedback="useful">有用</button><button data-feedback="not_useful">不太相关</button></div>`;
    card.querySelectorAll("[data-feedback]").forEach((button) => button.addEventListener("click", () => {
      button.disabled = true;
      chrome.runtime.sendMessage({ type: "FEEDBACK", feedback: { tweetId: item.id, value: button.dataset.feedback, score: item.score } });
    }));
    return card;
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url || location.href);
      return /^https?:$/.test(parsed.protocol) ? parsed.href.replace(/"/g, "%22") : location.href;
    } catch {
      return location.href;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "COLLECT_TWEETS") {
      const tweets = extractTweets(240);
      sendResponse({ tweets, capturedCount: tweets.length });
      return true;
    }
    if (message.type === "COLLECT_SOURCE_TWEETS") {
      collectSourceTweets().then((tweets) => sendResponse({ tweets })).catch(() => sendResponse({ tweets: [] }));
      return true;
    }
    if (message.type === "DISPLAY_RESULTS") {
      const root = document.getElementById(ROOT_ID);
      if (root) {
        togglePanel(root, true);
        renderResult(root, message.result);
      }
    }
  });

  init();
  const observer = new MutationObserver(() => init());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
