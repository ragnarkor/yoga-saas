# 云数据库索引

> 状态：代码侧索引检查路由已完成；生产环境复合索引仍需在微信云开发控制台确认并建立。

云函数 `admin/db_indexes_ensure`（仅超级管理员）用于在 SDK 支持时补齐高频单字段索引。
但微信云开发不同环境对 `createIndex` 能力和复合索引配置支持不同，不能把云函数返回 `created` 当作生产索引已全部完成。因此生产环境仍需在云开发控制台建立并验证以下复合索引：

| 集合 | 推荐索引 |
|---|---|
| `ax_join` | `_pid + JOIN_USER_ID + JOIN_STATUS` |
| `ax_join` | `_pid + JOIN_MEET_ID + JOIN_MEET_TIME_MARK + JOIN_STATUS` |
| `ax_join` | `_pid + JOIN_MEET_DAY + JOIN_STATUS` |
| `ax_join` | `_pid ASC + JOIN_USER_ID ASC + JOIN_MEET_DAY ASC + JOIN_MEET_TIME_START ASC + JOIN_ADD_TIME DESC`（首页今日约课） |
| `ax_user_card` | `_pid + USER_CARD_USER_ID + USER_CARD_STATUS` |
| `ax_user_card_log` | `_pid + CARD_LOG_USER_CARD_ID + CARD_LOG_STATUS` |
| `ax_user_card_log` | `_pid + CARD_LOG_JOIN_ID + CARD_LOG_ACTION` |
| `ax_day` | `_pid + DAY_MEET_ID + day` |
| `ax_card_order` | `ORDER_ID`（唯一，支付回调按此字段跨租户定位订单，见 `card_notify_service.js`） |
| `ax_card_order` | `ORDER_PAY_TYPE + ORDER_STATUS + ORDER_ADD_TIME`（不带 `_pid`：`card_order_job_service.js` 定时关单任务按此条件跨租户全表扫描，订单量增长后需要这条索引兜底） |
| `ax_checkin_streak` | `_pid + STREAK_USER_ID`（会员端高频读写打卡连续记录） |

执行路由后返回 `created/skipped/unsupported/failed` 明细；`unsupported` 不影响业务请求，需改用控制台手动建索引。

## 唯一性约束（当前仅应用层查重，无数据库唯一索引兜底）

以下字段目前靠"先查重再插入"保证唯一，并发请求下存在竞态窗口（两个并发请求可能都查重通过、都插入成功）。建议在控制台为这些字段建立唯一索引：

| 集合 | 字段 | 说明 |
|---|---|---|
| `ax_admin` | `_pid + ADMIN_PHONE` | 登录手机号，馆内唯一 |
| `ax_user` | `USER_MINI_OPENID` | 微信 openid，全局唯一 |
| `ax_card_tpl` | `_pid + CARD_TPL_ID` | 业务 ID，由 `Model.makeID()` 生成 |

`Model.makeID()`（`framework/database/model.js`）已加入随机分量以降低同毫秒并发插入撞 ID 的概率，但仍建议对被直接用作查询/编辑/删除键的业务 ID（如 `CARD_TPL_ID`）建立唯一索引作为最终兜底。

## 上线检查

1. 在目标云开发环境执行一次 `admin/db_indexes_ensure`，保存返回结果。
2. 对下表复合索引逐项截图或导出配置，确认字段顺序与查询条件一致。
3. 用课程列表、预约记录、会员卡流水和统计页面各执行一次真实查询，观察慢查询与错误日志。
4. 索引建立后再观察 1–2 天查询耗时；不要在未确认字段顺序前重复创建同类索引。
