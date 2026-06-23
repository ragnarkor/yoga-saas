const AdminBiz = require('../../../biz/admin_biz.js');
const UserProfileBiz = require('../../../biz/user_profile_biz.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const pageHelper = require('../../../helper/page_helper.js');
const setting = require('../../../setting/setting.js');

function fmtPicList(list) {
  return (list || [])
    .filter(Boolean)
    .map((item) => pageHelper.fmtImgUrl(item));
}

function toFileList(list) {
  return fmtPicList(list).map((url) => ({ url, isImage: true }));
}

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    isLoad: false,
    canEdit: false,
    name: '',
    formAvatar: [],
    avatarSrc: '',
    showAvatar: false,
    formSpecialty: '',
    formDesc: '',
    formPics: [],
    picsFileList: [],
    submitting: false,
  },

  onLoad() {
    this._applyCoachTheme();
    this._initPage();
  },

  async _initPage() {
    const admin = AdminBiz.getAdminToken();
    if (!admin) {
      wx.showToast({ title: '请先登录教练版', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    const canEdit = admin.type === 'owner' || admin.type === 'teacher';
    this.setData({ canEdit });
    if (!canEdit) {
      wx.showToast({ title: '仅馆主/教练可编辑', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    await this._loadProfile();
  },

  async _loadProfile() {
    this.setData({ loading: true });
    try {
      const data = await cloudHelper.callCloudData(
        'admin/my_teacher_profile',
        {},
        { hint: false, title: 'bar' },
      );
      if (!data) return;

      let avatarSrc = '';
      if (data.avatar) {
        avatarSrc = await UserProfileBiz.resolveAvatarUrl(data.avatar);
      }

      const formPics = data.pics || [];
      this.setData({
        loading: false,
        isLoad: true,
        name: data.name || '',
        formAvatar: data.avatar ? [data.avatar] : [],
        avatarSrc,
        showAvatar: !!avatarSrc,
        formSpecialty: data.specialty || '',
        formDesc: data.desc || '',
        formPics,
        picsFileList: toFileList(formPics),
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
      wx.showToast({ title: (e && e.msg) || '加载失败', icon: 'none' });
    }
  },

  bindChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (!tempPath) return;
    this.setData({
      avatarSrc: tempPath,
      showAvatar: true,
      formAvatar: [tempPath],
    });
  },

  bindFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail });
  },

  bindPicsAfterRead(e) {
    const file = e.detail.file;
    const files = Array.isArray(file) ? file : [file];
    const newItems = files.map((f) => ({ url: f.url, isImage: true }));
    const picsFileList = this.data.picsFileList.concat(newItems).slice(0, 9);
    this.setData({
      picsFileList,
      formPics: picsFileList.map((f) => f.url),
    });
  },

  bindPicsDelete(e) {
    const index = e.detail.index;
    const picsFileList = this.data.picsFileList.slice();
    picsFileList.splice(index, 1);
    this.setData({
      picsFileList,
      formPics: picsFileList.map((f) => f.url),
    });
  },

  async bindSubmitTap() {
    if (!this.data.canEdit || this.data.submitting) return;

    this.setData({ submitting: true });
    try {
      let avatarList = this.data.formAvatar || [];
      let pics = this.data.formPics || [];

      if (avatarList.length) {
        const needUpload = avatarList.some(
          (p) =>
            p &&
            (p.includes('wxfile') ||
              p.includes('tmp') ||
              p.includes('http://tmp')),
        );
        if (needUpload) {
          wx.showLoading({ title: '上传头像' });
          avatarList = await cloudHelper.transTempPics(
            avatarList,
            setting.SETUP_PIC_PATH,
            '',
          );
        }
      }

      if (pics.length) {
        const needUpload = pics.some(
          (p) =>
            p &&
            (p.includes('wxfile') ||
              p.includes('tmp') ||
              p.includes('http://tmp')),
        );
        if (needUpload) {
          wx.showLoading({ title: '上传照片' });
          pics = await cloudHelper.transTempPics(
            pics,
            setting.SETUP_PIC_PATH,
            '',
          );
        }
      }

      await cloudHelper.callCloudSumbit(
        'admin/my_teacher_profile_save',
        {
          avatar: avatarList[0] || '',
          specialty: (this.data.formSpecialty || '').trim(),
          desc: (this.data.formDesc || '').trim(),
          pics,
        },
        { title: '保存中' },
      );
      wx.showToast({ title: '已保存', icon: 'success' });
      await this._loadProfile();
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    await this._loadProfile();
  },
});
