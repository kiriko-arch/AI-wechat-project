const { buildStudyPlanJson, validateStudyPlan } = require('../planParser');

describe('buildStudyPlanJson & validateStudyPlan', () => {
  test('parses a complete plan with bilibili resources', () => {
    const raw = `{
      "title": "三天英语定语从句提升计划",
      "weekly_tasks": ["梳理语法框架", "完成专项练习"],
      "daily_tasks": ["学习定语从句基础概念", "观看一条哔哩哔哩推荐视频并记录笔记"],
      "suggestions": "每天复盘 15 分钟。",
      "bilibili_resources": [
        {
          "type": "video",
          "title": "英语定语从句入门",
          "author": "语法研究所",
          "url": "https://www.bilibili.com/video/BV1abc123456",
          "reason": "适合快速建立基础概念。"
        }
      ]
    }`;

    const result = buildStudyPlanJson(raw);

    expect(result.title).toBe('三天英语定语从句提升计划');
    expect(result.weekly_tasks.length).toBe(2);
    expect(result.daily_tasks[1]).toContain('哔哩哔哩');
    expect(result.bilibili_resources).toHaveLength(1);
    expect(result.bilibili_resources[0].type).toBe('video');
    expect(() => validateStudyPlan(result)).not.toThrow();
  });

  test('extracts json from markdown response', () => {
    const raw = `好的，以下是你的计划：
\`\`\`json
{"title":"数学复习","weekly_tasks":["做题"],"daily_tasks":["看讲解视频"],"suggestions":"","bilibili_resources":[{"type":"creator","title":"宋浩老师","author":"","url":"https://space.bilibili.com/123456","reason":"适合系统复习高数。"}]}
\`\`\``;

    const result = buildStudyPlanJson(raw);

    expect(result.title).toBe('数学复习');
    expect(result.bilibili_resources[0].type).toBe('creator');
    expect(() => validateStudyPlan(result)).not.toThrow();
  });

  test('falls back when tasks are missing', () => {
    const raw = `{"suggestions": "坚持复盘"}`;
    const result = buildStudyPlanJson(raw);

    expect(result.title).toBe('未命名学习计划');
    expect(result.weekly_tasks).toEqual(['请补充任务']);
    expect(result.daily_tasks).toEqual(['请补充任务']);
  });

  test('deduplicates and cleans resource items', () => {
    const raw = `{
      "title": "Python 入门",
      "weekly_tasks": ["完成语法学习"],
      "daily_tasks": ["观看一条哔哩哔哩推荐视频"],
      "suggestions": "",
      "bilibili_resources": [
        {
          "type": "video",
          "title": " Python 基础语法 ",
          "author": "黑马程序员",
          "url": "https://www.bilibili.com/video/BV1x1",
          "reason": "适合零基础入门"
        },
        {
          "type": "video",
          "title": "Python 基础语法",
          "author": "黑马程序员",
          "url": "https://www.bilibili.com/video/BV1x1",
          "reason": "适合零基础入门"
        }
      ]
    }`;

    const result = buildStudyPlanJson(raw);

    expect(result.bilibili_resources).toHaveLength(1);
    expect(result.bilibili_resources[0].title).toBe('Python 基础语法');
  });

  test('rejects plans without bilibili resources', () => {
    const rawObj = {
      title: '缺少资源',
      weekly_tasks: ['任务A'],
      daily_tasks: ['任务B'],
      suggestions: '',
      bilibili_resources: []
    };

    expect(() => validateStudyPlan(rawObj)).toThrow(/bilibili_resources长度须在1-3之间/);
  });
});
