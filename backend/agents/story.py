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
    user = "请根据以上游戏世界设计，输出完整的叙事内容JSON。直接输出JSON，不要任何解释。"
    return await asyncio.to_thread(story_client.chat_json, system, user)
