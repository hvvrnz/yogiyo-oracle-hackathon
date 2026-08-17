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


def _validated_text(result, field, maximum_length):
    value = result.get(field) if isinstance(result, dict) else None
    if not isinstance(value, str):
        raise LLMGenerationError("배차 설명 생성 결과에 필요한 문구가 없습니다.")
    text = value.strip()
    if not text or len(text) > maximum_length or "\x00" in text:
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
        "merchant_text": _validated_text(result, "merchant_text", 300),
        "rider_text": _validated_text(result, "rider_text", 500),
    }


def generate_demo_explanations(context):
    """Generate role-scoped copy from final demo API state."""
    return generate_package_explanation(context)


def demo_explanation_fallback(context):
    """Return safe role copy when an LLM provider is unavailable.

    Demo API handlers can use this result instead of failing a state-changing
    request such as cook-start. It intentionally summarizes only supplied
    state and never fabricates ETA, route, or revenue values.
    """
    normalized = build_demo_explanation_context(context)
    merchant = normalized["merchant_order"]
    package = normalized["package"]
    owner_cook_min = merchant.get("owner_cook_min")
    package_ready = package.get("package_id") is not None
    merchant_text = "조리·포장 안내를 준비 중입니다."
    if owner_cook_min is not None:
        merchant_text = "설정한 조리시간 %s분을 기준으로 조리·포장을 준비해 주세요." % owner_cook_min
    return {
        "consumer_text": "배차가 확정되면 배송 진행 상황을 안내해 드립니다." if not package_ready else "배차가 확정되어 배송을 준비하고 있습니다.",
        "merchant_text": merchant_text,
        "rider_text": "패키지의 수익과 방문 순서를 확인한 뒤 수락해 주세요." if package_ready else "배차 제안 정보를 준비 중입니다.",
    }
