# F7 · 会员购卡申请与人工确认设计

> 版本：v1.1
> 日期：2026-08-20
> 优先级：P2
> 关联：`product-roadmap.md` F7、F8；`SETUP_FEATURES.payment` 开关

---

## 一、当前决策

**本期不接入微信支付，也不保存任何商户号、API 密钥或银行卡敏感信息。**

会员可在小程序内浏览可售套餐并提交购卡申请；页面展示馆方配置的付款说明，例如“到店付款”“向指定银行卡转账后联系馆主确认”或“联系馆主”。馆方确认到账后，由馆主在管理端确认并自动发卡。

```
会员选择套餐 → 提交购卡申请（待付款）
              → 按馆方付款说明完成付款 / 转账
馆主核对到账 → 确认收款并发卡 → 会员卡到账
              → 拒绝或关闭申请（不发卡）
```

银行卡号等完整收款信息不写入云数据库；如需展示，只允许馆主维护脱敏说明文本。优先使用“到店扫码付款”或“联系馆主确认”，避免在小程序长期暴露银行卡信息。

## 二、目标与边界

### 本期目标

- 会员端有清晰的套餐展示和购卡申请入口。
- 会员提交申请，馆方在统一待办中确认到账并自动发卡。
- 订单可追溯申请、付款说明、确认人、发卡结果与关闭原因。
- 为未来微信支付、优惠券与活动价格预留订单与金额结构，但不调用任何支付 API。

### 本期不做

- 不做微信支付、银行卡支付链接、支付回调、自动退款或平台分账。
- 不上传或存储银行卡照片、支付密码、身份证、商户密钥等敏感信息。
- 不做会员声明“我已付款”后的自动发卡；付款确认始终由馆方完成。
- 不做优惠券、体验课、拼团、分销；仅保留价格快照字段。

## 三、数据模型：`ax_card_order`

