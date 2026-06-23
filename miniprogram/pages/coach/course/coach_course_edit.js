const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const AdminMeetBiz = require('../../../biz/admin_meet_biz.js');
const scheduleSlotHelper = require('../../../helper/schedule_slot_helper.js');
const validate = require('../../../helper/validate.js');
const formSetHelper = require('../../../cmpts/public/form/form_set_helper.js');

const COLOR_OPTIONS = [
  { value: '#e57373', label: '珊瑚红' },
  { value: '#f48fb1', label: '樱花粉' },
  { value: '#64b5f6', label: '天空蓝' },
  { value: '#81c784', label: '薄荷绿' },
  { value: '#ffb74d', label: '暖橙色' },
  { value: '#ba68c8', label: '薰衣草' },
  { value: '#4db6ac', label: '青绿色' },
  { value: '#ffd54f', label: '阳光黄' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    pageTitle: '新增课程',
    id: '',
    typeName: '',
    categories: [],
    templateList: [],
    templatePickerList: [],
    selectedTemplatePreview: null,
    templateSheetShow: false,
    typeSheetShow: false,
    colorOptions: COLOR_OPTIONS,
    colorSheetShow: false,
    selectedColorLabel: '薄荷绿',
    thumbList: [],
    carouselList: [],
    formTitle: '',
    formTypeId: '',
    formOrder: 9999,
    formDaysSet: [],
    formIsShowLimit: 1,
    formFormSet: [],
    formStyleSet: AdminMeetBiz.defaultCourseStyleSet(),
  },

  onLoad(options) {
    this.setData({
      id: options.id || '',
      formTypeId: options.typeId || '',
      pageTitle: options.id ? '编辑课程' : '新增课程',
    });
  },

  onShow() {
    this._coachOnShow();
    if (!this._inited) {
      this._inited = true;
      this._initPage();
    }
  },

  async _initPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }

    const skin = pageHelper.getSkin();
    const formFormSet = formSetHelper.defaultForm(skin.DEFAULT_FORMS);
    this.setData({ formFormSet });

    await Promise.all([
      this._loadCategories(),
      this._loadTemplates(),
    ]);

    if (this.data.id) {
      await this._loadDetail();
    } else {
      this._syncTypeName();
      this.setData({ loading: false });
    }
  },

  async _loadCategories() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_store',
        {},
        { hint: false },
      );
      const categories = (res && res.categories) || [];
      this.setData({
        categories,
      });
      this._syncTypeName();
      this._syncSelectedTemplatePreview();
      this._syncColorLabel();
    } catch (e) {
      console.error(e);
    }
  },

  async _loadTemplates() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/meet_list',
        { page: 1, size: 100 },
        { hint: false },
      );
      const templateList = (res && res.list) || [];
      const templatePickerList = templateList.map((m, idx) =>
        scheduleSlotHelper.formatCoursePickerItem(m, idx),
      );
      this.setData({
        templateList,
        templatePickerList,
      });
      this._syncSelectedTemplatePreview();
    } catch (e) {
      console.error(e);
    }
  },

  async _loadDetail() {
    try {
      const meet = await cloudHelper.callCloudData(
        'admin/meet_detail',
        { id: this.data.id },
        { title: 'bar' },
      );
      if (!meet) {
        this.setData({ loading: false });
        return;
      }

      const styleSet = AdminMeetBiz.normalizeCourseStyleSet(meet.MEET_STYLE_SET);
      const pic = styleSet.pic
        ? pageHelper.fmtCoverUrl(styleSet.pic, meet._id)
        : '';
      const carousel = (styleSet.carousel || []).map(
        (p) => pageHelper.fmtCoverUrl(p, meet._id) || pageHelper.fmtImgUrl(p) || p,
      );

      this.setData({
        loading: false,
        formTitle: meet.MEET_TITLE,
        formTypeId: meet.MEET_TYPE_ID,
        formOrder: meet.MEET_ORDER,
        formDaysSet: meet.MEET_DAYS_SET || [],
        formIsShowLimit: meet.MEET_IS_SHOW_LIMIT,
        formFormSet: meet.MEET_FORM_SET || this.data.formFormSet,
        formStyleSet: Object.assign({}, styleSet, { pic }),
        thumbList: pic ? [{ url: pic, isImage: true }] : [],
        carouselList: carousel.map((url) => ({ url, isImage: true })),
      });
      this._syncTypeName();
      this._syncSelectedTemplatePreview();
      this._syncColorLabel();
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  _syncSelectedTemplatePreview() {
    const templateId = this.data.formStyleSet.templateId;
    if (!templateId) {
      this.setData({ selectedTemplatePreview: null });
      return;
    }
    const item = this.data.templatePickerList.find((t) => t._id === templateId);
    if (item) {
      this.setData({ selectedTemplatePreview: item });
      return;
    }
    if (this.data.formStyleSet.templateName) {
      this.setData({
        selectedTemplatePreview: {
          _id: templateId,
          title: this.data.formStyleSet.templateName,
          cover: pageHelper.fmtImgUrl(this.data.formStyleSet.pic) || '',
          typeName: this.data.typeName || '',
          durationText: (this.data.formStyleSet.duration || 60) + '分钟',
          color: this.data.formStyleSet.color || '#81c784',
        },
      });
    }
  },

  _syncTypeName() {
    const { formTypeId, categories } = this.data;
    const hit = categories.find((c) => c.id === formTypeId);
    if (hit) {
      this.setData({ typeName: hit.name });
      return;
    }
    const name = AdminMeetBiz.getTypeName(formTypeId);
    if (name) this.setData({ typeName: name });
  },

  bindTitleChange(e) {
    this.setData({ formTitle: e.detail });
  },

  bindStyleFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail;
    const numFields = ['duration', 'cardAmount', 'cardTimes', 'capacity', 'minJoin'];
    this.setData({
      [`formStyleSet.${field}`]: numFields.includes(field)
        ? val === ''
          ? ''
          : Number(val)
        : val,
    });
  },

  bindRateChange(e) {
    const star = Number(e.detail);
    this.setData({
      'formStyleSet.difficulty': star,
      'formStyleSet.level': star,
    });
  },

  bindThumbAfterRead(e) {
    const file = e.detail.file;
    const files = Array.isArray(file) ? file : [file];
    const thumbList = files.map((f) => ({ url: f.url, isImage: true }));
    this.setData({
      thumbList,
      'formStyleSet.pic': thumbList[0] ? thumbList[0].url : '',
    });
  },

  bindThumbDelete() {
    this.setData({ thumbList: [], 'formStyleSet.pic': '' });
  },

  bindCarouselAfterRead(e) {
    const file = e.detail.file;
    const files = Array.isArray(file) ? file : [file];
    const newItems = files.map((f) => ({ url: f.url, isImage: true }));
    const carouselList = this.data.carouselList.concat(newItems);
    this.setData({
      carouselList,
      'formStyleSet.carousel': carouselList.map((f) => f.url),
    });
  },

  bindCarouselDelete(e) {
    const index = e.detail.index;
    const carouselList = this.data.carouselList.slice();
    carouselList.splice(index, 1);
    this.setData({
      carouselList,
      'formStyleSet.carousel': carouselList.map((f) => f.url),
    });
  },

  _syncColorLabel() {
    const color = this.data.formStyleSet.color;
    const hit = this.data.colorOptions.find((c) => c.value === color);
    this.setData({ selectedColorLabel: hit ? hit.label : '自定义' });
  },

  bindColorTap(e) {
    const color = e.currentTarget.dataset.color;
    const label = e.currentTarget.dataset.label || '';
    this.setData({
      'formStyleSet.color': color,
      selectedColorLabel: label,
      colorSheetShow: false,
    });
  },

  bindColorFieldTap() {
    this.setData({ colorSheetShow: true });
  },

  bindCloseColorSheet() {
    this.setData({ colorSheetShow: false });
  },

  bindTemplateTap() {
    if (!this.data.templatePickerList.length) {
      wx.showToast({ title: '暂无可选模板', icon: 'none' });
      return;
    }
    this.setData({ templateSheetShow: true });
  },

  bindTemplatePick(e) {
    const id = e.currentTarget.dataset.id;
    const meet = this.data.templateList.find((m) => m._id === id);
    if (!meet) return;
    const style = AdminMeetBiz.normalizeCourseStyleSet(meet.MEET_STYLE_SET);
    const pic = style.pic ? pageHelper.fmtImgUrl(style.pic) || style.pic : '';
    const carousel = (style.carousel || []).map(
      (p) => pageHelper.fmtImgUrl(p) || p,
    );
    const preview = this.data.templatePickerList.find((t) => t._id === id) || null;
    this.setData({
      templateSheetShow: false,
      formStyleSet: Object.assign({}, this.data.formStyleSet, style, {
        templateId: meet._id,
        templateName: meet.MEET_TITLE,
        pic,
      }),
      thumbList: pic ? [{ url: pic, isImage: true }] : [],
      carouselList: carousel.map((url) => ({ url, isImage: true })),
      selectedTemplatePreview: preview,
    });
    this._syncColorLabel();
  },

  bindCloseTemplateSheet() {
    this.setData({ templateSheetShow: false });
  },

  bindTypeTap() {
    if (!this.data.categories.length) {
      wx.showToast({ title: '请先在「我的门店」配置分类', icon: 'none' });
      return;
    }
    this.setData({ typeSheetShow: true });
  },

  bindTypePick(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.categories.find((c) => c.id === id);
    if (!item) return;
    this.setData({
      typeSheetShow: false,
      formTypeId: item.id,
      typeName: item.name,
    });
  },

  bindCloseTypeSheet() {
    this.setData({ typeSheetShow: false });
  },

  async bindSaveTap() {
    const data = this.data;
    if (!data.formTitle.trim()) {
      return wx.showToast({ title: '请填写课程名称', icon: 'none' });
    }
    if (!data.formTypeId) {
      return wx.showToast({ title: '请选择课程类型', icon: 'none' });
    }

    const payload = validate.check(data, AdminMeetBiz.CHECK_FORM_COACH, this);
    if (!payload) return;
    payload.typeName = this.data.typeName || AdminMeetBiz.getTypeName(payload.typeId);
    payload.daysSet = data.formDaysSet || [];

    const styleSet = AdminMeetBiz.normalizeCourseStyleSet(data.formStyleSet);
    styleSet.level = styleSet.difficulty;
    styleSet.pic = data.thumbList[0] ? data.thumbList[0].url : (styleSet.pic || '');
    styleSet.carousel = data.carouselList.map((f) => f.url);

    wx.showLoading({ title: '保存中...', mask: true });
    try {
      let meetId = data.id;
      if (meetId) {
        payload.id = meetId;
        await cloudHelper.callCloudSumbit('admin/meet_edit', payload);
      } else {
        const result = await cloudHelper.callCloudSumbit('admin/meet_insert', payload);
        meetId = result.data.id;
        this.setData({ id: meetId, pageTitle: '编辑课程' });
      }

      if (!(await AdminMeetBiz.updateCourseStyleSet(meetId, styleSet, this))) {
        wx.hideLoading();
        return;
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.hideLoading();
      console.error(e);
    }
  },

  bindDeleteTap() {
    const id = this.data.id;
    if (!id) return;
    wx.showModal({
      title: '提示',
      content: '确定删除该课程吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await cloudHelper.callCloudSumbit('admin/meet_del', { meetId: id });
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1500);
        } catch (e) {
          console.error(e);
        }
      },
    });
  },
});
