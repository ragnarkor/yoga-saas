const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const cardScopeHelper = require("../../../helper/card_scope_helper.js");
const meetCategoryHelper = require("../../../helper/meet_category_helper.js");

// [AI_START TIMESTAMP=2025-01-27 16:00:00]
/**
 * 卡模板选择器组件
 * 用法：
 *   <card-tpl-picker
 *     value="{{selectedTplId}}"
 *     theme-color="{{themeColor}}"
 *     label="会员卡"
 *     required="{{true}}"
 *     placeholder="请选择会员卡"
 *     bind:pick="onCardPick"
 *   />
 * 事件 pick detail: { tplId, tpl }
 */
Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false,
  },

  externalClasses: ["field-class"],

  properties: {
    /** 当前选中的卡模板 ID（双向绑定由外部维护） */
    value: {
      type: String,
      value: "",
    },
    /** 主题色 */
    themeColor: {
      type: String,
      value: "#5B8A72",
    },
    /** 字段标签文字 */
    label: {
      type: String,
      value: "会员卡",
    },
    /** 是否必选（显示红色 * 号） */
    required: {
      type: Boolean,
      value: false,
    },
    /** 未选择时的占位文字 */
    placeholder: {
      type: String,
      value: "请选择会员卡",
    },
  },

  data: {
    tplList: [],
    selectedTpl: null,
    sheetShow: false,
    loading: true,
    categories: [],
  },

  observers: {
    value(tplId) {
      this._syncSelected(tplId);
    },
  },

  lifetimes: {
    attached() {
      this._loadTplList();
    },
  },

  methods: {
    async _loadTplList() {
      try {
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) {
          this.setData({ loading: false });
          return;
        }
        const [res, storeRes] = await Promise.all([
          cloudHelper.callCloudData("admin/card_tpl_list", {}, { hint: false }),
          cloudHelper.callCloudData("admin/tenant_store", {}, { hint: false }).catch(() => null),
        ]);
        const categories = meetCategoryHelper.resolveCategoryList(
          (storeRes && storeRes.categories) || [],
        );
        const tplList = ((res && res.list) || []).map((item) =>
          this._formatTplItem(item, categories),
        );
        this.setData({ tplList, categories, loading: false });
        // 如果外部已传入 value，同步选中项
        if (this.data.value) {
          this._syncSelected(this.data.value);
        }
      } catch (e) {
        console.error("card_tpl_picker load error:", e);
        this.setData({ tplList: [], loading: false });
      }
    },

    _formatTplItem(item, categories) {
      const cats = categories || this.data.categories || [];
      const scope = cardScopeHelper.normalizeScope(
        item.scope || item.CARD_TPL_SCOPE,
      );
      const scopeDesc =
        item.scopeDesc ||
        cardScopeHelper.buildScopeDesc(scope, cats);
      const metaTags = [];
      if (item.CARD_TPL_DAYS) {
        metaTags.push({
          key: "days",
          label: "有效期",
          value: item.CARD_TPL_DAYS + "天",
        });
      }
      if (item.CARD_TPL_TYPE === "times" && item.CARD_TPL_QUOTA) {
        metaTags.push({
          key: "quota",
          label: "额度",
          value: item.CARD_TPL_QUOTA + "次",
        });
      }
      if (item.CARD_TPL_PRICE != null && item.CARD_TPL_PRICE !== "") {
        metaTags.push({
          key: "price",
          label: "售价",
          value: "¥" + item.CARD_TPL_PRICE,
        });
      }
      if (scopeDesc && scopeDesc !== "全馆课程") {
        metaTags.push({
          key: "scope",
          label: "适用",
          value: scopeDesc,
        });
      }
      return { ...item, scope, scopeDesc, metaTags };
    },

    _syncSelected(tplId) {
      if (!tplId || !this.data.tplList.length) {
        this.setData({ selectedTpl: null });
        return;
      }
      const selectedTpl =
        this.data.tplList.find((item) => item.CARD_TPL_ID === tplId) || null;
      this.setData({ selectedTpl });
    },

    bindFieldTap() {
      if (this.data.loading) {
        wx.showToast({ title: "加载中，请稍候", icon: "none" });
        return;
      }
      if (!this.data.tplList.length) {
        wx.showToast({ title: "暂无会员卡模板", icon: "none" });
        return;
      }
      this.setData({ sheetShow: true });
    },

    bindCloseSheet() {
      this.setData({ sheetShow: false });
    },

    bindTplPick(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      const tpl = this.data.tplList.find((item) => item.CARD_TPL_ID === id);
      this.setData({ sheetShow: false });
      this._syncSelected(id);
      this.triggerEvent("pick", { tplId: id, tpl: tpl || null });
    },
  },
});
// [AI_END LINES=125 TIMESTAMP=2025-01-27 16:00:00]
