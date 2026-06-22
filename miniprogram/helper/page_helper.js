/**
 * Notes: 通用页面操作类库
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux@qq.com
 * Date: 2020-11-14 07:48:00
 */

const helper = require("./helper.js");
const setting = require("../setting/setting.js");
const cacheHelper = require("./cache_helper.js");
const picHelper = require("./pic_helper.js");
const CACHE_SKIN = "SKIN_PID";
const CACHE_TENANT = "CACHE_TENANT";
const CACHE_TENANT_INFO = "CACHE_TENANT_INFO";
const CACHE_TEMPLATE = "CACHE_TENANT_TEMPLATE";
const tenantPages = require("../projects/page_registry.js");
const skinDefault = require("../pages/default/skin/skin.js");
const skinA00 = require("../projects/A00/skin/skin.js");
const themeHelper = require("./theme_helper.js");

const SKIN_MAP = {
  default: skinDefault,
  A00: skinA00,
};

/** 获取当前租户页面模板 ID */
function getTemplate() {
  return cacheHelper.get(CACHE_TEMPLATE) || "default";
}

/** 获取当前租户主题色（优先租户配置，否则皮肤默认） */
function getThemeColor() {
  const tenant = getTenantInfo();
  if (tenant && tenant.TENANT_THEME_COLOR) {
    return themeHelper.normalizeHex(tenant.TENANT_THEME_COLOR);
  }
  const template = getTemplate();
  const skin = SKIN_MAP[template] || skinDefault;
  return themeHelper.normalizeHex(skin.NAV_BG);
}

/** 获取当前皮肤配置（NAV_BG 已合并租户主题色） */
function getSkin() {
  const template = getTemplate();
  const base = SKIN_MAP[template] || skinDefault;
  const themeColor = getThemeColor();
  return Object.assign({}, base, { NAV_BG: themeColor });
}

/** 设置租户上下文（PID + 模板） */
function setTenant(pid, template) {
  let tenantInfo = null;
  if (typeof pid === "object" && pid !== null) {
    tenantInfo = pid;
    template = pid.TENANT_TEMPLATE || pid.template || "default";
    pid = pid._pid || pid.pid;
  }
  const prev = getTenantInfo() || {};
  cacheHelper.set(CACHE_TENANT, pid, 86400 * 365);
  cacheHelper.set(CACHE_TEMPLATE, template || "default", 86400 * 365);
  cacheHelper.set(
    CACHE_TENANT_INFO,
    tenantInfo ||
      Object.assign({}, prev, {
        _pid: pid,
        TENANT_TEMPLATE: template || prev.TENANT_TEMPLATE || "default",
      }),
    86400 * 365,
  );
  themeHelper.applyMemberThemeGlobal();
}

/** 会员端 Tab 首页（须在 app.json tabBar 中注册） */
const MEMBER_TAB_HOME = "/pages/default/index/default_index";

function refreshMemberTabBar(selected = 0) {
  syncMemberTabBar(selected);
}

/** 从当前 Tab 页获取 custom-tab-bar 实例 */
function getMemberTabBar(page) {
  if (page && typeof page.getTabBar === "function") {
    const tabBar = page.getTabBar();
    if (tabBar) return tabBar;
  }
  const pages = getCurrentPages();
  const cur = pages.length ? pages[pages.length - 1] : null;
  if (cur && typeof cur.getTabBar === "function") {
    return cur.getTabBar() || null;
  }
  return null;
}

/** 会员 Tab 页显式同步底部栏选中索引 */
function syncMemberTabBar(selected = 0, page) {
  const index = Number(selected);
  if (Number.isNaN(index) || index < 0) return;
  try {
    const tabBar = getMemberTabBar(page);
    if (!tabBar) return;
    tabBar.setData({ hidden: false, selected: index });
    if (typeof tabBar.refreshTabs === "function") {
      tabBar.refreshTabs(index);
    }
  } catch (e) {
    console.warn("[syncMemberTabBar]", e);
  }
}

