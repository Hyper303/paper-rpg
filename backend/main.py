import asyncio
import json
import os

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from agents.director import run_director
from agents.story import run_story
from agents.map_agent import run_map
from agents.npc_spawner import spawn_npcs
from agents.assembly import run_assembly
from agents.npc import run_npc_turn
from agents.runtime import process_action, _initial_state
from schemas import Questionnaire, NpcChatRequest
from utils import extract_text_from_pdf, sse

app = FastAPI(title="Paper RPG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/generate-world")
async def generate_world(
    pdf_file: UploadFile = File(...),
    questionnaire: str = Form(...),
):
    q_dict = json.loads(questionnaire)
    q = Questionnaire(**q_dict)
    pdf_bytes = await pdf_file.read()

    async def event_stream():
        try:
            paper_text = extract_text_from_pdf(pdf_bytes)

            yield sse("progress", {"step": "director", "status": "running"})
            try:
                world_bible = await run_director(paper_text, q.model_dump())
            except Exception as e:
                yield sse("error", {"step": "director", "message": str(e)})
                return
            yield sse("progress", {"step": "director", "status": "done"})
            yield sse("world_bible", world_bible)

            yield sse("progress", {"step": "story_map", "status": "running"})
            try:
                story_output, map_output = await asyncio.gather(
                    run_story(world_bible),
                    run_map(world_bible, q.visual_style),
                )
            except Exception as e:
                yield sse("error", {"step": "story_map", "message": str(e)})
                return
            yield sse("progress", {"step": "story_map", "status": "done"})

            yield sse("progress", {"step": "npcs", "status": "running"})
            try:
                npc_data = await spawn_npcs(world_bible, q.background)
            except Exception as e:
                yield sse("error", {"step": "npcs", "message": str(e)})
                return
            yield sse("progress", {"step": "npcs", "status": "done"})

            yield sse("progress", {"step": "assembly", "status": "running"})
            try:
                game_data = await run_assembly(world_bible, story_output, map_output, npc_data)
            except Exception as e:
                yield sse("error", {"step": "assembly", "message": str(e)})
                return
            yield sse("progress", {"step": "assembly", "status": "done"})

            yield sse("complete", game_data)

        except Exception as e:
            yield sse("error", {"step": "unknown", "message": str(e)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/npc-chat")
async def npc_chat(body: NpcChatRequest):
    try:
        reply = await run_npc_turn(
            npc_data=body.npc_data,
            message=body.message,
            history=body.history,
            player_profile=body.player_profile,
            world_bible=body.world_bible,
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/game-action")
async def game_action(body: dict):
    """Process a player action and update game state."""
    try:
        updated_state, response = await process_action(
            action=body["action"],
            payload=body.get("payload", {}),
            game_state=body["game_state"],
            game_data=body["game_data"],
        )
        return {"game_state": updated_state, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/init-game")
async def init_game(body: dict):
    """Initialize game state from assembled game_data."""
    game_data = body["game_data"]
    return {"game_state": _initial_state(game_data)}


@app.post("/api/generate-quiz")
async def generate_quiz(body: dict):
    """Generate a multiple-choice question for a given act."""
    from models.llm_client import LLMClient, _extract_json
    client = LLMClient(provider="deepseek", model="deepseek-chat")

    act = body.get("act_data", {})
    system = "你是教育游戏设计师，根据章节内容生成测验题目。只输出JSON，不要任何解释。"
    user = f"""根据以下游戏章节，生成一道4选1的选择题，考察玩家对核心内容的理解。

章节名：{act.get('name', '')}
主线任务：{act.get('main_quest', '')}
支线任务：{act.get('side_quests', [])}

输出JSON：
{{
  "question": "问题文本（中文，考察章节核心概念）",
  "options": {{"A": "选项A文本", "B": "选项B文本", "C": "选项C文本", "D": "选项D文本"}},
  "correct": "A",
  "explanation": "解释正确答案及核心知识点（2-3句话）"
}}"""

    try:
        raw = await asyncio.to_thread(client.chat, system, user)
        result = _extract_json(raw)
        if not result.get("question"):
            raise ValueError("quiz generation returned empty")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Serve React frontend (must be last — catches all non-API routes)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
