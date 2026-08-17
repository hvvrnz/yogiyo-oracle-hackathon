"""Normalize final demo API state into safe LLM explanation input."""

import json


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


def _mapping(value):
    return value if isinstance(value, dict) else {}


def _list(value):
    value = _as_json(value, [])
    return value if isinstance(value, list) else []


def _route(value):
    route = []
    for index, step in enumerate(_list(value)):
        if not isinstance(step, dict):
            continue
        route.append({
            "order_id": _safe_value(step.get("order_id")),
            "type": _safe_value(step.get("type")),
            "sequence": _safe_value(step.get("sequence", index + 1)),
        })
    return route


def _score_detail(value):
    detail = _mapping(_as_json(value, {}))
    timeline = []
    for step in _list(detail.get("timeline")):
        if not isinstance(step, dict):
            continue
        timeline.append({
            field: _safe_value(step.get(field))
            for field in (
                "order_id", "type", "move_time_min", "arrival_time_min",
                "owner_cook_min", "predicted_cook_min", "wait_min",
                "food_sitting_min", "bag_min",
            )
        })
    return {
        "food_sitting_time": _safe_value(detail.get("food_sitting_time")),
        "courier_wait_time": _safe_value(detail.get("courier_wait_time")),
        "bag_time": _safe_value(detail.get("bag_time")),
        "total_time": _safe_value(detail.get("total_time")),
        "timeline": timeline,
    }


def _order(value, include_delivery_address=False):
    order = _mapping(value)
    normalized = {
        "order_id": _safe_value(order.get("order_id")),
        "store_name": _safe_value(order.get("store_name")),
        "status": _safe_value(order.get("status")),
        "owner_cook_min": _safe_value(order.get("owner_cook_min")),
        "predicted_cook_min": _safe_value(order.get("predicted_cook_min")),
        "eta_min": _safe_value(order.get("eta_min")),
    }
    if include_delivery_address:
        normalized["delivery_address"] = _safe_value(order.get("delivery_address"))
    return normalized


def build_demo_explanation_context(context):
    """Return JSON-safe, role-scoped input from the final demo API state.

    ``context`` may contain ``package``, ``orders``, ``customer_order``,
    ``merchant_order``, ``rider_offer``, and ``next_stop``. Missing data is
    intentionally represented as null/empty values so the generator can give
    a short, honest fallback instead of inventing operational facts.
    """
    context = _mapping(context)
    package = _mapping(context.get("package") or context.get("rider_offer"))
    orders = [_order(order) for order in _list(context.get("orders")) if isinstance(order, dict)]
    customer_order = _order(context.get("customer_order"), include_delivery_address=True)
    merchant_order = _order(context.get("merchant_order"))
    next_stop = _mapping(context.get("next_stop"))

    return {
        "explanation_stage": _safe_value(context.get("explanation_stage")),
        "package": {
            "package_id": _safe_value(package.get("package_id")),
            "package_type": _safe_value(package.get("package_type")),
            "bundle_size": _safe_value(package.get("bundle_size")),
            "score": _safe_value(package.get("score")),
            "package_revenue": _safe_value(package.get("package_revenue")),
            "hourly_revenue": _safe_value(package.get("hourly_revenue")),
            "order_ids": [_safe_value(order_id) for order_id in _list(package.get("order_ids"))],
            "route_detail": _route(package.get("route_detail")),
            "score_detail": _score_detail(package.get("score_detail")),
        },
        "orders": orders,
        "customer_order": customer_order,
        "merchant_order": merchant_order,
        "rider": {
            "status": _safe_value(_mapping(context.get("rider_profile")).get("status")),
            "offer_status": _safe_value(package.get("status")),
        },
        "next_stop": {
            "order_id": _safe_value(next_stop.get("order_id")),
            "type": _safe_value(next_stop.get("type")),
            "label": _safe_value(next_stop.get("label")),
        },
    }
