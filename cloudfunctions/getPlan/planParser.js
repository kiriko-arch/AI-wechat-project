/**
 * @typedef {Object} BilibiliResource
 * @property {"video"|"creator"} type
 * @property {string} title
 * @property {string} author
 * @property {string} url
 * @property {string} reason
 */

/**
 * @typedef {Object} StudyPlan
 * @property {string} title
 * @property {string[]} weekly_tasks
 * @property {string[]} daily_tasks
 * @property {string} suggestions
 * @property {BilibiliResource[]} bilibili_resources
 */

function cleanString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
}

function cleanArray(arr, minLen, maxLen) {
  if (!Array.isArray(arr)) return [];
  const cleaned = arr
    .map(cleanString)
    .filter((item) => item.length >= minLen && item.length <= maxLen);
  return [...new Set(cleaned)];
}

function cleanBilibiliResources(arr) {
  if (!Array.isArray(arr)) return [];

  const seen = new Set();
  const cleaned = [];

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;

    const type = cleanString(item.type).toLowerCase() === 'creator' ? 'creator' : 'video';
    const title = cleanString(item.title);
    const author = cleanString(item.author);
    const url = cleanString(item.url);
    const reason = cleanString(item.reason);

    if (title.length < 2 || title.length > 100) continue;
    if (author.length > 50) continue;
    if (url.length > 300) continue;
    if (reason.length < 2 || reason.length > 120) continue;

    const uniqueKey = `${type}|${title}|${author}|${url}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    cleaned.push({
      type,
      title,
      author,
      url,
      reason
    });
  }

  return cleaned.slice(0, 3);
}

function extractJson(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (error) {}

  try {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (error) {}

  return null;
}

/**
 * @param {string} rawText
 * @returns {StudyPlan}
 */
function buildStudyPlanJson(rawText) {
  let parsed = extractJson(rawText);

  if (!parsed) {
    parsed = {};
    const titleMatch = rawText.match(/"?title"?\s*:\s*["']([^"'\n]+)["']/i);
    if (titleMatch) parsed.title = titleMatch[1];
  }

  const result = {
    title: cleanString(parsed.title),
    weekly_tasks: cleanArray(parsed.weekly_tasks, 2, 100),
    daily_tasks: cleanArray(parsed.daily_tasks, 2, 100),
    suggestions: cleanString(parsed.suggestions),
    bilibili_resources: cleanBilibiliResources(parsed.bilibili_resources)
  };

  if (!result.title) result.title = '未命名学习计划';
  if (result.weekly_tasks.length === 0) result.weekly_tasks = ['请补充任务'];
  if (result.daily_tasks.length === 0) result.daily_tasks = ['请补充任务'];
  if (result.suggestions.length > 500) {
    result.suggestions = result.suggestions.substring(0, 500);
  }

  return result;
}

/**
 * @param {StudyPlan} obj
 * @returns {boolean}
 */
function validateStudyPlan(obj) {
  const errors = [];

  if (typeof obj.title !== 'string' || obj.title.length < 2 || obj.title.length > 50) {
    errors.push('title长度须在2-50之间');
  }
  if (!Array.isArray(obj.weekly_tasks) || obj.weekly_tasks.length < 1 || obj.weekly_tasks.length > 10) {
    errors.push('weekly_tasks长度须在1-10之间');
  }
  if (!Array.isArray(obj.daily_tasks) || obj.daily_tasks.length < 1 || obj.daily_tasks.length > 20) {
    errors.push('daily_tasks长度须在1-20之间');
  }
  if (typeof obj.suggestions !== 'string' || obj.suggestions.length > 500) {
    errors.push('suggestions长度须在0-500之间');
  }
  if (!Array.isArray(obj.bilibili_resources) || obj.bilibili_resources.length < 1 || obj.bilibili_resources.length > 3) {
    errors.push('bilibili_resources长度须在1-3之间');
  } else {
    for (const item of obj.bilibili_resources) {
      if (!item || typeof item !== 'object') {
        errors.push('bilibili_resources中的每一项必须是对象');
        break;
      }
      if (!['video', 'creator'].includes(item.type)) {
        errors.push('bilibili_resources.type 仅支持 video 或 creator');
        break;
      }
      if (typeof item.title !== 'string' || item.title.length < 2 || item.title.length > 100) {
        errors.push('bilibili_resources.title长度须在2-100之间');
        break;
      }
      if (typeof item.author !== 'string' || item.author.length > 50) {
        errors.push('bilibili_resources.author长度须在0-50之间');
        break;
      }
      if (typeof item.url !== 'string' || item.url.length > 300) {
        errors.push('bilibili_resources.url长度须在0-300之间');
        break;
      }
      if (typeof item.reason !== 'string' || item.reason.length < 2 || item.reason.length > 120) {
        errors.push('bilibili_resources.reason长度须在2-120之间');
        break;
      }
    }
  }

  if (errors.length > 0) {
    const err = new Error(`数据格式校验不通过: ${errors.join('; ')}`);
    err.code = 400;
    throw err;
  }

  return true;
}

module.exports = {
  cleanString,
  cleanArray,
  cleanBilibiliResources,
  buildStudyPlanJson,
  validateStudyPlan
};
