import asyncio
from models.llm_client import LLMClient

assembly_client = LLMClient(provider="deepseek", model="deepseek-chat")

_ASSEMBLY_PROMPT = """你是游戏QA工程师。给你以下游戏设计文档的摘要，请指出最多5个关键一致性问题。
输出JSON格式：{"issue_log": [{"issue": "...", "fix": "..."}]}
如果没有问题，输出 {"issue_log": []}"""


async def run_assembly(
    world_bible: dict,
    story_output: dict,
    map_output: dict,
    npc_data: list,
) -> dict:
    # Build a compact summary instead of passing full JSON blobs
    npc_names = [n.get("name", "") for n in npc_data[:10]]
    region_names = [r.get("name", "") for r in map_output.get("regions", [])[:10]]
    world_obj = world_bible.get("world", world_bible)

    summary = (
        f"世界名：{world_obj.get('world_name', '')}\n"
        f"矛盾：{world_obj.get('fundamental_conflict', '')}\n"
        f"地图区域（前10）：{region_names}\n"
        f"NPC（前10）：{npc_names}\n"
        f"Acts数量：{len(world_bible.get('acts', []))}"
    )

    try:
        result = await asyncio.to_thread(
            assembly_client.chat_json, _ASSEMBLY_PROMPT, summary + "\n\n请以JSON格式输出。"
        )
    except Exception as e:
        result = {"issue_log": [{"issue": f"Assembly LLM failed: {e}", "fix": "skipped"}]}

    # Always merge the raw data directly — don't rely on LLM to re-output everything
    result["world_bible"] = world_bible
    result["story"] = story_output
    result["map"] = map_output
    result["npcs"] = npc_data
    return result
