from models.llm_client import LLMClient
from prompts import load_prompt

npc_runtime_client = LLMClient(provider="deepseek", model="deepseek-chat")


async def run_npc_turn(
    npc_data: dict,
    message: str,
    history: list[dict],
    player_profile: dict,
    world_bible: dict,
) -> str:
    world_obj = world_bible.get("world", world_bible)
    world_summary = (
        f"{world_obj.get('world_name', '')}：{world_obj.get('fundamental_conflict', '')}"
    )

    import json
    author_npc = world_bible.get("author_npc", {})
    is_author = npc_data.get("type") == "C"
    exam_hint = (
        json.dumps(author_npc.get("exam_questions", []), ensure_ascii=False)
        if is_author else "（此NPC不负责考察玩家）"
    )

    system = load_prompt("npc_template.txt").format(
        world_name=world_obj.get("world_name", "Unknown World"),
        npc_name=npc_data.get("name", "Unknown"),
        npc_type=npc_data.get("type", "B"),
        real_reference=npc_data.get("real_reference", ""),
        personality=npc_data.get("personality", ""),
        knowledge_domain=npc_data.get("knowledge_domain", ""),
        role_in_story=npc_data.get("role_in_story", ""),
        quest_given=npc_data.get("quest_given", "无特定任务"),
        player_level=player_profile.get("background", "intermediate"),
        exam_questions_hint=exam_hint,
        world_bible_summary=world_summary,
    )

    messages = []
    for turn in history[-10:]:  # keep last 10 turns to limit tokens
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    return npc_runtime_client.chat_with_history(system, messages)
