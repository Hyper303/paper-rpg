import asyncio
from models.llm_client import LLMClient
from prompts import load_prompt

director_client = LLMClient(provider="deepseek", model="deepseek-chat")

_EXTRACT_PROMPT = """\
You are an RPG game world designer. Based on the following paper analysis, fill in the game design JSON template.
Output the JSON object directly — no explanatory text, no markdown code blocks.

Output format (strictly follow this structure — do not add or remove fields):
{
  "world": {
    "world_name": "Game world name (2-4 words, epic in feel)",
    "fundamental_conflict": "The world's fundamental conflict (elevate the paper's technical problem into a world-level crisis, one sentence)",
    "historical_timeline": [
      {"era": "Era name", "reference_paper": "Corresponding reference paper", "description": "Historical description"}
    ],
    "current_crisis": "Current crisis (2-3 sentences, the dark moment before the paper was published)",
    "victory_condition": "Victory condition (a concrete in-world description of the evaluation metric, one sentence)",
    "tone": "epic"
  },
  "narrative_type": "method",
  "acts": [
    {
      "act_id": 1,
      "name": "Act name",
      "paper_section": "Introduction",
      "game_role": "World-building",
      "area_name": "Region name",
      "area_type": "town",
      "main_quest": "Main quest description",
      "side_quests": ["Side quest"],
      "unlock_condition": "start"
    }
  ],
  "npcs": [
    {
      "npc_id": "npc_001",
      "type": "A",
      "name": "NPC name",
      "real_reference": "Corresponding real paper/person",
      "location_act": 1,
      "role_in_story": "Story role",
      "personality": "Personality",
      "knowledge_domain": "Knowledge domain",
      "quest_given": "Quest given to the player",
      "unlock_condition": "start"
    }
  ],
  "boss": {
    "name": "Boss name",
    "represents": "The old method/baseline the boss represents",
    "battle_mechanic": "combat",
    "weakness": "The paper's core innovation"
  },
  "author_npc": {
    "name": "Author's in-game name",
    "personality": "Personality",
    "exam_questions": [
      {"question": "Exam question", "difficulty": "intermediate", "key_concepts": ["concept"]}
    ]
  },
  "map_hints": {
    "geography_type": "two_continents",
    "special_landmark": "Landmark location description"
  },
  "freedom_notes": "Design notes"
}

Fill-in rules:
- acts: 4-8 entries, each corresponding to one section of the paper; first act has unlock_condition="start", rest have "previous_act_complete"
- npcs: 3-5 Type A (reference paper authors) + 3-4 Type B (core paper concepts) + 1 Type C (paper author)
- Type C NPC unlock_condition="boss_defeated"
- area_type must be one of: town/ruins/temple/arena/forge/library/abyss
- tone must be one of: epic/mystery/adventure/philosophical
- narrative_type must be one of: method/theory/system/survey
"""


async def run_director(paper_text: str, questionnaire: dict) -> dict:
    system_prompt = load_prompt("director.txt")

    step1_user = (
        f"Player background: {questionnaire['background']}, "
        f"preference: {questionnaire['preference']}, "
        f"time: {questionnaire['time']}, "
        f"goal: {questionnaire['goal']}\n\n"
        f"Paper content:\n{paper_text[:60000]}"
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
        f"Paper analysis:\n{analysis[:8000]}\n\nPlease fill in the JSON template. Output JSON directly."
    )
    print(f"[director] step2 raw (first 300): {raw_text[:300]}")
    from models.llm_client import _extract_json
    result = _extract_json(raw_text)
    print(f"[director] step2 done: world={result.get('world', {}).get('world_name')}, "
          f"acts={len(result.get('acts', []))}, npcs={len(result.get('npcs', []))}")
    return result
