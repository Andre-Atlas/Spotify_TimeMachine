from pydantic import BaseModel

class CurateRequest(BaseModel):
    prompt: str
    decade: str
    size: int = 15
    trackIds: list[str] | None = None

class CurateChunk(BaseModel):
    text: str

class CurateDone(BaseModel):
    trackIds: list[str]