/** 切换租户后回到会员 Tab 首页，并恢复底部栏 */
function goMemberTabHome() {
  wx.switchTab({
    url: MEMBER_TAB_HOME,
    success() {
      wx.nextTick(() => {
        const pages = getCurrentPages();
        const page = pages.length ? pages[pages.length - 1] : null;
        syncMemberTabBar(0, page);
      });
    },
    fail(err) {
      console.error("[goMemberTabHome] switchTab fail", err);
      wx.reLaunch({
        url: MEMBER_TAB_HOME,
        success() {
          wx.nextTick(() => {
            const pages = getCurrentPages();
            const page = pages.length ? pages[pages.length - 1] : null;
            syncMemberTabBar(0, page);
          });
        },
      });
    },
  });
}

/** 设置当前选中的租户PID（多租户模式） */
function setPID(pid, template) {
  setTenant(pid, template);
}

/** 清除当前租户上下文 */
function clearPID() {
  cacheHelper.remove(CACHE_TENANT);
  cacheHelper.remove(CACHE_TENANT_INFO);
  cacheHelper.remove(CACHE_TEMPLATE);
}

function getPID() {
  if (setting.PID) return setting.PID;

  let tenantPid = cacheHelper.get(CACHE_TENANT);
  if (tenantPid) return tenantPid;

  return "";
}

function getTenantInfo() {
  return cacheHelper.get(CACHE_TENANT_INFO) || null;
}

/** 合并租户信息到缓存（不触发全局主题刷新，供顶栏组件拉取详情用） */
function mergeTenantInfo(tenantInfo) {
  if (!tenantInfo || typeof tenantInfo !== "object") return;
  const prev = getTenantInfo() || {};
  if (tenantInfo._pid) {
    cacheHelper.set(CACHE_TENANT, tenantInfo._pid, 86400 * 365);
  }
  if (tenantInfo.TENANT_TEMPLATE) {
    cacheHelper.set(
      CACHE_TEMPLATE,
      tenantInfo.TENANT_TEMPLATE,
      86400 * 365,
    );
  }
  cacheHelper.set(
    CACHE_TENANT_INFO,
    Object.assign({}, prev, tenantInfo),
    86400 * 365,
  );
}

function getTenantName() {
  const tenant = getTenantInfo();
  if (tenant?.TENANT_NAME) return tenant.TENANT_NAME;
  const pid = getPID();
  return pid || "选择瑜伽馆";
}

/** 当前租户课程分类配置（优先门店配置，否则皮肤默认） */
function getMeetTypeStr() {
  return require("./meet_category_helper.js").getMeetTypeStr();
}

/** 约课分类 Tab（会员端/教练端共用解析逻辑） */
function getMeetCategories(allLabel = "全部课程") {
  return require("./meet_category_helper.js").getMeetCategories(allLabel);
}

/** 标准化页面相对路径，如 index/default_index */
function normalizePagePath(url) {
  let path = url.split("?")[0];
  if (!path.startsWith("/")) path = "/" + path;
  path = path.slice(1);

  if (path.startsWith("pages/default/")) {
    return path.slice("pages/default/".length);
  }
  if (path.startsWith("pages/")) {
    return path.slice("pages/".length);
  }
  if (path.startsWith("projects/")) {
    return path.replace(/^projects\/[^/]+\//, "");
  }
  return path;
}

/** 全局页面（不参与租户路由） */
function isGlobalPage(url) {
  return (
    url.indexOf("/pages/public/") >= 0 ||
    url.indexOf("/pages/admin/") >= 0 ||
    url.indexOf("/pages/coach/") >= 0 ||
    url.indexOf("/pages/tenant/") >= 0 ||
    url.indexOf("pages/public/") === 0 ||
    url.indexOf("pages/admin/") === 0 ||
    url.indexOf("pages/coach/") === 0 ||
    url.indexOf("pages/tenant/") === 0
  );
}

/** 本地图片路径标准化（兼容种子数据里的相对路径） */
function fmtImgUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (
    url.indexOf("cloud://") >= 0 ||
    url.indexOf("http://") >= 0 ||
    url.indexOf("https://") >= 0
  ) {
    return url;
  }
  if (url.startsWith("/")) return url;
  const imgIdx = url.indexOf("images/");
  if (imgIdx >= 0) return "/" + url.slice(imgIdx);
  return url;
}

