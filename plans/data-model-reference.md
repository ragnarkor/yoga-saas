# 数据模型参考手册

> 生成日期：2026-07-09（2026-08-25 补充在线购卡/打卡成就/平台日志等集合及字段级修正）
> 所有集合均通过 `_pid` 字段实现多租户逻辑隔离
> 例外：超级管理员（`ADMIN_TYPE=super`）账号的 `_pid` 固定为字面量字符串 `"admin"`（哨兵值，不代表任何真实租户），创建与查询均以 `mustPID=false` 显式绕过按租户注入/过滤的常规逻辑（参考 `base_service.js` 中 `superData._pid = "admin"` 及 `AdminModel.insert(superData, false)`），不适用常规的按 `_pid` 隔离查询假设。

---

## ax_card_tpl — 会员卡模板

**用途**：定义馆内可发卡的种类和规则，由馆长管理，发卡时从模板复制配置到 ax_user_card。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|:---:|---|---|
| `_pid` | string | ✅ | — | 租户 ID |
| `CARD_TPL_ID` | string | ✅ | — | 模板唯一 ID |
| `CARD_TPL_NAME` | string | ✅ | — | 卡名称，如「月卡」「10次通卡」 |
| `CARD_TPL_TYPE` | string | ✅ | `times` | `times`=次数卡 / `period`=期限卡 |
| `CARD_TPL_DAYS` | int | ✅ | 365 | 有效天数（次数卡也有，用于到期控制） |
| `CARD_TPL_PRICE` | int | ✅ | 0 | 售价（元），用于收入统计分摊 |
| `CARD_TPL_QUOTA` | int | ✅ | 1 | 次数额度（期限卡强制为 0） |
| `CARD_TPL_COLOR` | string | ✅ | `#F5A623` | 卡片展示颜色 |
| `CARD_TPL_COVER` | string | — | — | 卡面图案 ID（空=纯色，如 `sage_wave`） |
| `CARD_TPL_SCOPE` | object | ✅ | `{mode:"all"}` | 适用课程范围（见下方说明） |
| `CARD_TPL_ORDER` | int | ✅ | 9999 | 排序权重（越小越靠前） |
| `CARD_TPL_STATUS` | int | ✅ | 1 | `0`=停售 `1`=在售 |
| `CARD_TPL_SALE_STATUS` | int | — | 0 | 会员自助购卡开关：`1`=允许会员在购卡商城提交申请 `0`=不展示 |
| `CARD_TPL_SALE_PRICE_FEE` | int | — | 0 | 会员端展示售价（分），`0`=沿用 `CARD_TPL_PRICE` 原价 |
| `CARD_TPL_SALE_DESC` | string | — | — | 会员购卡说明文案 |
| `CARD_TPL_ADD_TIME` | int | ✅ | — | 创建时间戳 |
| `CARD_TPL_EDIT_TIME` | int | ✅ | — | 最后修改时间戳 |

**CARD_TPL_SCOPE 结构：**
```json
{
  "mode": "all",           // "all"=全部课程 / "categories"=指定分类
  "categoryIds": ["1","2"] // mode=categories 时必填
}
```

**TYPE 常量：**
- `times` — 次数卡，`TYPE_DESC = "次数卡"`
- `period` — 期限卡，`TYPE_DESC = "期限卡"`

---

## ax_user_card — 会员持卡

**用途**：记录每张已发出的会员卡，是扣次/退次的操作主体。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|:---:|---|---|
| `_pid` | string | ✅ | — | 租户 ID |
| `USER_CARD_ID` | string | ✅ | — | 持卡唯一 ID |
| `USER_CARD_USER_ID` | string | ✅ | — | 会员 openid |
| `USER_CARD_TPL_ID` | string | — | — | 关联模板 ID（手动发卡可为空） |
| `USER_CARD_NAME` | string | ✅ | — | 卡名称（冗余，从模板复制） |
| `USER_CARD_TYPE` | string | ✅ | — | `times` / `period` |
| `USER_CARD_DAYS` | int | ✅ | — | 有效天数 |
| `USER_CARD_PRICE` | int | ✅ | 0 | 价格（元） |
| `USER_CARD_QUOTA` | int | ✅ | — | 剩余次数（期限卡始终为 0） |
| `USER_CARD_QUOTA_INIT` | int | ✅ | — | 初始次数（用于收入分摊计算） |
| `USER_CARD_ACTIVATE` | string | ✅ | `immediate` | 激活方式（见常量说明） |
| `USER_CARD_SCOPE` | object | ✅ | — | 适用范围（从模板复制） |
| `USER_CARD_COACH_ID` | string | — | — | 归属教练 admin ID |
| `USER_CARD_COACH_NAME` | string | — | — | 归属教练名（冗余） |
| `USER_CARD_MEMO` | string | — | — | 备注（最多 50 字） |
| `USER_CARD_ORDER_ID` | string | — | — | 购卡订单号（在线购卡发卡时回填，用于发卡幂等查重，关联 `ax_card_order.ORDER_ID`） |
| `USER_CARD_PAID_FEE` | int | — | 0 | 实付金额（分）。在线购卡时从订单 `ORDER_PAY_FEE` 回填，馆主手动发卡默认 0 |
| `USER_CARD_STATUS` | int | ✅ | 1 | `0`=停卡 `1`=正常 `9`=已用完 |
| `USER_CARD_START_TIME` | int | ✅ | 0 | 激活开始时间戳（`0`=待激活） |
| `USER_CARD_END_TIME` | int | ✅ | 0 | 到期时间戳（`0`=长期有效） |
| `USER_CARD_ADD_TIME` | int | ✅ | — | 发卡时间戳 |
| `USER_CARD_EDIT_TIME` | int | ✅ | — | 最后修改时间戳 |

