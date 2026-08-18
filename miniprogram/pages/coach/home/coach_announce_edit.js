const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const newsContentHelper = require("../../../helper/news_content_helper.js");

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    isLoad: false,
    isEdit: false,
    id: "",
    submitting: false,
    form: { title: "", desc: "" },
    contentDelta: { ops: [{ insert: "\n" }] },
    previewNodes: [],
    previewShow: false,
  },

  onLoad(options) {
    this._applyCoachTheme();
    this._id = options && options.id ? decodeURIComponent(options.id) : "";
    this.setData({ id: this._id, isEdit: !!this._id });
    this._ensureAccess();
  },

  async _ensureAccess() {
    if (!AdminWxBiz.isSuperSession()) {
      const ok = await AdminWxBiz.ensureSession();
      if (!ok) {
        wx.showToast({ title: "请先完成教练端登录", icon: "none" });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
    }
    await this._loadDetail();
  },

  async _loadDetail() {
    try {
      if (this._id) {
        const res = await cloudHelper.callCloudData("admin/home_announce_list", {});
        const list = (res && res.list) || [];
        const item = list.find((x) => x._id === this._id);
        if (item) {
          const delta = item.ANNOUNCE_CONTENT_DELTA || newsContentHelper.legacyToDelta(item.ANNOUNCE_CONTENT || [{ type: "text", val: item.ANNOUNCE_DESC || "" }]);
          this.setData({ form: { title: item.ANNOUNCE_TITLE || "", desc: item.ANNOUNCE_DESC || "" }, contentDelta: delta, isLoad: true });
          return;
        }
      }
      this.setData({ isLoad: true });
    } catch (err) {
      console.error(err);
      this.setData({ isLoad: true });
    }
  },

  bindFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ["form." + field]: e.detail });
  },

  bindEditorReady() {
    this._ensureEditorContext(true);
  },

  bindEditorInput(e) {
    const delta = (e.detail && e.detail.delta) || { ops: [] };
    this.setData({ contentDelta: delta });
  },

  _ensureEditorContext(setContents = false) {
    return new Promise((resolve) => {
      if (this.editorCtx) {
        if (setContents) this.editorCtx.setContents({ delta: this.data.contentDelta });
        resolve(this.editorCtx);
        return;
      }
      wx.createSelectorQuery().in(this).select("#announceEditor").context((res) => {
        this.editorCtx = res && res.context;
        if (this.editorCtx && setContents) this.editorCtx.setContents({ delta: this.data.contentDelta });
        resolve(this.editorCtx || null);
      }).exec();
    });
  },

  async bindFormatTap(e) {
    const name = e.currentTarget.dataset.name;
    if (name === "image") {
      wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success: async (res) => {
          const editor = await this._ensureEditorContext();
          if (!editor) return wx.showToast({ title: "编辑器还未就绪，请稍后重试", icon: "none" });
          editor.insertImage({ src: res.tempFilePaths[0], width: "100%" });
        },
      });
      return;
    }
    const editor = await this._ensureEditorContext();
    if (!editor) return wx.showToast({ title: "编辑器还未就绪，请稍后重试", icon: "none" });
    if (name === "clear") return editor.removeFormat();
    editor.format(name, e.currentTarget.dataset.value || true);
  },

  async bindPreviewTap() {
    const delta = await this._getDelta();
    this.setData({ previewNodes: newsContentHelper.deltaToRichNodes(delta), previewShow: true });
  },

  bindPreviewClose() {
    this.setData({ previewShow: false });
  },

  _getDelta() {
    return new Promise((resolve) => {
      if (!this.editorCtx) return resolve(this.data.contentDelta);
      this.editorCtx.getContents({ success: (res) => resolve(res.delta || this.data.contentDelta), fail: () => resolve(this.data.contentDelta) });
    });
  },

  async _prepareDelta(delta) {
    const next = JSON.parse(JSON.stringify(delta || { ops: [] }));
    const images = next.ops.filter((op) => op.insert && op.insert.image).map((op) => op.insert.image);
    if (images.length) {
      await cloudHelper.transTempPics(images, "admin_home/announce/", this._id || Date.now() + "");
      let index = 0;
      next.ops.forEach((op) => { if (op.insert && op.insert.image) op.insert.image = images[index++]; });
    }
    return next;
  },

  async bindSubmitTap() {
    const title = (this.data.form.title || "").trim();
    if (!title) return wx.showToast({ title: "请输入标题", icon: "none" });
    this.setData({ submitting: true });
    try {
      const delta = await this._prepareDelta(await this._getDelta());
      const params = { title, desc: (this.data.form.desc || "").trim(), content: newsContentHelper.deltaToLegacy(delta), delta };
      const route = this._id ? "admin/home_announce_edit" : "admin/home_announce_insert";
      if (this._id) params.id = this._id;
      await cloudHelper.callCloudSumbit(route, params, { title: "保存中" });
      pageHelper.showSuccToast(this._id ? "保存成功" : "添加成功");
      setTimeout(() => wx.navigateBack(), 500);
    } catch (err) {
      console.error(err);
      this.setData({ submitting: false });
    }
  },
});
