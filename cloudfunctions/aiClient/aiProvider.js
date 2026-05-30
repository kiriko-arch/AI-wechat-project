/**
 * AI 模型调用公共模块
 * 所有云函数统一通过此模块调用大模型，避免 PROVIDERS 和 callAI 多处复制
 *
 * 部署注意：微信云函数需要从 cloudfunctions 根目录上传，common 目录会被随函数目录一起打包。
 * 若遇到 require 找不到模块，在开发者工具中右键 cloudfunctions 目录 → 上传所有云函数。
 */

const axios = require('axios');

// === 模型提供商配置（唯一数据源） ===

// 密钥请替换为你自己的 API Key，从对应平台控制台获取
const PROVIDERS = {
  deepseek: {
    API_KEY: 'YOUR_DEEPSEEK_API_KEY',
    BASE_URL: 'https://api.deepseek.com/chat/completions',
    MODEL: 'deepseek-chat'
  },
  hunyuan: {
    API_KEY: 'YOUR_HUNYUAN_API_KEY',
    BASE_URL: 'https://tokenhub.tencentmaas.com/v1/chat/completions',
    MODEL: 'hunyuan-2.0-thinking-20251109'
  },
  zhipu: {
    API_KEY: 'YOUR_ZHIPU_API_KEY',
    BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    MODEL: 'glm-4-flash'
  }
};

const DEFAULT_PROVIDER = 'deepseek';
const DEFAULT_TIMEOUT = 55000;
const DEFAULT_TEMPERATURE = 0.7;
const MAX_RETRIES = 1;

/**
 * AI 调用错误类，携带分类信息方便上层针对性处理
 */
class AIError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'AIError';
    this.code = code;    // 'UNKNOWN_PROVIDER' | 'NETWORK_ERROR' | 'API_ERROR' | 'EMPTY_RESPONSE'
    this.status = status; // HTTP 状态码
  }
}

/**
 * 统一的大模型调用接口
 * @param {Array}  messages - OpenAI 格式的对话数组
 * @param {Object} options   - { provider, model, temperature, timeout, stream }
 * @returns {Promise<string>} AI 文本回复
 */
async function callAI(messages, options = {}) {
  const providerKey = options.provider || DEFAULT_PROVIDER;
  const providerConfig = PROVIDERS[providerKey];

  if (!providerConfig) {
    throw new AIError(
      `未知的 AI 提供商: ${providerKey}`,
      'UNKNOWN_PROVIDER',
      400
    );
  }

  const data = {
    model: options.model || providerConfig.MODEL,
    messages,
    temperature: options.temperature != null ? options.temperature : DEFAULT_TEMPERATURE,
    stream: options.stream || false
  };

  const timeout = options.timeout || DEFAULT_TIMEOUT;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(providerConfig.BASE_URL, data, {
        headers: {
          'Authorization': `Bearer ${providerConfig.API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout
      });

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AIError('AI 返回了空内容', 'EMPTY_RESPONSE', 502);
      }
      return content;

    } catch (error) {
      lastError = error;

      // 网络/超时类错误，且还有重试次数，则重试
      if (!error.response && attempt < MAX_RETRIES) {
        console.warn(`[AIProvider] ${providerKey} 第 ${attempt + 1} 次调用失败，准备重试...`);
        continue;
      }

      // API 返回了错误响应
      if (error instanceof AIError) {
        throw error;
      }

      const errMsg = error.response?.data?.error?.message || error.message || '大模型服务调用失败';
      const errStatus = error.response?.status || (error.code === 'ECONNABORTED' ? 504 : 500);
      const errCode = error.response ? 'API_ERROR' : 'NETWORK_ERROR';

      console.error(`[AIProvider] ${providerKey} 调用失败:`, errMsg);
      throw new AIError(errMsg, errCode, errStatus);
    }
  }

  throw new AIError(
    lastError?.message || '大模型服务调用失败',
    'NETWORK_ERROR',
    504
  );
}

module.exports = {
  PROVIDERS,
  callAI,
  AIError,
  DEFAULT_PROVIDER,
  DEFAULT_TIMEOUT
};