**STATUS 常量：**
```
STOP   = 0  停卡（人工）
NORMAL = 1  正常可用
USED   = 9  已用完/已过期
```

**ACTIVATE 常量：**
```
immediate       立即激活（发卡即开始计有效期）
first_book      首次预约时激活
first_class     首次签到时激活
first_use_limit 首次使用时激活，并从当天起计天数
```

**状态流转：**
```
发卡
 ├── immediate → NORMAL + startTime=now
 └── 其他      → NORMAL + startTime=0 (待激活)

约课扣次 (次数卡)
 └── quota-- → quota≤0 时 status=USED

取消退次 (次数卡)
 └── quota++ → 若 status=USED 且 quota>0 恢复 NORMAL

手动操作
 ├── stop   → status=STOP
 └── resume → status=NORMAL (期限卡) 或按 quota 判断
```

---

## ax_user_card_log — 持卡流水

**用途**：记录每次扣次、退次、手动加减次操作，是收入统计的数据源。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `CARD_LOG_USER_ID` | string | ✅ | 会员 openid |
| `CARD_LOG_USER_CARD_ID` | string | ✅ | 关联持卡 `_id` |
| `CARD_LOG_JOIN_ID` | string | — | 关联预约 `_id`（手动操作无此字段） |
| `CARD_LOG_MEET_ID` | string | — | 关联课程 ID |
| `CARD_LOG_MEET_TITLE` | string | — | 课程名称（冗余） |
| `CARD_LOG_MEET_TYPE_NAME` | string | — | 课程分类（冗余） |
| `CARD_LOG_MEET_DAY` | string | — | 上课日期 `yyyy-MM-dd` |
| `CARD_LOG_TIME_START` | string | — | 上课开始时间 `hh:mm` |
| `CARD_LOG_TIME_END` | string | — | 上课结束时间 `hh:mm` |
| `CARD_LOG_COACH_NAME` | string | — | 授课老师（冗余） |
| `CARD_LOG_TIMES` | int | ✅ | 本次扣/加次数（期限卡为 0） |
| `CARD_LOG_ACTION` | string | ✅ | 操作类型（见常量） |
| `CARD_LOG_STATUS` | int | ✅ | `1`=有效 `10`=已退还 |
| `CARD_LOG_MEMO` | string | — | 备注 |
| `CARD_LOG_OPERATOR_NAME` | string | — | 操作人姓名 |
| `CARD_LOG_ADD_TIME` | int | ✅ | 记录时间戳 |

**ACTION 常量：**
```
deduct        预约扣次（最常见）
refund        退次（旧版，现通过 status=REFUNDED 标记）
manual_add    手动加次
manual_deduct 手动消次
```

**收入统计规则（基于此表计算）：**
- 次数卡：`amount = 卡价格 / QUOTA_INIT × TIMES`
- 期限卡：只有首次上课（TIMES=0）的那条记录计入，`amount = 卡价格`

---

## ax_card_order — 购卡订单

