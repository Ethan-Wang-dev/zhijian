document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const current = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  renderStatus(current);

  document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("dashboard").addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" }));
  document.getElementById("refresh").addEventListener("click", refreshConfiguredSources);
  document.getElementById("analyze").addEventListener("click", analyzeCurrentTab);
});

function renderStatus(current) {
  const status = document.getElementById("status");
  if (!current?.configured) {
    status.textContent = "还没有配置 LLM API Key，请先打开设置。";
  } else if (!current.xConfigured) {
    status.textContent = "LLM 已配置，但 X 数据 API Key 尚未填写。也可以关闭 X 数据源，只使用 RSS/Atom。";
  } else if (!current.sourceCount) {
    status.textContent = "LLM 已配置，但还没有添加账号、主题或 RSS 源。";
  } else if (current.lastResult) {
    const time = new Date(current.lastResult.at).toLocaleString();
    const warning = current.lastResult.sourceErrors?.length ? `\n${current.lastResult.sourceErrors.length} 个来源获取失败，可在结果面板查看。` : "";
    const readCount = current.lastResult.readCount || current.lastResult.candidateCount || 0;
    const archiveCount = current.lastResult.archiveCount ?? Math.max(0, (current.lastResult.others || []).length);
    status.textContent = `${current.sourceCount} 个配置源 · ${current.model}\n上次：${time}，已读取 ${readCount} 条 → ${current.lastResult.count} 条主推荐，${archiveCount} 条归档${warning}`;
    renderResults(current.lastResult.top || []);
  } else {
    status.textContent = `${current.sourceCount} 个配置源 · ${current.model}\n还没有分析记录。`;
  }
}

function renderResults(items) {
  const container = document.getElementById("results");
  container.innerHTML = "";
  items.forEach((item, index) => {
    const link = document.createElement("a");
    link.className = "result";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent = `${index + 1} · ${item.score || 0} 分 · ${item.type || "内容"} · ${item.sourceName || "来源"}`;
    link.appendChild(meta);
    link.append(document.createTextNode(String(item.title || item.text || "").slice(0, 100)));
    container.appendChild(link);
  });
}

async function refreshConfiguredSources() {
  const button = document.getElementById("refresh");
  const status = document.getElementById("status");
  button.disabled = true;
  status.textContent = "正在扫描全站发现、账号、主题和 RSS，可能需要几十秒…";
  document.getElementById("results").innerHTML = "";
  try {
    const result = await chrome.runtime.sendMessage({ type: "REFRESH_NOW" });
    if (!result?.ok) throw new Error(result?.error || "扫描失败，请检查 LLM、X 数据源和 RSS 配置。");
    const warning = result.sourceErrors?.length ? ` ${result.sourceErrors.length} 个来源失败。` : "";
    status.textContent = `完成：已读取 ${result.readCount || result.candidateCount} 条，${result.top.length} 条主推荐，${(result.archive || result.others || []).length} 条归档。${warning}`;
    renderResults(result.top || []);
  } catch (error) {
    status.textContent = error.message || "扫描失败";
  } finally {
    button.disabled = false;
  }
}

async function analyzeCurrentTab() {
  const button = document.getElementById("analyze");
  const status = document.getElementById("status");
  button.disabled = true;
  status.textContent = "正在读取并分析当前页面…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
      throw new Error("请先打开 X 网页。\n浏览器设置页、商店页等页面无法注入值见。\n");
    }
    const collected = await sendToCurrentTab(tab.id, { type: "COLLECT_TWEETS" });
    const result = await chrome.runtime.sendMessage({ type: "RUN_ANALYSIS", tweets: collected?.tweets || [], capturedCount: collected?.capturedCount, source: "manual", tabId: tab.id });
    if (!result?.ok) throw new Error(result?.error || "分析失败");
    status.textContent = `完成：已读取 ${result.readCount || collected?.tweets?.length || 0} 条，${result.top.length} 条主推荐，${(result.archive || result.others || []).length} 条归档。\n请查看 X 页面右下角的值见面板。`;
  } catch (error) {
    status.textContent = error.message || "分析失败";
  } finally {
    button.disabled = false;
  }
}

async function sendToCurrentTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (firstError) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
      await new Promise((resolve) => setTimeout(resolve, 250));
      return await chrome.tabs.sendMessage(tabId, message);
    } catch {
      throw new Error("值见还没有连接到当前 X 页面。请刷新 X 标签页，然后重新点击扩展按钮；如果仍失败，请在 chrome://extensions 中重新加载值见。");
    }
  }
}
