const DEFAULTS = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  valueProfile: "我时间有限，优先看有新信息、可信、有实际影响、能帮助我思考或做决策的内容。少推荐纯情绪、营销和重复内容。",
  topics: "",
  accounts: "",
  maxCandidates: 40,
  notify: true,
  autoAnalyze: true
};

const fields = ["apiKey", "baseUrl", "model", "valueProfile", "topics", "accounts", "maxCandidates", "notify", "autoAnalyze"];

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await chrome.storage.local.get(DEFAULTS);
  fields.forEach((field) => {
    const element = document.getElementById(field);
    if (element) element.type === "checkbox" ? element.checked = Boolean(settings[field]) : element.value = settings[field];
  });
  document.getElementById("save").addEventListener("click", save);
  document.getElementById("test").addEventListener("click", test);
});

async function save() {
  const values = readValues();
  await chrome.storage.local.set(values);
  await requestEndpointPermission(values.baseUrl);
  showStatus("已保存。", false);
}

async function test() {
  await save();
  const button = document.getElementById("test");
  button.disabled = true;
  showStatus("正在测试…", false);
  const result = await chrome.runtime.sendMessage({ type: "TEST_CONNECTION" });
  button.disabled = false;
  showStatus(result?.ok ? "连接成功。" : (result?.error || "连接失败。"), !result?.ok);
}

function readValues() {
  const values = {};
  fields.forEach((field) => {
    const element = document.getElementById(field);
    values[field] = element.type === "checkbox" ? element.checked : element.value.trim();
  });
  values.maxCandidates = Math.max(10, Math.min(100, Number(values.maxCandidates) || 40));
  return values;
}

async function requestEndpointPermission(baseUrl) {
  try {
    const origin = new URL(baseUrl).origin;
    if (!origin.includes("api.openai.com") && !origin.includes("api.deepseek.com") && !origin.includes("openrouter.ai")) {
      await chrome.permissions.request({ origins: [`${origin}/*`] });
    }
  } catch {
    // The fetch will provide a more useful error if the provider URL is invalid.
  }
}

function showStatus(text, isError) {
  const status = document.getElementById("status");
  status.textContent = text;
  status.style.color = isError ? "#a54a42" : "#58724b";
}
