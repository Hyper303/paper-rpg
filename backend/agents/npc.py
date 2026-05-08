from models.llm_client import LLMClient, _extract_json
from prompts import load_prompt

npc_runtime_client = LLMClient(provider="deepseek", model="deepseek-chat")


async def run_npc_turn(
    npc_data: dict,
    message: str,
    history: list[dict],
    player_profile: dict,
    world_bible: dict,
    extra_context: dict = {},
    force_complete: bool = False,
) -> dict:
    world_obj = world_bible.get("world", world_bible)
    world_summary = (
        f"{world_obj.get('world_name', '')}: {world_obj.get('fundamental_conflict', '')}"
    )

    import json
    author_npc = world_bible.get("author_npc", {})
    is_author = npc_data.get("type") == "C"
    exam_hint = (
        json.dumps(author_npc.get("exam_questions", []), ensure_ascii=False)
        if is_author else "(This NPC is not responsible for testing the player)"
    )

    quest_type = npc_data.get("quest_type", "knowledge")
    quest_target_npc_name = npc_data.get("quest_target_npc_name", "")
    quest_target_topic = npc_data.get("quest_target_topic", "")
    quest_target_npc_id = npc_data.get("quest_target_npc", "")
    quest_spot_name = npc_data.get("quest_spot_name", "")

    system = load_prompt("npc_template.txt").format(
        world_name=world_obj.get("world_name", "Unknown World"),
        npc_id=npc_data.get("npc_id", "npc_unknown"),
        npc_name=npc_data.get("name", "Unknown"),
        npc_type=npc_data.get("type", "B"),
        real_reference=npc_data.get("real_reference", ""),
        personality=npc_data.get("personality", ""),
        knowledge_domain=npc_data.get("knowledge_domain", ""),
        role_in_story=npc_data.get("role_in_story", ""),
        quest_given=npc_data.get("quest_given", "No specific quest"),
        quest_type=quest_type,
        quest_target_npc_name=quest_target_npc_name,
        quest_target_topic=quest_target_topic,
        quest_target_npc_id=quest_target_npc_id,
        quest_spot_name=quest_spot_name,
        player_level=player_profile.get("background", "intermediate"),
        exam_questions_hint=exam_hint,
        world_bible_summary=world_summary,
    )

    # Delivery task: inject target NPC conversation as context
    delivery_ctx = ""
    if extra_context.get("target_npc_history"):
        target_name = extra_context.get("target_npc_name", "Target NPC")
        turns = extra_context["target_npc_history"][-6:]
        summary = "\n".join(
            f"{'Player' if t['role']=='user' else target_name}: {t['content']}"
            for t in turns
        )
        delivery_ctx = f"\n\n[Reference: Conversation log between player and {target_name}]\n{summary}\n[End of reference]"

    messages = []
    for turn in history[-10:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": message + delivery_ctx})

    raw = npc_runtime_client.chat_with_history(system, messages)
    parsed = _extract_json(raw)

    if parsed and "reply" in parsed:
        result = {
            "reply": parsed["reply"],
            "task_complete": bool(parsed.get("task_complete", False)),
            "task_given": parsed.get("task_given") if isinstance(parsed.get("task_given"), dict) else None,
            "item_given": parsed.get("item_given") if isinstance(parsed.get("item_given"), dict) else None,
        }
    else:
        result = {"reply": raw, "task_complete": False, "task_given": None, "item_given": None}

    # force_complete: override the model's decision (used for help button)
    if force_complete and not result["task_complete"]:
        result["task_complete"] = True
        npc_name = npc_data.get("name", "NPC")
        domain = npc_data.get("knowledge_domain", "knowledge")[:40]
        result["reply"] = result["reply"] + f"\n\n({npc_name} senses your sincerity and nods in acknowledgment.)"
        result["item_given"] = result["item_given"] or {
            "item_id": f"item_{npc_data.get('npc_id', 'unknown')}",
            "name": f"{domain} Fragment",
            "description": f"A knowledge crystal from {npc_name}",
        }

    # item_given only when task_complete=true
    if not result["task_complete"]:
        result["item_given"] = None

    return result
