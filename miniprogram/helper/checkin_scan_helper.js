const pageHelper = require("./page_helper.js");
const cloudHelper = require("./cloud_helper.js");

async function submitLocationCheckin(timeMark, location) {
  const res = await cloudHelper.callCloudSumbit(
    "my/my_join_checkin",
    {
      timeMark,
      mode: "location",
      latitude: location.latitude,
      longitude: location.longitude,
    },
    { title: "签到中" },
  );
  return (res && res.data && res.data.ret) || "签到完成";
}

function locationCheckin(options = {}) {
  const requestLocation = () => wx.getLocation({
    type: "gcj02",
    isHighAccuracy: true,
    success: async (location) => {
      try {
        const msg = await submitLocationCheckin(options.timeMark, location);
        if (typeof options.onSuccess === "function") options.onSuccess(msg);
      } catch (err) {
        if (typeof options.onFail === "function") options.onFail(err);
      }
    },
    fail: (err) => {
      pageHelper.showModal("无法获取当前位置，请在设置中允许微信访问位置信息");
      if (typeof options.onFail === "function") options.onFail(err);
    },
  });

  const openLocationSetting = () => wx.openSetting({
    success: (res) => {
      if (res.authSetting && res.authSetting["scope.userLocation"] === true) {
        requestLocation();
      }
    },
  });

  wx.getSetting({
    success: (setting) => {
      const auth = setting.authSetting || {};
      const scope = "scope.userLocation";
      if (auth[scope] === true) {
        requestLocation();
        return;
      }
      if (auth[scope] === undefined) {
        wx.authorize({
          scope,
          success: requestLocation,
          fail: () => pageHelper.showModal(
            "需要授权位置信息才能进行到店签到，请点击确定后允许微信访问位置",
            "位置权限",
            openLocationSetting,
          ),
        });
        return;
      }
      pageHelper.showModal(
        "位置权限已关闭，请点击确定打开设置并允许微信访问位置信息",
        "位置权限",
        openLocationSetting,
      );
    },
    fail: () => requestLocation(),
  });
}

module.exports = {
  submitLocationCheckin,
  locationCheckin,
};
