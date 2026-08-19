# API 路由参考手册

> 生成日期：2026-07-09  
> 所有接口通过微信云函数调用，入口统一为 `cloudHelper.callCloud(route, params)`  
> `#noDemo` 标记的接口在演示模式下会被拦截，禁止写入操作

---

## 一、会员端 API

### 1.1 公共 / 首页

| 路由 | 说明 | 主要参数 | 返回 |
|---|---|---|---|
| `tenant/list` | 获取所有开放租户列表 | — | `[{_pid, name, logo, desc}]` |
| `tenant/detail` | 单个馆详情（含功能配置） | `pid` | `{name, features, themeColor}` |
| `tenant/check_access` | 校验当前馆是否可访问 | — | `{ok, reason}` |
| `home/setup_all` | 全局配置（首页启动必调） | — | `{setup, features}` |
| `home/index` | 首页数据（banner/公告/教练/照片） | — | `{banners, announces, teachers, photos}` |
| `home/search` | 全文搜索 | `keyword` | `{meets, news}` |
| `home/teacher_detail` | 教练详情页 | `id` | `{teacher, meets}` |
| `home/teacher_home` | 教练主页 | `adminId` | `{teacher}` |
| `home/announce_detail` | 公告详情 | `id` | `{announce}` |

### 1.2 用户 / 登录

| 路由 | 说明 | 主要参数 | 返回 |
|---|---|---|---|
| `passport/phone` | 获取微信手机号（授权后） | `code` | `{phone}` |
| `passport/my_detail` | 当前会员信息 | — | `{user}` |
| `passport/my_tenants` | 我加入的馆列表 | — | `[{pid, name}]` |
| `passport/sync_profile` | 同步微信头像和昵称 | `name, pic` | `{ok}` |
| `passport/edit_base` | 编辑个人基础信息 | `name, mobile, city...` | `{ok}` |
| `passport/join_tenant` | 加入（授权访问）某个馆 | `pid` | `{ok}` |
| `passport/ensure_member` | 确保已注册为会员（静默） | — | `{userId}` |

### 1.3 课程 / 约课

| 路由 | 说明 | 主要参数 | 返回 |
|---|---|---|---|
| `meet/list` | 课程列表 | `page, size, typeId` | `{list, total}` |
| `meet/list_by_day` | 按日期查当天所有时段 | `day` | `{list}` |
| `meet/list_by_week` | 按周查课表 | `startDay, endDay` | `{list}` |
| `meet/list_has_day` | 查询从某天起有课的日期 | `fromDay, meetId` | `[day]` |
| `meet/view` | 浏览课程详情 | `id` | `{meet}` |
| `meet/join_roster` | 查看某时段预约名单（公开） | `meetId, timeMark` | `{list, total}` |
| `meet/join_card_options` | 预约前查可用会员卡 | `meetId, timeMark` | `{list, needTimes}` |
| `meet/detail_for_join` | 预约前课程详情（含表单配置） | `meetId, timeMark` | `{meet, slot}` |
| `meet/before_join` | 预约前置校验（人数/卡/重复） | `meetId, timeMark, cardId` | `{ok, card}` |
| `meet/join` | 发起预约 | `meetId, timeMark, cardId, forms` | `{joinId}` |

### 1.4 我的

| 路由 | 说明 | 主要参数 | 返回 |
|---|---|---|---|
| `my/my_join_list` | 我的约课记录 | `status, page, size` | `{list, total}` |
| `my/my_join_detail` | 预约详情 | `joinId` | `{join, meet, slot}` |
| `my/my_join_cancel` | 取消预约（自主） | `joinId` | `{ok}` |
| `my/my_join_someday` | 查看某天我的约课 | `day` | `{list}` |
| `my/my_join_checkin` | 到店定位签到 | `timeMark, latitude, longitude` | `{ok}` |
| `my/my_card_list` | 我的会员卡列表 | — | `{list, total}` |
| `my/my_card_summary` | 持卡概要（首页用） | — | `{hasCard, canBook, timesTotal, hasPeriod}` |
| `my/my_card_detail` | 会员卡详情 + 使用记录 | `cardId` | `{card, usageList}` |
| `my/achievement` | 我的成就（累计/连续/徽章/热力图） | — | `{streak, badges, heatmap, heatmapStartDay, heatmapHint}` |

### 1.5 私教预约

| 路由 | 说明 | 主要参数 | 返回 |
|---|---|---|---|
| `private/meta` | 私教元数据（教练列表/分类） | — | `{teachers, categories}` |
| `private/available_slots` | 可预约时段 | `teacherId, startDay, endDay` | `{slots}` |
| `private/book` | 预约私教 | `meetId, timeMark, cardId` | `{joinId}` |

### 1.6 资讯

| 路由 | 说明 | 主要参数 |
|---|---|---|
| `news/list` | 资讯列表（分类过滤） | `cateId, page, size` |
| `news/home_list` | 首页资讯（最新） | `limit` |
| `news/view` | 浏览资讯（计阅读数） | `id` |

