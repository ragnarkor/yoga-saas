# 照片墙功能设计文档

> 版本：v1.1  
> 日期：2026-07-10

---

## 一、定位

照片墙是馆的门面，服务两个场景：新用户初次进入建立信任感、会员带朋友来时的第一印象。内容是静态的空间和课堂照片，不需要动态更新。

---

## 二、现状

`ax_photo` 集合、管理端 CRUD、`home/index` 返回 `photoAlbums` 均已实现。

缺的：
- `PHOTO_DESC` 兼任专辑名，语义不清
- 没有独立的照片墙页面，只有首页横向滑条

---

## 三、数据模型

`ax_photo` 新增一个字段：

```js
PHOTO_ALBUM: 'string|false|comment=相册名'
```

旧数据 `PHOTO_ALBUM` 为空时，降级取 `PHOTO_DESC` 作为相册名（与现有 `_buildPhotoAlbums` 兼容，无需回写旧数据）。

---

## 四、后端改动

| 文件 | 改动 |
|---|---|
| `model/photo_model.js` | 新增 `PHOTO_ALBUM` 字段定义 |
| `service/home_service.js` | `_buildPhotoAlbums` 优先取 `PHOTO_ALBUM`，兜底取 `PHOTO_DESC` |
| `controller/home_controller.js` | 新增 `getPhotoAlbumList` 方法（供详情页单独拉取，不走首页缓存） |
| `controller/admin/admin_home_controller.js` | `insertPhoto / editPhoto` 增加 `album` 字段接收 |
| `config/route.js` | 新增 `'home/photo_album_list': 'home_controller@getPhotoAlbumList'` |

---

## 五、管理端改动

上传/编辑图片表单增加一个「相册」输入项（支持下拉选已有相册名或手动输入新名称），其余不动。

---

## 六、会员端

### 首页入口

照片墙区块改为入口卡，取第一张图作封面，点击跳转详情页：

```
┌──────────────────────────────────┐
│  [封面图]    照片墙              │
│              N 个相册            │  → 点击跳转
└──────────────────────────────────┘
```

图片少于 4 张时退化为原有横向滑动，不显示入口卡。

### 照片墙详情页（新建）

**路径**：`pages/default/photo/photo_wall`

```
┌─────────────────────────────────────┐
│  照片墙                              │  ← 导航栏
├─────────────────────────────────────┤
│  [全部] [馆舍风采] [教练团队] ...    │  ← 相册 Tab，scroll-view 横向
├─────────────────────────────────────┤
│  ┌──────┐ ┌──────┐                  │
│  │      │ │      │                  │  ← 两列等宽网格
│  └──────┘ └──────┘                  │
│  ┌──────┐ ┌──────┐                  │
│  │      │ │      │                  │
│  └──────┘ └──────┘                  │
└─────────────────────────────────────┘
```

- Tab 切换过滤图片，数据一次性拉取，无需分页
- 点击图片调 `wx.previewImage`，`urls` 传当前相册全部图片

---

## 七、文件清单

### 后端（5 处）

```
model/photo_model.js                        修改
service/home_service.js                     修改
controller/home_controller.js               修改
controller/admin/admin_home_controller.js   修改
config/route.js                             修改
```

### 前端（5 处）

```
pages/default/photo/photo_wall.js           新建
pages/default/photo/photo_wall.wxml         新建
pages/default/photo/photo_wall.wxss         新建
pages/default/photo/photo_wall.json         新建
tpls/project/default_index_tpl.wxml         修改（首页入口卡）
miniprogram/app.json                        修改（注册新页面）
```

管理端上传/编辑页增加「相册」输入项（已有页面小改）。

---

## 八、改动量

约 150 行，1 天内完成。
