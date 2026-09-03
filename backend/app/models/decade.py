"""Dados estáticos das 7 décadas — espelho de Front_end/src/data/decades.ts."""
from __future__ import annotations

DECADES: list[dict] = [
    {
        'id': '50s', 'ink': '#7C4A1E', 'era': 'Válvula', 'label': 'Anos 50', 'years': '1950 – 1959', 'nixie': '1950',
        'tagline': 'Válvula, fita e rádio AM',
        'genres': ['Rock and roll', 'Jazz vocal', 'Doo-wop', 'Blues elétrico'],
        'accent': '#E8C88A', 'accentAlt': '#8A6A3F', 'audio': 'am', 'cover': 'jazz-modern',
    },
    {
        'id': '60s', 'ink': '#B93F0B', 'era': 'Fita', 'label': 'Anos 60', 'years': '1960 – 1969', 'nixie': '1960',
        'tagline': 'Revolução em fita magnética',
        'genres': ['Rock clássico', 'Soul', 'Psicodelia', 'Motown'],
        'accent': '#FF8A3D', 'accentAlt': '#FFD166', 'audio': 'am', 'cover': 'psychedelic',
    },
    {
        'id': '70s', 'ink': '#8A5A06', 'era': 'Vinil', 'label': 'Anos 70', 'years': '1970 – 1979', 'nixie': '1970',
        'tagline': 'Vinil, groove e excesso',
        'genres': ['Rock progressivo', 'Funk', 'Disco', 'Punk'],
        'accent': '#FFB703', 'accentAlt': '#FB8500', 'audio': 'vinyl', 'cover': 'gatefold',
    },
    {
        'id': '80s', 'ink': '#BE185D', 'era': 'Sintetizador', 'label': 'Anos 80', 'years': '1980 – 1989', 'nixie': '1980',
        'tagline': 'Sintetizadores e neon',
        'genres': ['Synth-pop', 'New wave', 'Hair metal', 'Hip-hop old school'],
        'accent': '#FF2D95', 'accentAlt': '#22E0FF', 'audio': 'vinyl', 'cover': 'neon-grid',
    },
    {
        'id': '90s', 'ink': '#3F6212', 'era': 'Distorção', 'label': 'Anos 90', 'years': '1990 – 1999', 'nixie': '1990',
        'tagline': 'Distorção e batidas cruas',
        'genres': ['Grunge', 'Britpop', 'Hip-hop', 'Eurodance'],
        'accent': '#8AC926', 'accentAlt': '#22E0FF', 'audio': 'mp3', 'cover': 'xerox',
    },
    {
        'id': '00s', 'ink': '#1D4ED8', 'era': 'MP3', 'label': 'Anos 2000', 'years': '2000 – 2009', 'nixie': '2000',
        'tagline': 'MP3, iPod e revival garage',
        'genres': ['Indie rock', 'Pop-punk', 'R&B', 'Electro'],
        'accent': '#4D7CFF', 'accentAlt': '#B892FF', 'audio': 'clean', 'cover': 'plastic',
    },
    {
        'id': '10s', 'ink': '#6D28D9', 'era': 'Streaming', 'label': 'Anos 2010', 'years': '2010 – 2019', 'nixie': '2010',
        'tagline': 'Streaming e pop global',
        'genres': ['EDM', 'Trap', 'Indie pop', 'Synthwave'],
        'accent': '#B892FF', 'accentAlt': '#FF5CC8', 'audio': 'clean', 'cover': 'minimal',
    },
]

DECADE_MAP: dict[str, dict] = {d['id']: d for d in DECADES}
DECADE_IDS: list[str] = [d['id'] for d in DECADES]
