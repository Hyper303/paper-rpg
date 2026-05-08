import asyncio
import json
from models.llm_client import LLMClient

map_client = LLMClient(provider="deepseek", model="deepseek-chat")

_MAP_PROMPT = """You are an RPG game map designer. Based on the following game design data, generate the map JSON data.

Output JSON directly in the format below — no explanations:
{{
  "map_style": "pixel_2d",
  "world_size": "medium",
  "regions": [
    {{
      "region_id": "r001",
      "name": "Region name",
      "act_id": 1,
      "area_type": "town",
      "terrain_description": "Terrain description",
      "atmosphere": "Atmosphere description",
      "locked": false,
      "unlock_condition": "start",
      "npcs_here": ["npc_001"],
      "explorable_elements": [
        {{"element_id":"e001","type":"inscription","name":"Element name","content":"Content description","position_in_region":"center"}}
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

Rules:
- One region per act, {act_count} regions total
- area_type must be one of: town/ruins/temple/arena/forge/library/abyss
- First region: locked=false, unlock_condition="start"
- All other regions: locked=true, unlock_condition="previous_act_complete"
- npcs_here lists the npc_id of every NPC in this region
- boss_arena is the last combat region; author_chamber is the second-to-last region
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
        f"Game world name: {world_obj.get('world_name', '')}\n"
        f"World conflict: {world_obj.get('fundamental_conflict', '')}\n\n"
        f"Act list:\n{json.dumps(acts_summary, ensure_ascii=False)}\n\n"
        f"NPC list:\n{json.dumps(npcs_summary, ensure_ascii=False)}\n\n"
        f"Please generate the map JSON. Output JSON directly with no explanations."
    )

    system = _MAP_PROMPT.format(act_count=len(acts))
    raw = await asyncio.to_thread(map_client.chat_json, system, user)

    # Build a lookup of exploration_spots per act_id from the world_bible
    act_spots = {}
    for act in acts:
        aid = act.get("act_id")
        spots = act.get("exploration_spots") or []
        act_spots[aid] = [
            {
                "element_id": f"spot_{aid}_{i}",
                "name": s.get("name", "Ruins"),
                "description": s.get("description", ""),
                "item_name": s.get("item_name", "Fragment"),
                "item_description": s.get("item_description", ""),
            }
            for i, s in enumerate(spots)
        ]

    # Normalize
    regions = raw.get("regions", [])
    norm_regions = []
    for i, r in enumerate(regions):
        if not isinstance(r, dict):
            continue
        act_id = r.get("act_id") or i + 1
        # Use director-defined exploration spots; fall back to map agent's explorable_elements
        spots_for_region = act_spots.get(act_id) or r.get("explorable_elements") or []
        norm_regions.append({
            "region_id":           r.get("region_id") or f"r{i+1:03d}",
            "name":                r.get("name") or f"Region {i+1}",
            "act_id":              act_id,
            "area_type":           r.get("area_type") or "ruins",
            "terrain_description": r.get("terrain_description") or "",
            "atmosphere":          r.get("atmosphere") or "",
            "locked":              r.get("locked", i > 0),
            "unlock_condition":    r.get("unlock_condition") or ("start" if i == 0 else "previous_act_complete"),
            "npcs_here":           r.get("npcs_here") or [],
            "explorable_elements": spots_for_region,
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
