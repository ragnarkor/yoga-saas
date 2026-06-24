const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const meetCategoryHelper = require("../../../helper/meet_category_helper.js");
const cardScopeHelper = require("../../../helper/card_scope_helper.js");
const AdminMeetBiz = require("../../../biz/admin_meet_biz.js");

const SHEET_SUB = {
  single: "课程类型用于排课分类与筛选",
  scope: "指定分类后，该卡仅可用于对应课程",
};

/**
 * 课程类型 / 适用课程分类选择器（field + picker 与课程编辑页一致，点选即生效）
 */
Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false,
  },

  properties: {
    value: {
      type: String,
      value: "",
    },
    themeColor: {
      type: String,
      value: "#5B8A72",
    },
    label: {
      type: String,
      value: "课程类型",
    },
    required: {
      type: Boolean,
      value: false,
    },
    placeholder: {
      type: String,
      value: "请选择",
    },
    /** single | scope */
    mode: {
      type: String,
      value: "single",
    },
    scopeMode: {
      type: String,
      value: "all",
    },
    scopeCategoryIds: {
      type: Array,
      value: [],
    },
  },

  data: {
    categories: [],
    scopeCategories: [],
    sheetShow: false,
    loading: true,
    typeName: "",
    scopeDescText: "全馆课程",
    fieldValue: "请选择",
    fieldValueIsPlaceholder: true,
    sheetTitle: "选择课程类型",
    sheetSub: SHEET_SUB.single,
  },

  observers: {
    "label, mode"() {
      this._syncSheetMeta();
    },
    value(typeId) {
      this._syncTypeName(typeId);
    },
    "scopeMode, scopeCategoryIds, categories"() {
      this._syncScopeDesc();
      this._syncScopeCategories();
    },
  },

  lifetimes: {
    attached() {
      this._syncSheetMeta();
      this.reload();
    },
  },

  methods: {
    _syncSheetMeta() {
      const { label, mode } = this.data;
      this.setData({
        sheetTitle: `选择${label}`,
        sheetSub: SHEET_SUB[mode === "scope" ? "scope" : "single"],
      });
    },

    _syncFieldDisplay() {
      const { mode, typeName, scopeDescText, placeholder } = this.data;
      if (mode === "single") {
        const hasValue = !!typeName;
        this.setData({
          fieldValue: hasValue ? typeName : placeholder,
          fieldValueIsPlaceholder: !hasValue,
        });
        return;
      }
      const isEmpty = !scopeDescText || scopeDescText === "未指定分类";
      this.setData({
        fieldValue: isEmpty ? placeholder : scopeDescText,
        fieldValueIsPlaceholder: isEmpty,
      });
    },

    _syncScopeCategories() {
      if (this.data.mode !== "scope") return;
      const ids = (this.data.scopeCategoryIds || []).map(String);
      const isCategories = this.data.scopeMode === "categories";
      const scopeCategories = (this.data.categories || []).map((c) => ({
        ...c,
        selected: isCategories && ids.includes(String(c.id)),
      }));
      this.setData({ scopeCategories });
    },

    async reload() {
      this.setData({ loading: true });
      try {
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) {
          this.setData({ loading: false, categories: [] });
          return;
        }
        const res = await cloudHelper.callCloudData(
          "admin/tenant_store",
          {},
          { hint: false },
        );
        const categories = meetCategoryHelper.resolveCategoryList(
          res?.categories || [],
        );
        this.setData({ categories, loading: false });
        this._syncTypeName(this.data.value);
        this._syncScopeDesc();
        this._syncScopeCategories();
      } catch (e) {
        console.error("meet_category_picker load error:", e);
        this.setData({ loading: false, categories: [] });
      }
    },

    _syncTypeName(typeId) {
      if (this.data.mode !== "single") return;
      if (!typeId) {
        this.setData({ typeName: "" }, () => this._syncFieldDisplay());
        return;
      }
      const hit = this.data.categories.find((c) => c.id === String(typeId));
      if (hit) {
        this.setData({ typeName: hit.name }, () => this._syncFieldDisplay());
        return;
      }
      const name = AdminMeetBiz.getTypeName(typeId);
      this.setData({ typeName: name || "" }, () => this._syncFieldDisplay());
    },

    _syncScopeDesc() {
      if (this.data.mode !== "scope") return;
      const scope = {
        mode: this.data.scopeMode,
        categoryIds: this.data.scopeCategoryIds || [],
      };
      this.setData(
        {
          scopeDescText: cardScopeHelper.buildScopeDesc(
            scope,
            this.data.categories,
          ),
        },
        () => this._syncFieldDisplay(),
      );
    },

    _applyScope(mode, categoryIds) {
      const scope = { mode, categoryIds };
      const desc = cardScopeHelper.buildScopeDesc(scope, this.data.categories);
      this.setData({ sheetShow: false, scopeDescText: desc }, () =>
        this._syncFieldDisplay(),
      );
      this.triggerEvent("scopeChange", {
        mode,
        categoryIds: categoryIds.slice(),
        desc,
      });
    },

    bindFieldTap() {
      if (this.data.loading) {
        wx.showToast({ title: "加载中，请稍候", icon: "none" });
        return;
      }
      if (!this.data.categories.length) {
        wx.showToast({
          title: "请先在「我的门店」配置分类",
          icon: "none",
        });
        return;
      }
      this.setData({ sheetShow: true });
    },

    bindCloseSheet() {
      this.setData({ sheetShow: false });
    },

    bindTypePick(e) {
      const id = String(e.currentTarget.dataset.id || "");
      if (!id) return;
      const item = this.data.categories.find((c) => c.id === id);
      this.setData({ sheetShow: false, typeName: item ? item.name : "" }, () =>
        this._syncFieldDisplay(),
      );
      this.triggerEvent("pick", {
        typeId: id,
        typeName: item ? item.name : "",
        category: item || null,
      });
    },

    bindScopeAllTap() {
      this._applyScope("all", []);
    },

    bindScopeCategoryTap(e) {
      const id = String(e.currentTarget.dataset.id || "");
      if (!id) return;
      this._applyScope("categories", [id]);
    },
  },
});
