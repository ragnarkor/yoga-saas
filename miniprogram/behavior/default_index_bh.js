const pageHelper = require("../helper/page_helper.js");
const cloudHelper = require("../helper/cloud_helper.js");
const setting = require("../setting/setting.js");
const {
  enrichPhotoAlbumList,
  isPlaceholderPic,
} = require("../helper/photo_album_helper.js");

/** 首页顶部横幅无图时的默认插画（?v 破除本地资源缓存） */
const DEFAULT_EDITORIAL_COVER =
  "/pages/default/skin/images/default_index_bg.jpg?v=2";

function buildLinkUrl(linkType, linkId) {
  switch (linkType) {
    case "about":
      return "/pages/default/about/index/about_index";
    case "news":
      return linkId
        ? "/pages/default/news/detail/news_detail?id=" + linkId
        : "";
    case "meet":
      return linkId
        ? "/pages/default/meet/detail/meet_detail?id=" + linkId
        : "";
    case "announce":
      return linkId
        ? "/pages/default/announcement/detail/announcement_detail?id=" + linkId
        : "";
    default:
      return "";
  }
}

/**
 * 媒体图清洗：路径规范化但剔除占位插画（空/占位 → ""）。
 * 注意 fmtImgUrl 对历史占位路径会随机注入 /images/default_cover_N.jpg，
 * 相册照片、横幅、老师图等场景必须走本函数，避免占位插画混入数据。
 */
function fmtMediaUrl(url) {
  const formatted = pageHelper.fmtImgUrl(url);
  return isPlaceholderPic(formatted) ? "" : formatted;
}

function mapBanner(item) {
  return {
    _id: item._id,
    type: item.type,
    title: item.title,
    pic: fmtMediaUrl(item.pic),
    video: fmtMediaUrl(item.video),
    linkType: item.linkType,
    linkId: item.linkId,
    linkUrl: buildLinkUrl(item.linkType, item.linkId),
  };
}

function formatPublishAgo(timestamp) {
  const publishTime = Number(timestamp || 0);
  const diff = Date.now() - publishTime;
  if (!publishTime || diff < 0) return "";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;

  // 过了一周后继续显示“X 天前”没有辨识度，直接给出发布日期。
  const date = new Date(publishTime);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function fmtNextJoinDay(day) {
  if (!day) return "";
  const target = new Date(String(day).replace(/-/g, "/"));
  if (isNaN(target.getTime())) return String(day).slice(5);
  const now = new Date();
  const diff = Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()) -
      new Date(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000,
  );
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return (
    "周" +
    weekdays[target.getDay()] +
    " " +
    (target.getMonth() + 1) +
    "." +
    target.getDate()
  );
}

function mapNextJoin(next) {
  if (!next) return null;
  const dayLabel = fmtNextJoinDay(next.day);
  const time = next.timeStart + "–" + next.timeEnd;
  return {
    ...next,
    subText: dayLabel + " " + time,
  };
}

function fmtDurationMinutes(start, end) {
  const toMin = (t) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const s = toMin(start);
  const e = toMin(end);
  if (s === null || e === null || e <= s) return 0;
  return e - s;
}

function mapRecommend(item) {
  if (!item) return item;
  // 同一门课的多个时段共享 meetId，seed 混入日期+时段保证占位封面互不相同。
  const coverSeed =
    (item.meetId || item.title || "home-rec") +
    "-" +
    (item.day || "") +
    "-" +
    (item.timeStart || "");
  const cover = pageHelper.fmtCoverUrl(item.cover || "", coverSeed);
  if (item.type === "private") {
    return {
      ...item,
      cover,
      smallText: "私教体验",
      spanText: item.subText || "",
    };
  }
  const dur = fmtDurationMinutes(item.timeStart, item.timeEnd);
  const spanText =
    (item.coachName ? item.coachName + "教练 · " : "") +
    (dur ? dur + " 分钟" : "");
  return { ...item, cover, smallText: item.subText || "", spanText };
}

function fmtOpenStatus(openTime, closeTime) {
  if (!openTime || !closeTime) return null;
  const parseMinutes = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const open = parseMinutes(openTime);
  const close = parseMinutes(closeTime);
  if (open === null || close === null || open === close) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const isOpen =
    open < close ? cur >= open && cur < close : cur >= open || cur < close;
  return {
    open: isOpen,
    label: isOpen ? "营业中" : "已打烊",
    timeText: openTime + "-" + closeTime,
  };
}

