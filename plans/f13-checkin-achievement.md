# F13 · 会员打卡成就系统 需求文档

> 版本：v1.0  
> 日期：2026-07-09  
> 优先级：P3

---

## 一、背景与目标

### 问题

会员上完课就走，和馆的连接只停留在「约课」这一个动作。馆长没有工具留住会员、让会员主动传播，只能靠人工发朋友圈和微信群运营。

### 目标

- **留存**：让会员感知自己的积累，形成「打断损失感」——连续 8 周的人不舍得中断
- **传播**：成就海报分享到朋友圈，带小程序码，顺带为馆引流
- **无额外负担**：数据完全来自已有的签到记录，会员不需要主动「打卡」，签到即打卡

### 不做什么

- 不做动态流、评论、点赞——需要内容运营，中小馆撑不起来
- 不做排行榜——容易引起焦虑，与瑜伽「非竞争」理念相悖
- 不做积分兑换——功能边界扩散，放到 F8 营销工具里

---

## 二、核心概念

**上课即打卡**：会员只要预约了课程且未取消，即视为一次有效上课记录，不依赖签到操作。中小馆很多场景下馆长和会员都认识，不一定会走签到流程，以签到为口径会严重低估实际出勤。

**数据口径**：`ax_join.JOIN_STATUS = 1`（预约成功）且未被取消（`JOIN_STATUS ≠ 10 / 99`）。

**三个维度**：

| 维度 | 含义 | 数据来源 |
|---|---|---|
| 累计上课次数 | 历史有效上课总次数 | `ax_join` WHERE `JOIN_STATUS=1` |
| 连续打卡周数 | 以「自然周（ISO 周）」为单位，上周上过课本周才算连续 | `ax_join` 按 week 去重 |
| 上课热力图 | 过去 12 周每天是否上过课（二值：去/未去） | `ax_join` 按 day 聚合 |

---

## 三、数据模型

### 3.1 新增集合：ax_checkin_streak

存储每个会员的成就聚合状态，签到时增量更新，不重新全量计算。

```js
{
  _pid: 'A00',                    // 租户 ID
  STREAK_USER_ID: 'openid_xxx',   // 会员 openid（唯一索引）

  // 连续打卡
  STREAK_CURRENT: 12,              // 当前连续上课周数（ISO 周）
  STREAK_MAX: 28,                  // 历史最长连续周数
  STREAK_LAST_WEEK: '2026-W28',   // 最后一次有签到的 ISO 周（格式：yyyy-Www）

  // 累计数据
  STREAK_TOTAL_CLASSES: 86,       // 累计上课次数（JOIN_STATUS=1 且未取消）
  STREAK_TOTAL_DAYS: 64,          // 累计上课天数（按自然日去重）

  // 徽章
  STREAK_BADGES: ['first_class', 'classes_10', 'week_3'],  // 已解锁徽章 ID 数组

  STREAK_ADD_TIME: 1720000000,
  STREAK_EDIT_TIME: 1720000000,
}
```

**连续周数计算规则（增量更新逻辑）：**

```
签到所在 ISO 周 = thisWeek（格式：yyyy-Www，如 2026-W28）

if thisWeek == STREAK_LAST_WEEK:
    本次是同一周内重复签到，TOTAL_CLASSES++ 但连续周数不变

if thisWeek == STREAK_LAST_WEEK + 1周:
    STREAK_CURRENT++
    STREAK_MAX = max(STREAK_MAX, STREAK_CURRENT)

if thisWeek > STREAK_LAST_WEEK + 1周:
    STREAK_CURRENT = 1   ← 中断，重新从 1 开始（跳过了至少一个自然周）

STREAK_LAST_WEEK = thisWeek
STREAK_TOTAL_CLASSES++
if 今日是本周首次签到: STREAK_TOTAL_DAYS++
```

> ISO 周计算：`const d = new Date(day); const jan4 = new Date(d.getFullYear(), 0, 4); const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)`

### 3.2 热力图数据

**不单独存储**，每次调用 `my/achievement` 接口时实时从 `ax_join` 聚合：

