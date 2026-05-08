from pydantic import BaseModel
from typing import Any


class Questionnaire(BaseModel):
    background: str   # novice | intermediate | expert
    preference: str   # guided | self-directed
    time: str         # quick | normal | deep
    goal: str         # overview | deep-understanding | paper-replication
    visual_style: str = "pixel_2d"  # pixel_2d (only implemented style)


class NpcChatRequest(BaseModel):
    npc_data: dict[str, Any]
    message: str
    history: list[dict[str, str]] = []
    player_profile: dict[str, Any]
    world_bible: dict[str, Any]
    extra_context: dict[str, Any] = {}
    force_complete: bool = False  # set True when player clicks help button
