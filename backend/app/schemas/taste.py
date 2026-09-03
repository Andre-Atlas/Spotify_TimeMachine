from pydantic import BaseModel

class TasteOut(BaseModel):
    energy: float
    valence: float
    danceability: float
    acousticness: float
