document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refresh").addEventListener("click", refresh);
  document.getElementById("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("emptySettings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  loadResult();
});

async function loadResult() {
  const response = await chrome.runtime.sendMessage({ type: "GET_LAST_RESULT" });
  if (!response?.result) {
    document.getElementById("runStatus").textContent = "还没有完成过扫描。";
    document.getElementById("empty").hidden = false;
    return;
  }
  renderResult(response.result);
}

async function refresh() {
  const button = document.getElementById("refresh");
  button.disabled = true;
  document.getElementById("runStatus").textContent = "正在扫描账号、主题和 RSS，可能需要几十秒…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "REFRESH_NOW" });
    if (!result?.ok) throw new Error(result?.error || "扫描失败");
    renderResult(result);
  } catch (error) {
    document.getElementById("runStatus").textContent = error.message || "扫描失败";
  } finally {
    button.disabled = false;
  }
}

function renderResult(result) {
  document.getElementById("empty").hidden = true;
  document.getElementById("content").hidden = false;
  const time = result.at ? new Date(result.at).toLocaleString() : "刚刚";
  document.getElementById("runStatus").textContent = `${time} · ${result.candidateCount || 0} 个候选 · 主推荐 ${result.top?.length || 0} 条`;
  document.getElementById("summary").textContent = result.summary || "本轮已按你的价值需求完成筛选。";
  const sourceStats = document.getElementById("sourceStats");
  sourceStats.innerHTML = "";
  Object.entries(result.sourceStats || {}).forEach(([name, count]) => {
    const chip = document.createElement("span");
    chip.className = "source-chip";
    chip.textContent = `${name} · ${count}`;
    sourceStats.appendChild(chip);
  });
  renderItems(document.getElementById("top"), result.top || []);
  const othersWrap = document.getElementById("othersWrap");
  othersWrap.hidden = !(result.others || []).length;
  renderItems(document.getElementById("others"), result.others || []);
}

function renderItems(container, items) {
  container.innerHTML = "";
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "item-card";
    const title = item.title || item.text || "未命名内容";
    card.innerHTML = `
      <div class="item-meta"><span>#${index + 1}</span><span>${escapeHtml(item.type || "内容")}</span><span>${Math.round(item.score || 0)} 分</span><span>${escapeHtml(item.sourceName || "来源")}</span></div>
      <a class="item-title" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title.slice(0, 180))}</a>
      ${item.title && item.text !== item.title ? `<p class="item-text">${escapeHtml(String(item.text || "").slice(0, 500))}</p>` : ""}
      <p class="reason"><b>为什么推荐：</b>${escapeHtml(item.worth_reading_reason || "与当前价值需求匹配。")}</p>
      <p class="reason"><b>互动判断：</b>${escapeHtml(item.worth_interacting_reason || "请阅读原文后自行判断。")}</p>
      <div class="item-actions"><button data-feedback="useful">有用</button><button data-feedback="not_useful">不太相关</button></div>`;
    card.querySelectorAll("[data-feedback]").forEach((button) => button.addEventListener("click", () => {
      button.disabled = true;
      chrome.runtime.sendMessage({ type: "FEEDBACK", feedback: { tweetId: item.id, value: button.dataset.feedback, score: item.score } });
    }));
    container.appendChild(card);
  });
}

function safeUrl(url) {
  try {
    const parsed = new URL(url || "https://x.com/home");
    return /^https?:$/.test(parsed.protocol) ? parsed.href.replace(/"/g, "%22") : "https://x.com/home";
  } catch { return "https://x.com/home"; }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}
