import asyncio
from models.llm_client import LLMClient
from prompts import load_prompt

director_client = LLMClient(provider="deepseek", model="deepseek-chat")

_EXTRACT_PROMPT = """\
你是RPG游戏世界设计师。根据以下论文分析，填写游戏设计JSON模板。
直接输出JSON对象，不要任何解释文字，不要markdown代码块。

输出格式（严格按照此结构，不要增删字段）：
{
  "world": {
    "world_name": "游戏世界名称（2-4个字，有史诗感）",
    "fundamental_conflict": "世界根本矛盾（把论文技术问题升华为世界危机，一句话）",
    "historical_timeline": [
      {"era": "时代名", "reference_paper": "对应引用文献", "description": "历史描述"}
    ],
    "current_crisis": "当前危机（2-3句，论文发表前的黑暗时刻）",
    "victory_condition": "胜利条件（评估指标具象化，一句话）",
    "tone": "epic"
  },
  "narrative_type": "method",
  "acts": [
    {
      "act_id": 1,
      "name": "章节名",
      "paper_section": "Introduction",
      "game_role": "世界观建立",
      "area_name": "区域名",
      "area_type": "town",
      "main_quest": "主线任务描述",
      "side_quests": ["支线任务"],
      "unlock_condition": "start"
    }
  ],
  "npcs": [
    {
      "npc_id": "npc_001",
      "type": "A",
      "name": "NPC名",
      "real_reference": "对应真实论文/人物",
      "location_act": 1,
      "role_in_story": "故事角色",
      "personality": "性格",
      "knowledge_domain": "知识领域",
      "quest_given": "给玩家的任务",
      "unlock_condition": "start"
    }
  ],
  "boss": {
    "name": "Boss名",
    "represents": "代表的旧方法/baseline",
    "battle_mechanic": "combat",
    "weakness": "论文核心创新点"
  },
  "author_npc": {
    "name": "作者游戏名",
    "personality": "性格",
    "exam_questions": [
      {"question": "考察问题", "difficulty": "intermediate", "key_concepts": ["概念"]}
    ]
  },
  "map_hints": {
    "geography_type": "two_continents",
    "special_landmark": "标志性地点"
  },
  "freedom_notes": "设计说明"
}

填写规则：
- acts：4-8个，每个对应论文一个章节，第一个unlock_condition="start"，其余="previous_act_complete"
- npcs：3-5个A类（引用文献作者）+ 3-4个B类（论文核心概念）+ 1个C类（论文作者）
- C类NPC的unlock_condition="boss_defeated"
- area_type只能是：town/ruins/temple/arena/forge/library/abyss
- tone只能是：epic/mystery/adventure/philosophical
- narrative_type只能是：method/theory/system/survey
"""


async def run_director(paper_text: str, questionnaire: dict) -> dict:
    system_prompt = load_prompt("director.txt")

    step1_user = (
        f"玩家背景：{questionnaire['background']}，"
        f"偏好：{questionnaire['preference']}，"
        f"时间：{questionnaire['time']}，"
        f"目标：{questionnaire['goal']}\n\n"
        f"论文内容：\n{paper_text[:60000]}"
    )

    # Step 1: free analysis (run in thread so it doesn't block the event loop)
    analysis = await asyncio.to_thread(
        director_client.chat, str(system_prompt), step1_user
    )
    print(f"[director] step1 done, length={len(analysis)}")

    # Step 2: single JSON extraction — one call, all fields at once
    raw_text = await asyncio.to_thread(
        director_client.chat,
        _EXTRACT_PROMPT,
        f"论文分析：\n{analysis[:8000]}\n\n请填写JSON模板，直接输出JSON。"
    )
    print(f"[director] step2 raw (first 300): {raw_text[:300]}")
    from models.llm_client import _extract_json
    result = _extract_json(raw_text)
    print(f"[director] step2 done: world={result.get('world', {}).get('world_name')}, "
          f"acts={len(result.get('acts', []))}, npcs={len(result.get('npcs', []))}")
    return result
