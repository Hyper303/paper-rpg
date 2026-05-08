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
        result = await run_npc_turn(
            npc_data=body.npc_data,
            message=body.message,
            history=body.history,
            player_profile=body.player_profile,
            world_bible=body.world_bible,
            extra_context=body.extra_context,
            force_complete=body.force_complete,
        )
        return result
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
    """Generate multi-question quiz: one MC per NPC + one free-text question."""
    from models.llm_client import LLMClient, _extract_json
    client = LLMClient(provider="deepseek", model="deepseek-chat")

    act = body.get("act_data", {})
    npcs = body.get("npcs", [])

    npc_lines = "\n".join(
        f"- npc_id={n.get('npc_id','')} name={n.get('name','')} knowledge={n.get('knowledge_domain','')}"
        for n in npcs
    )

    system = "You are an educational game quiz expert. Generate quiz questions based on the region info and NPC list. Output JSON only, no explanations."
    user = f"""Region: {act.get('name','')}
Main quest: {act.get('main_quest','')}

NPC list (generate one multiple-choice question per NPC):
{npc_lines}

Output format:
{{
  "mc_questions": [
    {{
      "npc_id": "npc_001",
      "npc_name": "NPC name",
      "question": "A question about this NPC's knowledge domain (in English)",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "correct": "B",
      "explanation": "Explanation of the correct answer (2 sentences)",
      "wrong_hints": {{
        "A": "First-person explanation from this NPC's perspective of why A is wrong (1 sentence)",
        "C": "First-person explanation from this NPC's perspective of why C is wrong (1 sentence)",
        "D": "First-person explanation from this NPC's perspective of why D is wrong (1 sentence)"
      }}
    }}
  ],
  "free_text": {{
    "question": "An open-ended synthesis question asking the player to explain the region's core concepts in their own words",
    "key_concepts": ["concept 1", "concept 2"],
    "npc_insights": {{
      "npc_001": "One hint from this NPC's first-person perspective",
      "npc_002": "One hint from this NPC's first-person perspective"
    }}
  }}
}}

Requirements:
- mc_questions: {len(npcs)} questions total, one per NPC
- wrong_hints: provide hints for the 3 wrong options only, in the NPC's voice
- npc_insights: provide hints for all NPCs
- [Important] correct answers must be evenly distributed across A/B/C/D: no single letter appears more than {max(1, len(npcs)//4 + 1)} times in the full set, at least 3 different letters must be used; option text lengths should be similar so the correct answer isn't obvious from length"""

    try:
        raw = await asyncio.to_thread(client.chat, system, user, True)
        result = _extract_json(raw)
        if not result.get("mc_questions"):
            raise ValueError("quiz generation failed")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/evaluate-answer")
async def evaluate_answer(body: dict):
    """Evaluate a free-text answer against key concepts."""
    from models.llm_client import LLMClient, _extract_json
    client = LLMClient(provider="deepseek", model="deepseek-chat")

    system = "You are a learning assessment expert. Be lenient: a student passes if they can express the core idea in their own words. Output JSON only."
    user = f"""Question: {body.get('question','')}
Key concepts: {', '.join(body.get('key_concepts', []))}
Student answer: {body.get('answer','')}

Output: {{"passed": true or false, "feedback": "Encouraging feedback that fills in any missing key points (2-3 sentences)"}}"""

    try:
        raw = await asyncio.to_thread(client.chat, system, user, True)
        result = _extract_json(raw)
        return result if result.get("feedback") else {"passed": True, "feedback": "Well understood — keep going!"}
    except Exception:
        return {"passed": True, "feedback": "Keep going!"}


# Serve React frontend (must be last — catches all non-API routes)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
