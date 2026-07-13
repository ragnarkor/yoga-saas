const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const { buildAlbumGroupsFromPhotos } = require("../../../helper/photo_album_helper.js");

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    isLoad: false,
    albumGroups: [],
    photoView: "albums",
    activeAlbumTitle: "",
    activeAlbumPhotos: [],
    batchDeleteMode: false,
    selectedPhotoMap: {},
    selectedPhotoCount: 0,
    popupShow: false,
    submitting: false,
    newAlbumName: "",
    newAlbumImgs: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this._ensureAccess();
  },

  onShow() {
    this._loadPhotos();
  },

  async _loadCoachData() {
    await this._loadPhotos();
  },

  onPullDownRefresh() {
    this._loadPhotos().finally(() => wx.stopPullDownRefresh());
  },

  async _ensureAccess() {
    if (AdminWxBiz.isSuperSession()) return;
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      wx.showToast({ title: "请先完成教练端登录", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  async _loadPhotos() {
    try {
      const res = await cloudHelper.callCloudData("admin/home_photo_list", {});
      const photos = (res && res.list) || [];
      this.setData({
        isLoad: true,
        albumGroups: buildAlbumGroupsFromPhotos(photos),
        albumListKey: Date.now(),
      });
      this._syncActiveAlbumPhotos();
    } catch (err) {
      console.error(err);
      this.setData({ isLoad: true });
    }
  },

  _syncActiveAlbumPhotos() {
    if (this.data.photoView !== "detail" || !this.data.activeAlbumTitle) return;
    const group = this.data.albumGroups.find(
      (item) => item.title === this.data.activeAlbumTitle,
    );
    if (group) {
      this.setData({ activeAlbumPhotos: group.photos });
      return;
    }
    this.setData({
      photoView: "albums",
      activeAlbumTitle: "",
      activeAlbumPhotos: [],
    });
  },

  _exitBatchDelete() {
    this.setData({
      batchDeleteMode: false,
      selectedPhotoMap: {},
      selectedPhotoCount: 0,
    });
  },

  _enterBatchDelete(id) {
    this.setData({
      batchDeleteMode: true,
      selectedPhotoMap: { [id]: true },
      selectedPhotoCount: 1,
    });
    wx.vibrateShort({ type: "medium" });
  },

  _togglePhotoSelect(id) {
    const map = { ...this.data.selectedPhotoMap };
    if (map[id]) delete map[id];
    else map[id] = true;
    this.setData({
      selectedPhotoMap: map,
      selectedPhotoCount: Object.keys(map).length,
    });
  },

  bindPhotoAlbumTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    const album = this.data.albumGroups[index];
    if (!album) return;
    this._exitBatchDelete();
    this.setData({
      photoView: "detail",
      activeAlbumTitle: album.title,
      activeAlbumPhotos: album.photos,
    });
  },

  bindPhotoAlbumBack() {
    if (this.data.batchDeleteMode) {
      this._exitBatchDelete();
      return;
    }
    this.setData({
      photoView: "albums",
      activeAlbumTitle: "",
      activeAlbumPhotos: [],
    });
  },

  _closeAlbumSwipe(swipeId) {
    if (swipeId == null || swipeId === "") return;
    const comp = this.selectComponent(`#album-swipe-${swipeId}`);
    if (comp && typeof comp.close === "function") comp.close();
  },

  bindAlbumSwipeOpen(e) {
    const swipeId = e.currentTarget.dataset.swipeId;
    if (
      this._openAlbumSwipeId != null &&
      this._openAlbumSwipeId !== swipeId
    ) {
      this._closeAlbumSwipe(this._openAlbumSwipeId);
    }
    this._openAlbumSwipeId = swipeId;
  },

  bindNewAlbumTap() {
    this.setData({
      popupShow: true,
      newAlbumName: "",
      newAlbumImgs: [],
    });
  },

  bindPopupClose() {
    this.setData({ popupShow: false });
  },

  bindAlbumNameInput(e) {
    this.setData({ newAlbumName: e.detail });
  },

  bindChooseNewAlbumImg() {
    const remain = Math.max(0, 9 - this.data.newAlbumImgs.length);
    if (!remain) {
      return wx.showToast({ title: "最多选择 9 张", icon: "none" });
    }
    wx.chooseImage({
      count: remain,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const picked = res.tempFilePaths || [];
        this.setData({
          newAlbumImgs: [...this.data.newAlbumImgs, ...picked].slice(0, 9),
        });
      },
    });
  },

  bindDelNewAlbumImg(e) {
    const index = Number(e.currentTarget.dataset.index);
    const imgs = [...this.data.newAlbumImgs];
    imgs.splice(index, 1);
    this.setData({ newAlbumImgs: imgs });
  },

  async bindSubmitNewAlbum() {
    const album = (this.data.newAlbumName || "").trim();
    if (!album) {
      return wx.showToast({ title: "请输入相册名称", icon: "none" });
    }
    if (!this.data.newAlbumImgs.length) {
      return wx.showToast({ title: "请选择照片", icon: "none" });
    }
    this.setData({ submitting: true });
    const ok = await this._uploadPhotosToAlbum(album, this.data.newAlbumImgs);
    if (ok) {
      this.setData({
        popupShow: false,
        submitting: false,
        newAlbumName: "",
        newAlbumImgs: [],
      });
    } else {
      this.setData({ submitting: false });
    }
  },

  bindQuickAddPhotos() {
    const album = this.data.activeAlbumTitle;
    if (!album) return;
    wx.chooseImage({
      count: 9,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        const paths = res.tempFilePaths || [];
        if (!paths.length) return;
        await this._uploadPhotosToAlbum(album, paths);
      },
    });
  },

  bindPhotoLongPress(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    if (!this.data.batchDeleteMode) {
      this._enterBatchDelete(id);
      return;
    }
    this._togglePhotoSelect(id);
  },

  bindPhotoGridTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    if (this.data.batchDeleteMode) {
      this._togglePhotoSelect(id);
      return;
    }
    const photos = this.data.activeAlbumPhotos || [];
    const index = photos.findIndex((p) => p._id === id);
    if (index < 0) return;
    const item = photos[index];
    const urls = photos.map((p) => p.PHOTO_PIC).filter(Boolean);
    if (urls.length && item.PHOTO_PIC) {
      wx.previewImage({ current: item.PHOTO_PIC, urls });
    }
  },

  bindCancelBatchDelete() {
    this._exitBatchDelete();
  },

  async bindBatchDeleteTap() {
    const ids = Object.keys(this.data.selectedPhotoMap || {});
    if (!ids.length) {
      return wx.showToast({ title: "请选择照片", icon: "none" });
    }
    const ok = await pageHelper.showConfirm(
      `确认删除选中的 ${ids.length} 张照片？`,
    );
    if (!ok) return;
    await this._delPhotos(ids);
  },

  async _delPhotos(ids) {
    wx.showLoading({ title: "删除中", mask: true });
    let success = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        await cloudHelper.callCloudSumbit(
          "admin/home_photo_del",
          { id: ids[i] },
          { hint: false },
        );
        success++;
      }
      wx.hideLoading();
      pageHelper.showSuccToast(`已删除 ${success} 张`);
      this._exitBatchDelete();
      await this._loadPhotos();
    } catch (err) {
      wx.hideLoading();
      console.error("[photo_batch_del]", err);
      wx.showToast({
        title: (err && err.msg) || "删除失败",
        icon: "none",
      });
    }
  },

  async bindDelAlbumTap(e) {
    const title = e.currentTarget.dataset.title;
    const count = Number(e.currentTarget.dataset.count) || 0;
    const swipeId = e.currentTarget.dataset.swipeId;
    if (!title) return;
    const ok = await pageHelper.showConfirm(
      `确认删除相册「${title}」及全部 ${count} 张照片？`,
    );
    if (!ok) return;
    this._closeAlbumSwipe(swipeId);
    this._openAlbumSwipeId = null;
    await this._delAlbum(title);
  },

  async _delAlbum(album) {
    try {
      const res = await cloudHelper.callCloudSumbit(
        "admin/home_photo_album_del",
        { album },
        { title: "删除中" },
      );
      const count = (res && res.data && res.data.count) || 0;
      pageHelper.showSuccToast(count ? "相册已删除" : "相册已清空");
      this._openAlbumSwipeId = null;
      this._exitBatchDelete();
      this.setData({
        photoView: "albums",
        activeAlbumTitle: "",
        activeAlbumPhotos: [],
      });
      await this._loadPhotos();
    } catch (err) {
      console.error("[album_del]", err);
      wx.showToast({
        title: (err && err.msg) || "删除失败，请确认云函数已上传",
        icon: "none",
      });
    }
  },

  async _uploadImg(filePath) {
    if (!filePath) return "";
    try {
      return (
        (await cloudHelper.transTempPicOne(
          filePath,
          "admin_home/photo",
          Date.now() + "",
        )) || ""
      );
    } catch (err) {
      console.error(err);
      return "";
    }
  },

  async _uploadPhotosToAlbum(album, paths) {
    if (!paths || !paths.length) return false;
    wx.showLoading({ title: "上传中", mask: true });
    let success = 0;
    try {
      for (let i = 0; i < paths.length; i++) {
        wx.showLoading({
          title: `上传 ${i + 1}/${paths.length}`,
          mask: true,
        });
        const pic = await this._uploadImg(paths[i]);
        if (!pic) continue;
        await cloudHelper.callCloudSumbit(
          "admin/home_photo_insert",
          { title: "", desc: "", album, pic },
          { hint: false },
        );
        success++;
      }
      wx.hideLoading();
      if (!success) {
        wx.showToast({ title: "上传失败", icon: "none" });
        return false;
      }
      pageHelper.showSuccToast(`已上传 ${success} 张`);
      await this._loadPhotos();
      return true;
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      return false;
    }
  },
});
