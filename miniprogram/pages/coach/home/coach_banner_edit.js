const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],
  data: { isLoad: false, isEdit: false, id: "", submitting: false, title: "", img: "", changed: false },

  onLoad(options) {
    this._applyCoachTheme();
    this._id = options && options.id ? decodeURIComponent(options.id) : "";
    this.setData({ id: this._id, isEdit: !!this._id });
    this._ensureAccess();
  },

  async _ensureAccess() {
    if (!AdminWxBiz.isSuperSession() && !(await AdminWxBiz.ensureSession())) {
      wx.showToast({ title: "请先完成教练端登录", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    try {
      if (this._id) {
        const res = await cloudHelper.callCloudData("admin/home_banner_list", {});
        const item = ((res && res.list) || []).find((x) => x._id === this._id);
        if (item) this.setData({ title: item.BANNER_TITLE || "", img: item.BANNER_PIC || "" });
      }
    } catch (err) { console.error(err); }
    this.setData({ isLoad: true });
  },

  bindTitleInput(e) { this.setData({ title: e.detail }); },

  bindChooseImage() {
    wx.chooseImage({ count: 1, sizeType: ["compressed"], sourceType: ["album", "camera"], success: (res) => this.setData({ img: res.tempFilePaths[0], changed: true }) });
  },

  bindDeleteImage() { this.setData({ img: "", changed: true }); },

  async bindSubmitTap() {
    const title = (this.data.title || "").trim();
    if (!title) return wx.showToast({ title: "请输入横幅标题", icon: "none" });
    if (!this.data.img) return wx.showToast({ title: "请选择横幅图片", icon: "none" });
    this.setData({ submitting: true });
    try {
      let pic = this.data.img;
      if (this.data.changed) pic = await cloudHelper.transTempPicOne(pic, "admin_home/banner", this._id || Date.now() + "");
      const params = { title, pic };
      const route = this._id ? "admin/home_banner_edit" : "admin/home_banner_insert";
      if (this._id) params.id = this._id;
      await cloudHelper.callCloudSumbit(route, params, { title: "保存中" });
      pageHelper.showSuccToast(this._id ? "保存成功" : "添加成功");
      setTimeout(() => wx.navigateBack(), 500);
    } catch (err) { console.error(err); this.setData({ submitting: false }); }
  },
});
