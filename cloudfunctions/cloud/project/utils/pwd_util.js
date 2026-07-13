/**
 * 管理员密码哈希（SHA256 + salt）
 */
const crypto = require("crypto");

const HASH_PREFIX = "sha256:";

function hashPwd(pwd, salt) {
  const raw = String(pwd || "") + String(salt || "");
  return (
    HASH_PREFIX +
    crypto.createHash("sha256").update(raw).digest("hex")
  );
}

function isHashed(pwd) {
  return typeof pwd === "string" && pwd.startsWith(HASH_PREFIX);
}

function verifyPwd(pwd, stored, salt) {
  if (!stored) return false;
  if (isHashed(stored)) {
    return hashPwd(pwd, salt) === stored;
  }
  return String(pwd) === String(stored);
}

function hashNewPwd(pwd, salt) {
  const s = salt || crypto.randomBytes(8).toString("hex");
  return {
    ADMIN_PWD: hashPwd(pwd, s),
    ADMIN_PWD_SALT: s,
  };
}

module.exports = {
  hashPwd,
  isHashed,
  verifyPwd,
  hashNewPwd,
};
