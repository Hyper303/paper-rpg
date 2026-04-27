import asyncio
import json
from models.llm_client import LLMClient
from prompts import load_prompt

npc_client = LLMClient(provider="deepseek", model="deepseek-chat")


def _get_world_obj(world_bible: dict) -> dict:
    return world_bible.get("world", world_bible)


def _get_npcs(world_bible: dict) -> list:
    # Try common key names the model might use
    for key in ("npcs", "characters", "npc_list", "NPCs"):
        val = world_bible.get(key)
        if isinstance(val, list):
            return val
    return []


async def generate_single_npc(npc_spec: dict, world_bible: dict, player_level: str) -> dict:
    world_obj = _get_world_obj(world_bible)
    author_npc = world_bible.get("author_npc", {})
    is_author = npc_spec.get("type") == "C"
    exam_hint = (
        json.dumps(author_npc.get("exam_questions", []), ensure_ascii=False)
        if is_author else "（此NPC不负责考察玩家）"
    )
    world_summary = (
        f"{world_obj.get('world_name', '')}：{world_obj.get('fundamental_conflict', '')}"
    )

    system = load_prompt("npc_template.txt").format(
        world_name=world_obj.get("world_name", "Unknown World"),
        npc_name=npc_spec.get("name", "Unknown"),
        npc_type=npc_spec.get("type", "B"),
        real_reference=npc_spec.get("real_reference", ""),
        personality=npc_spec.get("personality", ""),
        knowledge_domain=npc_spec.get("knowledge_domain", ""),
        role_in_story=npc_spec.get("role_in_story", ""),
        quest_given=npc_spec.get("quest_given", "无特定任务"),
        player_level=player_level,
        exam_questions_hint=exam_hint,
        world_bible_summary=world_summary,
    )

    user = (
        "请生成这个NPC的完整设定，包括：\n"
        "1. opening_line：开场白（玩家第一次与NPC对话时看到的话，50字以内）\n"
        "2. knowledge_points：核心知识点列表（3-5个，每个包含name和explanation）\n"
        "3. sample_qa：3个常见问题和回答示例（每个包含question和answer）\n"
        "输出JSON格式。"
    )
    result = npc_client.chat_json(system, user)
    npc_id = npc_spec.get("npc_id", f"npc_{npc_spec.get('name', 'unknown')}")
    return {"npc_id": npc_id, **npc_spec, "generated": result}


async def spawn_npcs(world_bible: dict, player_level: str = "intermediate") -> list:
    print(f"[npc_spawner] world_bible top-level keys: {list(world_bible.keys())}")
    npc_specs = _get_npcs(world_bible)
    print(f"[npc_spawner] found {len(npc_specs)} NPCs")
    if not npc_specs:
        return []

    tasks = [generate_single_npc(spec, world_bible, player_level) for spec in npc_specs]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    npcs = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            spec = npc_specs[i]
            npcs.append({**spec, "npc_id": spec.get("npc_id", f"npc_{i}"), "generated": {"error": str(r)}})
        else:
            npcs.append(r)
    return npcs
