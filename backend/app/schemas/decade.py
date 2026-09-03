from pydantic import BaseModel

class DecadeOut(BaseModel):
    id: str              # DecadeId: '50s'|'60s'|...|'10s'
    label: str           # 'Anos 50'
    years: str           # '1950 – 1959'
    nixie: str           # '1950'
    tagline: str
    genres: list[str]
    era: str
    ink: str             # hex color
    accent: str          # hex color
    accentAlt: str       # hex color (camelCase to match frontend)
    audio: str           # AudioProfile
    cover: str           # CoverStyle

    model_config = {'populate_by_name': True}
