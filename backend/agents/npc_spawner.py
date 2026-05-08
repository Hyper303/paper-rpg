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
        if is_author else "(This NPC is not responsible for testing the player)"
    )
    world_summary = (
        f"{world_obj.get('world_name', '')}: {world_obj.get('fundamental_conflict', '')}"
    )

    system = load_prompt("npc_template.txt").format(
        world_name=world_obj.get("world_name", "Unknown World"),
        npc_id=npc_spec.get("npc_id", "npc_unknown"),
        npc_name=npc_spec.get("name", "Unknown"),
        npc_type=npc_spec.get("type", "B"),
        real_reference=npc_spec.get("real_reference", ""),
        personality=npc_spec.get("personality", ""),
        knowledge_domain=npc_spec.get("knowledge_domain", ""),
        role_in_story=npc_spec.get("role_in_story", ""),
        quest_given=npc_spec.get("quest_given", "No specific quest"),
        quest_type=npc_spec.get("quest_type", "knowledge"),
        quest_target_npc_name=npc_spec.get("quest_target_npc_name", ""),
        quest_target_topic=npc_spec.get("quest_target_topic", ""),
        quest_target_npc_id=npc_spec.get("quest_target_npc", ""),
        quest_spot_name=npc_spec.get("quest_spot_name", ""),
        player_level=player_level,
        exam_questions_hint=exam_hint,
        world_bible_summary=world_summary,
    )

    user = (
        "Generate the complete profile for this NPC, including:\n"
        "1. opening_line: Opening line (what the player sees the first time they talk to this NPC, under 50 words)\n"
        "2. knowledge_points: List of core knowledge points (3-5 items, each with a name and explanation)\n"
        "3. sample_qa: 3 sample questions and answers (each with a question and answer)\n"
        "Output in JSON format."
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
