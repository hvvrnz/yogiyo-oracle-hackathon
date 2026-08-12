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