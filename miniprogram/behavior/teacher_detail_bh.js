const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');

module.exports = Behavior({
  data: {
    isLoad: false,
    teacher: null,
  },

  methods: {
    onLoad: async function (options) {
      if (!options.id) return;
      this._teacherId = options.id;
    },

    onShow: async function () {
      if (!this._teacherId) return;
      try {
        let res = await cloudHelper.callCloudSumbit(
          'home/teacher_detail',
          { id: this._teacherId },
          { title: 'bar' },
        );
        let teacher = (res && res.data) ? res.data : null;
        if (teacher) {
          teacher.avatar = pageHelper.fmtImgUrl(teacher.avatar);
          teacher.pics = (teacher.pics || []).map((p) => pageHelper.fmtImgUrl(p));
        }
        this.setData({ teacher, isLoad: true });
      } catch (err) {
        console.error(err);
        this.setData({ teacher: null, isLoad: true });
      }
    },

    bindPreviewPic: function (e) {
      let url = e.currentTarget.dataset.url;
      let urls = (this.data.teacher && this.data.teacher.pics) || [];
      if (urls.length) wx.previewImage({ current: url, urls });
    },

    url: async function (e) {
      pageHelper.url(e, this);
    },
  },
});