**用途**：会员在线自助购卡的订单表，支持线下转账（馆主人工确认）与微信支付两种方式，串联 ax_card_tpl（下单时固化套餐快照）与 ax_user_card（确认/支付成功后发卡）。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|:---:|---|---|
| `_pid` | string | ✅ | — | 租户 ID |
| `ORDER_ID` | string | ✅ | — | 订单唯一 ID |
| `ORDER_USER_ID` | string | ✅ | — | 会员 openid |
| `ORDER_USER_NAME` | string | — | — | 会员姓名（下单时快照，冗余） |
| `ORDER_TPL_ID` | string | ✅ | — | 关联卡模板 ID |
| `ORDER_TPL_NAME` | string | ✅ | — | 卡名称（冗余） |
| `ORDER_TPL_SNAPSHOT` | object | ✅ | — | 下单时固化的套餐配置快照，发卡只信此快照，不重读模板 |
| `ORDER_ORIGIN_FEE` | int | ✅ | 0 | 原价（分） |
| `ORDER_DISCOUNT_FEE` | int | ✅ | 0 | 优惠金额（分） |
| `ORDER_PAY_FEE` | int | ✅ | 0 | 应付/实付金额（分） |
| `ORDER_PAY_GUIDE` | string | — | — | 下单时固化的付款说明文案 |
| `ORDER_TRANSFER_ACCOUNT` | object | — | — | 下单时固化的银行卡收款信息（线下转账用，`{receiver,bank,account}`） |
| `ORDER_TRANSFER_PROOF` | string | — | — | 会员上传的转账凭证 cloudId |
| `ORDER_TRANSFER_REFERENCE` | string | — | — | 会员填写的转账流水号/备注 |
| `ORDER_TRANSFER_SUBMIT_TIME` | int | — | 0 | 转账凭证提交时间戳 |
| `ORDER_REMARK` | string | — | — | 会员下单备注（≤100 字） |
| `ORDER_STATUS` | int | ✅ | 1 | 订单状态（见常量） |
| `ORDER_PAY_TYPE` | string | — | `offline` | `offline`=线下转账 `wechat`=微信支付 |
| `ORDER_TRANSACTION_ID` | string | — | — | 微信支付单号（仅 wechat） |
| `ORDER_PAY_TIME` | int | — | 0 | 支付成功时间戳（仅 wechat） |
| `ORDER_CONFIRMED_BY_ID` | string | — | — | 确认发卡的管理员 ID |
| `ORDER_CONFIRMED_BY_NAME` | string | — | — | 确认发卡的管理员姓名 |
| `ORDER_CONFIRMED_TIME` | int | — | 0 | 确认发卡时间戳 |
| `ORDER_USER_CARD_ID` | string | — | — | 发卡后关联的 ax_user_card `_id` |
| `ORDER_CLOSE_REASON` | string | — | — | 关闭原因/发卡失败原因 |
| `ORDER_REFUND_ID` | string | — | — | 微信退款单号 |
| `ORDER_REFUND_FEE` | int | — | 0 | 退款金额（分） |
| `ORDER_REFUND_TIME` | int | — | 0 | 退款成功时间戳 |
| `ORDER_REFUND_REASON` | string | — | — | 退款原因 |
| `ORDER_REFUND_BY_ID` | string | — | — | 发起退款的管理员 ID |
| `ORDER_REFUND_BY_NAME` | string | — | — | 发起退款的管理员姓名 |
| `ORDER_ADD_TIME` | int | ✅ | — | 下单时间戳 |
| `ORDER_EDIT_TIME` | int | ✅ | — | 最后修改时间戳 |

**STATUS 常量：**
```
PENDING    = 1   待处理（offline=待馆方确认；wechat=待支付）
CONFIRMING = 5   确认中（CAS 抢占态，人工确认/自动发卡/退款均需先占用此态）
PAID       = 8   已付款未发卡（仅 wechat，支付成功但自动发卡失败时的兜底态）
ISSUED     = 10  已发卡
REFUNDING  = 15  退款中（CAS 抢占态）
CLOSED     = 20  已关闭（拒绝/超时自动关闭）
REFUNDED   = 25  已退款
```

**PAY_TYPE 常量：** `offline`=线下人工确认 / `wechat`=微信支付

**状态流转：**
```
线下转账（offline）：
PENDING（待馆方确认，会员可上传转账凭证）
 ├── 馆主确认收款 → CONFIRMING → ISSUED（已发卡，失败回滚 PENDING）
 └── 馆主拒绝/取消 → CLOSED

微信支付（wechat）：
PENDING（待支付；超时由 card_order_job_service 定时任务自动关闭为 CLOSED）
 └── 支付成功回调 → CONFIRMING（CAS 抢占）
                      ├── 自动发卡成功 → ISSUED
                      └── 自动发卡失败 → 回滚 PAID（钱已到，不回退 PENDING，等待人工在待办里补发）
PAID → 馆主人工确认 → CONFIRMING → ISSUED（同上失败回滚 PAID）

退款（仅 wechat 且已发卡、卡未被使用过）：
ISSUED → REFUNDING（CAS 抢占）
           ├── 退款成功 → REFUNDED，同时关联的 ax_user_card 停用（USER_CARD_STATUS=STOP）
           └── 退款失败 → 回滚 ISSUED，记录 ORDER_REFUND_REASON，可重试
```

**幂等设计要点：**
- 发卡三要素：订单号唯一 + 状态 CAS（`edit` 按旧状态条件更新，返回受影响行数判断是否抢占成功）+ `USER_CARD_ORDER_ID` 查重（防重复发卡）。
- 微信支付回调可能重放，`card_notify_service.js → admin_card_service.autoIssueByPay()` 全链路须可重复安全调用。
- `card_order_job_service.js` 的定时关单任务是跨租户全表扫描（不带 `_pid`），只处理「微信 + PENDING」超时订单，线下订单的 PENDING 不自动关闭（可能会员已线下付款待核实）。

---

## ax_meet — 课程

