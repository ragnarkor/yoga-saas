const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const scheduleSlotHelper = require('../../../helper/schedule_slot_helper.js');
const dataHelper = require('../../../helper/data_helper.js');

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

      let tabs = [{ id: '0', name: '全部' }];
      const categories = (res && res.categories) || [];
      if (categories.length) {
        tabs = tabs.concat(categories);
      } else {
        tabs = tabs.concat(
          dataHelper.getSelectOptions(pageHelper.getMeetTypeStr()).map((o) => ({
            id: o.val,
            name: o.label,
          })),
        );
      }

      this.setData({
        tabs,
        activeTab: 0,
        activeTypeId: '0',
      });
    } catch (e) {
      console.error(e);
    }
  },

  async _loadCourses() {
    const typeId = this.data.activeTypeId;

    try {
      const params = { page: 1, size: 100 };
      if (typeId && typeId !== '0') {
        params.sortType = 'typeId';
        params.sortVal = typeId;
      }
      const res = await cloudHelper.callCloudData(
        'admin/meet_list',
        params,
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
    const picker = scheduleSlotHelper.formatCoursePickerItem(item, idx);
    return {
      ...item,
      cover: picker.cover,
      duration: picker.durationText,
      color: picker.color,
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
    const typeId = this.data.activeTypeId;
    const qs =
      typeId && typeId !== '0' ? `?typeId=${typeId}` : '';
    wx.navigateTo({
      url: `/pages/coach/course/coach_course_edit${qs}`,
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