---

## 二、管理端 API（教练/馆长）

> 所有管理端接口需在 header 中携带 `ADMIN_TOKEN`，由 `base_admin_controller.isAdmin()` 校验

### 2.1 登录与账号管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/login` | 无需登录 | 账号密码登录 | `phone, password` |
| `admin/home` | 全部 | 工作台数据（今日预约/待签到等） | — |
| `admin/wx_session` | 无需登录 | 微信静默登录（openid 匹配） | `code` |
| `admin/wx_bind` | 需登录 | 绑定微信 | `code` |
| `admin/wx_unbind` | owner | 解绑微信 | `adminId` |
| `admin/bind_code_gen` | owner | 生成新管理员绑定码 | `type(owner/teacher)` |
| `admin/bind_admin_list` | owner | 可绑定账号列表 | — |
| `admin/member_invite_qr` | 全部 | 生成会员邀请小程序码 | — |

### 2.2 会员卡模板管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/card_tpl_list` | 全部 | 卡模板列表 | — |
| `admin/card_tpl_detail` | 全部 | 模板详情 | `id` |
| `admin/card_tpl_save` #noDemo | owner | 新建/编辑模板 | `{id?, name, type, days, quota, price, color, cover, scope}` |
| `admin/card_tpl_del` #noDemo | owner | 删除模板 | `id` |

### 2.3 会员持卡管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/user_card_list` | 全部 | 某会员全部持卡 | `userId` |
| `admin/user_join_card_options` | 全部 | 教练代约时查可用卡 | `userId, meetId, timeMark?` |
| `admin/user_card_detail` | 全部 | 持卡详情 + 流水 | `cardId` |
| `admin/user_card_issue` #noDemo | 全部 | 发卡 | `{userId, tplId, activate, days?, memo?, coachId?}` |
| `admin/user_card_adjust` #noDemo | 全部 | 手动加次/消次/停卡/恢复 | `{cardId, action, times?, memo, operatorName}` |
| `admin/user_card_del` #noDemo | owner | 删除持卡 | `cardId` |
| `admin/card_holder_members` | 全部 | 有效持卡会员列表 | `search?, page, size` |
| `admin/month_new_card_members` | 全部 | 本月新发卡会员 | `search?, page, size` |
| `admin/coach_member_list` | 全部 | 教练持卡会员 | `coachId, page, size` |

### 2.4 课程管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/meet_list` | 全部 | 课程分页列表（teacher 自动过滤） | `search?, page, size, sortType` |
| `admin/meet_insert` #noDemo | 全部 | 新建课程 | `{title, typeId, typeName, order, daysSet, isShowLimit, formSet}` |
| `admin/meet_detail` | 全部 | 课程详情 + 排课数据 | `id, fromDay?` |
| `admin/meet_edit` #noDemo | 全部 | 编辑课程 | `{id, title, typeId, daysSet, ...}` |
| `admin/meet_del` #noDemo | owner | 删除课程（级联删 join+day） | `id` |
| `admin/meet_update_content` #noDemo | 全部 | 更新图文介绍 | `{meetId, content}` |
| `admin/meet_update_style` #noDemo | 全部 | 更新样式配置 | `{meetId, styleSet}` |
| `admin/meet_sort` #noDemo | 全部 | 排序 | `{id, sort}` |
| `admin/meet_status` #noDemo | 全部 | 更改课程状态 | `{id, status}` |

### 2.5 排课管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/schedule_week` | 全部 | 周课表（含预约数） | `startDay, endDay, typeId?, coachId?` |
| `admin/schedule_slot_remove` #noDemo | 全部 | 删除单个排课时段 | `{meetId, day, mark}` |
| `admin/meet_cancel_time_join` #noDemo | 全部 | 取消某时段全部预约 | `{meetId, timeMark, reason}` |
| `admin/meet_restore_time_slot` #noDemo | 全部 | 恢复已取消时段 | `{meetId, timeMark}` |
| `admin/meet_day_list` | 全部 | 获取课程排课日期数据 | `meetId, start, end` |
| `admin/temp_list` | 全部 | 排课时段模板列表 | — |
| `admin/temp_insert` #noDemo | 全部 | 新建时段模板 | `{name, times}` |
| `admin/temp_edit` #noDemo | 全部 | 编辑时段模板 | `{id, name, times}` |
| `admin/temp_del` #noDemo | 全部 | 删除时段模板 | `id` |

### 2.6 预约名单管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/meet_join_list` | 全部 | 预约名单（分页） | `meetId, mark?, search?, status?, page, size` |
| `admin/join_status` #noDemo | 全部 | 修改预约状态（取消/恢复） | `{joinId, status, reason?}` |
| `admin/join_del` #noDemo | owner | 删除预约记录 | `joinId` |
| `admin/group_book` #noDemo | 全部 | 团课代预约 | `{meetId, timeMark, userId, cardId?, memo?}` |

