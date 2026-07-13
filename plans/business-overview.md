# 业务全景文档

> 生成日期：2026-07-09  
> 适用版本：当前代码库（基于 CCMiniCloud Framework 2.0.1）

---

## 一、产品定位

本项目是一款面向**瑜伽馆 / 健身工作室 / 舞蹈工作室**的微信小程序 SaaS 管理平台。  
核心价值：用一个小程序替代「微信群接龙约课 + Excel 排课 + 纸质签到表 + 人工记次」。

平台分三端：

| 端 | 用户 | 核心诉求 |
|---|---|---|
| 会员端 | 普通会员 | 自助约课、查卡余额、查历史 |
| 教练/馆长端 | 馆长、教练 | 排课、管名单、扣卡、看数据 |
| 超管平台 | 平台运营方 | 开通馆、续费、全局管控 |

---

## 二、角色与权限

### 2.1 角色体系

```
超级管理员 (super)
    │  跨馆，管所有租户的开通/关闭/续费
    │
  馆长 (owner)
    │  单馆全权：排课、卡务、会员、统计、设置
    │
  教练 (teacher)
       单馆受限：只能管理自己创建的课程，会员信息只读
```

### 2.2 权限矩阵

| 功能 | 超管 | 馆长 | 教练 |
|---|:---:|:---:|:---:|
| 创建/管理租户 | ✅ | ❌ | ❌ |
| 发卡 / 卡模板 | ✅ | ✅ | ❌ |
| 排课（全馆） | ✅ | ✅ | 仅自己 |
| 签到核销 | ✅ | ✅ | 仅自己课程 |
| 会员数据导出 | ✅ | ✅ | ❌ |
| 会员管理 | ✅ | ✅ | 只读 |
| 经营统计 | ✅全平台 | ✅本馆 | ✅本馆 |
| 首页内容管理 | ✅ | ✅ | ❌ |
| 系统设置 | ✅ | ✅ | ❌ |

### 2.3 登录方式

| 角色 | 方式 | 说明 |
|---|---|---|
| 超管 | 账号 + 密码 | 手机号 + 密码存 DB |
| 馆长 | 微信绑定 | 超管生成绑定码，微信扫码绑定 openid |
| 教练 | 微信绑定 | 馆长生成绑定码 |
| 会员 | 微信 openid | 首次登录自动注册 |

---

## 三、核心业务模块

### 3.1 会员约课流程

```
会员打开小程序
    ↓
首页 / 日历视图 → 浏览可约时段
    ↓
选择课程时段 → 查询可用会员卡（getJoinCardOptions）
    ↓
选卡 → 提交预约 → 云函数校验
    │       ├── 人数是否超额
    │       ├── 会员卡有效性（日期/次数/适用范围）
    │       └── 表单字段是否填写完整
    ↓
预约成功 → consumeForJoin 扣次 / 记流水
    ↓
到店扫码 / 自助签到 → 签到完成 → 触发首次上课激活（如有）
```

**取消流程：**  
会员取消 → `refundForJoinCancel` → 次数退还，流水标 REFUNDED → 时段名额释放

### 3.2 排课流程

```
馆长/教练 → 新建课程（ax_meet）
    ↓
设置排课日期 + 时段（ax_day）
    │   每个时段包含：开始时间、结束时间、人数上限、授课老师
    │   私教时段还有：bufferBefore/After 防冲突时间
    ↓
发布 → 会员端可见
```

**排课规则：**
- 每个时段生成唯一 `timeMark`（T + 日期 + 10位随机码）
- 编辑课程时保留有预约记录的时段的统计数据（succCnt/cancelCnt）
- 删除时段前检查是否有未取消的预约

### 3.3 会员卡体系

#### 卡类型

| 类型 | 字段值 | 划扣规则 | 余量显示 |
|---|---|---|---|
| 次数卡 | `times` | 每次预约按 `MEET_STYLE_SET.cardTimes` 扣减 | X 次 |
| 期限卡 | `period` | 有效期内不限次，仅记流水 | 期限内畅练 |