/** 将 ../../xxx 相对路径解析为以 / 开头的绝对小程序路径 */
function resolveRelativePageUrl(url) {
  if (!url || (!url.includes("../") && !url.startsWith("./"))) {
    return url;
  }

  const pages = getCurrentPages();
  if (!pages.length) return url;

  const route = pages[pages.length - 1].route || "";
  const dirParts = route.split("/");
  dirParts.pop();

  const query = url.includes("?") ? "?" + url.split("?").slice(1).join("?") : "";
  const pathOnly = url.split("?")[0];

  for (const part of pathOnly.split("/")) {
    if (part === "..") dirParts.pop();
    else if (part && part !== ".") dirParts.push(part);
  }

  return "/" + dirParts.join("/") + query;
}

/** 根据租户模板解析页面 URL */
function fmtURLByPID(url) {
  if (!url) return url;

  if (url.includes("../") || url.startsWith("./")) {
    url = resolveRelativePageUrl(url);
  }

  if (isGlobalPage(url)) {
    return url.startsWith("/") ? url : "/" + url;
  }

  const query = url.includes("?") ? "?" + url.split("?").slice(1).join("?") : "";
  const pagePath = normalizePagePath(url);
  const template = getTemplate();
  const customPages = tenantPages[template] || [];
  const isCustom = customPages.some(
    (p) => pagePath === p || pagePath.startsWith(p + "/"),
  );

  if (isCustom && template !== "default") {
    return `/projects/${template}/${pagePath}${query}`;
  }
  return `/pages/default/${pagePath}${query}`;
}

function getCurrentPageURL() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return `/${currentPage.route}`;
}

function setSkin(skin) {
  cacheHelper.set(CACHE_SKIN, skin, 86400 * 365);
}

/** 定时器销毁 */
function clearTimer(that, timerName = "timer") {
  if (helper.isDefined(that.data[timerName])) {
    clearInterval(that.data[timerName]);
  }
}

/**
 *  获取父页面
 * @param {*} deep  1=当前 2=父页 3=父父页
 */
function getPrevPage(deep = 2) {
  let pages = getCurrentPages();
  let prevPage = pages[pages.length - deep]; //上一个页面
  return prevPage;
}

/**
 * 修改当前/父页面的某个列表节点
 * @param {*} id 主键
 * @param {*} valName 被修改的字段名
 * @param {*} val  被修改的值
 * @param {*} list   数据集
 * @param {*} idName 主键名
 */
function modifyListNode(id, list, valName, val, idName = "_id") {
  if (!list || !Array.isArray(list)) return false;
  let pos = list.findIndex((item) => item[idName] === id);
  if (pos > -1) {
    list[pos][valName] = val;
    return true;
  }
  return false;
}

/**
 * 修改当前/父页面的某个列表节点(单个值)
 * @param {*} id 主键
 * @param {*} valName 被修改的字段名
 * @param {*} val  被修改的值
 * @param {*} deep  1=当前 2=父页 3=父父页
 * @param {*} listName   数据集名
 * @param {*} idName 主键名
 */
function modifyPrevPageListNode(
  id,
  valName,
  val,
  deep = 2,
  listName = "dataList",
  idName = "_id",
) {
  let prevPage = getPrevPage(deep);
  if (!prevPage) return;

  let dataList = prevPage.data[listName];
  if (!dataList) return;

  let list = dataList["list"];
  if (modifyListNode(id, list, valName, val, idName)) {
    prevPage.setData({
      [listName + ".list"]: list,
    });
  }
}

/**
 * 修改当前/父页面的某个列表节点(一组值)
 * @param {*} id 主键
 * @param {*} valName 被修改的字段名
 * @param {*} val  被修改的值
 * @param {*} deep  1=当前 2=父页 3=父父页
 * @param {*} listName   数据集名
 * @param {*} idName 主键名
 */
function modifyPrevPageListNodeObject(
  id,
  vals,
  deep = 2,
  listName = "dataList",
  idName = "_id",
) {
  let prevPage = getPrevPage(deep);
  if (!prevPage) return;

  let dataList = prevPage.data[listName];
  if (!dataList) return;

  let list = dataList["list"];

  for (let k in vals) {
    modifyListNode(id, list, k, vals[k], idName);
  }

  prevPage.setData({
    [listName + ".list"]: list,
  });
}

/**
 * 从记录数组里删除某个节点
 * @param {*} id
 * @param {*} list
 * @param {*} idName
 */
