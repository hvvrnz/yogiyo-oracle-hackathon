"""Unit tests for demo explanation context and role output validation."""

import unittest

from explanation.demo_context import build_demo_explanation_context
from explanation.generator import _validated_text, demo_explanation_fallback
from explanation.prompt_templates import build_messages


class DemoExplanationContextTest(unittest.TestCase):
    def setUp(self):
        self.context = {
            "package": {
                "package_id": 80001,
                "package_type": "BUNDLE",
                "bundle_size": 3,
                "score": 41,
                "package_revenue": 12700,
                "hourly_revenue": 22500,
                "order_ids": [90001, 90002, 90003],
                "route_detail": [{"order_id": 90002, "type": "pickup"}],
            },
            "orders": [{"order_id": 90001, "store_name": "테스트 매장", "owner_cook_min": 20}],
            "customer_order": {"order_id": 90001, "delivery_address": "테스트 주소", "status": "MATCHED"},
            "merchant_order": {"order_id": 90001, "owner_cook_min": 20, "status": "COOKING"},
            "rider_profile": {"status": "AVAILABLE"},
            "next_stop": {"order_id": 90002, "type": "pickup", "label": "테스트 매장"},
        }

    def test_normalizes_final_demo_fields(self):
        normalized = build_demo_explanation_context(self.context)
        self.assertEqual(normalized["package"]["package_id"], 80001)
        self.assertEqual(normalized["customer_order"]["delivery_address"], "테스트 주소")
        self.assertEqual(normalized["merchant_order"]["owner_cook_min"], 20)
        self.assertEqual(normalized["next_stop"]["type"], "pickup")

    def test_prompt_requires_three_role_outputs(self):
        messages = build_messages(self.context)
        self.assertIn("merchant_text", messages[0]["content"])
        self.assertIn("한 문장이 끝날 때마다 반드시 줄바꿈", messages[1]["content"])
        self.assertIn("항목명과 숫자만 나열하지 마세요", messages[1]["content"])
        self.assertIn("consumer_context", messages[1]["content"])
        self.assertIn("rider_context", messages[1]["content"])
        self.assertNotIn("delivery_address", messages[1]["content"])
        self.assertNotIn("route_detail", messages[1]["content"])

    def test_validates_merchant_text_and_has_fallback(self):
        self.assertEqual(
            _validated_text({"merchant_text": "- 조리 기준: 20분\n포장 상태: 준비"}, "merchant_text", 300),
            "• 조리 기준: 20분\n• 포장 상태: 준비",
        )
        fallback = demo_explanation_fallback(self.context)
        self.assertIn("merchant_text", fallback)
        self.assertIn("20분", fallback["merchant_text"])
        self.assertTrue(all(line.startswith("• ") for line in fallback["rider_text"].splitlines()))
        self.assertIn("\n", fallback["rider_text"])
        self.assertNotIn("방문 순서", fallback["rider_text"])
        self.assertIn("함께 배달돼요", fallback["consumer_text"])
        self.assertIn("조리 기준은 20분", fallback["merchant_text"])


if __name__ == "__main__":
    unittest.main()
