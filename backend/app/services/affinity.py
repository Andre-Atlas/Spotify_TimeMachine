def compute_affinity(track_features: dict, taste: dict) -> int:
    """Calcula afinidade ponderada (Manhattan) entre faixa e gosto.
    
    Pesos: energy=1.2, valence=0.7, danceability=1.0, acousticness=0.6
    Soma dos pesos = 3.5
    Piso mínimo = 38
    """
    d = (
        1.2 * abs(track_features['energy'] - taste['energy'])
        + 0.7 * abs(track_features['valence'] - taste['valence'])
        + 1.0 * abs(track_features['danceability'] - taste['danceability'])
        + 0.6 * abs(track_features['acousticness'] - taste['acousticness'])
    )
    return round(max(38, 100 - (d / 3.5) * 100))
