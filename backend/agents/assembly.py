import asyncio
import json
from models.llm_client import LLMClient

assembly_client = LLMClient(provider="deepseek", model="deepseek-chat")

_ASSEMBLY_PROMPT = """You are a game QA engineer. You are given a summary of a game design document. Find all consistency issues (no limit on count).
Focus on: whether NPC quest type distribution is reasonable, whether exploration spot names are sensible, whether player guidance is clear.
Output in JSON format: {"issue_log": [{"issue": "...", "fix": "..."}]}
If there are no issues, output {"issue_log": []}"""


def _fix_npc_consistency(npc_data: list, world_bible: dict) -> tuple[list, list]:
    """Programmatically fix the most critical NPC consistency issues."""
    acts = world_bible.get("acts", [])
    fixes = []

    # Build valid exploration spots per act from world_bible
    valid_spots: dict[int, list[str]] = {}
    for act in acts:
        aid = act.get("act_id")
        spots = [s.get("name", "") for s in (act.get("exploration_spots") or []) if s.get("name")]
        valid_spots[aid] = spots

    # Build valid NPC IDs per act
    act_npc_ids: dict[int, set] = {}
    for npc in npc_data:
        aid = npc.get("location_act")
        act_npc_ids.setdefault(aid, set()).add(npc.get("npc_id", ""))

    for npc in npc_data:
        aid = npc.get("location_act")
        qt = npc.get("quest_type", "knowledge")
        npc_id = npc.get("npc_id", "")

        if qt == "exploration":
            spot_name = npc.get("quest_spot_name", "")
            valid = valid_spots.get(aid, [])
            if spot_name not in valid and valid:
                # Prefer a spot not already claimed by another exploration NPC in same act
                used = {n.get("quest_spot_name") for n in npc_data
                        if n.get("quest_type") == "exploration"
                        and n.get("location_act") == aid
                        and n.get("npc_id") != npc_id}
                unused = [s for s in valid if s not in used]
                new_spot = unused[0] if unused else valid[0]
                fixes.append(f"exploration NPC {npc_id}: spot {spot_name!r} → {new_spot!r}")
                npc["quest_spot_name"] = new_spot
                npc["quest_given"] = f"Go to {new_spot} and explore — find the item left behind and bring it back"

        elif qt == "delivery":
            target = npc.get("quest_target_npc", "")
            valid_targets = act_npc_ids.get(aid, set()) - {npc_id}
            if target not in valid_targets and valid_targets:
                # Prefer knowledge NPC as target
                knowledge_ids = [n.get("npc_id") for n in npc_data
                                 if n.get("location_act") == aid
                                 and n.get("quest_type") == "knowledge"
                                 and n.get("npc_id") != npc_id]
                new_target = knowledge_ids[0] if knowledge_ids else next(iter(valid_targets))
                fixes.append(f"delivery NPC {npc_id}: target {target!r} → {new_target!r}")
                npc["quest_target_npc"] = new_target

    return npc_data, fixes


async def run_assembly(
    world_bible: dict,
    story_output: dict,
    map_output: dict,
    npc_data: list,
) -> dict:
    # 1. Programmatic consistency fixes
    npc_data, prog_fixes = _fix_npc_consistency(npc_data, world_bible)
    if prog_fixes:
        print(f"[assembly] programmatic fixes: {prog_fixes}")

    # 2. LLM consistency check (compact summary, no issue cap)
    npc_summary = [
        {"npc_id": n.get("npc_id"), "name": n.get("name"), "act": n.get("location_act"),
         "quest_type": n.get("quest_type"), "quest_spot": n.get("quest_spot_name", ""),
         "quest_target": n.get("quest_target_npc", "")}
        for n in npc_data[:15]
    ]
    region_spots = [
        {"region": r.get("name"), "act_id": r.get("act_id"),
         "spots": [e.get("name") for e in (r.get("explorable_elements") or [])]}
        for r in map_output.get("regions", [])
    ]
    world_obj = world_bible.get("world", world_bible)
    summary = (
        f"World name: {world_obj.get('world_name', '')}\n"
        f"Map regions and exploration spots:\n{json.dumps(region_spots, ensure_ascii=False)}\n"
        f"NPC quest configuration:\n{json.dumps(npc_summary, ensure_ascii=False)}"
    )

    try:
        result = await asyncio.to_thread(
            assembly_client.chat_json, _ASSEMBLY_PROMPT, summary + "\n\nPlease output all issues in JSON format."
        )
    except Exception as e:
        result = {"issue_log": [{"issue": f"Assembly LLM failed: {e}", "fix": "skipped"}]}

    result["world_bible"] = world_bible
    result["story"] = story_output
    result["map"] = map_output
    result["npcs"] = npc_data
    result["assembly_fixes"] = prog_fixes
    return result
