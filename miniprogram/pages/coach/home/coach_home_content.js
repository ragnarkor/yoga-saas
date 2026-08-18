const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const newsContentHelper = require("../../../helper/news_content_helper.js");

const TYPE_NAMES = {
  announce: "公告",
  banner: "横幅",
};

const TAB_TYPES = ["banner", "announce"];

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    isLoad: false,
    activeTab: 0,
    tabs: [
      { id: "banner", name: "横幅", icon: "photo-o" },
      { id: "announce", name: "公告", icon: "volume-o" },
    ],
    banners: [],
    announces: [],
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
    contentDelta: { ops: [{ insert: "\n" }] },
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
      const [banners, announces] = await Promise.all([
        cloudHelper.callCloudData("admin/home_banner_list", {}),
        cloudHelper.callCloudData("admin/home_announce_list", {}),
      ]);
      this.setData({
        isLoad: true,
        banners: (banners && banners.list) || [],
        announces: (announces && announces.list) || [],
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
    };
    const route = routeMap[type];
    if (!route || !id) return;

    const ok = await pageHelper.showConfirm("确认删除该项？");
    if (!ok) return;

    try {
      await cloudHelper.callCloudSumbit(route, { id }, { title: "删除中" });
      pageHelper.showSuccToast("已删除");
      await this._loadAll();
    } catch (err) {
      console.error(err);
    }
  },

  bindAddTap(e) {
    const type = e.currentTarget.dataset.type || TAB_TYPES[this.data.activeTab];
    if (type === "announce") return wx.navigateTo({ url: "/pages/coach/home/coach_announce_edit" });
    if (type === "banner") return wx.navigateTo({ url: "/pages/coach/home/coach_banner_edit" });
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
      contentDelta: newsContentHelper.legacyToDelta([{ type: "text", val: "" }]),
      imgList: [],
    }, () => {
      if (type === "announce" && this.announceEditorCtx) {
        this.announceEditorCtx.setContents({ delta: this.data.contentDelta });
      }
    });
  },

  bindEditTap(e) {
    const { type, id } = e.currentTarget.dataset;
    if (type === "announce") {
      wx.navigateTo({ url: "/pages/coach/home/coach_announce_edit?id=" + encodeURIComponent(id) });
      return;
    }
    if (type === "banner") {
      wx.navigateTo({ url: "/pages/coach/home/coach_banner_edit?id=" + encodeURIComponent(id) });
      return;
    }
    const name = TYPE_NAMES[type] || "";
    let form = { title: "", desc: "" };
    let imgList = [];
    let contentDelta = { ops: [{ insert: "\n" }] };

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
        contentDelta = item.ANNOUNCE_CONTENT_DELTA || newsContentHelper.legacyToDelta(item.ANNOUNCE_CONTENT || [{ type: "text", val: form.desc }]);
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
      contentDelta,
      imgList,
    }, () => {
      if (type === "announce" && this.announceEditorCtx) {
        this.announceEditorCtx.setContents({ delta: this.data.contentDelta });
      }
    });
  },

  bindSwipeOpen(e) {
    const id = e.currentTarget.dataset.swipeId;
    if (this._openSwipeId && this._openSwipeId !== id) {
      const old = this.selectComponent(`#home-swipe-${this._openSwipeId}`);
      if (old) old.close();
    }
    this._openSwipeId = id;
  },

  bindAnnounceEditorReady() {
    wx.createSelectorQuery().in(this).select("#announceEditor").context((res) => {
      this.announceEditorCtx = res && res.context;
      if (this.announceEditorCtx) this.announceEditorCtx.setContents({ delta: this.data.contentDelta });
    }).exec();
  },

  bindAnnounceEditorInput(e) {
    if (e.detail && e.detail.delta) this.setData({ contentDelta: e.detail.delta });
  },

  bindAnnounceFormatTap(e) {
    if (!this.announceEditorCtx) return;
    const name = e.currentTarget.dataset.name;
    if (name === "image") return this.bindAnnounceImageTap();
    if (name === "clear") return this.announceEditorCtx.removeFormat();
    this.announceEditorCtx.format(name, e.currentTarget.dataset.value || true);
  },

  bindAnnounceImageTap() {
    if (!this.announceEditorCtx) return;
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => this.announceEditorCtx.insertImage({ src: res.tempFilePaths[0], width: "100%" }),
    });
  },

  _getAnnounceDelta() {
    return new Promise((resolve) => {
      if (!this.announceEditorCtx) return resolve(this.data.contentDelta);
      this.announceEditorCtx.getContents({ success: (res) => resolve(res.delta || this.data.contentDelta), fail: () => resolve(this.data.contentDelta) });
    });
  },

  async _prepareAnnounceContent(delta) {
    const next = JSON.parse(JSON.stringify(delta || { ops: [] }));
    const images = next.ops.filter((op) => op.insert && op.insert.image).map((op) => op.insert.image);
    if (images.length) {
      await cloudHelper.transTempPics(images, "admin_home/announce/", this.data.editId || Date.now() + "");
      let index = 0;
      next.ops.forEach((op) => { if (op.insert && op.insert.image) op.insert.image = images[index++]; });
    }
    return next;
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
      const delta = await this._prepareAnnounceContent(await this._getAnnounceDelta());
      const content = newsContentHelper.deltaToLegacy(delta);
      if (isEdit) {
        await this._submit("admin/home_announce_edit", {
          id: this.data.editId,
          title,
          desc,
          content,
          delta,
        });
      } else {
        await this._submit("admin/home_announce_insert", { title, desc, content, delta });
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
      await this._loadAll();
    } catch (err) {
      console.error(err);
      this.setData({ submitting: false });
    }
  },
});