```js
// 查过去 84 天（12周）内该会员的上课记录
// 条件：JOIN_STATUS=1（预约成功）且 JOIN_STATUS ≠ 10/99（未取消）
// 按 JOIN_MEET_DAY 分组，有记录的日期返回 1
// 返回格式：{ '2026-07-09': 1, '2026-07-01': 1, ... }
```

84 天数据量很小（单人最多 84 条 join 记录），实时聚合无性能压力。

---

## 四、徽章体系

徽章定义**写死在云函数配置中**，不入库，判断逻辑是对 `ax_checkin_streak` 字段做阈值比较。

### 4.1 累计次数徽章（里程碑）

| 徽章 ID | 名称 | 解锁条件 | 图标风格 |
|---|---|---|---|
| `first_class` | 初心者 | 第 1 次上课 | 嫩芽 🌱 |
| `classes_10` | 十步之遥 | 累计 10 次 | 脚印 👣 |
| `classes_30` | 月度常客 | 累计 30 次 | 月亮 🌙 |
| `classes_50` | 稳定修行 | 累计 50 次 | 莲花 🪷 |
| `classes_100` | 百课不倦 | 累计 100 次 | 金冠 👑 |
| `classes_200` | 瑜伽深耕 | 累计 200 次 | 山脉 ⛰️ |

### 4.2 连续坚持徽章

| 徽章 ID | 名称 | 解锁条件 | 文案锚点 |
|---|---|---|---|
| `streak_4` | 月月不断 | 连续 4 周 | 一个月没跳过任何一周 |
| `streak_8` | 习惯养成 | 连续 8 周 | 心理学「两个月习惯」节点，适合宣传 |
| `streak_12` | 季度达人 | 连续 12 周 | 整季度坚持 |
| `streak_24` | 半年坚守 | 连续 24 周 | 稀有徽章 |
| `streak_max_12` | 最长记录 | 历史最长连续 ≥ 12 周 | 动态文案：「你的最长纪录是 X 周」 |

### 4.3 徽章展示规则

- **已解锁**：彩色图标 + 徽章名 + 解锁日期
- **未解锁**：灰色 + 进度提示，如「还差 14 次」「还差 3 天」
- **最近解锁**（7天内）：徽章角标显示「NEW」

---

## 五、接口设计

### 5.1 新增接口：`my/achievement`

**用途**：会员端「我的成就」页面入口数据

**返回：**

```js
{
  streak: {
    current: 12,          // 当前连续周数（ISO 周）
    max: 28,              // 历史最长连续周数
    totalClasses: 86,     // 累计上课次数
    totalDays: 64,        // 累计上课天数（按自然日去重）
  },
  badges: [
    {
      id: 'first_class',
      name: '初心者',
      desc: '完成第一次上课',
      unlocked: true,
      unlockedAt: '2025-03-01',  // 解锁日期（从 ax_join 首次签到日推算）
      isNew: false,
    },
    {
      id: 'streak_8',
      name: '习惯养成',
      desc: '连续上课 8 周',
      unlocked: false,
      progress: 12,    // 当前连续周数
      target: 8,       // 目标周数
    },
    // ...
  ],
  heatmap: {
    // 过去 84 天，key=yyyy-MM-dd，value=1（当天有签到）；无记录的日期不返回
    '2026-07-09': 1,
    '2026-07-08': 1,
    '2026-07-01': 1,
    // ...
  },
  heatmapDays: 84,     // 热力图跨度天数（固定 84）
  heatmapStartDay: '2026-04-16',  // 起始日期（今天 - 83天）
}
```

### 5.2 修改接口：预约成功触发更新

在预约写入 `ax_join` 成功后（`JOIN_STATUS=1`）追加 `_updateStreak(userId, day)` 调用：

| 文件 | 方法 | 触发时机 |
|---|---|---|
| `meet_service.js` | `joinMeet` | 用户预约成功 |
| `private_service.js` | `joinPrivate` | 私教预约成功 |

