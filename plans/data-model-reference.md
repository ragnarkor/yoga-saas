# 数据模型参考手册

> 生成日期：2026-07-09  
> 所有集合均通过 `_pid` 字段实现多租户逻辑隔离

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
| `JOIN_EDIT_TIME` | int | — | 最后操作时间戳 |
| `JOIN_EDIT_STATUS` | int | — | 操作状态快照 |
| `JOIN_ADD_TIME` | int | ✅ | 预约时间戳 |

**STATUS 常量：**
```
SUCC         = 1   预约成功（有效）
CANCEL       = 10  会员自主取消
ADMIN_CANCEL = 99  管理员/系统取消
```

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

## ax_teacher — 教练档案（前台展示）

**用途**：会员端展示的教练信息，与 ax_admin 是 1:1 关系（通过 TEACHER_ADMIN_ID 关联）。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `_pid` | string | ✅ | 租户 ID |
| `TEACHER_ID` | string | ✅ | 教练 ID |
| `TEACHER_ADMIN_ID` | string | ✅ | 关联 ax_admin `_id` |
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
