const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const AdminMeetBiz = require('../../../biz/admin_meet_biz.js');
const dataHelper = require('../../../helper/data_helper.js');

const TAB_COLORS = ['#c4b5fd', '#f48fb1', '#64b5f6', '#81c784', '#ffb74d'];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    tabs: [],
    activeTab: 0,
    activeTypeId: '',
    courseList: [],
  },

  onShow() {
    this._coachOnShow();
    this._initPage();
  },

  async _initPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    await this._loadCategories();
    await this._loadCourses();
  },

  async _loadCategories() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_store',
        {},
        { hint: false, title: 'bar' },
      );
      const tenant = (res && res.tenant) || {};
      if (tenant._pid) pageHelper.setTenant(tenant);

      let tabs = (res && res.categories) || [];
      if (!tabs.length) {
        tabs = dataHelper.getSelectOptions(pageHelper.getMeetTypeStr()).map((o) => ({
          id: o.val,
          name: o.label,
        }));
      }

      const activeTypeId = tabs.length ? tabs[0].id : '';
      this.setData({
        tabs,
        activeTab: 0,
        activeTypeId,
      });
    } catch (e) {
      console.error(e);
    }
  },

  async _loadCourses() {
    const typeId = this.data.activeTypeId;
    if (!typeId) {
      this.setData({ loading: false, courseList: [] });
      return;
    }

    try {
      const res = await cloudHelper.callCloudData(
        'admin/meet_list',
        {
          page: 1,
          size: 100,
          sortType: 'typeId',
          sortVal: typeId,
        },
        { hint: false, title: 'bar' },
      );
      const list = ((res && res.list) || []).map((item, idx) =>
        this._formatCourse(item, idx),
      );
      this.setData({ loading: false, courseList: list });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, courseList: [] });
    }
  },

  _formatCourse(item, idx) {
    const style = AdminMeetBiz.normalizeCourseStyleSet(item.MEET_STYLE_SET || {});
    let cover = '';
    if (typeof style.pic === 'string' && style.pic) {
      cover = pageHelper.fmtImgUrl(style.pic) || style.pic;
    } else if (Array.isArray(style.pic) && style.pic.length) {
      cover = pageHelper.fmtImgUrl(style.pic[0]) || style.pic[0];
    }
    const duration = style.duration ? style.duration + '分钟' : '60分钟';
    const color = style.color || TAB_COLORS[idx % TAB_COLORS.length];
    return {
      ...item,
      cover,
      duration,
      color,
    };
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this.setData({ loading: true });
    await this._loadCategories();
    await this._loadCourses();
  },

  bindTabChange(e) {
    const idx = e.detail.index;
    const tab = this.data.tabs[idx];
    if (!tab) return;
    this.setData(
      {
        activeTab: idx,
        activeTypeId: tab.id,
        loading: true,
      },
      () => this._loadCourses(),
    );
  },

  bindAddTap() {
    const typeId = this.data.activeTypeId || '';
    wx.navigateTo({
      url: `/pages/coach/course/coach_course_edit${typeId ? '?typeId=' + typeId : ''}`,
    });
  },

  bindCourseTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/coach/course/coach_course_edit?id=${id}` });
  },

  onPullDownRefresh() {
    this.setData({ loading: true });
    Promise.all([this._loadCategories(), this._loadCourses()]).finally(() =>
      wx.stopPullDownRefresh(),
    );
  },
});
