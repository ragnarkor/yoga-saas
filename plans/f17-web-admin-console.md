# F17 · Web 超管后台（HTTP 网关接入）设计

> 版本：v1.0
> 日期：2026-08-20
> 优先级：P2（不阻塞现有小程序功能）
> 关联：`saas-multitenant-design.md`、`api-reference.md`、`product-roadmap.md` F9/F15/F16

---

## 一、核心决策

**不是「Web 后台取代小程序后台」，而是按角色分工，共用同一套云函数接口。**

| 谁用 | 管什么 | 放哪 | 为什么 |
|---|---|---|---|
| 馆主 / 教练（owner/teacher） | 日常运营：确认订单、发卡、看会员、排课 | **保留小程序 coach 端** | 前台、手机、随手就办；已实现且完整，不动 |
| 平台超管（super） | 跨租户：开馆、平台数据、健康度、审计、批量 | **新增 Web 后台** | 大屏多列表、批量操作、导出，手机上本就别扭 |

关键前提（已通过读码验证）：**后端接口零重写**。admin 鉴权走 `event.token` 而非微信 openid，token 是普通字符串，浏览器可携带；`application.app` 只认 `event.route`，不关心请求来自小程序还是浏览器。因此 Web 端与小程序端走**同一条路由与鉴权链**，只是入口和 token 来源不同。

**本设计只解决「后端如何被 Web 调用」。Web 前端页面是独立工程，不在后端改动范围内。**

## 二、目标与边界

### 本期目标
- 云函数增加 **HTTP 入口**，可被普通 HTTPS `fetch` 调用，复用全部现有 `admin/*` 接口。
- Web 端 **账号密码登录换 token**，后续请求带 token 即可通过现有鉴权。
- 打通验证链路：浏览器/Postman 调 `admin/login` → 拿 token → 调 `admin/card_order_list` 成功返回。

### 本期不做
- Web 前端 SPA（另立工程，React/Vue/纯 HTML 皆可）。
- 把馆主日常管理搬到 Web（继续留在小程序）。
- 独立服务器 / 自建数据库（仍用微信云开发）。
- 精细化 RBAC、操作审计增强（已有 F15 审计日志，可复用）。

## 三、请求链路

```
现有（小程序）：
  wx.cloud.callFunction({ route, token, ...params }) → index.js → application.app → Controller

新增（Web）：
  fetch('https://<云函数HTTP访问URL>', {
    method:'POST', body: JSON.stringify({ route, token, ...params })
  }) → index.js（HTTP 分支）→ 解析 body → 拼成框架 event → application.app → 同一 Controller
```

两条链在 `application.app` 之后**完全一致**。

## 四、后端改动清单

| 改动 | 文件 | 量 | 说明 |
|---|---|---|---|
| HTTP 入口分支 | `index.js` | ~35 行 | 识别 HTTP 请求（`event.httpMethod`）、解析 `body`、拼 event、CORS、OPTIONS 预检 |
| CORS 响应包装 | `index.js` 内小函数 | ~10 行 | 给返回值套 `headers`（`Access-Control-Allow-*`） |
| Controller / Service / Model | — | **0 行** | 只认 `route`，来源无关 |
| `config/route.js` | — | **0 行** | 现有 `admin/*` 路由直接可用 |
| `admin/login` | — | **0 行** | 已存在，返回 token，Web 直接用 |

### HTTP 入口分支要点
1. 微信云函数「HTTP 访问服务」触发时，event 带 `httpMethod` / `headers` / `body` / `path`。据此判定是 HTTP 调用。
2. `OPTIONS` 预检：直接返回 200 + CORS 头，不进业务。
3. `POST`：`JSON.parse(event.body)` 得到 `{ route, token, ...params }`，把这些字段展开成框架 event（等价于小程序 callFunction 的 event 结构），交给 `application.app`。
4. 响应：把 `application.app` 的返回值 JSON 序列化，套 CORS 头，按 HTTP 网关要求的 `{ statusCode, headers, body }` 结构返回。
5. 顺序：HTTP 分支需与既有「Timer 定时器」「支付回调」分支并列，均在 `application.app` 之前判定——与现有手法一致。

## 五、鉴权与安全

- **登录**：Web 端调 `admin/login`（账号密码，`config.js` 已有 `ADMIN_NAME`/`ADMIN_PWD`）换 token；后续请求带 `token`，走现有 `isAdmin(token, ...)`。
- **权限收口**：Web 后台定位平台超管，页面只暴露 super 级功能；super 判定沿用现有 `_adminType`。
- **公网暴露风险（HTTP 入口比小程序入口更敏感）**：
  - 登录接口**防爆破**：失败次数限流 / 验证码（后置增强）。
  - **CORS 白名单**：Allow-Origin 限定后台域名，不用 `*`（尤其带 token 时）。
  - 强制 HTTPS（云函数 HTTP 访问服务默认 HTTPS）。
  - token 有效期沿用 `ADMIN_LOGIN_EXPIRE`；敏感操作可加二次确认。
- **安全红线（延续 F7）**：不在库中保存商户密钥/银行卡敏感信息；Web 端同样不展示完整敏感支付信息。

## 六、控制台操作（非代码，部署时一次性）

1. 云开发控制台 → 云函数 → 开启「HTTP 访问服务」，绑定本云函数，拿到访问 URL。
2. 重新部署云函数使 HTTP 入口生效。
3. 用 Postman POST 该 URL，body `{"route":"admin/login","name":"...","pwd":"..."}` 验证拿到 token。

## 七、实施阶段

| 阶段 | 范围 | 交付 | 可独立验证 |
|---|---|---|---|
| P0 | `index.js` HTTP 入口 + CORS；控制台开 HTTP 服务 | 浏览器/Postman 能调 `admin/login` 拿 token，再调 `admin/card_order_list` 成功 | ✅ 不依赖 Web 前端 |
| P1 | Web 前端最小骨架：登录页 + 一个列表页（如订单/租户） | 全链路 UI 跑通 | ✅ |
| P2 | 平台超管功能页：开馆、平台总览、健康度、审计日志（复用 F9/F15/F16 接口） | 超管日常在 Web 完成 | ✅ |
| P3（可选） | 登录防爆破、CORS 白名单、操作审计增强 | 公网安全加固 | ✅ |

## 八、上线前检查清单

- [ ] HTTP 入口只解析可信字段，`body` 解析失败安全返回，不抛裸异常。
- [ ] OPTIONS 预检正确返回，浏览器跨域请求不被拦。
- [ ] CORS Allow-Origin 为后台域名白名单，非 `*`。
- [ ] 未带合法 token 的 `admin/*` 请求被现有鉴权拒绝（Web 与小程序一致）。
- [ ] Web 后台仅暴露 super 级功能，owner/teacher 日常仍走小程序。
- [ ] 定时器 / 支付回调 / HTTP / 小程序四类入口互不误判。
- [ ] 登录接口具备基本防爆破（或已排期 P3）。

## 九、为什么这样做（决策留档）

- **省**：后端接口零重写，复用已建的路由/鉴权/多租户/参数校验全套。
- **稳**：与已上线的「支付回调入口」「定时器入口」同一种手法、同一处位置，风险已知。
- **对**：按角色分工——手机场景留小程序、大屏场景上 Web，各取所长，不是非此即彼。
- **可退**：Web 前端是独立工程，即使不做，后端 HTTP 入口也不影响小程序现有链路。
