/**
 * 微信资料同步：昵称、头像、手机号（手机选填）
 */
const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");
const cacheHelper = require("../helper/cache_helper.js");
const setting = require("../setting/setting.js");

const CACHE_USER_PROFILE = "CACHE_USER_PROFILE";
const CACHE_USER_PROFILE_TIME = 86400 * 365;

class UserProfileBiz {
  static displayAvatar(user) {
    if (user && user.USER_PIC) {
      return pageHelper.fmtImgUrl(user.USER_PIC) || "";
    }
    return "";
  }

  static async resolveAvatarUrl(url) {
    if (!url) return "";
    const formatted = pageHelper.fmtImgUrl(url);
    if (!formatted) return "";
    if (
      formatted.startsWith("http://") ||
      formatted.startsWith("https://") ||
      formatted.startsWith("wxfile://")
    ) {
      return formatted;
    }
    if (!formatted.startsWith("cloud://")) return formatted;

    try {
      const tempUrlTask = wx.cloud
        .getTempFileURL({ fileList: [formatted] })
        .catch((err) => {
          console.warn("[resolveAvatarUrl:getTempFileURL]", err);
          return null;
        });
      const res = await Promise.race([
        tempUrlTask,
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (!res) return formatted;
      const item = res.fileList && res.fileList[0];
      if (item && item.tempFileURL) return item.tempFileURL;
    } catch (err) {
      console.warn("[resolveAvatarUrl]", err);
    }
    return formatted;
  }

  static hasAvatar(user, localAvatar) {
    return !!(localAvatar || (user && user.USER_PIC));
  }

  static avatarSrc(user, localAvatar) {
    if (localAvatar) return localAvatar;
    return UserProfileBiz.displayAvatar(user);
  }

  static isReady(user) {
    return !!(user && user.USER_NAME);
  }

  static cacheUser(user) {
    if (user) {
      cacheHelper.set(CACHE_USER_PROFILE, user, CACHE_USER_PROFILE_TIME);
    }
  }

  static getCachedUser() {
    return cacheHelper.get(CACHE_USER_PROFILE) || null;
  }

  static mergeProfile(cloudUser, cachedUser) {
    if (!cloudUser && cachedUser) return cachedUser;
    if (!cachedUser) return cloudUser;
    if (!cloudUser) return cachedUser;

    return Object.assign({}, cachedUser, cloudUser, {
      USER_NAME: cloudUser.USER_NAME || cachedUser.USER_NAME || "",
      USER_MOBILE: cloudUser.USER_MOBILE || cachedUser.USER_MOBILE || "",
      USER_PIC: cloudUser.USER_PIC || cachedUser.USER_PIC || "",
    });
  }

  static async fetch() {
    const cached = UserProfileBiz.getCachedUser();
    const cloudUser = await cloudHelper.callCloudData(
      "passport/my_detail",
      {},
      { hint: false },
    );
    const user = UserProfileBiz.mergeProfile(cloudUser, cached);
    if (user && (user.USER_NAME || user.USER_PIC || user.USER_MOBILE)) {
      UserProfileBiz.cacheUser(user);
    }
    return user;
  }

  static showPhoneAuthHint(errMsg) {
    let content =
      "开发者工具里通常无法完成手机号授权，请用「预览」扫码在真机上操作。";
    if (errMsg && errMsg.includes("deny")) {
      content = "您已拒绝授权手机号，可稍后在「我的」页再次绑定。";
    }
    wx.showModal({
      title: "手机号授权",
      content,
      showCancel: false,
    });
  }

  static async syncPhoneFromEvent(e) {
    if (!e || !e.detail) return null;

    const detail = e.detail;
    if (detail.errMsg !== "getPhoneNumber:ok") {
      UserProfileBiz.showPhoneAuthHint(detail.errMsg || "");
      return null;
    }

    const params = {};
    if (detail.code) params.code = detail.code;
    else if (detail.cloudID) params.cloudID = detail.cloudID;
    else {
      wx.showToast({ title: "未获取到手机号凭证", icon: "none" });
      return null;
    }

    const res = await cloudHelper.callCloudSumbit(
      "passport/sync_profile",
      params,
      { title: "授权中" },
    );
    const user = res.data || null;
    if (user) UserProfileBiz.cacheUser(user);
    return user;
  }

  static async syncName(name) {
    const val = (name || "").trim();
    if (!val) return null;

    const res = await cloudHelper.callCloudSumbit(
      "passport/sync_profile",
      { name: val },
      { hint: false },
    );
    const user = res.data || null;
    if (user) UserProfileBiz.cacheUser(user);
    return user;
  }

  static async syncAvatar(tempPath) {
    if (!tempPath) return null;

    let pic = tempPath;
    const needUpload =
      tempPath.includes("tmp") ||
      tempPath.includes("temp") ||
      tempPath.includes("wxfile");

    if (needUpload) {
      pic = await cloudHelper.transTempPicOne(
        tempPath,
        setting.USER_PIC_PATH || "user/pic/",
        "",
        false,
      );
    }

    if (!pic) {
      throw new Error("头像上传失败");
    }

    const res = await cloudHelper.callCloudSumbit(
      "passport/sync_profile",
      { pic },
      { title: "保存中" },
    );
    const user = res.data || null;
    if (user) UserProfileBiz.cacheUser(user);
    return user;
  }

  static promptGoMyTab(content) {
    wx.showModal({
      title: "温馨提示",
      content: content || "请先在「我的」页填写微信昵称",
      confirmText: "去填写",
      cancelText: "取消",
      success(res) {
        if (res.confirm) {
          wx.switchTab({
            url: "/pages/default/my/index/my_index",
          });
        }
      },
    });
  }

  static relaxPhoneRequired(fields) {
    return fields.map((field) => {
      const title = field.title || "";
      if (field.type === "mobile" || title.includes("手机")) {
        return Object.assign({}, field, { must: false });
      }
      return field;
    });
  }
}

module.exports = UserProfileBiz;
