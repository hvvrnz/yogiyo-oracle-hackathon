# 참고: 이 프로그램은 끝나지 않고 계속 "새 메시지를 기다리는" 상태로 남아있다.
# 메시지를 구독해서 읽는 Consumer이기에, 멈추고 싶으면 Ctrl+C로 종료
import json
import time
from itertools import combinations
from kafka import KafkaConsumer
from common.config import MIN_ACCEPTABLE_HOURLY_REVENUE
from stream_processor.orders.clustering.scoring import cluster_score
from stream_processor.orders.clustering.grouping import form_clusters
from stream_processor.orders.timing import still_has_time
from sequencing_engine.handler.search import find_best_route, is_hourly_revenue_acceptable, calculate_solo_delivery
from sequencing_engine.handler.scoring import calculate_revenue
from stream_processor.riders.geo_client import find_nearby_riders, get_rider_position, get_rider_info

WINDOW_SECONDS = 30

consumer = KafkaConsumer(
    'order-events',
    bootstrap_servers='localhost:9092',
    value_deserializer=lambda v: json.loads(v.decode('utf-8')),
    auto_offset_reset='earliest',
    group_id='order-processing-group'
)


def print_cluster_detail(i, cluster):
    print(f"\n--- 클러스터 {i} ---")
    for o in cluster:
        print(f"  주문{o['order_id']}: {o['store_name']} - {o.get('menu_name','?')} "
              f"[{o.get('region','?')}권역] "
              f"조리시간={o['base_cooking_min']}분 "
              f"배달지({o['delivery_lat']:.4f},{o['delivery_lng']:.4f})")
    if len(cluster) > 1:
        for a, b in combinations(cluster, 2):
            sc = cluster_score(a, b)
            print(f"  score(주문{a['order_id']}, 주문{b['order_id']}) = {sc:.2f}")

def print_route_timeline(best_detail, orders_by_id):
    print(f"   🕐 상세 타임라인:")
    for step in best_detail['timeline']:
        order = orders_by_id[step['order_id']]
        if step['type'] == 'pickup':
            print(f"      📍 [픽업] {order['store_name']} ({order.get('menu_name','?')}): "
                  f"이동 {step['move_time_min']}분 → 도착(접수 후 {step['arrival_time_min']}분째), "
                  f"사장님설정 조리시간 {step['owner_cook_min']}분 / 시스템예측 조리시간 {step['predicted_cook_min']}분, "
                  f"대기 {step['wait_min']}분, 방치 {step['food_sitting_min']}분")
        else:
            print(f"      📍 [배달] {order['store_name']} 배달지 (주문{step['order_id']}): "
                  f"이동 {step['move_time_min']}분 → 도착(접수 후 {step['arrival_time_min']}분째), "
                  f"가방체류 {step['bag_min']}분")


def print_consumer_eta(best_detail, orders_by_id):
    print(f"   👤 소비자별 예상 ETA:")
    for step in best_detail['timeline']:
        if step['type'] == 'dropoff':
            order = orders_by_id[step['order_id']]
            print(f"      {order['store_name']}({order.get('menu_name','?')}) 주문 고객: "
                  f"조리시간 {order['base_cooking_min']}분 + 배달과정 포함, "
                  f"총 접수 후 약 {step['arrival_time_min']}분 뒤 배달완료 예상")

def assign_rider_and_route(cluster, assigned_rider_ids):
    """
    클러스터 하나를 받아서, 근처 라이더를 배정하고 최적 경로 계산.
    이미 배정된 라이더(assigned_rider_ids)는 후보에서 제외.
    성공하면 결과를 출력하고 True, 실패하면 사유를 출력하고 False 반환.
    """
    if len(cluster) < 2:
        print(f"   ⚠ 1건뿐이라 경로 계산 생략, 한집배달 처리")
        return False

    rep_store_lat = cluster[0]["store_lat"]
    rep_store_lng = cluster[0]["store_lng"]
    nearby_riders = find_nearby_riders(rep_store_lat, rep_store_lng, radius_km=5)

    available_riders = [(rid, dist) for rid, dist in nearby_riders if rid not in assigned_rider_ids]
    if not available_riders:
        print(f"   ⚠ 근처에 배정 가능한 라이더 없음, 배차 불가")
        return False

    nearest_rider_id, nearest_dist = available_riders[0]
    assigned_rider_ids.add(nearest_rider_id)

    rider_start_pos = get_rider_position(nearest_rider_id)
    rider_info = get_rider_info(nearest_rider_id)
    rider_name = rider_info["name"] if rider_info else "이름없음"
    rider_region = rider_info["region"] if rider_info else "권역미상"

    best_route, best_score, best_detail = find_best_route(cluster, rider_start_pos)
    package_revenue, hourly_revenue = calculate_revenue(cluster, best_detail['total_time'])

    if not is_hourly_revenue_acceptable(hourly_revenue):
        print(f"   ⚠ 묶음 시간당 수익({hourly_revenue:,.0f}원)이 "
            f"최소 기준({MIN_ACCEPTABLE_HOURLY_REVENUE:,.0f}원)보다 낮음 — 묶음 취소, 각각 한집배달로 전환")
        assigned_rider_ids.discard(nearest_rider_id)
        return False

    orders_by_id = {o["order_id"]: o for o in cluster}

    print(f"   🏍 배정 라이더: {nearest_rider_id} ({rider_name}, {rider_region} 권역) "
          f"— {float(nearest_dist):.2f}km")
    print(f"   💰 라이더 예상 수익: {package_revenue:,.0f}원 (시간당 환산 {hourly_revenue:,.0f}원)")
    print(f"   ⭐ score: {best_score:.2f} "
          f"(food_sitting={best_detail['food_sitting_time']:.1f}, "
          f"wait={best_detail['courier_wait_time']:.1f}, "
          f"bag={best_detail['bag_time']:.1f}, "
          f"total={best_detail['total_time']:.1f})")
    print_route_timeline(best_detail, orders_by_id)
    print_consumer_eta(best_detail, orders_by_id)

    return True