### 2.7 签到核销

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/join_checkin` #noDemo | 全部 | 手动签到/取消签到 | `{joinId, flag(0/1)}` |
| `admin/join_checkin_batch` #noDemo | 全部 | 批量签到 | `{meetId, timeMark, flag}` |

### 2.8 私教管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/private_meta` | 全部 | 私教元数据 | — |
| `admin/private_list` | 全部 | 私教预约列表 | `page, size` |
| `admin/private_check` | 全部 | 检查时段是否冲突 | `{teacherId, day, start, end}` |
| `admin/private_book` #noDemo | 全部 | 私教代约 | `{meetId, timeMark, userId, cardId?}` |

### 2.9 统计与报表

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/stats_card_analysis` | 全部 | 会员卡分析（按类型/卡名汇总） | — |
| `admin/stats_class` | 全部 | 上课统计 | `startDay, endDay, coachId?` |
| `admin/stats_rank` | 全部 | 约课排名（Top N 会员） | `limit?` |
| `admin/stats_fund` | owner | 耗卡收入明细 | `range(today/month/all), page, size` |
| `admin/stats_consume` | owner | 耗卡统计（耗次/耗卡率） | — |
| `admin/stats_join_query` | 全部 | 预约查询（跨日期范围） | `dayStart, dayEnd, search?, page, size` |
| `admin/stats_schedule_query` | 全部 | 排课查询 | `startDay, endDay` |
| `admin/income_data_get` | owner | 收入数据预览 | `startDay, endDay` |
| `admin/income_data_export` #noDemo | owner | 收入数据导出 CSV | `startDay, endDay` |
| `admin/join_data_get` | owner | 预约数据预览 | `startDay, endDay` |
| `admin/join_data_export` #noDemo | owner | 预约数据导出 CSV | `startDay, endDay` |
| `admin/user_data_get` | owner | 会员数据预览 | — |
| `admin/user_data_export` #noDemo | owner | 会员数据导出 CSV | — |

### 2.10 首页内容管理

| 路由 | 权限 | 说明 |
|---|---|---|
| `admin/home_banner_*` | 全部 | 轮播图 CRUD |
| `admin/home_announce_*` | 全部 | 公告 CRUD |
| `admin/home_teacher_*` | 全部 | 教练档案 CRUD |
| `admin/home_photo_*` | 全部 | 馆内照片 CRUD |

### 2.11 管理员 / 员工管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/mgr_list` | owner | 管理员列表 | — |
| `admin/mgr_insert` #noDemo | owner | 新建管理员 | `{name, phone, type}` |
| `admin/staff_insert` #noDemo | super | 平台新建员工 | — |
| `admin/mgr_del` #noDemo | owner | 删除管理员 | `id` |
| `admin/log_list` | owner | 操作日志 | `page, size` |

### 2.12 系统设置

| 路由 | 权限 | 说明 |
|---|---|---|
| `admin/setup_about` | owner | 关于我们设置 |
| `admin/setup_contact` | owner | 联系方式设置 |
| `admin/setup_qr` | owner | 二维码设置 |
| `admin/setup_feature` #noDemo | owner | 功能开关保存 |
| `admin/setup_feature_get` | owner | 功能开关读取 |

### 2.13 会员管理

| 路由 | 权限 | 说明 | 主要参数 |
|---|---|---|---|
| `admin/user_list` | owner | 会员列表 | `search?, cardFilter, page, size` |
| `admin/user_detail` | owner | 会员详情（含持卡/预约） | `userId` |
| `admin/user_del` #noDemo | owner | 删除会员 | `userId` |

---

## 三、平台超管 API

| 路由 | 说明 | 主要参数 |
|---|---|---|
| `admin/tenant_store` | 馆设置读取 | — |
| `admin/tenant_insert` #noDemo | 新建馆（租户） | `{name, logo, desc, themeColor, meetType}` |
| `admin/tenant_expire_set` #noDemo | 设置到期时间 | `{pid, expireTime}` |
| `admin/tenant_expire_del` #noDemo | 移除到期限制 | `{pid}` |
| `admin/platform_overview` | 平台概览数据 | — |
| `admin/platform_tenant_list` | 全部馆列表（超管） | — |

---

## 四、接口调用规范

### 请求格式（通过 cloud_helper 封装）

```javascript
// 会员端
cloudHelper.callCloud('meet/join', {
  meetId: 'xxx',
  timeMark: 'T20250110ABCDE',
  cardId: 'yyy',
  forms: []
})

// 管理端（自动带 token）
cloudHelper.callCloud('admin/user_card_issue', {
  userId: 'openid_xxx',
  tplId: 'tpl_001',
  activate: 'first_book'
})
```

### 通用返回格式

```json
{
  "code": 0,       // 0=成功，非0=失败
  "msg": "ok",     // 错误消息
  "data": { ... }  // 业务数据
}
```

### 常见错误码

| code | 含义 |
|---|---|
| 0 | 成功 |
| 401 | 未登录 / Token 失效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 422 | 参数校验失败 |
| 500 | 业务逻辑错误（AppError） |
