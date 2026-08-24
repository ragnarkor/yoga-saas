const NewsBiz = require("../biz/news_biz.js");
const pageHelper = require("../helper/page_helper.js");
let dataHelper = require("../helper/data_helper.js");
const setting = require("../setting/setting.js");

module.exports = Behavior({
  /**
   * 页面的初始数据
   */
  // [AI_START TIMESTAMP=2025-01-26 10:00:00]
  data: {
    search: "",
    sortMenus: [],
    sortItems: [],
  },
  // [AI_END LINES=4 TIMESTAMP=2025-01-26 10:00:00]

  methods: {
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: async function (options) {
      if (options && options.id) {
        this.setData({
          _params: {
            cateId: options.id,
          },
        });
      } else {
        this.setData({
          _params: {
            cateId: 0,
          },
        });
      }

      if (setting.IS_SUB) wx.hideHomeButton();

      let { sortItems, sortMenus } = await NewsBiz.getSearchMenu();
      this.setData({ sortItems, sortMenus });
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {},

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: async function () {
      /*
			// 获取当前小程序的页面栈
			let pages = getCurrentPages();
			// 数组中索引最大的页面--当前页面
			let currentPage = pages[pages.length - 1];
			// 附加参数 
			if (currentPage.options && currentPage.options.id) {
				this.setData({
					_params: {
						cateId: currentPage.options.id,
					}
				});
			}
			*/
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {},

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {},

    url: async function (e) {
      pageHelper.url(e, this);
    },

    bindCommListCmpt: function (e) {
      pageHelper.commListListener(this, e);
    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {},
  },
});
