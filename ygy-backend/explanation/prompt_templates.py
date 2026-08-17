"""LLM prompts and context normalization for package explanations."""

import json

from explanation.demo_context import build_demo_explanation_context


SYSTEM_PROMPT = """
당신은 음식 배달 패키지의 확정된 결과를 설명하는 한국어 안내 작성기입니다.
배차, 경로, ETA, 수익을 새로 계산하거나 변경하지 말고 제공된 데이터만 근거로 설명하세요.
데이터에 없는 후보 비교, 거리, 가용 라이더 상태, 할인, 보상, 확정 ETA를 만들지 마세요.
응답은 Markdown 없이 아래 JSON 객체만 반환해야 합니다.
{
  "consumer_text": "고객용 안내",
  "merchant_text": "사장님용 안내",
  "rider_text": "라이더용 안내"
}
""".strip()


def _as_json(value, fallback):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return fallback
    return value if value is not None else fallback


def _safe_value(value):
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _normalize_menu_items(value):
    items = _as_json(value, [])
    if not isinstance(items, list):
        return []
    normalized = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized.append({
            "menu": _safe_value(item.get("menu")),
            "qty": _safe_value(item.get("qty")),
        })
    return normalized


def _normalize_route(value):
    route = _as_json(value, [])
    if not isinstance(route, list):
        return []
    normalized = []
    for step in route:
        if not isinstance(step, dict):
            continue
        normalized.append({
            "order_id": _safe_value(step.get("order_id")),
            "type": _safe_value(step.get("type")),
            "sequence": _safe_value(step.get("sequence")),
        })
    return normalized


def _normalize_score_detail(value):
    detail = _as_json(value, {})
    if not isinstance(detail, dict):
        detail = {}
    timeline = detail.get("timeline")
    if not isinstance(timeline, list):
        timeline = []
    normalized_timeline = []
    timeline_fields = (
        "order_id", "type", "move_time_min", "arrival_time_min",
        "owner_cook_min", "predicted_cook_min", "wait_min",
        "food_sitting_min", "bag_min",
    )
    for step in timeline:
        if not isinstance(step, dict):
            continue
        normalized_timeline.append({field: _safe_value(step.get(field)) for field in timeline_fields})
    return {
        "food_sitting_time": _safe_value(detail.get("food_sitting_time")),
        "courier_wait_time": _safe_value(detail.get("courier_wait_time")),
        "bag_time": _safe_value(detail.get("bag_time")),
        "total_time": _safe_value(detail.get("total_time")),
        "timeline": normalized_timeline,
    }


def normalize_explanation_context(context):
    """Return only explanation-relevant, JSON-safe package and order data."""
    context = context if isinstance(context, dict) else {}
    package = context.get("package") if isinstance(context.get("package"), dict) else {}
    orders = context.get("orders") if isinstance(context.get("orders"), list) else []
    order_ids = _as_json(package.get("order_ids"), [])
    if not isinstance(order_ids, list):
        order_ids = []

    normalized_orders = []
    for order in orders:
        if not isinstance(order, dict):
            continue
        normalized_orders.append({
            "order_id": _safe_value(order.get("order_id")),
            "store_name": _safe_value(order.get("store_name")),
            "menu_items": _normalize_menu_items(order.get("menu_items")),
            "owner_cook_min": _safe_value(order.get("owner_cook_min")),
            "predicted_cook_min": _safe_value(order.get("predicted_cook_min")),
        })

    return {
        "package": {
            "package_id": _safe_value(package.get("package_id")),
            "package_type": _safe_value(package.get("package_type")),
            "bundle_size": _safe_value(package.get("bundle_size")),
            "score": _safe_value(package.get("score")),
            "package_revenue": _safe_value(package.get("package_revenue")),
            "hourly_revenue": _safe_value(package.get("hourly_revenue")),
            "order_ids": [_safe_value(order_id) for order_id in order_ids],
            "route_detail": _normalize_route(package.get("route_detail")),
            "score_detail": _normalize_score_detail(package.get("score_detail")),
            "rider_id": _safe_value(package.get("rider_id")),
        },
        "orders": normalized_orders,
    }