**用途**：定义可预约的课程，每门课有独立的排课时段（ax_day）和预约记录（ax_join）。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `MEET_ID` | string | ✅ | 课程 ID |
| `MEET_ADMIN_ID` | string | ✅ | 创建/负责管理员 `_id` |
| `MEET_TITLE` | string | ✅ | 课程标题 |
| `MEET_CONTENT` | array | — | 图文介绍 `[{type:'text'/'img', val:''}]` |
| `MEET_TYPE_ID` | string | ✅ | 课程分类 ID |
| `MEET_TYPE_NAME` | string | ✅ | 课程分类名（冗余） |
| `MEET_IS_SHOW_LIMIT` | int | ✅ | `1`=显示剩余名额 `0`=不显示 |
| `MEET_STYLE_SET` | object | ✅ | 样式/业务配置（见下方说明） |
| `MEET_FORM_SET` | array | — | 预约表单字段配置 |
| `MEET_DAYS` | array | — | 最近可用日期列表（冗余缓存） |
| `MEET_STATUS` | int | ✅ | 课程状态（见常量） |
| `MEET_ORDER` | int | ✅ | 排序权重 |
| `MEET_ADD_TIME` | int | ✅ | 创建时间戳 |
| `MEET_EDIT_TIME` | int | ✅ | 修改时间戳 |

**MEET_STYLE_SET 内部字段（对象，非独立字段）：**
```
pic          缩略图 cloudId
desc         简介
notice       注意事项
duration     时长（分钟）
cardTimes    每次约课扣几次卡，默认 1
teacherId    默认授课教练 ID
teacherName  默认授课教练名（冗余）
capacity     容纳人数上限
minJoin      最低开课人数
difficulty   难度星级（1-5）
color        课程标识色
carousel     轮播图 cloudId 数组
templateId   排课模板 ID
templateName 排课模板名
```

**STATUS 常量：**
```
UNUSE = 0   未启用
COMM  = 1   使用中（正常可约）
OVER  = 9   停止预约（会员可见但不可约）
CLOSE = 10  已关闭（会员不可见）
```

---

## ax_day — 排课时段

