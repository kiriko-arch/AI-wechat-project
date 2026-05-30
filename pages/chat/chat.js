Page({
  data: {
    // 模型选择数据（增加 icon 路径）
    models: [
      { name: 'DeepSeek (深度求索)', value: 'deepseek', icon: '../../images/deepseek.png' },
      { name: '腾讯混元 (Tencent)', value: 'hunyuan', icon: '../../images/hunyuan.png' },
      { name: '智谱 GLM (Zhipu)', value: 'zhipu', icon: '../../images/zhipu.png' }
    ],
    modelIndex: 0, // 默认选中第一个 (DeepSeek)
    
    // 聊天记录数组
    messages: [
      {
        id: 'msg-0',
        role: 'ai', // 'ai' 代表机器人，'user' 代表用户
        content: '你好！我是你的 AI 学习管家，目前使用 DeepSeek (深度求索) 模型为您服务~'
      }
    ],
    inputText: '', // 输入框的内容
    scrollToMessage: '' // 用于控制滚动条滚到哪一条消息
  },

  // 切换模型
  onModelChange: function(e) {
    const index = e.detail.value;
    const selectedModelName = this.data.models[index].name;
    
    // 动态修改第一条欢迎语的内容
    const messages = this.data.messages;
    if (messages.length > 0 && messages[0].id === 'msg-0') {
      messages[0].content = `你好！我是你的 AI 学习管家，目前使用 ${selectedModelName} 模型为您服务~`;
    }

    this.setData({
      modelIndex: index,
      messages: messages
    });
    
    wx.showToast({
      title: `已切换至 ${selectedModelName}`,
      icon: 'none'
    });
  },

  // 监听输入框变化
  onInput: function(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  // 点击发送按钮
  sendMessage: function() {
    const text = this.data.inputText.trim();
    if (!text) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      });
      return;
    }

    const messages = this.data.messages;
    const newMsgId = 'msg-' + Date.now(); // 简单生成一个唯一 ID

    // 1. 把用户发的消息加入列表
    messages.push({
      id: newMsgId,
      role: 'user',
      content: text
    });

    // 2. 清空输入框，并更新消息列表
    this.setData({
      messages: messages,
      inputText: '',
      scrollToMessage: newMsgId // 让滚动条自动滚到最新消息
    });

    // 3. 呼叫真实的云函数处理 AI 回复
    this.requestRealAI();
  },

  // 呼叫真实的 AI 接口
  requestRealAI: function() {
    const that = this;
    const messages = this.data.messages;
    
    // 1. 先加入一条“思考中...”的假消息提示用户
    const loadingId = 'msg-loading';
    messages.push({
      id: loadingId,
      role: 'ai',
      content: '让我想想看哦...'
    });
    this.setData({
      messages: messages,
      scrollToMessage: loadingId
    });

    // 2. 提取最近的对话历史给大模型（最多带上最后 10 条消息作为记忆上下文）
    // 为了满足 API 的要求，只提取 role 和 content 两个字段
    const history = messages
      .filter(msg => msg.id !== loadingId) // 过滤掉假消息
      .map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user', // 大模型协议要求返回是 'assistant'
        content: msg.content
      }))
      .slice(-10); // 取最近10条

    // 3. 调用我们刚刚写好的云函数 chatWithAI，并传上选中的模型
    const selectedProvider = this.data.models[this.data.modelIndex].value;
    
    wx.cloud.callFunction({
      name: 'chatWithAI',
      data: {
        history: history,
        provider: selectedProvider
      }
    }).then(res => {
      // 成功拿到 AI 的真实回复
      const reply = res.result.reply;
      
      // 找到现在的列表，把那条“让我想想看哦...”删掉
      const currentMessages = that.data.messages.filter(msg => msg.id !== loadingId);
      const aiMsgId = 'msg-' + Date.now();
      
      // 把真正的回复加进去
      currentMessages.push({
        id: aiMsgId,
        role: 'ai',
        content: reply
      });
      
      that.setData({
        messages: currentMessages,
        scrollToMessage: aiMsgId
      });

    }).catch(err => {
      console.error("云函数调用失败:", err);
      // 如果报错，也删掉思考中，给个友好提示
      const currentMessages = that.data.messages.filter(msg => msg.id !== loadingId);
      currentMessages.push({
        id: 'msg-' + Date.now(),
        role: 'ai',
        content: '网络好像有点问题，请稍后再试哦~'
      });
      that.setData({ messages: currentMessages });
    });
  }
});