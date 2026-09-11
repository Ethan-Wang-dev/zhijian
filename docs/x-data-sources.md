# X 数据源选择

本文记录值见 0.3.1 选择 X 数据源的依据。页面能力和价格核验日期为 2026-09-11；第三方服务可能随时调整，接入前应重新确认。

## 结论

不存在一个已经确认“免费、稳定、允许自动提取，并且直接提供全站高价值帖子正文”的热门榜网站。可用方案应拆成三层：

1. 趋势或搜索 API 负责召回待评审内容。
2. 数据 API 或 RSS 服务负责返回具体帖子。
3. 值见的 LLM 负责判断这些内容是否符合当前用户的价值需求。

值见 0.3.0 首先接入 TwitterAPI.io，因为它同时有地区趋势和高级帖子搜索，并且不需要用户的 X 登录态。

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

## 风险判断

第三方 API 模式显著降低了用户 X 账号风险，因为值见没有用户账号凭据，也不会模拟该账号的浏览行为。但它把风险转移到了供应商：

- 数据授权和平台条款可能变化。
- 返回字段、限流和价格可能变化。
- 供应商可能停服或降低数据覆盖。
- 浏览器扩展本地保存的 API Key 仍需像其他开发者凭据一样保护。

因此，生产版本应至少保留两个可切换的数据提供商，并让 RSS 和开放网站来源在 X 不可用时继续工作。
