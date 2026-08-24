const pageHelper = require("../helper/page_helper.js");
const cloudHelper = require("../helper/cloud_helper.js");
const setting = require("../setting/setting.js");
const { enrichPhotoAlbumList } = require("../helper/photo_album_helper.js");

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

function mapBanner(item) {
  return {
    _id: item._id,
    type: item.type,
    title: item.title,
    pic: pageHelper.fmtCoverUrl(item.pic, item._id),
    video: pageHelper.fmtImgUrl(item.video),
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
    subText: dayLabel + " " + time + (next.checkedIn ? " · 已核销" : ""),
  };
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
  let pics = (item.pics || []).map((p) => pageHelper.fmtImgUrl(p));
  let avatar = pageHelper.fmtImgUrl(item.avatar);
  return {
    _id: item._id,
    name: item.name,
    specialty: item.specialty,
    desc: item.desc,
    avatar,
    pics,
    cover: pageHelper.fmtCoverUrl(item.cover, item._id) || pics[0] || avatar,
  };
}

function mapPhoto(item) {
  return {
    _id: item._id,
    title: item.title,
    desc: item.desc,
    album: item.album || item.desc || "馆舍风采",
    pic: pageHelper.fmtCoverUrl(item.pic, item._id),
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
    openStatus: null,
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

        this.setData({
          phone: data.phone || "",
          studioAddress: data.address || "",
          studioLatitude: data.latitude || 0,
          studioLongitude: data.longitude || 0,
          openStatus: fmtOpenStatus(data.openTime, data.closeTime),
          banners: (data.banners || []).map(mapBanner),
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
        this.setData({
          teachers: (data?.teachers || []).map(mapTeacher),
          photoAlbums,
        });
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
        this.setData({
          memberDashboardLoaded: true,
          nextJoin: mapNextJoin(data?.nextJoin),
          recommendMeets: data?.recommends || [],
          practiceProgress: data?.progress || {
            totalClasses: 0,
            currentStreak: 0,
            badgeCount: 0,
          },
        });
      } catch (err) {
        console.warn("[home/member_dashboard]", err);
        this.setData({ memberDashboardLoaded: true });
      }
    },

    onShow: async function () {
      if (this._skipShowRefresh) {
        this._skipShowRefresh = false;
        return;
      }
      this._applyTenantInfo();
      if (!this.data.isLoad) return;
      await this._fetchHome();
    },

    bindHomeBookingTap: function () {
      wx.switchTab({ url: "/pages/default/calendar/index/calendar_index" });
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
      const first = (this.data.teachers || [])[0];
      if (!first || !first._id) return;
      wx.navigateTo({
        url: "/pages/default/teacher/detail/teacher_detail?id=" + first._id,
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