**用途**：存储每门课程的具体排课日期与时段信息，是约课选时段的核心数据。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_pid` | string | 租户 ID |
| `DAY_MEET_ID` | string | 关联课程 `MEET_ID` |
| `day` | string | 日期 `yyyy-MM-dd` |
| `dayDesc` | string | 日期描述（如「周一」） |
| `times` | array | 时段列表（见下方） |
| `DAY_ADD_TIME` | int | 创建时间戳 |
| `DAY_EDIT_TIME` | int | 修改时间戳 |

**times 数组元素结构：**
```json
{
  "mark": "T20250115ABCDEFGHIJ",  // 唯一标识（T + 日期8位 + 随机10位大写）
  "start": "10:00",               // 开始时间
  "end": "11:30",                 // 结束时间
  "isLimit": 1,                   // 是否限制人数
  "limit": 20,                    // 人数上限
  "status": 1,                    // 0=已取消 1=正常
  "slotType": "group",            // "group"=团课 / "private"=私教
  "teacherId": "",                // 该时段指定教练 ID（覆盖课程默认值）
  "teacherName": "",              // 指定教练名（冗余）
  "bufferBefore": 0,              // 前缓冲分钟（私教防冲突）
  "bufferAfter": 0,               // 后缓冲分钟
  "blockStart": "10:00",          // 含缓冲的占用开始时间
  "blockEnd": "11:30",            // 含缓冲的占用结束时间
  "stat": {                       // 统计（编辑时保留）
    "succCnt": 5,                 // 成功预约数
    "cancelCnt": 1,               // 会员取消数
    "adminCancelCnt": 0           // 管理员取消数
  }
}
```

---

## ax_join — 预约记录

**用途**：记录每次会员预约，是签到、退次、统计的数据基础。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `JOIN_ID` | string | ✅ | 预约 ID |
| `JOIN_USER_ID` | string | ✅ | 会员 openid |
| `JOIN_MEET_ID` | string | ✅ | 课程 ID |
| `JOIN_MEET_TITLE` | string | ✅ | 课程标题（冗余） |
| `JOIN_MEET_DAY` | string | ✅ | 上课日期 `yyyy-MM-dd` |
| `JOIN_MEET_TIME_START` | string | ✅ | 时段开始 `hh:mm` |
| `JOIN_MEET_TIME_END` | string | ✅ | 时段结束 `hh:mm` |
| `JOIN_MEET_TIME_MARK` | string | ✅ | 时段唯一标识（timeMark） |
| `JOIN_START_TIME` | int | ✅ | 课程开始时间戳（用于排序） |
| `JOIN_CODE` | string | ✅ | 历史核验码（兼容旧数据，当前会员端不展示） |
| `JOIN_IS_CHECKIN` | int | ✅ | `0`=未签到 `1`=已签到 |
| `JOIN_IS_ADMIN` | int | ✅ | `0`=自主预约 `1`=管理员代约 |
| `JOIN_STATUS` | int | ✅ | 预约状态（见常量） |
| `JOIN_REASON` | string | — | 取消/拒绝原因 |
| `JOIN_FORMS` | array | — | 预约时填写的表单数据 |
| `JOIN_EDIT_ADMIN_ID` | string | — | 最后操作的管理员 ID |
| `JOIN_EDIT_ADMIN_NAME` | string | — | 最后操作的管理员名（冗余） |
| `JOIN_EDIT_ADMIN_TIME` | int | ✅ | 管理员最近修改的时间戳，默认 0 |
| `JOIN_EDIT_ADMIN_STATUS` | int | — | 最近管理员修改为的状态 |
| `JOIN_CARD_CONSUME_STATUS` | int | ✅ | 会员卡处理状态 `0`=待处理 `1`=已处理，用于扣卡/退卡幂等（防止重复扣卡/重复退卡，见 `user_card_service.js`） |
| `JOIN_ADD_TIME` | int | ✅ | 预约时间戳 |

**STATUS 常量：**
```
SUCC         = 1   预约成功（有效）
CANCEL       = 10  会员自主取消
ADMIN_CANCEL = 99  管理员/系统取消
```

---

## ax_checkin_streak — 会员打卡成就

**用途**：聚合会员的连续上课周数、累计上课数据与已解锁成就徽章，供会员端「打卡」页展示。数据由 `streak_service.js` 基于 ax_join 历史预约记录增量/回填计算得出，不是实时统计表。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|:---:|---|---|
| `_pid` | string | ✅ | — | 租户 ID |
| `STREAK_ID` | string | ✅ | — | 记录唯一 ID |
| `STREAK_USER_ID` | string | ✅ | — | 会员 openid |
| `STREAK_CURRENT` | int | ✅ | 0 | 当前连续上课周数 |
| `STREAK_MAX` | int | ✅ | 0 | 历史最长连续周数 |
| `STREAK_LAST_WEEK` | string | — | — | 最后一次签到所在 ISO 周 `yyyy-Www` |
| `STREAK_TOTAL_CLASSES` | int | ✅ | 0 | 累计上课次数 |
| `STREAK_TOTAL_DAYS` | int | ✅ | 0 | 累计上课天数 |
| `STREAK_BADGES` | array | ✅ | `[]` | 已解锁徽章 ID 列表（见 `streak_service.js` 的 `BADGE_DEFS`） |
| `STREAK_BADGE_AT` | object | — | `{}` | 各徽章解锁时间戳 `{badgeId: timestamp}` |
| `STREAK_LAST_DAY` | string | — | — | 最后一次签到自然日 `yyyy-MM-dd` |
| `STREAK_HISTORY_SYNCED` | int | ✅ | 0 | 是否已从历史约课记录回填过 `0`/`1` |
| `STREAK_SYNC_VERSION` | int | ✅ | 0 | 历史回填口径版本号，代码里的口径版本变更后会触发对该会员重新全量计算 |
| `STREAK_DIRTY` | int | ✅ | 0 | 预约状态发生变化（签到/取消等）后置 1，标记需要重算，重算完成后清 0 |
| `STREAK_ADD_TIME` | int | ✅ | — | 创建时间戳 |
| `STREAK_EDIT_TIME` | int | ✅ | — | 最后修改时间戳 |

---

## ax_admin — 管理员账号

**用途**：馆长和教练的登录账号，包含角色、微信绑定信息和 token。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `ADMIN_ID` | string | ✅ | 管理员 ID |
| `ADMIN_NAME` | string | ✅ | 姓名 |
| `ADMIN_PHONE` | string | ✅ | 手机号（登录用） |
| `ADMIN_PWD` | string | ✅ | 登录密码，`sha256:` 前缀的 SHA256(pwd+salt) 哈希（旧明文数据兼容校验） |
| `ADMIN_PWD_SALT` | string | — | 密码盐（`hashNewPwd` 随机生成，旧明文账号可能无此字段） |
| `ADMIN_TYPE` | string | ✅ | 角色（见常量） |
| `ADMIN_STATUS` | int | ✅ | `0`=禁用 `1`=启用 |
| `ADMIN_MINI_OPENID` | string | — | 绑定的微信 openid |
| `ADMIN_BIND_TIME` | int | — | 微信绑定时间戳 |
| `ADMIN_TOKEN` | string | — | 当前登录 token |
| `ADMIN_TOKEN_TIME` | int | — | token 生成时间戳 |
| `ADMIN_LOGIN_CNT` | int | ✅ | 累计登录次数 |
| `ADMIN_LOGIN_TIME` | int | ✅ | 最后登录时间戳 |
| `ADMIN_ADD_TIME` | int | ✅ | 创建时间戳 |

**TYPE 常量：**
```
super   超级管理员（跨馆）
owner   馆长（本馆完整权限）
teacher 教练（仅自己课程）
```

---

## ax_platform_log — 平台操作审计日志

**用途**：记录平台超级管理员（super）发起的跨租户操作（建馆、删馆、改到期时间、启用/停用、新建员工等），与馆内 ax_log 分离，便于合规审计与溯源。

> 重要：本表的 `_pid` **固定写死为字面量字符串 `"PLATFORM"`**（`PlatformLogModel.PLATFORM_PID`），不随 `global.PID` 漂移，也不代表任何真实租户；写入时以 `mustPID=false` 显式跳过常规的按租户注入逻辑。查询本表时同样不能套用常规按 `_pid=当前租户` 过滤的惯例。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 固定值 `"PLATFORM"`（哨兵值，非真实租户） |
| `PLOG_ID` | string | ✅ | 日志 ID |
| `PLOG_ADMIN_ID` | string | ✅ | 操作人管理员 ID（快照） |
| `PLOG_ADMIN_NAME` | string | — | 操作人姓名（快照） |
| `PLOG_ADMIN_PHONE` | string | — | 操作人手机号（快照） |
| `PLOG_ADMIN_TYPE` | string | — | 操作人角色 `super`/`owner`/`teacher`（快照） |
| `PLOG_ACTION` | string | ✅ | 动作码（见常量） |
| `PLOG_CONTENT` | string | ✅ | 可读描述 |
| `PLOG_TARGET_PID` | string | — | 操作目标租户 `_pid` |
| `PLOG_TARGET_NAME` | string | — | 操作目标租户名称 |
| `PLOG_BEFORE` | string | — | 变更前值（字符串快照） |
| `PLOG_AFTER` | string | — | 变更后值（字符串快照） |
| `PLOG_ADD_TIME` | int | ✅ | 创建时间戳 |
| `PLOG_EDIT_TIME` | int | ✅ | 修改时间戳 |

**ACTION 常量：**
```
tenant_insert  新建瑜伽馆
tenant_del     删除瑜伽馆
tenant_expire  修改有效期
tenant_status  启用/停用
staff_insert   新建员工
```

---

## ax_teacher — 教练档案（前台展示）

**用途**：会员端展示的教练信息，与 ax_admin 是 1:1 关系（通过 TEACHER_ADMIN_ID 关联）。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `TEACHER_ID` | string | ✅ | 教练 ID |
| `TEACHER_ADMIN_ID` | string | 可选 | 关联 ax_admin `_id`（绑定微信后创建，教练档案可先于管理员账号独立存在） |
| `TEACHER_NAME` | string | ✅ | 姓名 |
| `TEACHER_AVATAR` | string | — | 头像 cloudId |
| `TEACHER_PIC` | array | — | 教学风采图片 cloudId 数组 |
| `TEACHER_SPECIALTY` | string | — | 擅长课程 |
| `TEACHER_DESC` | string | — | 简介 |
| `TEACHER_HOME` | int | ✅ | `1`=首页展示 `0`=不展示 |
| `TEACHER_ORDER` | int | ✅ | 排序权重 |
| `TEACHER_STATUS` | int | ✅ | `0`=停用 `1`=启用 |
| `TEACHER_ADD_TIME` | int | ✅ | 创建时间戳 |

---

## ax_user — 会员

**用途**：会员的基本信息，以微信 openid 为唯一标识。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `USER_ID` | string | ✅ | 用户 ID |
| `USER_MINI_OPENID` | string | ✅ | 微信小程序 openid（唯一标识） |
| `USER_NAME` | string | — | 昵称 |
| `USER_BIRTHDAY` | string | — | 生日 `yyyy-mm-dd` |
| `USER_MOBILE` | string | — | 手机号 |
| `USER_PIC` | string | — | 头像 URL |
| `USER_WORK` | string | — | 单位 |
| `USER_CITY` | string | — | 城市 |
| `USER_TRADE` | string | — | 职业 |
| `USER_STATUS` | int | ✅ | `0`=待审核 `1`=正常 |
| `USER_LOGIN_CNT` | int | ✅ | 登录次数 |
| `USER_LOGIN_TIME` | int | ✅ | 最后登录时间戳 |
| `USER_ADD_TIME` | int | ✅ | 注册时间戳 |

---

## ax_tenant — 租户

**用途**：每个入驻的瑜伽馆对应一条记录，由超管管理。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `TENANT_ID` | string | ✅ | 租户 ID（即 `_pid` 值，如 `A00`） |
| `TENANT_NAME` | string | ✅ | 馆名称 |
| `TENANT_LOGO` | string | — | 馆 LOGO cloudId |
| `TENANT_DESC` | string | — | 简介 |
| `TENANT_TEMPLATE` | string | — | 前端定制模板 ID（对应 `projects/{ID}/`） |
| `TENANT_STATUS` | int | ✅ | `0`=关闭 `1`=开放 |
| `TENANT_MEET_TYPE` | string | — | 课程分类配置（格式：`1=特色课\|leftbig3,2=精品课`） |
| `TENANT_MEET_NAME` | string | ✅ | 预约功能名称，默认「约课」 |
| `TENANT_THEME_COLOR` | string | — | 品牌主题色（如 `#5B8A72`） |
| `TENANT_EXPIRE_TIME` | int | ✅ | 服务到期时间戳（`0`=长期有效） |
| `TENANT_ADD_TIME` | int | ✅ | 开通时间戳 |

