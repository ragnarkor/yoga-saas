const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const meetCategoryHelper = require("../../../helper/meet_category_helper.js");
const cardScopeHelper = require("../../../helper/card_scope_helper.js");
const AdminMeetBiz = require("../../../biz/admin_meet_biz.js");

const SHEET_SUB = {
  single: "课程类型用于排课分类与筛选",
  scope: "勾选可用的课程；勾「整个分类」含后续新增课程",
};

/**
 * 课程类型 / 适用课程范围选择器
 * single：课程类型单选，点选即生效（与课程编辑页一致）
 * scope：分类 Tab + 课程多选，草稿式选择——点「确定」才生效
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
    meets: [],
    meetsLoaded: false,
    sheetShow: false,
    loading: true,
    typeName: "",
    scopeDescText: "全馆课程",
    fieldValue: "请选择",
    fieldValueIsPlaceholder: true,
    sheetTitle: "选择课程类型",
    sheetSub: SHEET_SUB.single,
    // scope 草稿：整类适用的分类集合 + 散选课程集合；activeTab 为空串时是「全部」Tab
    draftFullCateIds: [],
    draftMeetIds: [],
    draftActiveTab: "",
    tabList: [],
    activeMeets: [],
    activeCateName: "",
    activeCateFull: false,
    draftAllChecked: false,
    draftCountText: "",
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
        this._refreshDraftView();
        // 编辑已限定范围的卡时，预加载课程让列表即时呈现
        if (
          this.data.mode === "scope" &&
          (this.data.scopeMode === "meets" ||
            this.data.scopeMode === "categories")
        ) {
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

    // scope 面板打开即需要课程数据（列表/徽标依赖课程）
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
          this._syncScopeDesc();
          this._refreshDraftView();
        });
      } catch (e) {
        console.error("meet_category_picker load meets error:", e);
        this.setData({ meets: [], meetsLoaded: true });
      }
    },

    // ============ scope 草稿视图 ============

    // 面板打开时，把已提交范围反向转换为草稿
    _initDraft() {
      const mode = this.data.scopeMode || "all";
      let fullCateIds = [];
      let meetIds = [];
      if (mode === "all") {
        fullCateIds = (this.data.categories || []).map((c) => String(c.id));
      } else if (mode === "categories") {
        fullCateIds = (this.data.scopeCategoryIds || []).map(String);
      } else {
        meetIds = (this.data.scopeMeetIds || []).map(String);
      }
      this.setData({
        draftFullCateIds: fullCateIds,
        draftMeetIds: meetIds,
        draftActiveTab: "",
      });
      this._refreshDraftView();
    },

    // 从草稿派生 Tab 徽标 / 当前列表 / 汇总计数
    _buildDraftView() {
      if (this.data.mode !== "scope") return;
      const fullSet = new Set((this.data.draftFullCateIds || []).map(String));
      const selSet = new Set((this.data.draftMeetIds || []).map(String));
      const categories = this.data.categories || [];
      const meets = this.data.meets || [];
      const cateIds = new Set(categories.map((c) => String(c.id)));

      // 分类 → 课程映射；未分类课程只在「全部」Tab 平铺
      const meetsByCate = new Map();
      const uncategorized = [];
      meets.forEach((m) => {
        const tid = String(m.typeId || "");
        if (cateIds.has(tid)) {
          if (!meetsByCate.has(tid)) meetsByCate.set(tid, []);
          meetsByCate.get(tid).push(m);
        } else {
          uncategorized.push(m);
        }
      });

      // Tab：全部 + 各分类（徽标实时反馈：整类 / 已选数）
      let totalSelected = 0;
      const tabList = [
        { typeId: "", typeName: "全部", full: false, badge: "" },
      ];
      categories.forEach((c) => {
        const tid = String(c.id);
        const list = meetsByCate.get(tid) || [];
        const full = fullSet.has(tid);
        const part = full
          ? 0
          : list.filter((m) => selSet.has(String(m.id))).length;
        totalSelected += full ? list.length : part;
        tabList.push({
          typeId: tid,
          typeName: c.name,
          full,
          badge: full ? "整类" : part ? String(part) : "",
        });
      });
      totalSelected += uncategorized.filter((m) =>
        selSet.has(String(m.id)),
      ).length;

      // 当前 Tab 的课程列表
      const activeTab = this.data.draftActiveTab || "";
      const source =
        activeTab === ""
          ? meets
          : meets.filter((m) => String(m.typeId || "") === activeTab);
      const activeMeets = source.map((m) => ({
        id: String(m.id),
        name: m.name,
        typeId: String(m.typeId || ""),
        selected:
          fullSet.has(String(m.typeId || "")) || selSet.has(String(m.id)),
      }));

      const activeCate = categories.find((c) => String(c.id) === activeTab);
      this.setData({
        tabList,
        activeMeets,
        activeCateName: activeCate ? activeCate.name : "",
        activeCateFull: activeCate ? fullSet.has(activeTab) : false,
        draftAllChecked: meets.length > 0 && totalSelected === meets.length,
        draftCountText: totalSelected ? `（${totalSelected}门）` : "",
      });
    },

    // 课程/分类异步加载完成后，若面板开着则重建草稿视图
    _refreshDraftView() {
      if (!this.data.sheetShow || this.data.mode !== "scope") return;
      this._buildDraftView();
    },

    // 确定按钮：把草稿归一化为最简 scope 再提交
    _applyScope(mode, categoryIds, meetIds) {
      const scope = { mode, categoryIds, meetIds };
      const desc = cardScopeHelper.buildScopeDesc(
        scope,
        this.data.categories,
        this.data.meets,
      );
      // 本地先同步属性（页面回传前，field 文案即时更新）
      this.setData(
        {
          scopeMode: mode,
          scopeCategoryIds: (categoryIds || []).map(String),
          scopeMeetIds: (meetIds || []).map(String),
          scopeDescText: desc,
        },
        () => this._syncFieldDisplay(),
      );
      this.triggerEvent("scopeChange", {
        mode,
        categoryIds: (categoryIds || []).slice(),
        meetIds: (meetIds || []).slice(),
        desc,
      });
    },

    // ============ 事件 ============

    bindFieldTap() {
      if (this.data.loading) {
        wx.showToast({ title: "加载中，请稍候", icon: "none" });
        return;
      }
      // single 模式仍需分类；scope 模式树依赖课程，不强制有分类
      if (this.data.mode === "single" && !this.data.categories.length) {
        wx.showToast({
          title: "请先在「我的门店」配置分类",
          icon: "none",
        });
        return;
      }
      if (this.data.mode === "scope") {
        this._initDraft();
        this._ensureMeets();
      }
      this.setData({ sheetShow: true });
    },

    // 弹窗关闭/遮罩 = 丢弃草稿
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

    // 切换分类 Tab（typeId 为空串 = 「全部」）
    bindTabTap(e) {
      const raw = e.currentTarget.dataset.typeId;
      const typeId = raw === undefined || raw === null ? "" : String(raw);
      if (typeId === (this.data.draftActiveTab || "")) return;
      this.setData({ draftActiveTab: typeId });
      this._buildDraftView();
    },

    // 「全部课程」总开关：所有分类整类 + 未分类课程全选 / 全部清空
    bindDraftAllToggle() {
      if (this.data.draftAllChecked) {
        this.setData({ draftFullCateIds: [], draftMeetIds: [] });
        this._buildDraftView();
        return;
      }
      const fullCateIds = (this.data.categories || []).map((c) => String(c.id));
      const cateIds = new Set(fullCateIds);
      const meetIds = (this.data.meets || [])
        .filter((m) => !cateIds.has(String(m.typeId || "")))
        .map((m) => String(m.id));
      this.setData({ draftFullCateIds: fullCateIds, draftMeetIds: meetIds });
      this._buildDraftView();
    },

    // 「整个分类」快捷行：切换整类适用（取消时该分类课程一并清空）
    bindDraftGroupToggle(e) {
      const raw = e.currentTarget.dataset.typeId;
      if (raw === undefined || raw === null) return;
      const typeId = String(raw);
      if (!typeId) return;
      const groupMeetIds = (this.data.meets || [])
        .filter((m) => String(m.typeId || "") === typeId)
        .map((m) => String(m.id));
      if (this.data.draftFullCateIds.includes(typeId)) {
        this.setData({
          draftFullCateIds: this.data.draftFullCateIds.filter(
            (x) => x !== typeId,
          ),
          draftMeetIds: this.data.draftMeetIds.filter(
            (x) => !groupMeetIds.includes(x),
          ),
        });
      } else {
        this.setData({
          draftFullCateIds: this.data.draftFullCateIds.concat(typeId),
          draftMeetIds: this.data.draftMeetIds.filter(
            (x) => !groupMeetIds.includes(x),
          ),
        });
      }
      this._buildDraftView();
    },

    // 勾单课：整类分类下取消某课 → 该分类降级为散选（其余课程保持选中）
    bindDraftMeetToggle(e) {
      const id = String(e.currentTarget.dataset.id || "");
      const typeId = String(e.currentTarget.dataset.typeId || "");
      if (!id) return;

      if (typeId && this.data.draftFullCateIds.includes(typeId)) {
        const otherIds = (this.data.meets || [])
          .filter(
            (m) => String(m.typeId || "") === typeId && String(m.id) !== id,
          )
          .map((m) => String(m.id));
        this.setData({
          draftFullCateIds: this.data.draftFullCateIds.filter(
            (x) => x !== typeId,
          ),
          draftMeetIds: this.data.draftMeetIds.concat(otherIds),
        });
      } else {
        let meetIds = this.data.draftMeetIds.slice();
        const idx = meetIds.indexOf(id);
        if (idx >= 0) meetIds.splice(idx, 1);
        else meetIds.push(id);
        this.setData({ draftMeetIds: meetIds });
      }
      this._buildDraftView();
    },

    // 取消：丢弃草稿直接关闭
    bindSheetCancel() {
      this.setData({ sheetShow: false });
    },

    // 确定：草稿归一化为最简 scope 后写回表单
    // 覆盖全部课程 → all；纯整类 → categories；含散选 → meets（整类展开为具体课程）
    bindSheetConfirm() {
      const fullIds = this.data.draftFullCateIds.slice();
      let meetIds = this.data.draftMeetIds.slice();
      if (!fullIds.length && !meetIds.length) {
        wx.showToast({ title: "请至少选择 1 门课程", icon: "none" });
        return;
      }
      if (this.data.draftAllChecked) {
        this._applyScope("all", [], []);
      } else if (!meetIds.length) {
        this._applyScope("categories", fullIds, []);
      } else {
        const fullSet = new Set(fullIds);
        (this.data.meets || [])
          .filter((m) => fullSet.has(String(m.typeId || "")))
          .forEach((m) => {
            const mid = String(m.id);
            if (!meetIds.includes(mid)) meetIds.push(mid);
          });
        this._applyScope("meets", [], meetIds);
      }
      this.setData({ sheetShow: false });
    },
  },
});