取消预约时同步回滚（STREAK_TOTAL_CLASSES--，连续周数复杂回滚暂不处理，接受误差）：

| 文件 | 方法 | 触发时机 |
|---|---|---|
| `meet_service.js` | `cancelJoin` | 用户取消预约 |
| `admin_meet_service.js` | `adminCancelJoin` | 管理员取消 |

`_updateStreak` 逻辑（新建 `streak_service.js`）：

```js
async _updateStreak(userId, day) {
  // upsert ax_checkin_streak
  // 按上述增量更新规则更新字段
  // 检测新徽章解锁，push 到 STREAK_BADGES
}
```

---

## 六、前端页面

### 6.1 入口

「我的」页面（`my_index`）现有卡片列表中增加一行：

```
┌─────────────────────────────┐
│ 🏅 我的成就   已上课 86 次 › │
└─────────────────────────────┘
```

显示累计上课次数作为副文案，吸引点击。

---

### 6.2 成就页（`my_achievement`）

**页面路径**：`pages/default/my/achievement/my_achievement`

**整体布局（从上到下）：**

```
┌─────────────────────────────────┐
│         我的成就                 │  ← 导航栏
├─────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐    │
│  │ 累计上课  │  │ 连续周数  │   │  ← 数据概览卡片
│  │   86 次  │  │  12 周   │   │
│  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐    │
│  │ 上课天数  │  │ 历史最长  │   │
│  │   64 天  │  │  28 周   │   │
│  └──────────┘  └──────────┘    │
├─────────────────────────────────┤
│  上课热力图                      │  ← Section 标题
│  [热力图组件，12周 × 7列]         │
│  □ 未上课  ■ 已上课              │  ← 图例
├─────────────────────────────────┤
│  我的徽章                        │  ← Section 标题
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐      │
│  │🌱 │ │👣 │ │🌙 │ │░░░│      │  ← 徽章墙（4列）
│  │已解│ │已解│ │已解│ │未解│      │    已解锁彩色，未解锁灰色
│  └───┘ └───┘ └───┘ └───┘      │
│  ┌───┐ ┌───┐ ...               │
│  ...                            │
├─────────────────────────────────┤
│      [ 生成成就海报 ]             │  ← 主操作按钮
└─────────────────────────────────┘
```

---

### 6.3 热力图组件

**布局**：12列（周） × 7行（周日到周六），每格是一个小方块，颜色深浅表示当天上课次数。

```
     4月  5月        6月        7月
日 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]
一 [ ][ ][■][ ][ ][■][ ][ ][■][ ][ ][ ]
二 [ ][ ][ ][ ][■][ ][ ][ ][ ][ ][■][ ]
三 [ ][ ][■][■][ ][ ][ ][■][ ][ ][ ][ ]
四 [ ][ ][ ][ ][ ][■][ ][ ][ ][ ][ ][ ]
五 [ ][ ][■][ ][■][ ][ ][■][ ][■][ ][ ]
六 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]
```

**颜色方案**（二值，有/无）：

| 状态 | 颜色 | 说明 |
|---|---|---|
| 当天未上课 | `#EBEDF0` | 灰色底 |
| 当天已上课 | `themeColor` 100% | 品牌主色，不区分次数 |

**图例**：`□ 未上课  ■ 已上课`（替换原来的「少□□□□□多」渐变图例）

**交互**：点击某个方块，底部弹出小气泡显示「7月9日 已上课」或「7月9日 未上课」。

**实现**：纯 WXML + WXSS 渲染（`wx:for` 遍历 84 格），不用 Canvas，避免热力图加载闪烁。

---

### 6.4 徽章详情弹窗

点击任意徽章弹出半屏 popup：

```
┌─────────────────────────┐
│         🏅              │  ← 大图标（已解锁彩色/未解锁灰色）
│      习惯养成            │  ← 徽章名
│  连续上课坚持 21 天       │  ← 描述
│                         │
│  ████████░░  12/8 周    │  ← 进度条（未解锁时显示）
│                         │
│  2026-03-15 已解锁       │  ← 已解锁时显示日期
└─────────────────────────┘
```

