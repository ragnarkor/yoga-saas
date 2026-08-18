# 云数据库索引

云函数新增 `admin/db_indexes_ensure`（仅超级管理员）用于在 SDK 支持时补齐高频单字段索引。
由于微信云开发不同环境对 `createIndex` 能力和复合索引配置可能不同，生产环境仍建议在云开发控制台建立以下复合索引：

| 集合 | 推荐索引 |
|---|---|
| `ax_join` | `_pid + JOIN_USER_ID + JOIN_STATUS` |
| `ax_join` | `_pid + JOIN_MEET_ID + JOIN_MEET_TIME_MARK + JOIN_STATUS` |
| `ax_join` | `_pid + JOIN_MEET_DAY + JOIN_STATUS` |
| `ax_user_card` | `_pid + USER_CARD_USER_ID + USER_CARD_STATUS` |
| `ax_user_card_log` | `_pid + CARD_LOG_USER_CARD_ID + CARD_LOG_STATUS` |
| `ax_user_card_log` | `_pid + CARD_LOG_JOIN_ID + CARD_LOG_ACTION` |
| `ax_day` | `_pid + DAY_MEET_ID + day` |

执行路由后返回 `created/skipped/unsupported/failed` 明细；`unsupported` 不影响业务请求，需改用控制台手动建索引。