#### 激活方式

| 方式 | 触发时机 | 适用场景 |
|---|---|---|
| `immediate` | 发卡即激活，马上计有效期 | 现场刷卡购买 |
| `first_book` | 首次预约时激活 | 提前购买，约了才开始计天数 |
| `first_class` | 首次签到时激活 | 到店才算正式开始 |
| `first_use_limit` | 首次预约或签到均可触发 | 灵活使用 |

#### 适用范围（scope）

- `mode: "all"` — 适用全部课程
- `mode: "categories"` — 仅适用指定课程分类（通过 categoryIds 匹配）

#### 会员卡状态流转

```
发卡 → status=NORMAL（立即激活）/ status=NORMAL + startTime=0（待激活）
    ↓
约课扣次 → quota--
    ↓（quota ≤ 0）
status = USED（次数卡）
    ↓（取消预约）
quota++ → status 可能恢复 NORMAL

馆长手动 → STOP（停卡）/ NORMAL（恢复）
```

#### 期限卡自愈机制

若期限卡记录被误标为 USED 但实际未过期，`_selfHealPeriodCardRecord` 会在查询时自动检测并将 status 修正为 NORMAL（同步更新 DB）。

### 3.4 签到核销

三种签到方式：

| 方式 | 操作者 | 入口 |
|---|---|---|
| 扫码核销 | 教练用小程序扫会员二维码 | `admin/join_scan`，会员持 `JOIN_CODE` 展示 |
| 手动签到 | 教练在名单页手动勾选 | `admin/join_checkin` / 批量 `join_checkin_batch` |
| 用户自助签到 | 会员扫场馆二维码 | `my/my_join_checkin`，场馆生成时段二维码 |

签到后触发 `tryActivateForJoinCheckin`，若该会员卡激活方式为 `first_class` / `first_use_limit` 则激活。

### 3.5 私教预约

- 私教课在 ax_meet 中按分类识别（adminTenantService 维护私教分类 ID 列表）
- 时段字段 `slotType: "private"`，`limit: 1`（强制单人）
- 有冲突检测：教练同一时间段不得有其他已预约的私教课，并考虑 `bufferBefore/After` 缓冲分钟
- 私教路由独立（`private/*`），与团课流程分离

### 3.6 统计与数据导出

#### 统计模块（教练端 → 统计）

| 统计项 | 数据来源 | 说明 |
|---|---|---|
| 会员卡分析 | ax_user_card + ax_card_tpl | 按类型汇总持卡数量 |
| 上课统计 | ax_user_card_log + ax_meet | 按分类/教练分组，耗次/耗卡金额 |
| 约课排名 | ax_join | Top N 会员，按预约次数+签到次数 |
| 耗卡收入明细 | ax_user_card_log + ax_user_card | 次数卡按扣次分摊，期限卡首次上课记整价 |
| 耗卡统计 | ax_user_card_log + ax_user_card | 总耗次/总初始次/耗卡率，按卡名分组 |
| 预约查询 | ax_join + ax_user | 支持按日期区间、状态、签到过滤 |
| 排课查询 | ax_day + ax_meet | 教师角色自动过滤为自己的课 |

#### 收入计算逻辑

- **次数卡**：单次收入 = 卡单价 ÷ 初始次数 × 本次扣次
- **期限卡**：仅首次上课的流水条目计入，金额 = 卡总价（避免重复计算）

#### 数据导出

支持三类 CSV 导出（异步任务，存 ax_export）：
- 收入数据（按日期范围）
- 预约记录
- 会员信息

---

## 四、数据库集合总览