---

## 七、视觉设计规范

### 7.1 整体风格

**关键词**：禅意、自然、温暖、轻盈。

对标参考：Forest 专注森林、Nike Training Club 成就页。不要游戏化的赛博风格，不要冷峻的数据仪表盘风格。用柔和的插画语言传递「积累感」和「内在成长」。

**色彩系统**：

| 用途 | 色值 | 说明 |
|---|---|---|
| 主色 | `themeColor`（馆主配置） | 默认 `#6fae96` 绿色系 |
| 背景 | `#F7F5F0` | 暖米白，不用纯白 |
| 文字主色 | `#2C2C2C` | 近黑，不用纯黑 |
| 文字次色 | `#888888` | 标签/说明 |
| 未解锁灰 | `#D4D4D4` | 徽章未解锁态 |
| 热力图空 | `#EBEDF0` | 未上课方块 |

**字体**：系统默认 sans-serif，标题 `font-weight: 600`，数字用稍大字号突出。

---

### 7.2 插画规范

插画用于三个位置：页面顶部 banner、徽章图标、成就海报背景。

**风格**：扁平矢量插画（flat illustration），线条圆润，留白充分，色调从品牌主色派生（浅绿 / 浅橙 / 暖米色组合）。禁止写实照片风格。

**页面顶部 banner 插画**：

```
内容：一个正在做瑜伽体式的人形剪影（线条极简，无五官）
      背后是若隐若现的山脉轮廓或莲花形状
      左上角或右上角有稀疏的几何圆点装饰
尺寸：750 × 300 rpx，底部渐变过渡到背景色 #F7F5F0
      人物居右，左侧留给文字数据
```

如无设计资源，退化方案：用品牌主色渐变矩形（`themeColor` → `themeColor` 加深 15%）+ 白色大字，与现有 `admin_home` hero 风格一致。

**徽章图标设计**：

每枚徽章是一个**圆形底板 + 中心插画**的组合，类似勋章/徽章形态：

```
圆形底板：已解锁 = 品牌渐变色（themeColor → 深色）
          未解锁 = #D4D4D4 纯灰
          直径：140 × 140 rpx（列表态）/ 200 × 200 rpx（弹窗放大态）

中心插画：线条白色，描边风格，不填色，尺寸约占圆形 60%
          画面简洁，一眼能识别主题

底部文字：徽章名，14rpx，已解锁白色/未解锁灰色
```

各徽章插画主题：

| 徽章 | 插画内容 | 视觉意象 |
|---|---|---|
| `first_class` 初心者 | 嫩芽破土而出 | 开始、萌发 |
| `classes_10` 十步之遥 | 一双赤足脚印 | 踏出第一步 |
| `classes_30` 月度常客 | 弦月 + 星点 | 一个月的夜晚 |
| `classes_50` 稳定修行 | 莲花半开 | 沉淀、专注 |
| `classes_100` 百课不倦 | 满开莲花 + 光晕 | 丰盛、成就 |
| `classes_200` 瑜伽深耕 | 连绵山脉剪影 | 长期、厚重 |
| `streak_4` 月月不断 | 四片叶子围成圆 | 四周循环 |
| `streak_8` 习惯养成 | 缠绕的藤蔓 | 习惯生根 |
| `streak_12` 季度达人 | 太阳 + 弧线轨迹 | 一季的光 |
| `streak_24` 半年坚守 | 沙漏 | 时间积累 |

**实现方式**：将插画制作为本地 SVG 或 PNG（2x 分辨率），存放在 `miniprogram/images/achievement/` 目录下，文件名与徽章 ID 对应（如 `badge_first_class.png`）。代码中用路径引用，不用 Emoji，确保渲染一致性。

---

### 7.3 成就页视觉细节

**顶部 Hero 区**（高约 300rpx）：

```
背景：插画或品牌渐变
叠加：半透明白色遮罩（rgba(255,255,255,0.08)）
内容：
  左侧：
    「我的成就」（白色，24rpx）
    大数字「86」（白色，72rpx，bold）
    「次上课记录」（白色，24rpx）
  右侧：
    瑜伽人形插画
```

