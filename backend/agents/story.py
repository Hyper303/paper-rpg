import asyncio
import json
from models.llm_client import LLMClient
from prompts import load_prompt

story_client = LLMClient(provider="deepseek", model="deepseek-chat")


async def run_story(world_bible: dict) -> dict:
    world_obj = world_bible.get("world", world_bible)
    system = load_prompt("story.txt").format(
        world_bible_json=json.dumps(world_bible, ensure_ascii=False),
        tone=world_obj.get("tone", "epic"),
    )
    user = "Based on the game world design above, output the complete narrative content JSON. Output JSON directly, no explanations."
    return await asyncio.to_thread(story_client.chat_json, system, user)