---

## ax_setup — 全局配置

**用途**：每个馆的系统设置，每馆一条记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_pid` | string | 租户 ID |
| `SETUP_NAME` | string | 馆名称（冗余） |
| `SETUP_ABOUT` | string | 关于我们文字 |
| `SETUP_ABOUT_PIC` | array | 关于我们图片 cloudId 数组 |
| `SETUP_THEME_COLOR` | string | 品牌主题色 |
| `SETUP_MEET_TYPE` | string | 课程分类配置字符串 |
| `SETUP_ADDRESS` | string | 门店地址 |
| `SETUP_PHONE` | string | 联系电话 |
| `SETUP_LATITUDE` | float | 门店纬度 |
| `SETUP_LONGITUDE` | float | 门店经度 |
| `SETUP_SERVICE_PIC` | array | 客服图片 |
| `SETUP_OFFICE_PIC` | array | 官方微信图片 |
| `SETUP_OPEN_TIME` | string | 营业开始时间 `HH:mm` |
| `SETUP_CLOSE_TIME` | string | 营业结束时间 `HH:mm` |
| `SETUP_CARD_PURCHASE_ENABLED` | int | 是否开启会员自助购卡商城，`0`=关闭 `1`=开启 |
| `SETUP_CARD_PURCHASE_GUIDE` | string | 购卡付款说明文案 |
| `SETUP_CARD_PURCHASE_CONTACT` | string | 购卡联系提示 |
| `SETUP_CARD_PURCHASE_RECEIVER` | string | 线下转账收款人姓名 |
| `SETUP_CARD_PURCHASE_BANK` | string | 线下转账收款银行及支行 |
| `SETUP_CARD_PURCHASE_ACCOUNT` | string | 线下转账收款银行卡号（会员购卡下单时展示给已登录会员，非公开接口不返回） |
| `SETUP_FEATURES` | object | 功能开关（见下方） |

**SETUP_FEATURES 结构：**
```json
{
  "booking": true,        // 预约功能
  "payment": false,       // 支付功能（待开发）
  "teacherManage": true,  // 教练管理
  "checkin": true,        // 签到核销
  "news": true,           // 动态资讯
  "selfCheckin": false    // 会员到店定位签到
}
```

---

## ax_announcement — 公告

**用途**：馆内公告，展示于会员端首页/公告列表。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `ANNOUNCE_ID` | string | ✅ | 公告 ID |
| `ANNOUNCE_TITLE` | string | ✅ | 标题 |
| `ANNOUNCE_DESC` | string | — | 摘要 |
| `ANNOUNCE_CONTENT` | array | ✅ | 图文详情，结构同 ax_meet.MEET_CONTENT |
| `ANNOUNCE_CONTENT_DELTA` | object | — | 富文本 Delta 内容（编辑器用） |
| `ANNOUNCE_AUTHOR_NAME` / `ANNOUNCE_AUTHOR_AVATAR` | string | — | 发布人姓名/头像 |
| `ANNOUNCE_ORDER` | int | ✅ | 排序权重，默认 9999 |
| `ANNOUNCE_STATUS` | int | ✅ | `0`=下线 `1`=发布，默认 1 |
| `ANNOUNCE_ADD_TIME` / `ANNOUNCE_EDIT_TIME` | int | ✅ | 创建/修改时间戳 |

---

## ax_banner — 首页轮播图

**用途**：会员端首页轮播图/视频，可跳转到关于我们/资讯/课程/公告。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `BANNER_ID` | string | ✅ | 轮播图 ID |
| `BANNER_TITLE` | string | — | 标题 |
| `BANNER_TYPE` | string | ✅ | `image`=图片 `video`=视频，默认 image |
| `BANNER_PIC` | string | — | 图片或视频封面 cloudId |
| `BANNER_VIDEO` | string | — | 视频 cloudId |
| `BANNER_LINK_TYPE` | string | ✅ | 跳转类型 `about`/`news`/`meet`/`announce`/`none`，默认 none |
| `BANNER_LINK_ID` | string | — | 跳转目标 ID |
| `BANNER_ORDER` | int | ✅ | 排序权重，默认 9999 |
| `BANNER_STATUS` | int | ✅ | `0`=下线 `1`=展示，默认 1 |
| `BANNER_ADD_TIME` / `BANNER_EDIT_TIME` | int | ✅ | 创建/修改时间戳 |

---

## ax_news — 资讯动态

**用途**：馆内资讯文章，可为本地图文或外部链接，带浏览/收藏/评论/点赞计数。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `NEWS_ID` | string | ✅ | 资讯 ID |
| `NEWS_ADMIN_ID` | string | ✅ | 发布管理员 ID |
| `NEWS_TYPE` | int | ✅ | `0`=本地文章 `1`=外部链接，默认 0 |
| `NEWS_TITLE` / `NEWS_DESC` | string | — | 标题/描述 |
| `NEWS_URL` | string | — | 外部链接 URL（TYPE=1 用） |
| `NEWS_STATUS` | int | ✅ | `0`=下线 `1`=发布，默认 1 |
| `NEWS_CATE_ID` / `NEWS_CATE_NAME` | string | ✅ | 分类 ID / 分类名（冗余） |
| `NEWS_ORDER` | int | ✅ | 排序权重，默认 9999 |
| `NEWS_HOME` | int | ✅ | 首页推荐权重，默认 9999 |
| `NEWS_CONTENT` | array | ✅ | 图文内容 |
| `NEWS_CONTENT_DELTA` | object | — | 富文本 Delta 内容 |
| `NEWS_VIEW_CNT` / `NEWS_FAV_CNT` / `NEWS_COMMENT_CNT` / `NEWS_LIKE_CNT` | int | ✅ | 浏览/收藏/评论/点赞计数，默认 0 |
| `NEWS_PIC` | array | — | 附加图片 cloudId 数组 |
| `NEWS_ADD_TIME` / `NEWS_EDIT_TIME` | int | ✅ | 创建/修改时间戳 |

---

## ax_photo — 相册

**用途**：馆内环境/活动相册图片，可跳转到资讯或课程。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `PHOTO_ID` | string | ✅ | 图片 ID |
| `PHOTO_TITLE` / `PHOTO_DESC` | string | — | 标题/描述 |
| `PHOTO_ALBUM` | string | — | 相册名（分组用） |
| `PHOTO_PIC` | string | ✅ | 图片 cloudId |
| `PHOTO_LINK_TYPE` | string | ✅ | 跳转类型 `news`/`meet`/`none`，默认 none |
| `PHOTO_LINK_ID` | string | — | 跳转目标 ID |
| `PHOTO_ORDER` | int | ✅ | 排序权重，默认 9999 |
| `PHOTO_STATUS` | int | ✅ | `0`=下线 `1`=展示，默认 1 |
| `PHOTO_ADD_TIME` / `PHOTO_EDIT_TIME` | int | ✅ | 创建/修改时间戳 |

---

## ax_cache — 通用缓存

**用途**：框架级 KV 缓存，供后端逻辑存储带过期时间的临时数据。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `CACHE_ID` | string | ✅ | 缓存记录 ID |
| `CACHE_KEY` | string | ✅ | 缓存键 |
| `CACHE_VALUE` | object | ✅ | 缓存内容 |
| `CACHE_TIMEOUT` | int | ✅ | 超时时间（毫秒），超过视为失效 |
| `CACHE_ADD_TIME` / `CACHE_EDIT_TIME` | int | ✅ | 创建/修改时间戳 |

---

## ax_export — 导出任务

**用途**：后台数据导出（报表/名单等）生成文件的索引记录，实际文件存于云存储。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `EXPORT_ID` | string | ✅ | 导出任务 ID |
| `EXPORT_KEY` | string | ✅ | 导出业务标识（区分导出类型） |
| `EXPORT_CLOUD_ID` | string | ✅ | 导出文件云存储 cloudId |
| `EXPORT_ADD_TIME` / `EXPORT_EDIT_TIME` | int | ✅ | 创建/修改时间戳 |

---

## ax_temp — 排课时段模板

**用途**：馆主预设的时间段组合模板，新建课程排课时可套用生成 ax_day.times，避免重复配置。对应 `ax_meet.MEET_STYLE_SET.templateId`/`templateName` 引用本表。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `TEMP_ID` | string | ✅ | 模板 ID |
| `TEMP_NAME` | string | ✅ | 模板名称 |
| `TEMP_TIMES` | array | ✅ | 时间段列表，元素结构与 ax_day.times 一致 |
| `TEMP_ADD_TIME` / `TEMP_EDIT_TIME` | int | ✅ | 创建/修改时间戳 |

---

## ax_log — 馆内操作日志

**用途**：馆内管理员操作审计，随 `_pid` 隔离，仅记录本馆操作（区别于跨租户的 ax_platform_log）。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `LOG_ID` | string | ✅ | 日志 ID |
| `LOG_ADMIN_ID` | string | ✅ | 操作管理员 ID |
| `LOG_ADMIN_PHONE` | string | — | 操作管理员手机号 |
| `LOG_ADMIN_NAME` | string | ✅ | 操作管理员姓名 |
| `LOG_CONTENT` | string | ✅ | 操作描述 |
| `LOG_TYPE` | int | ✅ | 日志类型（见常量） |
| `LOG_ADD_TIME` / `LOG_EDIT_TIME` | int | ✅ | 记录/修改时间戳 |

**TYPE 常量：**
```
USER = 0   用户
MEET = 1   预约/活动
NEWS = 2   内容/文章
SYS  = 99  系统
```