function delListNode(id, list, idName = "_id") {
  if (!list || !Array.isArray(list)) return false;
  let pos = list.findIndex((item) => item[idName] === id);
  if (pos > -1) {
    list.splice(pos, 1);
    return true;
  }
  return false;
}

/**
 * 删除当前/父页面的某个列表节点
 * @param {*} id 主键
 * @param {*} deep 1=当前 2=父页 3=父父页
 * @param {*} listName  数据集名
 * @param {*} idName  主键名
 */
function delPrevPageListNode(
  id,
  deep = 2,
  listName = "dataList",
  idName = "_id",
) {
  let prevPage = getPrevPage(deep);
  let dataList = prevPage.data[listName];
  if (!dataList) return;

  let list = dataList["list"];
  let total = dataList["total"] - 1;
  if (delListNode(id, list, idName)) {
    prevPage.setData({
      [listName + ".list"]: list,
      [listName + ".total"]: total,
    });
  }
}

/**
 * 刷新当前/父页面的某个列表节点
 * @param {*} deep  1=当前 2=父页 3=父父页
 * @param {*} listName  数据集名
 * @param {*} listFunc  翻页函数名
 */
async function refreshPrevListNode(
  deep = 2,
  listName = "dataList",
  listFunc = "_getList",
) {
  let prevPage = getPrevPage(deep);
  let dataList = prevPage.data[listName];
  if (!dataList) return;
  await prevPage[listFunc]();
}

/**
 * 回到顶部测算
 */
function scrollTop(e, that) {
  if (e.scrollTop > 100) {
    that.setData({
      topShow: true,
    });
  } else {
    that.setData({
      topShow: false,
    });
  }
}

/**
 * 选择图片
 * @param {*} that
 * @param {*} max  最大上传上限
 * @param {*} imgListName  图片数组名
 */
function chooseImage(that, max = 4, imgListName = "imgList") {
  wx.chooseImage({
    count: max, //默认9
    sizeType: ["compressed"], //可以指定是原图还是压缩图，默认二者都有
    sourceType: ["album", "camera"], //从相册选择
    success: async (res) => {
      that.setData({
        [imgListName]: that.data[imgListName].concat(res.tempFilePaths),
      });
    },
  });
}

/**
 * 删除图片
 * @param {*} that
 * @param {*} idx  被删除图片索引
 * @param {*} imgListName  图片数组名
 */
function delImage(that, idx, imgListName = "imgList") {
  let callback = function () {
    that.data[imgListName].splice(idx, 1);
    that.setData({
      [imgListName]: that.data[imgListName],
    });
  };
  showConfirm("确定要删除该图片吗？", callback);
}

/**
 * 图片预览
 * @param {*} that
 * @param {*} url
 * @param {*} imgListName  图片数组名
 */
function previewImage(that, url, imgListName = "imgList") {
  // 图片预览
  wx.previewImage({
    urls: that.data[imgListName],
    current: url,
  });
}

/**
 * 取得data-数据 去掉驼峰式命名，改成纯小写式命名
 * @param {*} e
 * @param {*} name
 * @param {*} child  是否获取穿透子元素的data-
 */
function dataset(e, name, child = false) {
  if (!child) return e.currentTarget.dataset[name];
  else return e.target.dataset[name];
}

// 表单的双向数据绑定
function model(that, e) {
  let item = e.currentTarget.dataset.item;
  that.setData({
    [item]: e.detail.value,
  });
}

// 表单的开关按钮数据绑定 mode=int/bool
function switchModel(that, e, mode = "int") {
  let item = e.currentTarget.dataset.item;
  let sel = e.detail.value ? 1 : 0;

  if (mode == "bool") {
    sel = e.detail.value ? true : false;
  }

  that.setData({
    [item]: sel,
  });
}

// 无提示成功，同时做后续处理, 最多可显示两行
function showNoneToast(title = "操作完成", duration = 1500, callback) {
  return wx.showToast({
    title: title,
    icon: "none",
    duration: duration,
    mask: true,
    success: function () {
      callback &&
        setTimeout(() => {
          callback();
        }, duration);
    },
  });
}

