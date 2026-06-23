const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');

module.exports = Behavior({
  data: {
    isLoad: false,
    teacher: null,
    categories: [],
    sessions: [],
    displaySessions: [],
    activeTab: 0,
  },

  methods: {
    onLoad: async function (options) {
      if (!options.id) return;
      this._teacherId = options.id;
    },

    onShow: async function () {
      if (!this._teacherId) return;
      await this._loadHome();
    },

    onPullDownRefresh: async function () {
      await this._loadHome();
      wx.stopPullDownRefresh();
    },

    async _loadHome(typeId) {
      try {
        const params = { id: this._teacherId };
        if (typeId) params.typeId = typeId;

        const res = await cloudHelper.callCloudSumbit(
          'home/teacher_home',
          params,
          { title: 'bar' },
        );
        const data = (res && res.data) || {};
        let teacher = data.teacher || null;

        if (teacher) {
          teacher.avatar = pageHelper.fmtCoverUrl(teacher.avatar, teacher._id || this._teacherId);
          teacher.pics = (teacher.pics || []).map((p) =>
            pageHelper.fmtImgUrl(p),
          );
          if (!teacher.desc) {
            teacher.desc = '暂无老师简介';
          }
        }

        const categories = data.categories || [{ id: '0', name: '全部课程' }];
        const sessions = (data.sessions || []).map((item) => ({
          ...item,
          sessionKey: `${item.meetId}_${item.timeMark}`,
          pic: pageHelper.fmtCoverUrl(item.pic, item.meetId || item.timeMark),
        }));

        wx.setNavigationBarTitle({
          title: teacher ? teacher.name : '老师主页',
        });
        wx.setNavigationBarColor({
          backgroundColor: pageHelper.getThemeColor(),
          frontColor: '#ffffff',
        });

        this.setData(
          {
            teacher,
            categories,
            sessions,
            isLoad: true,
          },
          () => {
            this._applySessionFilter();
          },
        );
      } catch (err) {
        console.error(err);
        this.setData({ teacher: null, isLoad: true, sessions: [], displaySessions: [] });
      }
    },

    _applySessionFilter: function () {
      const { sessions, categories, activeTab } = this.data;
      const tab = categories[activeTab] || { id: '0' };
      const typeId = tab.id;

      let displaySessions = sessions;
      if (typeId && typeId !== '0') {
        displaySessions = sessions.filter(
          (s) => String(s.typeId) === String(typeId),
        );
      }

      this.setData({ displaySessions });
    },

    bindCategoryTap: function (e) {
      const index = Number(e.currentTarget.dataset.index) || 0;
      if (index === this.data.activeTab) return;
      this.setData({ activeTab: index }, () => {
        this._applySessionFilter();
      });
    },

    bindBookTap: function (e) {
      const { meetId, day, mark, status } = e.currentTarget.dataset;
      if (!meetId || !day || !mark) return;
      if (status === 'full') {
        wx.showToast({ title: '该时段已满员', icon: 'none' });
        return;
      }
      wx.navigateTo({
        url: `/pages/default/meet/detail/meet_detail?id=${meetId}&day=${day}&timeMark=${mark}`,
      });
    },

    bindPreviewPic: function (e) {
      const url = e.currentTarget.dataset.url;
      const urls = (this.data.teacher && this.data.teacher.pics) || [];
      if (urls.length) wx.previewImage({ current: url, urls });
    },

    bindPrivateBookTap: function () {
      const teacher = this.data.teacher;
      if (!teacher || !teacher._id) return;
      wx.navigateTo({
        url:
          '/pages/default/private/book/private_book?teacherId=' +
          encodeURIComponent(teacher._id),
      });
    },
  },
});
