const pageHelper = require("./page_helper.js");
const cloudHelper = require("./cloud_helper.js");

function parseTimeMarkFromScan(res) {
  if (!res) return "";

  if (res.path) {
    const path = decodeURIComponent(res.path);
    const sceneMatch = path.match(/[?&]scene=([^&]+)/);
    if (sceneMatch && sceneMatch[1]) {
      return decodeURIComponent(sceneMatch[1]);
    }
    const markMatch = path.match(/[?&](?:timeMark|mark)=([^&]+)/);
    if (markMatch && markMatch[1]) {
      return decodeURIComponent(markMatch[1]);
    }
  }

  const raw = (res.result || "").trim();
  if (raw.startsWith("T") && raw.length >= 10) {
    return raw;
  }

  return "";
}

async function submitSelfCheckin(timeMark) {
  const res = await cloudHelper.callCloudSumbit(
    "my/my_join_checkin",
    { timeMark },
    { title: "签到中" },
  );
  return (res && res.data && res.data.ret) || "签到完成";
}

function scanAndCheckin(options = {}) {
  const { onSuccess, onFail } = options;

  wx.scanCode({
    onlyFromCamera: false,
    scanType: ["wxCode", "qrCode"],
    success: async (res) => {
      const timeMark = parseTimeMarkFromScan(res);
      if (!timeMark) {
        pageHelper.showModal("请扫描场馆出示的签到小程序码");
        if (typeof onFail === "function") onFail();
        return;
      }
      try {
        const msg = await submitSelfCheckin(timeMark);
        if (typeof onSuccess === "function") {
          onSuccess(msg);
        } else {
          pageHelper.showModal(msg, "签到结果");
        }
      } catch (err) {
        console.error(err);
        if (typeof onFail === "function") onFail(err);
      }
    },
    fail: (err) => {
      if (err && err.errMsg && err.errMsg.includes("cancel")) {
        return;
      }
      pageHelper.showModal("扫码失败，请重试");
      if (typeof onFail === "function") onFail(err);
    },
  });
}

module.exports = {
  parseTimeMarkFromScan,
  submitSelfCheckin,
  scanAndCheckin,
};