def process_clusters(clusters):
    assigned_rider_ids = set()
    rejected_orders = []  # 묶음 취소로 다시 풀려난 주문들

    for i, cluster in enumerate(clusters, 1):
        names = ', '.join(f"{o['store_name']}({o.get('menu_name','?')})" for o in cluster)
        print(f"\n✅ 묶음 #{i} 확정 시도: {names}")
        print(f"   주문번호: {[o['order_id'] for o in cluster]}")

        success = assign_rider_and_route(cluster, assigned_rider_ids)
        if not success:
            rejected_orders.extend(cluster)

    return assigned_rider_ids, rejected_orders

    
# 짝을 못 찾은 주문들을 조리시간 기준으로 나눠서, 대기/한집배달로 분류.
# 다음 윈도우로 넘길 목록(still_waiting)을 반환.
def process_unmatched(unmatched, assigned_rider_ids):
    still_waiting = [o for o in unmatched if still_has_time(o)]
    expired = [o for o in unmatched if not still_has_time(o)]

    for o in expired:
        print(f"\n🏠 한집배달: {o['store_name']}({o.get('menu_name','?')}) "
              f"— 조리시간 임박, 더 기다릴 수 없어 단건 배차")

        nearby_riders = find_nearby_riders(o["store_lat"], o["store_lng"], radius_km=5)
        available_riders = [(rid, dist) for rid, dist in nearby_riders if rid not in assigned_rider_ids]

        if not available_riders:
            print(f"   ⚠ 근처에 배정 가능한 라이더 없음")
            continue

        nearest_rider_id, nearest_dist = available_riders[0]
        assigned_rider_ids.add(nearest_rider_id)
        rider_start_pos = get_rider_position(nearest_rider_id)
        rider_info = get_rider_info(nearest_rider_id)

        route, score, detail = calculate_solo_delivery(o, rider_start_pos)
        revenue, hourly = calculate_revenue([o], detail['total_time'])

        print(f"   🏍 배정 라이더: {nearest_rider_id} ({rider_info['name'] if rider_info else '?'}) "
              f"— {float(nearest_dist):.2f}km")
        print(f"   💰 예상 수익: {revenue:,.0f}원 (시간당 환산 {hourly:,.0f}원)")
        print(f"   ⭐ score: {score:.2f}")
        print(f"   🕐 픽업: 이동 {detail['timeline'][0]['move_time_min']}분, "
              f"조리시간 {o['base_cooking_min']}분, "
              f"대기 {detail['timeline'][0]['wait_min']}분")
        print(f"   👤 소비자 예상 ETA: 접수 후 약 {detail['timeline'][1]['arrival_time_min']}분 뒤 배달완료")

    if still_waiting:
        names = ', '.join(f"{o['store_name']}({o.get('menu_name','?')})" for o in still_waiting)
        print(f"\n⏳ 매칭 대기 중: {names}")
        print(f"   → 아직 조리시간 여유 있음, 다음 30초에 새 주문과 재매칭 시도")

    return still_waiting


if __name__ == "__main__":
    print("=" * 60)
    print("  실속배달 — 조리시간 인지 배차 시퀀싱 데모")
    print("=" * 60)
    print("\n주문 수신 대기 중...\n")
    buffer = []
    window_start = time.time()

    while True:
        records = consumer.poll(timeout_ms=1000)

        for topic_partition, messages in records.items():
            for message in messages:
                order = message.value
                print(f"🍚 주문 접수: [{order['order_id']}] {order['store_name']} "
                      f"({order.get('category','?')}, 조리 {order['base_cooking_min']}분)")
                buffer.append(order)

        if time.time() - window_start >= WINDOW_SECONDS:
            if buffer:
                print(f"\n{'─'*60}")
                print(f"⏱  30초 경과 — 배차 후보 매칭 시작 (대기 중 주문 {len(buffer)}건)")
                print(f"{'─'*60}")

                clusters, unmatched = form_clusters(buffer)
                assigned_rider_ids, rejected_orders = process_clusters(clusters)
                buffer = process_unmatched(unmatched + rejected_orders, assigned_rider_ids)

                print(f"\n{'='*60}\n")
            window_start = time.time()