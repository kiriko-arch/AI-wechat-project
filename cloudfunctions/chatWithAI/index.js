const cloud = require('wx-server-sdk');
const { callAI } = require('./aiProvider');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const chatHistory = event.history || [];
  const provider = event.provider || 'deepseek';

  const messages = [
    {
      role: 'system',
      content: '你是一个温柔贴心的AI学习管家。请用简短、友好的语言解答用户的疑问。回复不要太长，尽量像微信聊天一样精炼。'
    },
    ...chatHistory
  ];

  try {
    const aiReply = await callAI(messages, {
      provider,
      temperature: 0.7
    });

    return { success: true, reply: aiReply };
  } catch (error) {
    console.error('[chatWithAI] 调用失败:', error.code || error.message);

    // 按错误类型返回不同的友好提示
    const fallbackMessages = {
      NETWORK_ERROR: '网络不太稳定，请稍后再试哦~',
      API_ERROR: 'AI 服务暂时繁忙，请稍后再问~',
      UNKNOWN_PROVIDER: '模型配置有误，请检查设置',
      EMPTY_RESPONSE: 'AI 没有返回内容，请换个方式再问一次'
    };

    return {
      success: false,
      reply: fallbackMessages[error.code] || '抱歉，我刚刚开小差了，请你重新说一遍好吗？'
    };
  }
};
