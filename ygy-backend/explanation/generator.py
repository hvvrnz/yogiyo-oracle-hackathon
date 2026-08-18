"""Server-side LLM generation for persisted package explanations."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from explanation.demo_context import build_demo_explanation_context
from explanation.prompt_templates import build_messages


class LLMConfigurationError(Exception):
    """Raised when required server-only LLM configuration is absent or invalid."""


class LLMGenerationError(Exception):
    """Raised when an LLM provider cannot return a valid explanation."""


def _read_timeout():
    raw_timeout = os.getenv("LLM_TIMEOUT_SECONDS", "20")
    try:
        timeout = int(raw_timeout)
    except (TypeError, ValueError):
        raise LLMConfigurationError("LLM 타임아웃 설정이 올바르지 않습니다.")
    if timeout < 1 or timeout > 120:
        raise LLMConfigurationError("LLM 타임아웃 설정이 허용 범위를 벗어났습니다.")
    return timeout


def _load_settings():
    provider = os.getenv("LLM_PROVIDER", "openai_compatible").strip().lower()
    if provider != "openai_compatible":
        raise LLMConfigurationError("지원하지 않는 LLM 제공자 설정입니다.")

    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "").strip()
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
    if not api_key or not model:
        raise LLMConfigurationError("LLM API 키 또는 모델 설정이 없습니다.")
    if not base_url.startswith(("https://", "http://")):
        raise LLMConfigurationError("LLM API 주소 설정이 올바르지 않습니다.")
    return {
        "api_key": api_key,
        "model": model,
        "url": base_url + "/chat/completions",
        "timeout": _read_timeout(),
    }


def _post_json(url, payload, api_key, timeout):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError:
        raise LLMGenerationError("배차 설명 생성 서비스가 요청을 처리하지 못했습니다.")
    except (URLError, ValueError):
        raise LLMGenerationError("배차 설명 생성 서비스에 연결하지 못했습니다.")
    except Exception:
        raise LLMGenerationError("배차 설명 생성 중 예기치 않은 오류가 발생했습니다.")


def _extract_json(content):
    if not isinstance(content, str):
        raise LLMGenerationError("배차 설명 생성 결과 형식이 올바르지 않습니다.")
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].strip().startswith("```"):
            text = "\n".join(lines[1:-1]).strip()
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        raise LLMGenerationError("배차 설명 생성 결과를 해석하지 못했습니다.")


def _validated_text(result, field, maximum_length, use_bullets=True):
    value = result.get(field) if isinstance(result, dict) else None
    if not isinstance(value, str):
        raise LLMGenerationError("배차 설명 생성 결과에 필요한 문구가 없습니다.")

    lines = [line.strip() for line in value.splitlines() if line.strip()]
    if not lines:
        raise LLMGenerationError("배차 설명 문구가 허용 형식을 벗어났습니다.")

    cleaned_lines = [line.lstrip("•-* ").strip() for line in lines]

    if use_bullets:
        text = "\n".join("• " + line for line in cleaned_lines)
    else:
        text = " ".join(cleaned_lines)

    if len(lines) > 3 or len(text) > maximum_length or "\x00" in text:
        raise LLMGenerationError("배차 설명 문구가 허용 형식을 벗어났습니다.")

    return text


def generate_package_explanation(context):
    """Generate validated customer, merchant, and rider text from package data."""
    settings = _load_settings()
    payload = {
        "model": settings["model"],
        "messages": build_messages(context),
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    response = _post_json(settings["url"], payload, settings["api_key"], settings["timeout"])
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise LLMGenerationError("배차 설명 생성 결과 형식이 올바르지 않습니다.")
    result = _extract_json(content)
    return {
        "consumer_text": _validated_text(result, "consumer_text", 220),
        "merchant_text": _validated_text(result, "merchant_text", 300, use_bullets=False),
        "rider_text": _validated_text(result, "rider_text", 500),
    }


def generate_demo_explanations(context):
    """Use deterministic copy for customer/rider and LLM copy for merchant in the demo."""
    fallback = demo_explanation_fallback(context)
    generated = generate_package_explanation(context)

    return {
        "consumer_text": fallback["consumer_text"],
        "merchant_text": generated["merchant_text"],
        "rider_text": fallback["rider_text"],
    }


def demo_explanation_fallback(context):
    """Return safe role copy when an LLM provider is unavailable.

    Demo API handlers can use this result instead of failing a state-changing
    request such as cook-start. It intentionally summarizes only supplied
    state and never fabricates ETA, route, or revenue values.
    """
    normalized = build_demo_explanation_context(context)
    stage = normalized.get("explanation_stage")
    merchant = normalized["merchant_order"]
    package = normalized["package"]
    score_detail = package.get("score_detail") or {}
    owner_cook_min = merchant.get("owner_cook_min")
    package_ready = package.get("package_id") is not None
    merchant_text = "조리·포장 안내를 준비하고 있어요."
    if owner_cook_min is not None:
        merchant_text = "현재 조리 기준은 %s분이에요. 조리 완료 시점에 맞춰 포장을 준비해 주세요." % owner_cook_min
    bundle_size = package.get("bundle_size")
    total_time = score_detail.get("total_time")
    food_sitting_time = score_detail.get("food_sitting_time")
    consumer_lines = ["• 배차가 확정되면 배송 상황을 안내해 드릴게요."]
    if package_ready:
        consumer_lines = ["• 배송이 시작될 준비가 됐어요."]
        if bundle_size:
            consumer_lines[0] = "• 총 %s건의 주문이 함께 배달돼요." % bundle_size
        if total_time is not None or food_sitting_time is not None:
            metrics = []
            if total_time is not None:
                metrics.append("총 소요 %s분" % total_time)
            if food_sitting_time is not None:
                metrics.append("음식 대기 %s분" % food_sitting_time)
            consumer_lines.append("• %s을 고려해 같은 배달로 묶였어요." % "과 ".join(metrics))
        dropoffs = [step for step in package.get("route_detail", []) if step.get("type") == "dropoff"]
        customer_order_id = normalized["customer_order"].get("order_id")
        for index, step in enumerate(dropoffs, start=1):
            if step.get("order_id") == customer_order_id:
                consumer_lines.append("• %s개 주문 중 %s번째로 배달될 예정이에요." % (len(dropoffs), index))
                break

    revenue = package.get("package_revenue")
    rider_lines = []
    if bundle_size:
        rider_lines.append("• 총 %s건을 함께 배달하는 제안이에요." % bundle_size)
    if revenue is not None:
        rider_lines.append("• 예상 수익은 %s원이에요." % revenue)
    courier_wait_time = score_detail.get("courier_wait_time")
    if courier_wait_time is not None:
        rider_lines.append("• 예상 라이더 대기시간은 %s분이에요." % courier_wait_time)
    if stage == "COOKING":
        merchant_text += " 아직 라이더가 수락하기 전이라 도착 시점은 확정되지 않았어요."
    elif stage == "MATCHED":
        rider_arrival = None
        merchant_order_id = merchant.get("order_id")
        for step in score_detail.get("timeline", []):
            if step.get("order_id") == merchant_order_id and step.get("type") == "pickup":
                rider_arrival = step.get("arrival_time_min")
                break
        merchant_lines = []
        if rider_arrival is not None:
            merchant_lines.append("라이더가 약 %s분 뒤 도착할 예정이에요." % rider_arrival)
        if owner_cook_min is not None:
            merchant_lines.append("설정한 %s분 조리시간을 기준으로 도착 시점에 맞춰 포장을 준비해 주세요." % owner_cook_min)
        merchant_text = " ".join(merchant_lines) or merchant_text

    return {
        "consumer_text": "\n".join(consumer_lines),
        "merchant_text": merchant_text,
        "rider_text": "\n".join(rider_lines[:3]) if package_ready else "• 배차 제안을 준비하고 있어요.",
    }