def _role_scoped_context(normalized):
    """Keep each role's prompt input limited to its decision-relevant facts."""
    package = normalized["package"]
    score_detail = package["score_detail"]
    merchant = normalized["merchant_order"]
    customer = normalized["customer_order"]
    return {
        "consumer_context": {
            "delivery_status": customer.get("status"),
            "package_type": package.get("package_type"),
            "bundle_size": package.get("bundle_size"),
            "total_time_min": score_detail.get("total_time"),
            "food_sitting_time_min": score_detail.get("food_sitting_time"),
        },
        "merchant_context": {
            "order_status": merchant.get("status"),
            "owner_cook_min": merchant.get("owner_cook_min"),
            "predicted_cook_min": merchant.get("predicted_cook_min"),
        },
        "rider_context": {
            "package_type": package.get("package_type"),
            "bundle_size": package.get("bundle_size"),
            "package_revenue": package.get("package_revenue"),
            "hourly_revenue": package.get("hourly_revenue"),
            "total_time_min": score_detail.get("total_time"),
            "courier_wait_time_min": score_detail.get("courier_wait_time"),
            "food_sitting_time_min": score_detail.get("food_sitting_time"),
        },
    }


def build_messages(context):
    """Build strict JSON messages for an OpenAI-compatible chat completion API."""
    context = context if isinstance(context, dict) else {}
    legacy_normalized = normalize_explanation_context(context)
    normalized = build_demo_explanation_context({
        "package": context.get("package") or context.get("rider_offer") or legacy_normalized["package"],
        "orders": context.get("orders") or legacy_normalized["orders"],
        "customer_order": context.get("customer_order"),
        "merchant_order": context.get("merchant_order"),
        "rider_profile": context.get("rider_profile"),
        "next_stop": context.get("next_stop"),
    })
    data = json.dumps(_role_scoped_context(normalized), ensure_ascii=False, separators=(",", ":"))
    user_prompt = """
아래는 이미 확정된 배차 결과 데이터입니다.

{data}

작성 규칙:
1. 세 text 값은 모두 1~3개의 개조식 줄로만 작성하세요. 각 줄은 반드시 "• "로 시작하고 줄바꿈(\n)으로 구분하세요.
2. 제목, 인사, 도입 문장, 문단형 서술, "합니다/하세요" 같은 문장형 종결어미를 쓰지 마세요. "• 조리 기준: 20분"처럼 항목명과 값·판단 근거만 간결하게 쓰세요.
3. consumer_text는 220자 이하의 고객 안내입니다. BUNDLE이면 묶음 배차의 합리적 근거를 bundle_size, total_time_min, food_sitting_time_min 범위에서 설명하세요. 고객의 배달지, 다른 주문·고객, 주문 번호, 라이더 ID, 매장명, 라이더 수익은 언급하지 마세요.
4. merchant_text는 300자 이하의 조리·포장 안내입니다. merchant_context의 본인 주문 조리시간과 상태만 근거로 쓰세요. 다른 매장, 다른 주문, 픽업 장소, 배달 경로, 픽업·배달 순서, 라이더 정보는 언급하지 마세요.
5. rider_text는 500자 이하의 수락 판단 안내입니다. rider_context의 수익·총 소요시간·대기시간만 근거로 쓰세요. 경로, 픽업 장소, 배달지, 픽업·배달 순서, next_stop 정보는 언급하지 마세요. 이 정보는 화면의 별도 운행 영역에서 제공합니다.
6. 점수는 결과값일 뿐 후보 간 우위를 증명하지 않습니다. 다른 후보보다 좋았다는 표현을 쓰지 마세요.
7. 설명이 가능한 근거가 부족하면 그 사실을 짧고 정직한 개조식으로 안내하세요.
""".strip().format(data=data)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
