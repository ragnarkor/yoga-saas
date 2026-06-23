const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");

const TYPE_NAMES = {
  announce: "公告",
  banner: "横幅",
  photo: "照片",
};

const TAB_TYPES = ["banner", "announce", "photo"];

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    isLoad: false,
    activeTab: 0,
    tabs: [
      { id: "banner", name: "横幅", icon: "photo-o" },
      { id: "announce", name: "公告", icon: "volume-o" },
      { id: "photo", name: "照片墙", icon: "photo" },
    ],
    banners: [],
    announces: [],
    photos: [],
    popupType: "",
    popupTitle: "",
    popupShow: false,
    submitting: false,
    form: { title: "", desc: "" },
    imgList: [],
    editId: "",
    editMode: false,
    imgChanged: false,
    submitBtnText: "确认添加",
  },

  onLoad() {
    this._applyCoachTheme();
    this._ensureAccess();
  },

  onShow() {
    this._loadAll();
  },

  onPullDownRefresh() {
    this._loadAll().finally(() => wx.stopPullDownRefresh());
  },

  async _ensureAccess() {
    if (AdminWxBiz.isSuperSession()) return;
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      wx.showToast({ title: "请先完成教练端登录", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  bindTabTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.activeTab) return;
    this.setData({ activeTab: index });
  },

  async _loadAll() {
    try {
      const [banners, announces, photos] = await Promise.all([
        cloudHelper.callCloudData("admin/home_banner_list", {}),
        cloudHelper.callCloudData("admin/home_announce_list", {}),
        cloudHelper.callCloudData("admin/home_photo_list", {}),
      ]);
      this.setData({
        isLoad: true,
        banners: (banners && banners.list) || [],
        announces: (announces && announces.list) || [],
        photos: (photos && photos.list) || [],
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoad: true });
    }
  },

  async bindDelTap(e) {
    const { type, id } = e.currentTarget.dataset;
    const routeMap = {
      banner: "admin/home_banner_del",
      announce: "admin/home_announce_del",
      photo: "admin/home_photo_del",
    };
    const route = routeMap[type];
    if (!route || !id) return;

    const ok = await pageHelper.showConfirm("确认删除该项？");
    if (!ok) return;

    try {
      await cloudHelper.callCloudSumbit(route, { id }, { title: "删除中" });
      pageHelper.showSuccToast("已删除");
      this._loadAll();
    } catch (err) {
      console.error(err);
    }
  },

  bindAddTap(e) {
    const type = e.currentTarget.dataset.type || TAB_TYPES[this.data.activeTab];
    const name = TYPE_NAMES[type] || "";
    this.setData({
      popupType: type,
      popupTitle: "新增" + name,
      popupShow: true,
      editMode: false,
      editId: "",
      imgChanged: false,
      submitBtnText: "确认添加",
      form: { title: "", desc: "" },
      imgList: [],
    });
  },

  bindEditTap(e) {
    const { type, id } = e.currentTarget.dataset;
    const name = TYPE_NAMES[type] || "";
    let form = { title: "", desc: "" };
    let imgList = [];

    if (type === "banner") {
      const item = this.data.banners.find((b) => b._id === id);
      if (item) {
        form.title = item.BANNER_TITLE || "";
        if (item.BANNER_PIC) imgList = [item.BANNER_PIC];
      }
    } else if (type === "announce") {
      const item = this.data.announces.find((a) => a._id === id);
      if (item) {
        form.title = item.ANNOUNCE_TITLE || "";
        form.desc = item.ANNOUNCE_DESC || "";
      }
    } else if (type === "photo") {
      const item = this.data.photos.find((p) => p._id === id);
      if (item) {
        form.title = item.PHOTO_TITLE || "";
        form.desc = item.PHOTO_DESC || "";
        if (item.PHOTO_PIC) imgList = [item.PHOTO_PIC];
      }
    }

    this.setData({
      popupType: type,
      popupTitle: "编辑" + name,
      popupShow: true,
      editMode: true,
      editId: id,
      imgChanged: false,
      submitBtnText: "保存修改",
      form,
      imgList,
    });
  },

  bindPopupClose() {
    this.setData({ popupShow: false });
  },

  bindFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ["form." + field]: e.detail });
  },

  bindChooseImg() {
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        this.setData({ imgList: res.tempFilePaths, imgChanged: true });
      },
    });
  },

  bindDelImg() {
    this.setData({ imgList: [], imgChanged: true });
  },

  async bindSubmitTap() {
    const type = this.data.popupType;
    const title = (this.data.form.title || "").trim();
    const desc = (this.data.form.desc || "").trim();
    const isEdit = this.data.editMode;

    if (type === "announce") {
      if (!title) return wx.showToast({ title: "请输入标题", icon: "none" });
      if (isEdit) {
        await this._submit("admin/home_announce_edit", {
          id: this.data.editId,
          title,
          desc,
        });
      } else {
        await this._submit("admin/home_announce_insert", { title, desc });
      }
    } else if (type === "banner") {
      if (!this.data.imgList.length) {
        return wx.showToast({ title: "请选择图片", icon: "none" });
      }
      let pic = this.data.imgList[0];
      if (this.data.imgChanged) {
        pic = await this._uploadImg("banner");
        if (!pic) return;
      }
      if (isEdit) {
        await this._submit("admin/home_banner_edit", {
          id: this.data.editId,
          title,
          pic,
        });
      } else {
        await this._submit("admin/home_banner_insert", { title, pic });
      }
    } else if (type === "photo") {
      if (!this.data.imgList.length) {
        return wx.showToast({ title: "请选择照片", icon: "none" });
      }
      let pic = this.data.imgList[0];
      if (this.data.imgChanged) {
        pic = await this._uploadImg("photo");
        if (!pic) return;
      }
      if (isEdit) {
        await this._submit("admin/home_photo_edit", {
          id: this.data.editId,
          title,
          desc,
          pic,
        });
      } else {
        await this._submit("admin/home_photo_insert", { title, desc, pic });
      }
    }
  },

  async _uploadImg(subDir) {
    try {
      const pic = await cloudHelper.transTempPicOne(
        this.data.imgList[0],
        "admin_home/" + subDir,
        Date.now() + "",
      );
      return pic || "";
    } catch (err) {
      console.error(err);
      wx.showToast({ title: "图片上传失败", icon: "none" });
      return "";
    }
  },

  async _submit(route, params) {
    this.setData({ submitting: true });
    try {
      await cloudHelper.callCloudSumbit(route, params, { title: "提交中" });
      pageHelper.showSuccToast(this.data.editMode ? "保存成功" : "添加成功");
      this.setData({
        popupShow: false,
        submitting: false,
        editMode: false,
        editId: "",
        imgChanged: false,
        form: { title: "", desc: "" },
        imgList: [],
      });
      this._loadAll();
    } catch (err) {
      console.error(err);
      this.setData({ submitting: false });
    }
  },
});