function mapTeacher(item) {
  let pics = (item.pics || [])
    .map((p) => fmtMediaUrl(p))
    .filter(Boolean);
  let avatar = fmtMediaUrl(item.avatar);
  return {
    _id: item._id,
    name: item.name,
    specialty: item.specialty,
    desc: item.desc,
    avatar,
    pics,
    cover: fmtMediaUrl(item.cover) || pics[0] || avatar,
  };
}

function mapPhoto(item) {
  return {
    _id: item._id,
    title: item.title,
    desc: item.desc,
    album: item.album || item.desc || "馆舍风采",
    pic: fmtMediaUrl(item.pic),
    linkType: item.linkType,
    linkId: item.linkId,
    linkUrl: buildLinkUrl(item.linkType, item.linkId),
  };
}

function buildPhotoAlbums(photos) {
  if (!photos || !photos.length) return [];
  let map = {};
  let idx = 0;
  for (let item of photos) {
    let key = item.album || "馆舍风采";
    if (!map[key]) {
      map[key] = { id: String(idx++), title: key, photos: [] };
    }
    map[key].photos.push(item);
  }
  return Object.values(map);
}

module.exports = Behavior({
  data: {
    isLoad: false,
    phone: "",
    tenantName: "",
    tenantDesc: "",
    banners: [],
    announcements: [],
    teachers: [],
    photoAlbums: [],
    memberDashboardLoaded: false,
    nextJoin: null,
    recommendMeets: [],
    practiceProgress: { totalClasses: 0, currentStreak: 0, badgeCount: 0 },
    homeRingDeg: 0,
    openStatus: null,
    editorialTitle: "选择下一次练习",
    editorialCover: DEFAULT_EDITORIAL_COVER,
    editorialLink: "",
    teacherCurrent: 0,
    photoAlbumsTop: [],
  },

  methods: {
    _applyTenantInfo: function () {
      const tenant = pageHelper.getTenantInfo();
      this.setData({
        tenantName:
          tenant?.TENANT_NAME || pageHelper.getTenantName() || "瑜伽馆",
        tenantDesc: tenant?.TENANT_DESC || "",
      });
    },

    onLoad: async function () {
      if (setting.IS_SUB) wx.hideHomeButton();
      this._skipShowRefresh = true;
      this._applyTenantInfo();
      this.setData({ isLoad: true });
      await this._fetchHome();
    },

    _fetchHome: async function () {
      this._stopAlbumRotation();
      if (!setting.PID && !pageHelper.getPID()) {
        wx.reLaunch({ url: "/pages/tenant/select/tenant_select" });
        return;
      }

      // 会员初始化与首页公开内容无依赖关系，不阻塞首页数据请求。
      const ensureMemberTask = cloudHelper
        .callCloudSumbit("passport/ensure_member", {}, { hint: false })
        .catch((err) => console.warn("[home/ensure_member]", err));

      try {
        let data = await cloudHelper.callCloudData(
          "home/index",
          {},
          { hint: false, title: "bar" },
        );
        if (!data) return;

        const banners = (data.banners || []).map(mapBanner);
        this.setData({
          phone: data.phone || "",
          studioAddress: data.address || "",
          studioLatitude: data.latitude || 0,
          studioLongitude: data.longitude || 0,
          openStatus: fmtOpenStatus(data.openTime, data.closeTime),
          editorialCover:
            banners.length && banners[0].pic
              ? banners[0].pic
              : DEFAULT_EDITORIAL_COVER,
          editorialLink: banners.length ? banners[0].linkUrl : "",
          banners,
          announcements: (data.announcements || []).map((item) => ({
            ...item,
            publishAgo: formatPublishAgo(item.publishTime),
          })),
          teachers: [],
          photoAlbums: [],
        });
        // 个人区域晚于公共首屏加载，避免会员初始化或预约数据拖慢横幅展示。
        ensureMemberTask
          .then(() => this._fetchMemberDashboard())
          .catch(() => this.setData({ memberDashboardLoaded: true }));
        setTimeout(() => this._fetchHomeDiscovery(), 180);
      } catch (err) {
        console.error("[home/index]", err);
      }
    },

    _fetchHomeDiscovery: async function () {
      try {
        const data = await cloudHelper.callCloudData(
          "home/discovery",
          {},
          {
            hint: false,
          },
        );
        const photos = (data?.photos || []).map(mapPhoto);
        const photoAlbums = enrichPhotoAlbumList(
          data?.photoAlbums || buildPhotoAlbums(photos),
        );
        const teachers = (data?.teachers || []).map(mapTeacher);
        const photoAlbumsTop = photoAlbums
          .filter((album) => (album.thumbs || []).length > 0)
          .slice(0, 2)
          .map((album) => {
            const thumbs = Array.from(new Set(album.thumbs || [])).filter(
              (pic) => pic && !isPlaceholderPic(pic),
            );
            return {
              ...album,
              thumbs,
              bufA: thumbs[0] || "",
              // 第二层等到第一次轮播时再加载，避免首页同时请求两倍相册图片。
              bufB: "",
              front: "a",
              ready: false,
              readyA: false,
              readyB: false,
              rotateIndex: 0,
            };
          });
        this.setData({
          teachers,
          teacherCurrent: 0,
          photoAlbums,
          photoAlbumsTop,
        });
        this._startAlbumRotation();
      } catch (err) {
        console.warn("[home/discovery]", err);
      }
    },

    _fetchMemberDashboard: async function () {
      try {
        const data = await cloudHelper.callCloudData(
          "home/member_dashboard",
          {},
          { hint: false },
        );
        const progress = data?.progress || {};
        const nextAchievement = progress.nextAchievement || null;
        this.setData({
          memberDashboardLoaded: true,
          nextJoin: mapNextJoin(data?.nextJoin),
          editorialTitle: data?.nextJoin ? "慢慢来，也很好" : "选择下一次练习",
          recommendMeets: (data?.recommends || []).map(mapRecommend),
          practiceProgress: data?.progress || {
            totalClasses: 0,
            currentStreak: 0,
            badgeCount: 0,
          },
          homeRingDeg: nextAchievement
            ? Math.min(
                360,
                Math.round((Number(nextAchievement.progressPercent) || 0) * 3.6),
              )
            : (Number(progress.badgeCount) || 0) > 0
              ? 360
              : 0,
        });
      } catch (err) {
        console.warn("[home/member_dashboard]", err);
        this.setData({ memberDashboardLoaded: true });
      }
    },

    onShow: async function () {
      this._startAlbumRotation();
      if (this._skipShowRefresh) {
        this._skipShowRefresh = false;
        return;
      }
      this._applyTenantInfo();
      if (!this.data.isLoad) return;
      await this._fetchHome();
    },

    onHide: function () {
      this._stopAlbumRotation();
    },

    onUnload: function () {
      this._stopAlbumRotation();
    },

    bindHomeBookingTap: function () {
      wx.switchTab({ url: "/pages/default/calendar/index/calendar_index" });
    },

    bindGoCourseTap: function () {
      wx.switchTab({ url: "/pages/default/news/cate1/news_cate1" });
    },

    bindTeacherSwiperChange: function (e) {
      const current = e.detail && e.detail.current;
      if (current === undefined || current === this.data.teacherCurrent) return;
      this.setData({ teacherCurrent: current });
    },

    /**
     * 相册封面轮播：一次只切换一个相册，先预载到不可见层，再做长交叠淡化。
     * 这样既不会因远程图片未加载而闪出底部占位背景，也不会让两张卡同时跳动。
     */
    _startAlbumRotation: function () {
      this._stopAlbumRotation();
      const albums = this.data.photoAlbumsTop || [];
      if (!albums.some((album) => (album.thumbs || []).length > 1)) return;
      this._albumRotationCursor = 0;
      // 首次进入首页后尽快给出一次可感知的切换，后续保持舒缓节奏。
      this._albumInitialRotateTimer = setTimeout(
        () => this._rotateNextAlbumCover(),
        2400,
      );
      this._albumRotateTimer = setInterval(
        () => this._rotateNextAlbumCover(),
        6800,
      );
    },

    _rotateNextAlbumCover: function () {
      if (this._albumRotationBusy) return;
      const albums = this.data.photoAlbumsTop || [];
      const candidates = [];
      albums.forEach((album, index) => {
        const valid = Array.from(new Set(album.thumbs || [])).filter(
          (pic) => pic && !isPlaceholderPic(pic),
        );
        if (valid.length > 1) candidates.push(index);
      });
      if (!candidates.length) return;

      const candidateCursor = this._albumRotationCursor || 0;
      const albumIndex = candidates[candidateCursor % candidates.length];
      this._albumRotationCursor = candidateCursor + 1;

      const album = albums[albumIndex];
      const pool = Array.from(new Set(album.thumbs || [])).filter(
        (pic) => pic && !isPlaceholderPic(pic),
      );
      const showing = album.front === "b" ? album.bufB : album.bufA;
      const currentIndex = Math.max(0, pool.indexOf(showing));
      const nextIndex = (currentIndex + 1) % pool.length;
      const pick = pool[nextIndex];
      if (!pick || pick === showing) return;

      const nextFront = album.front === "b" ? "a" : "b";
      const bufferKey =
        "photoAlbumsTop[" +
        albumIndex +
        "].buf" +
        (nextFront === "a" ? "A" : "B");
      const frontKey = "photoAlbumsTop[" + albumIndex + "].front";
      const rotateIndexKey =
        "photoAlbumsTop[" + albumIndex + "].rotateIndex";
      const rotationToken = this._albumRotationToken;
      this._albumRotationBusy = true;
      const pending = {
        albumIndex,
        pic: pick,
        nextFront,
        nextIndex,
        frontKey,
        rotateIndexKey,
        token: rotationToken,
      };
      this._albumPendingRotation = pending;

      const bufferedPic = nextFront === "a" ? album.bufA : album.bufB;
      if (bufferedPic === pick) {
        // 两张照片来回切换时隐藏层已经加载完成，无需等待新的 load 事件。
        setTimeout(() => this._commitAlbumRotation(pending), 100);
        return;
      }

      // 只更新不可见层；真正翻面由该 image 的 bindload 回调触发。
      this.setData({ [bufferKey]: pick });
      this._albumLoadTimeout = setTimeout(() => {
        if (this._albumPendingRotation !== pending) return;
        this._albumPendingRotation = null;
        this._albumRotationBusy = false;
      }, 4500);
    },

    _commitAlbumRotation: function (pending) {
      if (
        !pending ||
        this._albumPendingRotation !== pending ||
        pending.token !== this._albumRotationToken
      ) {
        return;
      }
      if (this._albumLoadTimeout) {
        clearTimeout(this._albumLoadTimeout);
        this._albumLoadTimeout = null;
      }
      this.setData({
        [pending.frontKey]: pending.nextFront,
        [pending.rotateIndexKey]: pending.nextIndex,
      });
      this._albumPendingRotation = null;
      this._albumRotationBusy = false;
    },

    bindAlbumImageLoad: function (e) {
      const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
      const albumIndex = Number(dataset.albumIndex);
      const layer = dataset.layer;
      const albums = this.data.photoAlbumsTop || [];
      const album = albums[albumIndex];
      if (!album || (layer !== "a" && layer !== "b")) return;

      const loadedPic = layer === "a" ? album.bufA : album.bufB;
      if (!dataset.pic || dataset.pic !== loadedPic) return;
      const loadedKey =
        "photoAlbumsTop[" +
        albumIndex +
        "].ready" +
        layer.toUpperCase();
      const readyPatch = { [loadedKey]: true };
      if (album.front === layer && !album.ready) {
        readyPatch["photoAlbumsTop[" + albumIndex + "].ready"] = true;
      }
      this.setData(readyPatch);

      const pending = this._albumPendingRotation;
      if (
        !pending ||
        albumIndex !== pending.albumIndex ||
        layer !== pending.nextFront ||
        dataset.pic !== pending.pic
      ) {
        return;
      }
      this._commitAlbumRotation(pending);
    },

    /** 图片地址失效时从首页轮播池剔除；仍保留原始相册数据供管理端排查。 */
    _removeBrokenAlbumPic: function (albumIndex, brokenPic) {
      const albums = (this.data.photoAlbumsTop || []).map((album) => ({
        ...album,
        thumbs: (album.thumbs || []).slice(),
      }));
      const album = albums[albumIndex];
      if (!album) return;
      album.thumbs = album.thumbs.filter((pic) => pic !== brokenPic);
      if (!album.thumbs.length) {
        albums.splice(albumIndex, 1);
      } else {
        if (album.bufA === brokenPic) {
          album.bufA = album.thumbs[0];
          album.readyA = false;
          if (album.front === "a") album.ready = false;
        }
        if (album.bufB === brokenPic) {
          album.bufB = album.thumbs[1] || album.thumbs[0];
          album.readyB = false;
          if (album.front === "b") album.ready = false;
        }
      }
      this.setData({ photoAlbumsTop: albums });
    },

    _stopAlbumRotation: function () {
      this._albumRotationToken = (this._albumRotationToken || 0) + 1;
      this._albumRotationBusy = false;
      this._albumPendingRotation = null;
      if (this._albumInitialRotateTimer) {
        clearTimeout(this._albumInitialRotateTimer);
        this._albumInitialRotateTimer = null;
      }
      if (this._albumLoadTimeout) {
        clearTimeout(this._albumLoadTimeout);
        this._albumLoadTimeout = null;
      }
      if (this._albumRotateTimer) {
        clearInterval(this._albumRotateTimer);
        this._albumRotateTimer = null;
      }
    },

    bindAlbumImageError: function (e) {
      const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
      const albumIndex = Number(dataset.albumIndex);
      if (!Number.isInteger(albumIndex) || !dataset.pic) return;
      const pending = this._albumPendingRotation;
      if (
        pending &&
        pending.albumIndex === albumIndex &&
        pending.pic === dataset.pic
      ) {
        this._albumPendingRotation = null;
        this._albumRotationBusy = false;
        if (this._albumLoadTimeout) {
          clearTimeout(this._albumLoadTimeout);
          this._albumLoadTimeout = null;
        }
      }
      this._removeBrokenAlbumPic(albumIndex, dataset.pic);
    },

    bindNextJoinTap: function (e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({
        url: "/pages/default/my/join_detail/my_join_detail?id=" + id,
      });
    },

    bindRecommendTap: function (e) {
      const type = e.currentTarget.dataset.type;
      if (type === "private") {
        wx.navigateTo({ url: "/pages/default/private/book/private_book" });
        return;
      }
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({
        url: "/pages/default/meet/detail/meet_detail?id=" + id,
      });
    },

    bindAchievementTap: function () {
      wx.navigateTo({
        url: "/pages/default/my/achievement/my_achievement",
      });
    },

    bindPrivateBookingTap: function () {
      wx.navigateTo({ url: "/pages/default/private/book/private_book" });
    },

    onPullDownRefresh: async function () {
      await this._fetchHome();
      wx.stopPullDownRefresh();
    },

    bindPhoneTap: function () {
      let phone = this.data.phone;
      if (!phone) {
        pageHelper.showNoneToast("暂未配置联系电话");
        return;
      }
      wx.makePhoneCall({ phoneNumber: phone });
    },

    bindStudioLocationTap: function () {
      let lat = Number(this.data.studioLatitude);
      let lng = Number(this.data.studioLongitude);
      if (!lat || !lng) {
        pageHelper.showNoneToast("门店暂未设置位置");
        return;
      }
      wx.openLocation({
        latitude: lat,
        longitude: lng,
        name: this.data.tenantName || "瑜伽馆",
        address: this.data.studioAddress || "",
        scale: 16,
      });
    },

    bindBannerTap: function (e) {
      let url = e.currentTarget.dataset.url;
      if (!url) return;
      wx.navigateTo({ url: pageHelper.fmtURLByPID(url) });
    },

    bindAnnounceTap: function (e) {
      let id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({
        url: "/pages/default/announcement/detail/announcement_detail?id=" + id,
      });
    },

    bindTeacherTap: function (e) {
      let id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({
        url: "/pages/default/teacher/detail/teacher_detail?id=" + id,
      });
    },

    bindTeacherMoreTap: function () {
      const teachers = this.data.teachers || [];
      const target = teachers[this.data.teacherCurrent || 0] || teachers[0];
      if (!target || !target._id) return;
      wx.navigateTo({
        url: "/pages/default/teacher/detail/teacher_detail?id=" + target._id,
      });
    },

    bindHomeAlbumTap: function (e) {
      const index = e.currentTarget.dataset.index;
      const album = this.data.photoAlbums[index];
      if (!album) return;
      wx.navigateTo({
        url:
          "/pages/default/photo/photo_wall?album=" +
          encodeURIComponent(album.title),
      });
    },

    bindPhotoWallTap: function () {
      wx.navigateTo({ url: "/pages/default/photo/photo_wall" });
    },

    onShareAppMessage: function () {},
  },
});
