Page({
  data: {
    url: "",
  },
  onLoad(options) {
    if (options && options.url) {
      this.setData({ url: decodeURIComponent(options.url) });
    }
  },
});