**数据卡片区**（Hero 下方，卡片上浮 -24rpx 遮挡 Hero 底部）：

```
白色圆角卡片，box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.06)
两列两行，四个数据格：
  累计上课 / 连续周数 / 上课天数 / 历史最长
数字：32rpx bold，品牌色
标签：24rpx，#888
```

**徽章墙**：

```
Section 标题左对齐，右侧显示「已获得 N 枚」
四列网格，已解锁徽章彩色饱满，未解锁半透明灰色
角标「NEW」：红色小圆点 + 白色文字，绝对定位在徽章右上角
```

**整体页面背景**：`#F7F5F0` 暖米白，不是纯白。

---

## 八、成就海报

### 8.1 设计规格

- **尺寸**：750 × 1100 px（竖版，适合朋友圈）
- **DPR**：设备像素比自适应（`wx.getWindowInfo().pixelRatio`，与现有 poster helper 一致）
- **实现**：前端 Canvas 绘制，参考 `member_invite_poster_helper.js` 的封装模式，新建 `achievement_poster_helper.js`

### 8.2 视觉布局

```
┌───────────────────────────────┐  ← 750px
│                               │
│  ████████████████████████████ │  ← 品牌色顶栏（高 120px）
│       [馆名]                  │    白色大字，品牌色背景
│  ████████████████████████████ │
│                               │
│   ┌──────────────────────┐   │
│   │     [会员头像]        │   │  ← 圆形头像（直径 120px）
│   │      [昵称]          │   │    居中显示
│   └──────────────────────┘   │
│                               │
│   ── 我的瑜伽成就 ──          │  ← 分隔标题，细线 + 文字
│                               │
│   ┌───────┐   ┌───────┐      │
│   │  86   │   │  12   │      │  ← 核心数据大字（双列）
│   │ 累计上课 │   │ 连续周数 │      │
│   │  次   │   │  周   │      │
│   └───────┘   └───────┘      │
│                               │
│   ┌───────────────────────┐  │
│   │  [热力图：12周 × 7行]  │  │  ← 热力图（Canvas 绘制）
│   │  浅色背景，圆角卡片    │  │    宽约 640px，高约 160px
│   └───────────────────────┘  │
│                               │
│   ── 已获得的徽章 ──          │
│                               │
│   [🌱][👣][🌙][🪷]           │  ← 已解锁徽章横排（最多显示6个）
│   初心者  十步  月度  稳定    │    小图标 + 文字
│                               │
│   ┌───────────────────────┐  │
│   │   [小程序码]           │  │  ← 圆形小程序码（直径 140px）
│   │   扫码加入 [馆名]      │  │    带引导文案
│   └───────────────────────┘  │
│                               │
│  ████████████████████████████ │  ← 底栏（品牌色，高 72px）
│       [馆名] · 瑜伽           │    与现有 invite poster 底栏一致
└───────────────────────────────┘
```

### 8.3 热力图在海报中的绘制

海报中的热力图用 Canvas 直接画：

```js
// achievement_poster_helper.js 中
function _drawHeatmap(ctx, heatmap, startDay, x, y, totalW, totalH) {
  const cols = 12   // 12 周
  const rows = 7    // 7 天
  const gap = 3
  const cellW = (totalW - gap * (cols - 1)) / cols
  const cellH = (totalH - gap * (rows - 1)) / rows

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      // 根据 startDay + col*7 + row 计算日期
      // 查 heatmap[date]：有值（=1）则已上课，无值则未上课
      // 选颜色：已上课=themeColor，未上课=#EBEDF0
      const attended = !!heatmap[date]
      ctx.fillStyle = attended ? themeColor : '#EBEDF0'
      _roundRect(ctx, x + col*(cellW+gap), y + row*(cellH+gap), cellW, cellH, 3)
      ctx.fill()
    }
  }
}
```

### 8.4 徽章在海报中的渲染

