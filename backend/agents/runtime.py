import json
from models.llm_client import LLMClient
from prompts import load_prompt

runtime_client = LLMClient(provider="deepseek", model="deepseek-chat")


def _get_world_obj(world_bible: dict) -> dict:
    return world_bible.get("world", world_bible)


def _get_npcs(world_bible: dict) -> list:
    for key in ("npcs", "characters", "npc_list", "NPCs"):
        val = world_bible.get(key)
        if isinstance(val, list):
            return val
    return []


def _get_start_region(game_data: dict) -> str:
    map_data = game_data.get("map", {})
    special = map_data.get("special_locations", {})
    start = special.get("start")
    if start:
        return start
    # Fall back to first region in the list
    regions = map_data.get("regions", [])
    if regions:
        return regions[0].get("region_id", "r001")
    return "r001"


def _initial_state(game_data: dict) -> dict:
    world_bible = game_data.get("world_bible", {})
    first_region = _get_start_region(game_data)
    return {
        "current_region": first_region,
        "completed_quests": [],
        "unlocked_npcs": [
            npc.get("npc_id", "")
            for npc in _get_npcs(world_bible)
            if npc.get("unlock_condition") in ("start", "none", "", None)
        ],
        "unlocked_regions": [first_region],
        "recruited_npcs": [],
        "chat_histories": {},
        "boss_defeated": False,
        "author_exam_started": False,
        "game_complete": False,
    }


async def process_action(
    action: str,
    payload: dict,
    game_state: dict,
    game_data: dict,
) -> tuple[dict, dict]:
    world_bible = game_data.get("world_bible", {})
    world_obj = _get_world_obj(world_bible)
    world_summary = (
        f"{world_obj.get('world_name', '')}："
        f"{world_obj.get('fundamental_conflict', '')}"
    )

    system = load_prompt("runtime.txt").format(
        world_name=world_obj.get("world_name", "World"),
        game_state_json=json.dumps(game_state, ensure_ascii=False),
        world_bible_summary=world_summary,
    )

    user = f"玩家行为：{action}\n详情：{json.dumps(payload, ensure_ascii=False)}"
    result = runtime_client.chat_json(system, user)

    updates = result.get("state_updates", {})
    if updates.get("current_region"):
        game_state["current_region"] = updates["current_region"]
    for list_key in ("completed_quests", "unlocked_npcs", "unlocked_regions", "recruited_npcs"):
        if updates.get(list_key):
            game_state[list_key] = list(set(game_state[list_key] + updates[list_key]))

    event = result.get("event")
    if event == "boss_defeated":
        game_state["boss_defeated"] = True
    elif event == "author_exam":
        game_state["author_exam_started"] = True
    elif event == "game_complete":
        game_state["game_complete"] = True

    return game_state, result
