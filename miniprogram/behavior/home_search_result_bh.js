const SearchBiz = require('../biz/search_biz.js');
const cloudHelper = require('../helper/cloud_helper.js');
const pageHelper = require('../helper/page_helper.js');

module.exports = Behavior({
  data: {
    keyword: '',
    isLoad: false,
    meetList: [],
    newsList: [],
    teacherList: [],
  },

  methods: {
    onLoad: async function (options) {
      let keyword = (options.keyword || '').trim();
      this.setData({ keyword });
      if (keyword) await this._search(keyword);
      else this.setData({ isLoad: true });
    },

    _search: async function (keyword) {
      try {
        let res = await cloudHelper.callCloudSumbit(
          'home/search',
          { keyword },
          { title: 'bar' },
        );
        let data = (res && res.data) ? res.data : {};
        let meetList = (data.meetList || []).map((item) => ({
          ...item,
          pic: pageHelper.fmtImgUrl(item.pic),
        }));
        let newsList = (data.newsList || []).map((item) => ({
          ...item,
          pic: pageHelper.fmtImgUrl(item.pic),
        }));
        let teacherList = (data.teacherList || []).map((item) => ({
          ...item,
          pic: pageHelper.fmtImgUrl(item.pic),
        }));
        this.setData({ meetList, newsList, teacherList, isLoad: true });
      } catch (err) {
        console.error(err);
        this.setData({ meetList: [], newsList: [], teacherList: [], isLoad: true });
      }
    },

    bindItemTap: function (e) {
      let type = e.currentTarget.dataset.type;
      let id = e.currentTarget.dataset.id;
      let url = '';
      if (type === 'meet') url = '/pages/default/meet/detail/meet_detail?id=' + id;
      else if (type === 'news') url = '/pages/default/news/detail/news_detail?id=' + id;
      else if (type === 'teacher') url = '/pages/default/teacher/detail/teacher_detail?id=' + id;
      if (url) wx.navigateTo({ url: pageHelper.fmtURLByPID(url) });
    },

    url: function (e) {
      pageHelper.url(e, this);
    },
  },
});
