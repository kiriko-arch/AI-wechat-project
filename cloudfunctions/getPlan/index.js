const cloud = require('wx-server-sdk');
const { callAI } = require('./aiProvider');
const { buildStudyPlanJson, validateStudyPlan } = require('./planParser');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const SYSTEM_PROMPT = `你是一个专业的学习规划助手。请根据用户目标返回严格 JSON，不要输出 Markdown 代码块、解释文字或多余前后缀。

必须返回以下结构：
{
  "title": "计划标题，2-50字",
  "weekly_tasks": ["本周任务1", "本周任务2"],
  "daily_tasks": ["每日任务1", "每日任务2"],
  "suggestions": "补充建议，0-500字",
  "bilibili_resources": [
    {
      "type": "video",
      "title": "推荐视频标题或博主名",
      "author": "UP主名称，可为空",
      "url": "哔哩哔哩链接，建议为视频页或UP主页链接",
      "reason": "为什么推荐，2-120字"
    }
  ]
}

额外且严格的要求：
1. bilibili_resources 必须返回 1 到 3 条。必须提供真实的、具体的 B站搜索关键词 或 具体的 UP主名字。
2. bilibili_resources 中的 url 绝对不要伪造 BV 号或具体视频链接，因为你无法验证其真实性。请统一使用B站的搜索链接格式：
   - 如果是推荐视频或知识点，url 必须为：https://search.bilibili.com/all?keyword=具体的搜索词 (请将搜索词进行 URL 编码处理)
   - 如果是推荐UP主，url 必须为：https://search.bilibili.com/upuser?keyword=UP主名字 (请将名字进行 URL 编码处理)
3. daily_tasks 必须是【每天都要重复执行】的打卡任务，绝对不要按天排期（禁止出现"首日"、"次日"、"第X天"）。
4. daily_tasks 主要是用来给用户打卡用的（如：背诵20个单词，观看本计划推荐的视频1集）。
5. 任务要具体、简短、可执行，适合学生自学场景。`;

exports.main = async (event) => {
  const userGoal = event.goal || '未输入目标';
  const requestId = `${cloud.getWXContext().ENV}-${Date.now()}`;

  console.log(`[${requestId}] 收到学习计划请求，目标: ${userGoal}`);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `我的学习目标是：${userGoal}` }
  ];

  try {
    const rawText = await callAI(messages, {
      provider: 'deepseek',
      temperature: 0.7
    });

    const planObj = buildStudyPlanJson(rawText);
    validateStudyPlan(planObj);

    console.log(`[${requestId}] 学习计划生成成功`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      plan: JSON.stringify(planObj, null, 2)
    };
  } catch (error) {
    console.error(`[${requestId}] 学习计划生成失败:`, error.code || error.message);

    // planParser 抛出的格式校验错误
    if (error.code === 400) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        plan: JSON.stringify({ error: '数据格式校验失败', details: error.message }, null, 2)
      };
    }

    // AI 调用层错误：按类型返回不同提示
    const errorMessages = {
      NETWORK_ERROR: '网络不稳定，请稍后重试',
      API_ERROR: 'AI 服务暂时繁忙，请稍后重试',
      EMPTY_RESPONSE: 'AI 未返回有效计划，请换个学习目标再试',
      UNKNOWN_PROVIDER: '模型配置异常，请联系管理员'
    };
    const friendlyMsg = errorMessages[error.code] || '生成计划失败，请稍后再试';

    return {
      statusCode: error.status || 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      plan: JSON.stringify({ error: friendlyMsg, details: error.message }, null, 2)
    };
  }
};
