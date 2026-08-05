from __future__ import annotations

import json
import os
from typing import Any

from common.models import ExplanationReason, RoleExplanation


def rule_customer(view: dict[str, Any]) -> RoleExplanation:
    package = view["package"]
    order = view["order"]
    margin = order["quality_margin_min"]
    return RoleExplanation(
        role="customer",
        headline=f"조리시간과 동선이 맞는 {package['bundle_size']}건이에요",
        summary=(
            f"현재 {package['route_strategy_label']} 방식이며, 세 주문의 조리 완료 예상 시각 차이가 {package['ready_gap_min']}분이고 이동 방향이 "
            f"{package['route_overlap_pct']}% 겹쳐 함께 배달하도록 묶었어요. 고객님의 음식은 품질 기준 안에서 도착하도록 경로를 제한했어요."
        ),
        reasons=[
            ExplanationReason(
                title="조리시간 동기화",
                description=f"조리 완료 예상 시각 차이가 {package['ready_gap_min']}분이라 라이더 대기와 음식 방치를 줄일 수 있어요.",
                metric=f"완료 편차 {package['ready_gap_min']}분",
            ),
            ExplanationReason(
                title="겹치는 이동 동선",
                description=f"이동 경로가 {package['route_overlap_pct']}% 겹치고 추가 이동거리가 약 {package['extra_distance_km']}km예요.",
                metric=f"경로 중복 {package['route_overlap_pct']}%",
            ),
            ExplanationReason(
                title="음식 품질 보호",
                description=f"예상 가방 체류시간은 {order['bag_time_min']}분으로 제한 {order['bag_time_limit_min']}분보다 {margin}분 여유가 있어요.",
                metric=f"{order['bag_time_min']}분 / {order['bag_time_limit_min']}분",
            ),
        ],
        note=f"알고리즘이 {package['candidate_route_count']}개 후보 경로를 비교했으며, 조리나 교통 상황이 달라지면 다시 계산해 안내해드려요.",
    )


def rule_merchant(view: dict[str, Any]) -> RoleExplanation:
    order = view["orders"][0]
    rider = view["rider"]
    package = view["package"]
    return RoleExplanation(
        role="merchant",
        headline=f"{order['target_ready_label']}까지 완료하면 좋아요",
        summary=(
            f"현재 {package['route_strategy_label']} 경로를 기준으로 라이더는 {rider['arrival_label']} 전후 도착할 예정이며, 현재 예측대로라면 대기시간을 약 "
            f"{order['expected_rider_wait_min']}분으로 줄일 수 있어요."
        ),
        reasons=[
            ExplanationReason(
                title="조리 완료 목표",
                description=f"최근 조리 이력과 현재 혼잡도를 반영한 예상 조리시간은 {order['predicted_cooking_min']}분이에요.",
                metric=order["target_ready_label"],
            ),
            ExplanationReason(
                title="라이더 도착 맞춤",
                description=f"라이더 도착 예상과 조리 완료 목표를 맞춰 음식 방치와 라이더 대기를 함께 줄여요.",
                metric=f"도착까지 {rider['remaining_min']}분" if rider["remaining_min"] is not None else "픽업 완료",
            ),
            ExplanationReason(
                title="패키지 동기화",
                description=f"다른 주문과 조리 완료 예상 차이가 {package['ready_gap_min']}분인 묶음에 포함되어 있어요.",
                metric=f"3건 편차 {package['ready_gap_min']}분",
            ),
        ],
        note="실제 조리가 늦어질 경우 5분 또는 10분 지연을 입력하면 라이더 경로와 고객 ETA를 다시 계산합니다.",
    )


def rule_rider(view: dict[str, Any]) -> RoleExplanation:
    package = view["package"]
    return RoleExplanation(
        role="rider",
        headline=f"{package['estimated_duration_min']}분에 {package['bundle_size']}건 완료 예상",
        summary=(
            f"현재 {package['route_strategy_label']} 방식이며, 조리 완료 시각이 가깝고 이동 경로가 {package['route_overlap_pct']}% 겹치는 배차예요. "
            f"예상 시간당 환산 수익은 {package['hourly_revenue']:,}원이에요."
        ),
        reasons=[
            ExplanationReason(
                title="짧은 매장 대기",
                description=f"세 매장의 조리 완료 예상 차이가 {package['ready_gap_min']}분이고 총 대기시간은 약 {package['total_wait_min']}분이에요.",
                metric=f"대기 {package['total_wait_min']}분",
            ),
            ExplanationReason(
                title="효율적인 동선",
                description=f"추가 이동거리는 약 {package['extra_distance_km']}km이며 추천 순서대로 움직이면 총 {package['total_distance_km']}km예요.",
                metric=f"총 {package['total_distance_km']}km",
            ),
            ExplanationReason(
                title="예상 수익",
                description=f"패키지 예상 수익 {package['package_revenue']:,}원을 {package['estimated_duration_min']}분 안에 완료하는 기준이에요.",
                metric=f"시간당 {package['hourly_revenue']:,}원",
            ),
        ],
        note="배차 수락 전에는 고객의 상세 주소를 숨기며, 수락 후 현재 수행 단계에 필요한 주소만 제공합니다.",
    )


RULE_BUILDERS = {
    "customer": rule_customer,
    "merchant": rule_merchant,
    "rider": rule_rider,
}


def _oci_prompt(role: str, rule_result: RoleExplanation, trusted_view: dict[str, Any]) -> list[dict[str, str]]:
    system = (
        "당신은 요기요 해커톤 데모의 역할별 설명 작성기입니다. 이미 확정된 알고리즘 수치만 사용하세요. "
        "배차, ETA, 경로, 수치를 새로 계산하지 마세요. 다른 고객의 개인정보를 만들거나 노출하지 마세요. "
        "보장, 절대, 무조건 같은 과장 표현을 사용하지 마세요. 반드시 JSON만 반환하세요."
    )
    contract = {
        "role": role,
        "headline": "string",
        "summary": "string",
        "reasons": [{"title": "string", "description": "string", "metric": "string"}],
        "note": "string",
        "source": "oci",
    }
    user = {
        "task": f"{role} 화면에 표시할 설명을 작성하세요.",
        "trusted_view": trusted_view,
        "fallback_example": rule_result.model_dump(),
        "output_contract": contract,
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
    ]


def generate_explanation(role: str, view: dict[str, Any]) -> RoleExplanation:
    if role not in RULE_BUILDERS:
        raise ValueError("unsupported role")
    fallback = RULE_BUILDERS[role](view)
    if os.getenv("GENAI_MODE", "mock").lower() != "oci":
        return fallback
    api_key = os.getenv("OCI_GENAI_API_KEY")
    base_url = os.getenv("OCI_GENAI_BASE_URL")
    model = os.getenv("OCI_GENAI_MODEL", "openai.gpt-oss-20b")
    if not api_key or not base_url:
        return fallback
    try:
        from openai import OpenAI

        trusted_view = {
            "version": view.get("version"),
            "order": view.get("order"),
            "package": view.get("package"),
            "rider": view.get("rider"),
            "weather": view.get("weather"),
            "store": view.get("store"),
            "orders": view.get("orders"),
        }
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=8.0)
        response = client.chat.completions.create(
            model=model,
            messages=_oci_prompt(role, fallback, trusted_view),
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        result = RoleExplanation.model_validate_json(content)
        result.source = "oci"
        return result
    except Exception:
        return fallback
