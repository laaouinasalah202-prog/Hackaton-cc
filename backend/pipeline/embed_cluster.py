import logging
from typing import List, Dict, Any, Tuple
import numpy as np
from sklearn.cluster import HDBSCAN
from backend.models import LogEntry

logger = logging.getLogger("embed_cluster")

# Lazy-loaded model holder
_ST_MODEL = None
_LOAD_FAILED = False

def get_sentence_transformer():
    """Lazily load SentenceTransformer model."""
    global _ST_MODEL, _LOAD_FAILED
    if _ST_MODEL is not None:
        return _ST_MODEL
    if _LOAD_FAILED:
        return None

    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformers (all-MiniLM-L6-v2)...")
        _ST_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        return _ST_MODEL
    except Exception as e:
        logger.warning(f"Could not load SentenceTransformer: {e}. Falling back to TF-IDF embeddings.")
        _LOAD_FAILED = True
        return None

def compute_embeddings(templates: List[str]) -> np.ndarray:
    """Compute dense vectors for unique template strings."""
    if not templates:
        return np.empty((0, 384))

    st_model = get_sentence_transformer()
    if st_model is not None:
        try:
            embeddings = st_model.encode(templates, show_progress_bar=False, normalize_embeddings=True)
            return np.array(embeddings)
        except Exception as e:
            logger.warning(f"SentenceTransformer encoding failed: {e}. Falling back to TF-IDF.")

    # Fallback: Scikit-learn TF-IDF Vectorizer
    from sklearn.feature_extraction.text import TfidfVectorizer
    vectorizer = TfidfVectorizer(max_features=128, stop_words="english")
    try:
        tfidf = vectorizer.fit_transform(templates).toarray()
        # Normalize
        norms = np.linalg.norm(tfidf, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return tfidf / norms
    except Exception:
        # Ultimate fallback: dummy embeddings
        return np.zeros((len(templates), 16))

def cluster_templates(entries: List[LogEntry]) -> Tuple[List[LogEntry], Dict[str, int]]:
    """
    Extract unique templates from log entries, embed unique templates only,
    cluster with HDBSCAN, and map cluster_ids back to entries.
    """
    if not entries:
        return entries, {}

    # Gather unique templates
    unique_templates: Dict[str, str] = {}  # {template_id: template_str}
    for e in entries:
        t_id = e.template_id or "unknown"
        t_str = e.template_str or e.message
        if t_id not in unique_templates:
            unique_templates[t_id] = t_str

    template_ids = list(unique_templates.keys())
    template_texts = [unique_templates[tid] for tid in template_ids]

    template_to_cluster: Dict[str, int] = {}

    if len(template_ids) <= 2:
        # Trivial clustering
        for i, tid in enumerate(template_ids):
            template_to_cluster[tid] = i
    else:
        try:
            embeddings = compute_embeddings(template_texts)
            # HDBSCAN clustering
            # min_cluster_size=2 for small log template sets
            min_size = min(2, len(template_ids))
            clusterer = HDBSCAN(min_cluster_size=min_size, min_samples=1, metric="euclidean", copy=True)
            labels = clusterer.fit_predict(embeddings)

            for tid, label in zip(template_ids, labels):
                # -1 is noise in HDBSCAN; assign noise its own positive cluster index
                template_to_cluster[tid] = int(label) if label >= 0 else abs(int(label)) + 99
        except Exception as e:
            logger.warning(f"HDBSCAN clustering failed: {e}. Defaulting each template to its own cluster.")
            for i, tid in enumerate(template_ids):
                template_to_cluster[tid] = i

    # Assign cluster_id to entries
    for e in entries:
        t_id = e.template_id or "unknown"
        e.cluster_id = template_to_cluster.get(t_id, 0)

    return entries, template_to_cluster
