"""Contract tests for LLM fields added to final demo API responses."""

import unittest

from api.routers import demo


class DemoLlmResponseTest(unittest.TestCase):
    def setUp(self):
        demo.demo_reset_scenario()
        demo.demo_explanations[(demo.PACKAGE_ID, "COOKING")] = {
            "consumer_text": "고객 안내",
            "merchant_text": "사장님 안내",
            "rider_text": "라이더 안내",
        }

    def tearDown(self):
        demo.demo_reset_scenario()

    def test_fields_are_added_without_replacing_existing_response_data(self):
        demo.demo_state["step"] = 1
        merchant = demo.demo_merchant_next()
        offer = demo.demo_rider_offers()["offers"][0]
        self.assertEqual(merchant["status"], "COOKING")
        self.assertEqual(merchant["merchant_text"], "사장님 안내")
        self.assertEqual(offer["package_id"], demo.PACKAGE_ID)
        self.assertEqual(offer["rider_text"], "라이더 안내")

        demo.demo_explanations[(demo.PACKAGE_ID, "MATCHED")] = {
            "consumer_text": "고객 안내",
            "merchant_text": "수락 후 사장님 안내",
            "rider_text": "라이더 안내",
        }
        demo.demo_state["step"] = 2
        customer = demo.demo_customer_order()
        merchant_after_match = demo.demo_merchant_next()
        self.assertEqual(customer["status"], "MATCHED")
        self.assertEqual(customer["consumer_text"], "고객 안내")
        self.assertEqual(merchant_after_match["merchant_text"], "수락 후 사장님 안내")

    def test_reset_clears_cached_explanations(self):
        demo.demo_reset_scenario()
        self.assertEqual(demo.demo_explanations, {})


if __name__ == "__main__":
    unittest.main()
