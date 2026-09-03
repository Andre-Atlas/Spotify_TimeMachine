"""Rota do perfil de gosto do usuário."""
from fastapi import APIRouter, Depends

from app.schemas.taste import TasteOut
from app.deps import get_taste_source
from app.providers.base import TasteSource

router = APIRouter(tags=['taste'])

@router.get('/me/taste', response_model=TasteOut)
async def user_taste(taste_source: TasteSource = Depends(get_taste_source)):
    """Retorna o perfil de gosto do usuário logado (ou demo)."""
    taste = await taste_source.get_taste()
    return TasteOut(**taste)
