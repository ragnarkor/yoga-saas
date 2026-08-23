const cloudHelper = require("../../../../helper/cloud_helper.js");
const pageHelper = require("../../../../helper/page_helper.js");
const themeHelper = require("../../../../helper/theme_helper.js");

const PAGE_SIZE = 10;

// 发布 7 天内的公告展示 NEW 徽标
const NEW_BADGE_WINDOW = 7 * 24 * 60 * 60 * 1000;

/**
 * 相对发布时间：与首页公告跑马灯（behavior/default_index_bh.js）保持同一套文案，
 * 避免两个入口展示的时间口径不一致。
 */
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

function mapAnnouncement(item) {
  const publishTime = Number(item.publishTime || 0);
  return {
    ...item,
    publishAgo: formatPublishAgo(publishTime),
    isNew: publishTime > 0 && Date.now() - publishTime <= NEW_BADGE_WINDOW,
  };
}

Page({
  data: {
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
    list: [],
    loading: true, // 首屏骨架
    loadingMore: false, // 触底追加中
    page: 1, // 当前页
    count: 0, // 总页数
    total: 0, // 总条数
  },

  onLoad() {
    this._loadList();
  },

  onPullDownRefresh() {
    this._loadList().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this._loadMore();
  },

  async _fetchPage(page, isTotal, oldTotal) {
    const res = await cloudHelper.callCloudSumbit(
      "home/announce_list",
      { page, size: PAGE_SIZE, isTotal, oldTotal },
      { hint: false, title: "bar" },
    );
    return (res && res.data) || null;
  },

  /** 首屏 / 下拉刷新：重置到第一页 */
  async _loadList() {
    this.setData({ loading: true });
    try {
      const data = await this._fetchPage(1, true, 0);
      this.setData({
        list: ((data && data.list) || []).map(mapAnnouncement),
        page: (data && data.page) || 1,
        count: (data && data.count) || 0,
        total: (data && data.total) || 0,
        loading: false,
      });
    } catch (err) {
      console.error(err);
      this.setData({ list: [], loading: false });
    }
  },

  /** 触底加载下一页：追加数据，非首页跳过 count 统计 */
  async _loadMore() {
    if (this.data.loading || this.data.loadingMore) return;
    if (!this.data.count || this.data.page >= this.data.count) return;

    this.setData({ loadingMore: true });
    const nextPage = this.data.page + 1;
    try {
      const data = await this._fetchPage(nextPage, false, this.data.total);
      this.setData({
        list: this.data.list.concat(
          ((data && data.list) || []).map(mapAnnouncement),
        ),
        page: nextPage,
        loadingMore: false,
      });
    } catch (err) {
      console.error(err);
      this.setData({ loadingMore: false });
    }
  },

  bindItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url:
        "/pages/default/announcement/detail/announcement_detail?id=" + id,
    });
  },

  // 空状态引导：回首页（首页为 tabBar 页，需用 switchTab）
  bindBackHome() {
    wx.switchTab({ url: "/pages/default/index/default_index" });
  },

  url(e) {
    pageHelper.url(e, this);
  },
});
