from sequencing_engine.handler.search import find_best_route

rider_start = (37.4970, 127.0290
best_route, best_score, best_detail = find_best_route(dummy_cluster, rider_start)

print("🏍️ 최적 경로:")
for order_id, visit_type in best_route:
    print(f"  {visit_type}: 주문{order_id}")
print(f"\nscore: {best_score:.2f}")
print(f"상세: {best_detail}")