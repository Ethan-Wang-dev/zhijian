document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const current = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  if (!current?.configured) {
    status.textContent = "还没有配置 LLM API Key，请先打开设置。";
  } else if (current.lastResult) {
    const time = new Date(current.lastResult.at).toLocaleString();
    status.textContent = `已配置 ${current.model}\n上次分析：${time}，${current.lastResult.count} 条主推荐`;
  } else {
    status.textContent = `已配置 ${current.model}\n还没有分析记录。`;
  }

  document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("analyze").addEventListener("click", analyzeCurrentTab);
});

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
    const collected = await chrome.tabs.sendMessage(tab.id, { type: "COLLECT_TWEETS" });
    const result = await chrome.runtime.sendMessage({ type: "RUN_ANALYSIS", tweets: collected?.tweets || [], source: "manual", tabId: tab.id });
    if (!result?.ok) throw new Error(result?.error || "分析失败");
    status.textContent = `完成：${result.top.length} 条主推荐，${result.others.length} 条候选。\n请查看 X 页面右下角的值见面板。`;
  } catch (error) {
    status.textContent = error.message || "分析失败";
  } finally {
    button.disabled = false;
  }
}
