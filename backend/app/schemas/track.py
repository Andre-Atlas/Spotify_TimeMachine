from pydantic import BaseModel

class TrackFeatures(BaseModel):
    energy: float
    valence: float
    danceability: float
    acousticness: float
    tempo: float

class TrackMusic(BaseModel):
    root: int
    minor: bool
    bpm: int
    drums: bool

class TrackOut(BaseModel):
    id: str
    decade: str
    title: str
    artist: str
    album: str
    year: int
    durationMs: int      # camelCase to match frontend
    palette: tuple[str, str]
    features: TrackFeatures
    music: TrackMusic
    popularity: int = 50
    affinity: int        # 0-100
    reason: str | None = None
