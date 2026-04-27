import asyncio
import json
from models.llm_client import LLMClient

map_client = LLMClient(provider="deepseek", model="deepseek-chat")

_MAP_PROMPT = """你是RPG游戏地图设计师。根据以下游戏设计数据，生成地图的JSON数据。

直接输出JSON，格式如下，不要任何解释：
{{
  "map_style": "pixel_2d",
  "world_size": "medium",
  "regions": [
    {{
      "region_id": "r001",
      "name": "区域名称",
      "act_id": 1,
      "area_type": "town",
      "terrain_description": "地形描述",
      "atmosphere": "氛围描述",
      "locked": false,
      "unlock_condition": "start",
      "npcs_here": ["npc_001"],
      "explorable_elements": [
        {{"element_id":"e001","type":"inscription","name":"元素名","content":"内容描述","position_in_region":"center"}}
      ],
      "connections": ["r002"]
    }}
  ],
  "special_locations": {{
    "start": "r001",
    "boss_arena": "r00X",
    "author_chamber": "r00Y"
  }}
}}

规则：
- 每个act对应一个region，共{act_count}个region
- area_type只能是：town/ruins/temple/arena/forge/library/abyss
- 第一个region：locked=false，unlock_condition="start"
- 其余region：locked=true，unlock_condition="previous_act_complete"
- npcs_here填该区域NPC的npc_id
- boss_arena是最后一个战斗区域，author_chamber是倒数第二个区域
"""


async def run_map(world_bible: dict, visual_style: str = "pixel_2d") -> dict:
    acts = world_bible.get("acts", [])
    npcs = world_bible.get("npcs", [])
    world_obj = world_bible.get("world", world_bible)

    # Build a structured summary — no ambiguous terms
    acts_summary = [
        {"act_id": a.get("act_id"), "name": a.get("name"), "area_type": a.get("area_type"),
         "area_name": a.get("area_name"), "paper_section": a.get("paper_section")}
        for a in acts
    ]
    npcs_summary = [
        {"npc_id": n.get("npc_id"), "name": n.get("name"), "type": n.get("type"),
         "location_act": n.get("location_act")}
        for n in npcs
    ]

    user = (
        f"游戏世界名：{world_obj.get('world_name', '')}\n"
        f"世界矛盾：{world_obj.get('fundamental_conflict', '')}\n\n"
        f"章节列表：\n{json.dumps(acts_summary, ensure_ascii=False)}\n\n"
        f"NPC列表：\n{json.dumps(npcs_summary, ensure_ascii=False)}\n\n"
        f"请生成地图JSON，直接输出JSON不要任何解释。"
    )

    system = _MAP_PROMPT.format(act_count=len(acts))
    raw = await asyncio.to_thread(map_client.chat_json, system, user)

    # Normalize
    regions = raw.get("regions", [])
    norm_regions = []
    for i, r in enumerate(regions):
        if not isinstance(r, dict):
            continue
        norm_regions.append({
            "region_id":           r.get("region_id") or f"r{i+1:03d}",
            "name":                r.get("name") or f"Region {i+1}",
            "act_id":              r.get("act_id") or i + 1,
            "area_type":           r.get("area_type") or "ruins",
            "terrain_description": r.get("terrain_description") or "",
            "atmosphere":          r.get("atmosphere") or "",
            "locked":              r.get("locked", i > 0),
            "unlock_condition":    r.get("unlock_condition") or ("start" if i == 0 else "previous_act_complete"),
            "npcs_here":           r.get("npcs_here") or [],
            "explorable_elements": r.get("explorable_elements") or [],
            "connections":         r.get("connections") or [],
        })

    special = raw.get("special_locations", {})
    start = special.get("start") or (norm_regions[0]["region_id"] if norm_regions else "r001")
    boss_arena = special.get("boss_arena") or (norm_regions[-1]["region_id"] if norm_regions else start)
    author_chamber = special.get("author_chamber") or boss_arena

    print(f"[map_agent] regions: {len(norm_regions)}")
    return {
        "map_style": "pixel_2d",
        "world_size": raw.get("world_size", "medium"),
        "regions": norm_regions,
        "special_locations": {"start": start, "boss_arena": boss_arena, "author_chamber": author_chamber},
    }