// 无提示成功，返回
function showNoneToastReturn(title = "操作完成", duration = 2000) {
  let callback = function () {
    wx.navigateBack({
      delta: 0,
    });
  };
  return showNoneToast(title, duration, callback);
}

// 错误提示成功，同时做后续处理, 最多显示7个汉字长度
function showErrToast(title = "操作失败", duration = 1500, callback) {
  return wx.showToast({
    title: title,
    icon: "error",
    duration: duration,
    mask: true,
    success: function () {
      callback &&
        setTimeout(() => {
          callback();
        }, duration);
    },
  });
}

// 加载中，同时做后续处理, 最多显示7个汉字长度
function showLoadingToast(title = "加载中", duration = 1500, callback) {
  return wx.showToast({
    title: title,
    icon: "loading",
    duration: duration,
    mask: true,
    success: function () {
      callback &&
        setTimeout(() => {
          callback();
        }, duration);
    },
  });
}

// 提示成功，同时做后续处理, 最多显示7个汉字长度
function showSuccToast(title = "操作成功", duration = 1500, callback) {
  return wx.showToast({
    title: title,
    icon: "success",
    duration: duration,
    mask: true,
    success: function () {
      callback &&
        setTimeout(() => {
          callback();
        }, duration);
    },
  });
}

// 提示成功，同时返回
function showSuccToastReturn(title = "操作成功", duration = 1500) {
  let callback = function () {
    wx.navigateBack({
      delta: 0,
    });
  };
  return showSuccToast(title, duration, callback);
}

// 清理提示焦点
function formClearFocus(that) {
  let data = that.data;
  let focus = {};
  for (let key in data) {
    if (key.startsWith("form") && !key.endsWith("Focus"))
      focus[key + "Focus"] = null;
  }
  that.setData({
    ...focus,
  });
}

// 焦点提示
function formHint(that, formName, hint) {
  that.setData({
    [formName + "Focus"]: hint,
  });
  return showModal(hint);
}

// 编辑或者添加设置标题
function formSetBarTitleByAddEdit(id, title) {
  ((title = id ? title + "编辑" : title + "添加"),
    wx.setNavigationBarTitle({
      title,
    }));
}

// 二次确认操作
function showConfirm(title = "确定要删除吗？", yes, no) {
  return wx.showModal({
    title: "",
    content: title,
    cancelText: "取消",
    confirmText: "确定",
    success: (res) => {
      if (res.confirm) {
        yes && yes();
      } else if (res.cancel) {
        no && no();
      }
    },
  });
}

function showModal(
  content,
  title = "温馨提示",
  callback = null,
  confirmText = null,
) {
  return wx.showModal({
    title,
    content: content,
    confirmText: confirmText || "确定",
    showCancel: false,
    success(res) {
      callback && callback();
    },
  });
}

/**
 * 页面赋值
 * @param {*} that
 * @param {*} data
 */
function setPageData(that, data) {
  // 删除页面保留数据
  if (helper.isDefined(data["__webviewId__"])) delete data["__webviewId__"];

  that.setData(data);
}
/**
 * 配合搜索列表响应监听
 * @param {*} that
 */
function commListListener(that, e) {
  if (helper.isDefined(e.detail.search))
    that.setData({
      search: "",
      sortType: "",
    });
  else {
    that.setData({
      dataList: e.detail.dataList,
    });
    if (e.detail.sortType)
      that.setData({
        sortType: e.detail.sortType,
      });
  }
}

function bindShowModalTap(e) {
  this.setData({
    modalName: e.currentTarget.dataset.modal,
  });
}

function bindHideModalTap(e) {
  this.setData({
    modalName: null,
  });
}

/**
 * 控制回页首按钮
 * @param {*} e
 */
function showTopBtn(e, that) {
  if (e.scrollTop > 100) {
    that.setData({
      topBtnShow: true,
    });
  } else {
    that.setData({
      topBtnShow: false,
    });
  }
}

/**
 * 回到顶部
 */
function top() {
  wx.pageScrollTo({
    scrollTop: 0,
  });
}

// 跳到锚点
function anchor(id, that) {
  let query = wx.createSelectorQuery().in(that);
  query.selectViewport().scrollOffset();
  //#comm 跳转到指定id位置
  query.select("#" + id).boundingClientRect();

  query.exec(function (res) {
    if (!res || res.length != 2 || !res[0] || !res[1]) return;
    //第一个为视图，第二个为当前id

    let miss = res[0].scrollTop + res[1].top - 10;
    wx.pageScrollTo({
      scrollTop: miss,
      duration: 300,
    });
  });
}