| 集合名 | 用途 | 关键隔离字段 |
|---|---|---|
| `ax_tenant` | 租户（各瑜伽馆）基础信息 | `_pid`（自身就是租户） |
| `ax_admin` | 管理员账号（馆长/教练/超管） | `_pid` |
| `ax_teacher` | 教练前台展示档案 | `_pid` |
| `ax_user` | 会员账号 | `_pid` |
| `ax_meet` | 课程（预约项目） | `_pid` |
| `ax_day` | 排课日期与时段 | `_pid`（通过 meetId 间接） |
| `ax_join` | 预约记录 | `_pid` |
| `ax_card_tpl` | 会员卡模板 | `_pid` |
| `ax_user_card` | 会员持卡记录 | `_pid` |
| `ax_user_card_log` | 持卡流水（扣次/退次/手动加减） | `_pid` |
| `ax_news` | 资讯/动态/常识 | `_pid` |
| `ax_banner` | 首页轮播图 | `_pid` |
| `ax_announcement` | 公告 | `_pid` |
| `ax_photo` | 馆内照片 | `_pid` |
| `ax_setup` | 全局配置（联系方式/功能开关等） | `_pid` |
| `ax_temp` | 排课时段模板 | `_pid` |
| `ax_log` | 后台操作日志 | `_pid` |
| `ax_export` | 数据导出任务记录 | `_pid` |
| `ax_cache` | 服务端缓存 | `_pid` |

**多租户隔离方式**：BaseModel 的 `_getWhere()` 自动注入 `_pid = global.PID`，所有查询天然隔离，无需业务层手动处理。

---

## 五、业务对象关系图

```
ax_tenant (馆)
    │
    ├── ax_admin (管理员)  ←── ax_teacher (教练档案)
    │
    ├── ax_user (会员)
    │       │
    │       ├── ax_user_card (持卡)  ←── ax_card_tpl (卡模板)
    │       │       │
    │       │       └── ax_user_card_log (流水)
    │       │
    │       └── ax_join (预约)
    │               │
    │               └── ax_user_card_log (JOIN_ID 关联)
    │
    ├── ax_meet (课程)
    │       │
    │       └── ax_day (排课时段)  ←── ax_join (TIME_MARK 关联)
    │
    ├── ax_news / ax_banner / ax_announcement / ax_photo
    └── ax_setup / ax_temp / ax_log / ax_export
```

---

## 六、SaaS 多租户架构

### 6.1 PID 传递链路

```
用户选馆 → 缓存 TENANT_PID
    ↓
每次云调用：cloud_helper.js 自动带 PID = pageHelper.getPID()
    ↓
云函数入口：base_controller.js → global.PID = event.PID
    ↓
BaseModel._getWhere() → 所有查询自动加 { _pid: global.PID }
```

### 6.2 租户状态管控

- `TENANT_STATUS: 0` → 访问时返回「馆已关闭」提示页（`tenant_expired_hint`）
- `TENANT_EXPIRE_TIME > 0` → 超过到期时间跳转到期提醒页
- 超管可通过平台管理续期或停用

### 6.3 定制化支持

- `ax_tenant.TENANT_TEMPLATE` 指向 `projects/{PID}/` 下的定制前端页面
- 默认走 `pages/default/`，定制页优先（通过 `page_registry.js` 注册）
- 课程分类、品牌色、tabBar 项均支持按馆独立配置

---

## 七、关键业务约束

| 约束 | 实现位置 | 说明 |
|---|---|---|
| 约课不超报 | `MeetService.join` | 查时段已预约数 vs limit，原子性写入 |
| 会员卡跨馆不通用 | BaseModel `_pid` 隔离 | 查 ax_user_card 自动加 `_pid` 过滤 |
| 期限卡不扣次 | `consumeForJoin` | `type === PERIOD` 只写流水，不修改 quota |
| 教练排课时间冲突 | `_validateDayTeacherTimes` | 检测含 bufferBefore/After 的占用区间 |
| 导出限馆长权限 | controller 层 `isOwner()` | teacher 调用导出接口会被拒绝 |
| 演示模式防写入 | 路由 `#noDemo` 标记 | 标记接口在演示模式下直接返回提示 |