Emoji 直接用 Canvas `fillText` 绘制，字号 44px，下方 18px 文字说明。最多展示 6 个已解锁徽章，超出时显示「+N」。

```js
function _drawBadges(ctx, badges, x, y, totalW) {
  const unlocked = badges.filter(b => b.unlocked).slice(0, 6)
  const colW = totalW / unlocked.length
  unlocked.forEach((badge, i) => {
    ctx.font = '44px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(badge.emoji, x + colW * i + colW / 2, y)
    ctx.font = '18px sans-serif'
    ctx.fillStyle = '#888888'
    ctx.fillText(badge.name, x + colW * i + colW / 2, y + 32)
  })
}
```

### 8.5 新建文件

```
miniprogram/helper/achievement_poster_helper.js
```

导出接口与现有 poster helper 保持一致：

```js
module.exports = {
  exportAchievementPoster(component, opts),  // opts: {userInfo, streak, badges, heatmap, tenantName, themeColor, qrUrl}
  saveToAlbum(filePath),                     // 复用 pic_helper
}
```

海报页使用 `<canvas type="2d" id="achievementCanvas" />` 节点，与 `member_invite_poster` 的 `#inviteCanvas` 模式完全一致。

---

## 九、文件清单

### 后端

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `project/model/streak_model.js` | 新建 | ax_checkin_streak 集合模型 |
| `project/service/streak_service.js` | 新建 | `_updateStreak`、`getAchievement`、`buildHeatmap` |
| `project/controller/my_controller.js` | 修改 | 新增 `getAchievement` 方法 |
| `project/service/admin/admin_meet_service.js` | 修改 | `checkinJoin`、`checkinJoinBatch` 末尾调用 `_updateStreak` |
| `project/service/meet_service.js` | 修改 | `userSelfCheckin` 末尾调用 `_updateStreak` |
| `config/route.js` | 修改 | 新增 `'my/achievement': 'my_controller@getAchievement'` |

### 前端

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `pages/default/my/achievement/my_achievement.js` | 新建 | 成就页逻辑 |
| `pages/default/my/achievement/my_achievement.wxml` | 新建 | 成就页布局 |
| `pages/default/my/achievement/my_achievement.wxss` | 新建 | 成就页样式 |
| `pages/default/my/achievement/my_achievement.json` | 新建 | 页面配置 |
| `pages/default/my/index/my_index.wxml` | 修改 | 新增成就入口卡片 |
| `pages/default/my/index/my_index.js` | 修改 | 加载并显示累计次数 |
| `helper/achievement_poster_helper.js` | 新建 | Canvas 海报绘制 |
| `miniprogram/app.json` | 修改 | 注册新页面路径 |
| `miniprogram/images/achievement/badge_*.png` | 新建 | 各徽章插画图标（10 枚，2x 分辨率 PNG） |
| `miniprogram/images/achievement/hero_illustration.png` | 新建 | 页面顶部 Banner 插画 |

---

## 十、改动量评估

| 类别 | 工作量估计 |
|---|---|
| 后端：streak_model + streak_service | 约 150 行 |
| 后端：3处签到方法追加调用 | 各 3-5 行，共 15 行 |
| 后端：my_controller + route | 约 20 行 |
| 前端：成就页（含热力图+徽章墙） | 约 300 行（wxml + js + wxss） |
| 前端：海报 helper | 约 200 行 |
| 前端：my_index 入口改动 | 约 10 行 |
| **总计** | **约 700 行，2-3 天工作量** |

---

## 十一、发布策略

**灰度建议**：首次上线时，历史数据不做批量回算（避免大量 DB 写入）。

- 老会员在下次签到后，系统开始从 0 积累新数据
- 可选：上线后在管理端提供一个「初始化历史打卡数据」按钮，触发一次全量回算（查该馆所有 `JOIN_STATUS=1` 且未取消的记录，按时间顺序重放 `_updateStreak`）

**AB 测试指标**：
- 30天后对比成就页月活用户 vs 未点开成就页用户的：约课频次、续卡率
