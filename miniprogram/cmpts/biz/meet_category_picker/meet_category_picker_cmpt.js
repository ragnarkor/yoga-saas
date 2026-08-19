const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const meetCategoryHelper = require("../../../helper/meet_category_helper.js");
const cardScopeHelper = require("../../../helper/card_scope_helper.js");
const AdminMeetBiz = require("../../../biz/admin_meet_biz.js");

const SHEET_SUB = {
  single: "课程类型用于排课分类与筛选",
  scope: "限定后，该卡仅可用于对应课程",
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
    scopeMeetIds: {
      type: Array,
      value: [],
    },
  },

  data: {
    categories: [],
    scopeCategories: [],
    meets: [],
    scopeMeets: [],
    meetsLoaded: false,
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
    "scopeMode, scopeCategoryIds, scopeMeetIds, categories, meets"() {
      this._syncScopeDesc();
      this._syncScopeCategories();
      this._syncScopeMeets();
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
      const meets = this.data.meets || [];
      const scopeCategories = (this.data.categories || []).map((c) => ({
        ...c,
        selected: isCategories && ids.includes(String(c.id)),
        meetCount: meets.filter((m) => String(m.typeId || "") === String(c.id)).length,
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
        // 编辑已存在的 meets 卡时，进入即加载课程以显示名称/高亮
        if (this.data.mode === "scope" && (this.data.scopeMode === "meets" || this.data.scopeMode === "categories")) {
          this._ensureMeets();
        }
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

    _syncScopeMeets() {
      if (this.data.mode !== "scope") return;
      const ids = (this.data.scopeMeetIds || []).map(String);
      const isMeets = this.data.scopeMode === "meets";
      const scopeMeets = (this.data.meets || []).map((m) => ({
        ...m,
        selected: isMeets && ids.includes(String(m.id)),
      }));
      this.setData({ scopeMeets });
    },

    _syncScopeDesc() {
      if (this.data.mode !== "scope") return;
      const scope = {
        mode: this.data.scopeMode,
        categoryIds: this.data.scopeCategoryIds || [],
        meetIds: this.data.scopeMeetIds || [],
      };
      this.setData(
        {
          scopeDescText: cardScopeHelper.buildScopeDesc(
            scope,
            this.data.categories,
            this.data.meets,
          ),
        },
        () => this._syncFieldDisplay(),
      );
    },

    // 首次切到「指定课程」时懒加载课程列表
    async _ensureMeets() {
      if (this.data.meetsLoaded) return;
      try {
        const res = await cloudHelper.callCloudData(
          "admin/meet_list",
          { page: 1, size: 200 },
          { hint: false },
        );
        const rawList = (res && (res.list || res.dataList?.list)) || [];
        const meets = rawList.map((m) => ({
          id: String(m._id || m.MEET_ID || ""),
          name: m.MEET_TITLE || "未命名课程",
          typeName: m.MEET_TYPE_NAME || "",
          typeId: String(m.MEET_TYPE_ID || ""),
        }));
        this.setData({ meets, meetsLoaded: true }, () => {
          this._syncScopeMeets();
          this._syncScopeDesc();
        });
      } catch (e) {
        console.error("meet_category_picker load meets error:", e);
        this.setData({ meets: [], meetsLoaded: true });
      }
    },

    _applyScope(mode, categoryIds, meetIds) {
      const scope = { mode, categoryIds, meetIds };
      const desc = cardScopeHelper.buildScopeDesc(
        scope,
        this.data.categories,
        this.data.meets,
      );
      // 本地同步 scopeMode（property 回传前先更新，保证分段高亮/分区即时切换）
      this.setData(
        {
          scopeMode: mode,
          scopeCategoryIds: (categoryIds || []).map(String),
          scopeMeetIds: (meetIds || []).map(String),
          scopeDescText: desc,
        },
        () => {
          this._syncFieldDisplay();
          this._syncScopeCategories();
          this._syncScopeMeets();
        },
      );
      this.triggerEvent("scopeChange", {
        mode,
        categoryIds: (categoryIds || []).slice(),
        meetIds: (meetIds || []).slice(),
        desc,
      });
    },

    bindFieldTap() {
      if (this.data.loading) {
        wx.showToast({ title: "加载中，请稍候", icon: "none" });
        return;
      }
      // single 模式仍需分类；scope 模式可只用「指定课程」，不强制有分类
      if (this.data.mode === "single" && !this.data.categories.length) {
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
      this._applyScope("all", [], []);
      // 全馆无需选择，直接收起
      this.setData({ sheetShow: false });
    },

    // 切到「按分类」分段（多选，不关面板）
    bindScopeCategoryModeTap() {
      this._ensureMeets();
      if (this.data.scopeMode !== "categories") {
        this._applyScope("categories", this.data.scopeCategoryIds || [], []);
      }
    },

    // 多选切换单个分类
    bindScopeCategoryTap(e) {
      const id = String(e.currentTarget.dataset.id || "");
      if (!id) return;
      let ids = (this.data.scopeCategoryIds || []).map(String);
      if (ids.includes(id)) ids = ids.filter((x) => x !== id);
      else ids = ids.concat(id);
      this._applyScope("categories", ids, []);
    },

    // 分类默认是整类适用；只有需要排除部分课程时才进入课程明细。
    bindScopeCustomTap() {
      this._ensureMeets();
      this._applyScope("meets", [], this.data.scopeMeetIds || []);
    },

    // 切到「指定课程」分段（多选，不关面板）
    bindScopeMeetModeTap() {
      this._ensureMeets();
      if (this.data.scopeMode !== "meets") {
        this._applyScope("meets", [], this.data.scopeMeetIds || []);
      }
    },

    // 多选切换单门课程
    bindScopeMeetTap(e) {
      const id = String(e.currentTarget.dataset.id || "");
      if (!id) return;
      let ids = (this.data.scopeMeetIds || []).map(String);
      if (ids.includes(id)) ids = ids.filter((x) => x !== id);
      else ids = ids.concat(id);
      this._applyScope("meets", [], ids);
    },
  },
});