// 页面跳转/图片预览
function url(e, that) {
  let url =
    (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.url) ||
    (e.target && e.target.dataset && e.target.dataset.url) ||
    (e.mark && e.mark.url) ||
    "";
  let type =
    (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.type) ||
    (e.target && e.target.dataset && e.target.dataset.type) ||
    "";
  if (!type) type = "url";

  switch (type) {
    case "picker": {
      //picker 选择trigger
      let item = e.currentTarget.dataset.item;
      that.setData({
        [item]: e.detail,
      });
      break;
    }
    case "map":
    case "location": {
      wx.getLocation({
        type: "gcj02", //返回可以用于wx.openLocation的经纬度
        success(res) {
          if (url) res = url;
          const latitude = res.latitude;
          const longitude = res.longitude;
          const name = res.name;
          const address = res.address;
          wx.openLocation({
            latitude,
            longitude,
            name,
            address,
            scale: 14,
          });
        },
      });
      break;
    }
    case "top": {
      top();
      break;
    }
    case "mini": {
      wx.navigateToMiniProgram({
        appId: e.currentTarget.dataset.app,
        path: url,
        envVersion: "release",
      });
      break;
    }
    case "out": {
      wx.navigateTo({
        url:
          "/pages/public/web_article?url=" + encodeURIComponent(url),
      });
      break;
    }
    case "redirect": {
      if (!url) return;
      url = fmtURLByPID(url);
      wx.redirectTo({
        url,
      });
      break;
    }
    case "reLaunch":
    case "relaunch": {
      if (!url) return;
      url = fmtURLByPID(url);
      wx.reLaunch({
        url,
      });
      break;
    }
    case "copy": {
      wx.setClipboardData({
        data: url,
        success(res) {
          wx.getClipboardData({
            success(res) {
              showNoneToast("已复制到剪贴板");
            },
          });
        },
      });
      break;
    }
    case "hint": {
      if (!url) return;
      showModal(url);
      break;
    }
    case "switch": {
      if (!url) return;
      wx.switchTab({
        url,
      });
      break;
    }
    case "back": {
      wx.navigateBack({
        delta: 0,
      });
      break;
    }
    case "toURL": {
      toURL(url);
      break;
    }
    case "phone": {
      wx.makePhoneCall({
        phoneNumber: url,
      });
      break;
    }
    case "anchor": {
      anchor(url, that);
      break;
    }
    case "saveimg":
    case "saveimage": {
      let callback = function () {
        wx.saveImageToPhotosAlbum({
          //成功之后保存到本地
          filePath: url, //生成的图片的本地路径
          success: function (res) {
            wx.showToast({
              title: e.currentTarget.dataset.hint || "保存成功",
              icon: "none",
              duration: 2000,
            });
          },
          fail: function (err) {
            console.log(err);
          },
        });
      };

      picHelper.getWritePhotosAlbum(callback);
      break;
    }
    case "bool": {
      //正反
      that.setData({
        [url]: !that.data[url],
      });
      break;
    }
    case "img":
    case "image": {
      if (url.indexOf("qlogo") > -1) {
        //微信大图
        url = url.replace("/132", "/0");
      }
      let urls = [url];

      if (helper.isDefined(e.currentTarget.dataset.imgs))
        urls = e.currentTarget.dataset.imgs;

      wx.previewImage({
        current: url, // 当前显示图片的http链接
        urls,
      });
      break;
    }
    default:
      if (!url) return;
      url = fmtURLByPID(url);
      wx.navigateTo({
        url,
      });
  }
}

function getOptions(that, options, idName = "id") {
  let id = options[idName];
  if (!id) return false;

  that.setData({
    [idName]: id,
  });
  return true;
}

// 页面提示
function hint(msg, type = "redirect") {
  const url =
    "/pages/public/hint?type=9&msg=" + encodeURIComponent(msg);
  if (type == "reLaunch") wx.reLaunch({ url });
  else wx.redirectTo({ url });
}

