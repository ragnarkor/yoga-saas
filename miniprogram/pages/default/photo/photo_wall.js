const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const themeHelper = require("../../../helper/theme_helper.js");
const themeBh = require("../../../behavior/theme_bh.js");
const { enrichPhotoAlbum } = require("../../../helper/photo_album_helper.js");

function mapPhoto(item) {
  return {
    _id: item._id,
    title: item.title,
    desc: item.desc,
    album: item.album || item.desc || "馆舍风采",
    pic: pageHelper.fmtCoverUrl(item.pic, item._id),
  };
}

Page({
  behaviors: [themeBh],

  data: {
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
    isLoad: false,
    viewMode: "albums",
    displayAlbums: [],
    activeAlbumTitle: "",
    displayPhotos: [],
    entryFromHome: false,
  },

  onLoad(options) {
    this._applyTheme();
    this._pendingAlbum = options.album
      ? decodeURIComponent(options.album)
      : "";
    this._loadAlbums();
  },

  onPullDownRefresh() {
    this._loadAlbums().finally(() => wx.stopPullDownRefresh());
  },

  async _loadAlbums() {
    try {
      const data = await cloudHelper.callCloudData(
        "home/photo_album_list",
        {},
        { hint: false, title: "bar" },
      );
      if (!data) {
        this.setData({
          isLoad: true,
          viewMode: "albums",
          displayAlbums: [],
          displayPhotos: [],
        });
        return;
      }

      const displayAlbums = (data.photoAlbums || []).map((album) => {
        const photos = (album.photos || []).map(mapPhoto);
        return enrichPhotoAlbum({ ...album, photos });
      });

      const updates = {
        isLoad: true,
        displayAlbums,
      };

      if (this.data.viewMode === "detail" && this.data.activeAlbumTitle) {
        const active = displayAlbums.find(
          (item) => item.title === this.data.activeAlbumTitle,
        );
        updates.displayPhotos = active ? active.photos : [];
        if (!active) {
          updates.viewMode = "albums";
          updates.activeAlbumTitle = "";
        }
      } else if (this._pendingAlbum) {
        const active = displayAlbums.find(
          (item) => item.title === this._pendingAlbum,
        );
        this._pendingAlbum = "";
        if (active) {
          updates.viewMode = "detail";
          updates.activeAlbumTitle = active.title;
          updates.displayPhotos = active.photos;
          updates.entryFromHome = true;
        } else {
          updates.viewMode = "albums";
          updates.activeAlbumTitle = "";
          updates.displayPhotos = [];
        }
      } else {
        updates.viewMode = "albums";
        updates.activeAlbumTitle = "";
        updates.displayPhotos = [];
      }

      this.setData(updates);
    } catch (err) {
      console.error("[photo_wall]", err);
      this.setData({ isLoad: true });
      pageHelper.showErrToast("相册加载失败");
    }
  },

  bindAlbumTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    const album = this.data.displayAlbums[index];
    if (!album) return;

    this.setData({
      viewMode: "detail",
      activeAlbumTitle: album.title,
      displayPhotos: album.photos,
      entryFromHome: false,
    });
  },

  bindHeaderBack() {
    this.bindBackTap();
  },

  bindBackTap() {
    this.setData({
      viewMode: "albums",
      activeAlbumTitle: "",
      displayPhotos: [],
      entryFromHome: false,
    });
  },

  bindPhotoTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.displayPhotos[index];
    if (!item) return;

    const urls = this.data.displayPhotos.map((p) => p.pic).filter(Boolean);
    if (urls.length) {
      wx.previewImage({ current: item.pic, urls });
    }
  },
});
