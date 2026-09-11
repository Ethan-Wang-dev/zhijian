# X 数据源选择

本文记录值见 0.3.2 选择 X 数据源的依据。页面能力和价格核验日期为 2026-09-11；第三方服务可能随时调整，接入前应重新确认。

## 结论

不存在一个已经确认“免费、稳定、允许自动提取，并且直接提供全站高价值帖子正文”的热门榜网站。可用方案应拆成三层：

1. 趋势或搜索 API 负责召回待评审内容。
2. 数据 API 或 RSS 服务负责返回具体帖子。
3. 值见的 LLM 负责判断这些内容是否符合当前用户的价值需求。

值见 0.3.0 首先接入 TwitterAPI.io，因为它同时有地区趋势和高级帖子搜索，并且不需要用户的 X 登录态。0.3.2 起，当用户手动分析 X 搜索页或账号页时，也会复用当前 URL 条件，通过搜索接口最多读取 3 页。当前页功能只读取 URL，不读取 X DOM；X 首页、通知和消息等个性化页面不会被读取。

## 必须先知道的合规边界

X [Terms of Service](https://x.com/en/tos) 写明，未经 X 明确书面许可，抓取/爬取 X 服务在任何形式、任何目的下都被禁止，并要求只能通过 X 当前提供的公开接口访问服务。[Developer Policy](https://developer.x.com/en/developer-terms/policy) 及其 [Restricted Uses](https://developer.x.com/en/developer-terms/more-on-restricted-use-cases) 还规定了垃圾信息、规避限速、离线存储、重新分发和模型训练等限制。

因此值见采取以下保守边界：

- 不请求 X 网站，不读取 X Cookie 或登录态，不声明 X 网站 host permission。
- 不注入 content script，不自动滚动、点击、打开 X 标签页，也不代替用户执行账号动作。
- 只在用户主动点击当前页按钮后，根据搜索页/公开账号页 URL 调用用户自行配置的第三方只读 API；定时任务也只请求第三方 API 和 RSS。
- 第三方 API 的数据授权和合规不能由值见保证。值见不能承诺账号“绝对不会”被 X 限制；若要完全避开 X 数据风险，应关闭 X 数据源。

## 已核验的数据来源

| 来源 | 能拿到什么 | 价格/限制摘要 | 当前决定 |
| --- | --- | --- | --- |
| [TwitterAPI.io](https://twitterapi.io/) | 高级搜索、账号时间线、List、趋势、帖子正文和互动字段 | 按官网为 `$0.15 / 1,000 tweets`，使用 `X-API-Key`；独立第三方服务 | 0.3.0 默认适配器 |
| [TweetAPI](https://tweetapi.com/) | 公开帖子搜索、账号、时间线和互动字段 | 100 次一次性免费请求；订阅从 `$17/月` 起；公开 OpenAPI 当前未列出趋势端点 | 可作为第二搜索适配器，不能单独完成当前趋势发现 |
| [Desearch](https://www.desearch.ai/twitter-api) | 实时/语义搜索、帖子、账号、互动信号、30 天历史 | 页面标示 `$0.15 / 1,000 posts` 和少量免费额度 | 能力适合 AI 检索，待进一步验证接口稳定性和数据条款 |
| [Sorsa](https://api.sorsa.io/blog/twitter-trends-api) | WOEID 趋势、搜索和多类 X 接口 | 100 次免费请求，随后从 `$49/月` 起；趋势与搜索分开调用 | 可作为未来备选适配器 |
| [RSS.app](https://rss.app/rss-feed/create-twitter-rss-feed) | 把 X 用户、Hashtag 或搜索转换为 RSS | 7 天试用；不同套餐刷新频率和 Feed 数不同 | 无需专门适配，生成的 Feed 可直接填入值见 |
| [Trends24](https://trends24.in/) / [xTrends](https://xtrends.iamrohit.in/) | 地区趋势名、排名和估算帖子量 | 未确认稳定的正式帖子 API | 只能做趋势线索，不能提供完整帖子内容 |
| [GetDayTrends](https://getdaytrends.com/) | 地区趋势、Most Tweeted、趋势历史 | Terms 明确禁止 mass extract、cache、save 或 transfer 网站信息 | 不作为自动采集源 |

## 已实现的 TwitterAPI.io 调用

值见只调用只读接口：

```text
GET https://api.twitterapi.io/twitter/trends
GET https://api.twitterapi.io/twitter/tweet/advanced_search
```

认证头为 `X-API-Key`。趋势请求使用 WOEID；搜索请求使用 `query` 和 `queryType=Latest|Top`。值见不会调用发帖、点赞、关注或私信接口。

搜索接口支持 cursor 分页。手动“当前页分析”最多请求 3 页，使用页面 URL 中的搜索词或账号名；这些请求发往第三方 API，不会向 X 页面发送滚动、点击或加载指令。分页请求会消耗第三方 API 配额，用户需要自行承担费用。

## 风险判断

第三方 API 模式显著降低了用户 X 账号的直接操作风险，因为值见没有用户账号凭据，也不会模拟该账号的浏览行为。但它把数据授权和供应商风险单独暴露出来：

- 数据授权和平台条款可能变化。
- 返回字段、限流和价格可能变化。
- 供应商可能停服或降低数据覆盖。
- 浏览器扩展本地保存的 API Key 仍需像其他开发者凭据一样保护。

所以，生产使用前应核对第三方 API 的授权来源、X 条款、价格和限速；不要把“没有使用 X Cookie”误解为获得了 X 官方许可。RSS 和开放网站来源可在关闭 X 数据源时继续工作。
