const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");

Page({
  data: {
    search: "",
    sortMenus: [],
    sortItems: [],
  },

  onLoad: function () {
    if (!AdminBiz.isAdmin(this)) return;

    // 仅超管可见；非超管直接退回
    if (!AdminBiz.isSuperAdmin()) {
      wx.showToast({ title: "无权访问", icon: "none" });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    this.setData(this._getSearchMenu());
  },

  url: async function (e) {
    pageHelper.url(e, this);
  },

  bindCommListCmpt: function (e) {
    pageHelper.commListListener(this, e);
  },

  _getSearchMenu: function () {
    let sortMenus = [
      { label: "全部", type: "", value: "" },
      { label: "新建馆", type: "action", value: "tenant_insert" },
      { label: "删除馆", type: "action", value: "tenant_del" },
      { label: "改有效期", type: "action", value: "tenant_expire" },
      { label: "启停馆", type: "action", value: "tenant_status" },
      { label: "加员工", type: "action", value: "staff_insert" },
    ];
    return { sortItems: [], sortMenus };
  },
});