// 跳转操作，找到页面中的目标，出栈后面的 delta=1为上一页面
function toURL(url) {
  let pages = getCurrentPages();
  for (let k in pages) {
    if (pages[k].route.includes(url)) {
      wx.navigateBack({
        delta: pages.length - k - 1,
      });
      return;
    }
  }

  wx.redirectTo({
    url,
  });
}

/** ListTouch触摸开始 */
function listTouchStart(e, that) {
  that.setData({
    touchX: e.touches[0].pageX,
  });
}

/** ListTouch计算方向 */
function listTouchMove(e, that, precision = 50) {
  if (that.data.touchX - e.touches[0].pageX > precision) {
    that.setData({
      touchDirection: "left",
    });
  } else if (that.data.touchX - e.touches[0].pageX < -precision) {
    that.setData({
      touchDirection: "right",
    });
  }
}

/** ListTouch计算滚动 */
function listTouchEnd(e, that) {
  if (that.data.touchDirection == "left") {
    that.setData({
      touchCur: e.currentTarget.dataset.idx,
    });
  } else {
    that.setData({
      touchCur: null,
    });
  }

  that.setData({
    touchDirection: null,
  });
}

/**
 * 多条件复合查询条件
 * @param {*} e
 * @param {*} key 查询键值
 * @param {*} val  查询值
 * @param {*} def  键值的数据类型(int,str,float)
 */
function queryMulti(that, e, key, val, def) {
  key = helper.isDefined(key) ? key : dataset(e, "key");
  val = helper.isDefined(val) ? val : dataset(e, "val");
  def = helper.isDefined(def) ? def : dataset(e, "def");

  // 类型转换
  if (def == "int") {
    val = parseInt(val);
  } else if (def == "float") {
    val = parseFloat(val);
  } else if (def == "str") {
    val = val.toString();
  }

  let _params = that.data._params;
  _params.query[key] = val;
  that.setData({
    _params,
  });
}

/**
 * 页面缓存
 * @param {*} key
 * @param {*} that
 * @param {*} listKey  数据项KEY
 */
function cacheListExist(key, that, listKey = "list") {
  const bizHelper = require("../biz/biz_helper.js");
  return bizHelper.isCacheList(key) && that.data && that.data[listKey];
}

function cacheListRemove(key) {
  require("../biz/biz_helper.js").removeCacheList(key);
}

function cacheListSet(key, time = setting.CACHE_LIST_TIME) {
  require("../biz/biz_helper.js").setCacheList(key, time);
}

module.exports = {
  setSkin,
  getSkin,
  getThemeColor,
  getTemplate,
  setTenant,
  setPID,
  clearPID,
  getPID,
  getTenantInfo,
  mergeTenantInfo,
  getTenantName,
  goMemberTabHome,
  refreshMemberTabBar,
  syncMemberTabBar,
  getMeetTypeStr,
  getMeetCategories,
  fmtImgUrl,
  fmtURLByPID,

  //### form
  formClearFocus,
  formHint,
  formSetBarTitleByAddEdit,

  //###
  dataset, //节点数据data-

  //### 节点操作
  getPrevPage,
  modifyListNode,
  modifyPrevPageListNode, //单个
  modifyPrevPageListNodeObject, //一组
  delListNode,
  delPrevPageListNode,
  refreshPrevListNode,

  scrollTop, //### 回顶部

  // ### 图片
  chooseImage,
  previewImage,
  delImage,

  //## 提示窗口
  showSuccToastReturn,
  showSuccToast,
  showErrToast,
  showNoneToast,
  showNoneToastReturn,
  showLoadingToast,
  showConfirm,
  showModal,
  setPageData,

  hint, //单独提示页

  commListListener, //组件监听

  bindShowModalTap,
  bindHideModalTap,
  showTopBtn,

  getOptions, //获取id或者其他参数

  model, // 双向数据绑定
  switchModel, //开关控件数据绑定

  top, // 回顶部事件
  url, // 跳转事件
  anchor, //锚点跳转事件

  toURL, //跳转操作

  //### 列表横向滑动
  listTouchStart,
  listTouchMove,
  listTouchEnd,

  //### 多条件复合查询
  queryMulti,

  clearTimer, //定时器销毁

  //LIST数据缓存
  cacheListExist,
  cacheListRemove,
  cacheListSet,
};
