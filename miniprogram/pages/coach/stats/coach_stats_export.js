const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const timeHelper = require('../../../helper/time_helper.js');
const fileHelper = require('../../../helper/file_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '预约名单导出',
    loading: true,
    isLoad: false,
    courseList: [],
    meetId: '',
    meetTitle: '',
    courseSheetShow: false,
    startDay: timeHelper.time('Y-M-D'),
    endDay: timeHelper.time('Y-M-D'),
    status: 1,
    url: '',
    time: '',
    endYear: new Date().getFullYear() + 1,
  },

  onLoad() {
    this._applyCoachTheme();
  },

  onShow() {
    this._loadCoachData();
  },

  onPullDownRefresh() {
    this._loadDetail(1).finally(() => wx.stopPullDownRefresh());
  },

  async _loadCoachData() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    await this._loadCourses();
    await this._loadDetail(1);
  },

  async _loadCourses() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/meet_list',
        { page: 1, size: 200 },
        { hint: false, title: 'bar' },
      );
      const list = (res && res.list) || [];
      let meetId = this.data.meetId;
      let meetTitle = this.data.meetTitle;
      if (!meetId && list.length) {
        meetId = list[0]._id;
        meetTitle = list[0].MEET_TITLE || '';
      } else if (meetId) {
        const hit = list.find((it) => it._id === meetId);
        meetTitle = (hit && hit.MEET_TITLE) || meetTitle;
      }
      this.setData({
        loading: false,
        courseList: list,
        meetId,
        meetTitle,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, courseList: [] });
    }
  },

  async _loadDetail(isDel) {
    if (!this.data.meetId) {
      this.setData({ isLoad: true, url: '', time: '' });
      return;
    }
    try {
      const data = await cloudHelper.callCloudData(
        'admin/join_data_get',
        { isDel },
        { title: 'bar' },
      );
      if (!data) return;
      this.setData({
        isLoad: true,
        url: data.url,
        time: data.time,
      });
    } catch (e) {
      console.error(e);
      this.setData({ isLoad: true });
    }
  },

  bindCourseTap() {
    if (!this.data.courseList.length) {
      pageHelper.showNoneToast('暂无课程，请先在课程管理中创建');
      return;
    }
    this.setData({ courseSheetShow: true });
  },

  bindCloseCourseSheet() {
    this.setData({ courseSheetShow: false });
  },

  bindPickCourse(e) {
    const { id, title } = e.currentTarget.dataset;
    this.setData({
      courseSheetShow: false,
      meetId: id,
      meetTitle: title,
      url: '',
      time: '',
    });
    this._loadDetail(1);
  },

  bindOpenTap() {
    fileHelper.openDoc('预约名单', this.data.url);
  },

  url(e) {
    pageHelper.url(e, this);
  },

  async bindExportTap() {
    if (!this.data.meetId) {
      pageHelper.showNoneToast('请先选择课程');
      return;
    }
    try {
      const params = {
        meetId: this.data.meetId,
        startDay: this.data.startDay,
        endDay: this.data.endDay,
        status: this.data.status,
      };
      const res = await cloudHelper.callCloudData('admin/join_data_export', params, {
        title: '数据生成中',
      });
      await this._loadDetail(0);
      pageHelper.showModal(
        '数据文件生成成功(' + res.total + '条记录), 请点击「直接打开」按钮或者复制文件地址下载',
      );
    } catch (err) {
      console.log(err);
      pageHelper.showNoneToast('导出失败，请重试');
    }
  },

  async bindDelTap() {
    try {
      await cloudHelper.callCloudData('admin/join_data_del', {}, { title: '数据删除中' });
      this.setData({ url: '', time: '' });
      pageHelper.showSuccToast('删除成功');
    } catch (err) {
      console.log(err);
      pageHelper.showNoneToast('删除失败，请重试');
    }
  },
});
