from itertools import combinations
from common.config import MAX_CLUSTER_SIZE
from stream_processor.orders.clustering.scoring import group_score

MAX_ACCEPTABLE_SCORE = 15  # ⭐ 초기 추정값, 추후 튜닝 필요 


def form_clusters(orders, max_size=MAX_CLUSTER_SIZE):
    """
    확정된 클러스터(clusters)와, 이번 윈도우에서 짝을 못 찾아
    다음 윈도우로 넘길 미확정 주문(unmatched)을 나눠서 반환.
    """
    clusters = []
    unmatched = []
    remaining = list(orders)

    while remaining:
        if len(remaining) == 1:
            unmatched.append(remaining[0])
            break

        group_size = min(max_size, len(remaining))
        best_group = None
        best_score = None

        for group in combinations(remaining, group_size):
            score = group_score(group)
            if best_score is None or score < best_score:
                best_score = score
                best_group = group

        pair_count = len(list(combinations(best_group, 2)))
        avg_score = best_score / pair_count if pair_count else best_score

        if avg_score > MAX_ACCEPTABLE_SCORE:
            unmatched.extend(best_group)
        else:
            clusters.append(list(best_group))

        for order in best_group:
            remaining.remove(order)

    return clusters, unmatched