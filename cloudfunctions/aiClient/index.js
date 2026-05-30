/**
 * aiClient 云函数 — 公共 AI 调用组件
 * 实际逻辑已移至 cloudfunctions/common/aiProvider.js，
 * 此文件保留向后兼容的导出。
 */

const { callAI, PROVIDERS } = require('./aiProvider');

module.exports = {
  callAI,
  PROVIDERS
};
