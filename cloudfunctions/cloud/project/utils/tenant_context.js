/**
 * 请求级租户上下文。
 *
 * 云函数实例会复用，不能把 PID 保存在进程级可变变量中。AsyncLocalStorage
 * 能让同一实例中的并发请求各自读取自己的 PID。保留 global.PID 的访问器，
 * 以兼容现有服务代码，同时将读写限定到当前异步请求链。
 */
const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();
let fallbackPID = "";

function normalizePID(pid) {
  return String(pid || "").trim();
}

function runWithPID(pid, callback) {
  return storage.run({ pid: normalizePID(pid) }, callback);
}

function getPID() {
  const store = storage.getStore();
  return store ? store.pid : fallbackPID;
}

function setPID(pid) {
  const store = storage.getStore();
  if (store) store.pid = normalizePID(pid);
  else fallbackPID = normalizePID(pid);
}

const descriptor = Object.getOwnPropertyDescriptor(global, "PID");
if (!descriptor || !descriptor.get) {
  Object.defineProperty(global, "PID", {
    configurable: true,
    get: getPID,
    set: setPID,
  });
}

module.exports = {
  getPID,
  setPID,
  runWithPID,
};