订单是“购买意向与馆方确认记录”，不是支付流水。使用独立集合，遵循多租户 `_pid` 隔离与 `ORDER_` 前缀。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_pid` | string | 租户 ID |
| `ORDER_ID` | string | 业务订单号，唯一 |
| `ORDER_USER_ID` | string | 下单会员 openid |
| `ORDER_USER_NAME` | string | 下单时会员昵称快照 |
| `ORDER_TPL_ID` | string | 卡模板 ID |
| `ORDER_TPL_NAME` | string | 卡名快照 |
| `ORDER_TPL_SNAPSHOT` | object | 类型、有效期、次数、适用范围、激活方式等快照 |
| `ORDER_ORIGIN_FEE` | int | 模板原价，单位：分 |
| `ORDER_DISCOUNT_FEE` | int | 优惠金额，单位：分；本期固定为 0 |
| `ORDER_PAY_FEE` | int | 应收金额，单位：分 |
| `ORDER_PAY_GUIDE` | string | 下单时的付款说明快照 |
| `ORDER_REMARK` | string | 会员备注，最多 100 字 |
| `ORDER_STATUS` | int | 见下方状态机 |
| `ORDER_CONFIRMED_BY_ID` | string | 确认收款的管理员 ID |
| `ORDER_CONFIRMED_BY_NAME` | string | 确认人姓名快照 |
| `ORDER_CONFIRMED_TIME` | int | 确认到账时间 |
| `ORDER_USER_CARD_ID` | string | 成功发卡后的用户卡 ID |
| `ORDER_CLOSE_REASON` | string | 拒绝/关闭原因 |
| `ORDER_ADD_TIME` | int | 申请时间 |
| `ORDER_EDIT_TIME` | int | 最后修改时间 |

### 金额规则

- **订单金额一律按分存储**，避免浮点误差；展示时再格式化为元。
- 现有 `USER_CARD_PRICE` 是历史“元”口径，本期人工确认发卡仍沿用其原价口径，避免影响既有收入报表。
- 未来接入优惠和线上支付时，新增 `USER_CARD_PAID_FEE`（分）记录真实成交额，并让新收入统计优先读取它；不要把既有 `USER_CARD_PRICE` 的单位直接改为分。

### 状态机

```
PENDING = 1   待付款 / 待馆方确认
PAID    = 8   微信支付已成功、尚未发卡（仅 wechat 路径中转）
CONFIRMING = 5   正在确认发卡（内部短暂状态）
ISSUED  = 10  已确认收款且已发卡（成功终态）
CLOSED  = 20  已关闭 / 已拒绝（终态）
```

发卡必须可重试且不误标：
- 线下确认失败：`CONFIRMING → PENDING`，记录原因，可重试。
- 微信支付后发卡失败：`CONFIRMING → PAID`（钱已到，不回退到 PENDING），记录原因，回调重推或馆主人工补发。

### 索引

- 唯一：`ORDER_ID`
- 管理待办：`_pid + ORDER_STATUS + ORDER_ADD_TIME`
- 会员订单：`_pid + ORDER_USER_ID + ORDER_ADD_TIME`

## 四、套餐与付款说明配置

卡模板继续作为套餐来源，但新增独立字段，避免“停售线上申请”影响后台人工发卡：

| 字段 | 说明 |
|---|---|
| `CARD_TPL_SALE_STATUS` | `0` 不展示购卡申请；`1` 可申请购买 |
| `CARD_TPL_SALE_PRICE_FEE` | 可选的营销展示价，单位分；为空则使用模板原价换算 |
| `CARD_TPL_SALE_DESC` | 购买说明，例如“适合每周 2 次练习” |

场馆设置只维护非敏感文本：

- `CARD_PURCHASE_GUIDE`：例如“请到前台付款，或联系馆主核对转账。”
- `CARD_PURCHASE_CONTACT`：例如客服电话、微信客服提示或到店地址。

若馆方使用银行卡转账，说明中只展示**开户行、户名和末四位**；完整账号由馆方在可信沟通渠道单独提供，不在申请页存或收集完整银行卡号、转账截图。

## 五、接口与权限

### 会员端

| 路由 | 说明 |
|---|---|
| `user/card_shop` | 获取可申请购买的套餐及付款说明 |
| `user/card_order_create` | 创建购卡申请：`tplId`、`remark?` |
| `user/card_order_my_list` | 我的购卡申请与状态 |
| `user/card_order_cancel` | 仅待确认状态允许会员关闭申请 |

创建申请时必须校验卡模板可售、从服务器读取价格而非相信前端金额，并写入模板与付款说明快照。相同会员、相同卡模板的未关闭申请可提示复用或先关闭旧申请，避免反复提交。

### 管理端

| 路由 | 权限 | 说明 |
|---|---|---|
| `admin/card_order_list` | 教练可查看；馆主可处理 | 待确认、已发卡、已关闭列表 |
| `admin/card_order_detail` | 教练可查看 | 订单快照与处理记录 |
| `admin/card_order_confirm` | 仅馆主 | 确认收款并发卡 |
| `admin/card_order_close` | 仅馆主 | 拒绝/关闭申请，必须填原因 |

“确认收款并发卡”要二次确认，并展示会员、卡名、次数/有效期与应收金额。教练默认只有查看和提醒权限。

## 六、确认发卡的安全实现

不能直接调用当前管理端 `issueUserCard(input)`：它会重新读模板原价，不能保证订单快照，也不具备订单幂等关联。

应抽取一个受服务端控制的底层方法：

```
createUserCardFromOrder(order, operator)
```

它只使用 `ORDER_TPL_SNAPSHOT` 与订单数据创建卡，并写入：

```
USER_CARD_ORDER_ID = ORDER_ID
USER_CARD_MEMO = "购卡申请确认"
```

处理顺序：

1. 校验馆主权限、订单属于当前租户且状态为 `PENDING_PAY`。
2. 原子抢占 `PENDING_PAY → CONFIRMING`，记录确认人。
3. 按 `USER_CARD_ORDER_ID` 查询是否已生成卡；存在则只回填订单，绝不再发卡。
4. 不存在时按订单快照创建一张用户卡。
5. 卡创建成功后更新 `CONFIRMING → ISSUED` 并写入用户卡 ID。
6. 任一步失败，恢复为可处理状态并记录失败原因，便于馆主再次确认。

不得通过修改 `global.PID` 处理跨租户订单。服务层必须以订单 `_pid` 建立明确的数据上下文，沿用项目现有的异步隔离机制。

## 七、前端体验

### 会员端

入口建议放在“我的会员卡”空状态、卡余量不足提示和“我的”页，不在首页堆叠营销入口。

1. **套餐列表**：卡名、价格、次数/有效期、适用范围、简短说明。
2. **确认申请页**：明确显示“提交申请后，请按馆方说明付款；到账后由馆方确认发卡”。
3. **申请详情**：状态时间线“已提交 → 待馆方确认 → 已发卡”，已发卡后可直接查看会员卡。
4. **空状态**：馆方未开启购卡申请时不展示入口，不制造“支付不可用”的挫败感。

### 教练端

- 首页管理区显示“待确认购卡申请”数量；仅馆主可点击处理。
- 订单列表默认“待确认”，支持会员名、日期、状态筛选。
- 确认页不要求上传银行凭证；线下核对是馆方的现实流程，系统只保留确认动作和备注。

## 八、微信支付接入（已实现，配置即启用）

支付能力作为 **订单支付方式（`ORDER_PAY_TYPE`）** 扩展，**不改卡与发卡核心**——两条路径最终都调用同一个 `_createUserCardFromOrder`。

```
线下：PENDING(待馆方确认) → 馆主确认 → CONFIRMING → ISSUED / CLOSED
微信：PENDING(待支付) → 支付回调 → CONFIRMING → ISSUED（失败回滚 PAID，可人工补发）
```

### 代码位置

| 职责 | 文件 |
|---|---|
| 统一下单 + 判定回调 + 解析回调 | `project/service/card_pay_service.js` |
| 回调发卡（跨租户建上下文、幂等） | `project/service/card_notify_service.js` |
| 会员下单（`payType=wechat` 分支、返回 `payment`） | `project/service/card_purchase_service.js` |
| 支付成功自动发卡（复用发卡核心） | `admin_card_service.autoIssueByPay()` |
| 回调入口拦截（先于鉴权链） | `index.js` |
| 商户配置 | `config/config.js` 的 `WX_PAY` |

### 关键设计

- **回调不走路由鉴权**：微信平台直接调用云函数，event 无 `route`/`token`。`index.js` 用 `CardPayService.isPayNotify(event)` 命中后交给 `CardNotifyService.handle()`，绕开 `application.app`。
- **回调自建租户上下文**：回调无 PID，先用 `outTradeNo(=ORDER_ID)` 跨租户查订单（`getOne(..., mustPID=false)`）取 `_pid`，再 `tenantContext.runWithPID(pid, ...)` 内发卡。
- **发卡幂等（同人工确认）**：订单号唯一 + 状态 CAS（`PENDING/PAID → CONFIRMING` 用 `['in',[..]]` 一次抢占）+ `USER_CARD_ORDER_ID` 查重。回调可重放，全链路可安全重复调用。
- **收款后发卡失败回滚到 PAID（不回 PENDING）**：钱已到，不能丢失支付事实；订单落到 PAID 待馆主人工补发，回调返回非 0 让微信重推重试。
- **未配置即安全降级**：`WX_PAY.mchId/payKey` 留空时 `isEnabled()` 为 false，`getShop()` 返回 `wechatPay:false`，前端只显示线下付款；后端即使收到 `payType=wechat` 也强制回落 offline，防前端伪造。

### 怎么用（开通步骤）

1. 申请**微信支付商户号**，在微信支付后台把商户号与本云开发环境关联（开通云支付/cloudPay 能力）。
2. 把商户号、支付密钥经**部署环境变量**注入：`WX_PAY_MCH_ID`、`WX_PAY_KEY`（`config.js` 已从 `process.env` 读取，**不要把密钥写进仓库**）。
3. `WX_PAY.functionName` 保持本云函数名（默认 `cloud`），回调会打回自身。
4. 前端下单传 `payType:'wechat'`，用返回的 `payment` 调 `wx.requestPayment`；发卡由回调自动完成，无需人工确认。
5. 本地/CI 无商户号无法真跑支付，代码在未配置时安全降级，可正常部署验证线下流程。

> 安全红线：不在数据库保存商户密钥/银行卡等敏感信息；不采用已退市的腾讯云“云支付（CPay）”作为接入基础，使用微信支付 + 云开发当期官方能力。

## 八·五、订单维护：超时未支付自动关单（已实现）

微信订单在 `PENDING`（待支付）停留过久会占用防重、堆积脏数据，由定时任务自动清理。

| 项 | 说明 |
|---|---|
| 触发 | `config.json` 的 `triggers` 定时器 `cardOrderMaintain`，每 10 分钟一次；`index.js` 识别 `event.Type === 'Timer'` 分发 |
| 逻辑 | `card_order_job_service.closeTimeoutOrders()`：跨租户扫 `微信 + PENDING + 下单超 2 小时` → CLOSED，原因「超时未支付，系统自动关闭」 |
| 范围 | **只关微信未支付单**；线下单的 PENDING = 待馆主人工确认，绝不自动关（会员可能已线下付款） |
| 并发安全 | CAS 关单（`edit` 匹配 `PENDING` 才生效）——若回调此刻正把订单推进到 PAID，抢不到、不误关已付款单 |
| 无 PID | 定时任务无租户上下文，`getAll(..., mustPID=false)` 跨租户查，再逐单 `runWithPID(_pid)` 关闭 |
| 限流 | 单次最多 200 单，剩余留给下次，防云函数超时 |

> 部署提醒：`config.json` 的 triggers 需在云开发控制台确认已生效；`TIMEOUT_MS` / 频率可按业务调整。此机制可复用于未来「卡到期提醒」「PAID 待补发提醒」等定时任务。

## 九、实施阶段

| 阶段 | 范围 | 交付 |
|---|---|---|
| P0 | 套餐售卖开关、套餐页、购卡申请、馆主确认自动发卡、我的申请 | 可稳定完成线下/转账购卡闭环 |
| P1 | 订单筛选、关闭原因、待办提醒、导出对账 | 馆方运营与对账效率提升 |
| P2 | 体验课/优惠券价格计算 | 营销能力，仍可沿用人工确认 |
| P3 | 独立支付技术方案与微信支付接入 | 取决于商户资质和合规路径 |

## 十、上线前检查清单

- [ ] 仅馆主可确认收款和关闭申请。
- [ ] 套餐停售不影响既有会员卡和后台人工发卡。
- [ ] 订单快照在模板修改后仍可正确发卡。
- [ ] 重复点击确认不会生成两张卡。
- [ ] 全部金额使用分进行订单计算与展示换算。
- [ ] 页面不展示或存储完整银行卡号、付款密码、转账截图等敏感支付信息。
- [ ] 未开启功能的场馆不显示购卡入口。
- [ ] 定时触发器 `cardOrderMaintain` 已在云开发控制台生效，超时微信单能自动关闭。
- [ ] 自动关单只影响微信待支付单，不误关线下待确认单。
