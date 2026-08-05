from fastapi.testclient import TestClient

from app import app


def test_health_and_pages():
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        for path in ["/", "/customer", "/merchant", "/rider", "/demo"]:
            response = client.get(path)
            assert response.status_code == 200
            assert "text/html" in response.headers["content-type"]


def test_role_views_and_privacy():
    with TestClient(app) as client:
        customer = client.get("/api/customer/C-001").json()
        assert customer["order"]["customer_id"] == "C-001"
        assert all("delivery_address" not in step for step in customer["route"])
        assert any(not step["is_own"] for step in customer["route"])

        merchant = client.get("/api/merchant/S-001").json()
        assert all(order["store_id"] == "S-001" for order in merchant["orders"])

        rider = client.get("/api/rider/R-001").json()
        assert rider["package"]["accepted"] is False
        delivery_steps = [step for step in rider["steps"] if step["type"] == "DELIVERY"]
        assert all(step["address"] == "배차 수락 후 상세 주소 공개" for step in delivery_steps)


def test_realtime_actions_change_all_views():
    with TestClient(app) as client:
        client.post("/api/demo/reset")
        result = client.post("/api/rider/R-001/action", json={"action": "accept"})
        assert result.status_code == 200
        assert client.get("/api/customer/C-001").json()["rider"]["assigned"] is True
        assert client.get("/api/merchant/S-001").json()["rider"]["assigned"] is True
        rider = client.get("/api/rider/R-001").json()
        assert rider["package"]["accepted"] is True
        assert any("고객 주소" in step["address"] for step in rider["steps"] if step["type"] == "DELIVERY")


def test_delay_triggers_recalculation():
    with TestClient(app) as client:
        client.post("/api/demo/reset")
        response = client.post("/api/merchant/orders/O-002/action", json={"action": "delay", "delay_min": 7})
        assert response.status_code == 200
        customer = client.get("/api/customer/C-001").json()
        rider = client.get("/api/rider/R-001").json()
        assert customer["package"]["route_changed"] is True
        assert rider["package"]["route_changed"] is True


def test_explanations_have_three_reasons():
    with TestClient(app) as client:
        for role, entity in [("customer", "C-001"), ("merchant", "S-001"), ("rider", "R-001")]:
            response = client.get(f"/api/explanations/{role}/{entity}")
            assert response.status_code == 200
            payload = response.json()
            assert payload["role"] == role
            assert len(payload["reasons"]) == 3


def test_route_strategy_supports_pickup_first_and_preserves_constraints():
    with TestClient(app) as client:
        client.post("/api/demo/reset")
        default_steps = client.get("/api/rider/R-001").json()["steps"]
        assert [step["type"] for step in default_steps[:4]] == ["PICKUP", "PICKUP", "DELIVERY", "PICKUP"]

        response = client.post("/api/demo/route-strategy", json={"strategy": "pickup_first"})
        assert response.status_code == 200
        rider = client.get("/api/rider/R-001").json()
        assert rider["package"]["route_strategy"] == "pickup_first"
        assert [step["type"] for step in rider["steps"][:3]] == ["PICKUP", "PICKUP", "PICKUP"]
        assert all(step["type"] == "DELIVERY" for step in rider["steps"][3:])
        assert rider["package"]["quality_guard_passed"] is True


def test_route_strategy_cannot_change_after_route_started():
    with TestClient(app) as client:
        client.post("/api/demo/reset")
        client.post("/api/demo/route-strategy", json={"strategy": "pickup_first"})
        client.post("/api/rider/R-001/action", json={"action": "accept"})
        client.post("/api/rider/R-001/action", json={"action": "complete_step"})
        response = client.post("/api/demo/route-strategy", json={"strategy": "optimized"})
        assert response.status_code == 400


def test_map_config_and_map_scripts_are_available(monkeypatch):
    monkeypatch.setenv("MAP_PROVIDER", "naver")
    monkeypatch.delenv("NAVER_MAPS_NCP_KEY_ID", raising=False)
    with TestClient(app) as client:
        config = client.get("/api/config/maps")
        assert config.status_code == 200
        assert config.json()["provider"] == "naver"
        assert config.json()["has_credentials"] is False
        assert client.get("/static/maps.js").status_code == 200
        customer_html = client.get("/customer").text
        rider_html = client.get("/rider").text
        assert "/static/maps.js" in customer_html
        assert "/static/maps.js" in rider_html


def test_pickup_first_delay_keeps_all_remaining_pickups_before_delivery():
    with TestClient(app) as client:
        client.post("/api/demo/reset")
        client.post("/api/demo/route-strategy", json={"strategy": "pickup_first"})
        response = client.post("/api/merchant/orders/O-002/action", json={"action": "delay", "delay_min": 7})
        assert response.status_code == 200
        steps = client.get("/api/rider/R-001").json()["steps"]
        first_delivery = next(index for index, step in enumerate(steps) if step["type"] == "DELIVERY")
        assert all(step["type"] == "PICKUP" for step in steps[:first_delivery])
        assert sum(step["type"] == "PICKUP" for step in steps[:first_delivery]) == 3


def test_dummy_dataset_catalog_and_switching():
    with TestClient(app) as client:
        response = client.get("/api/demo/datasets")
        assert response.status_code == 200
        payload = response.json()
        ids = {item["dataset_id"] for item in payload["datasets"]}
        assert {"balanced", "rainy_rush", "store_delay", "pickup_first"}.issubset(ids)

        switched = client.post("/api/demo/dataset", json={"dataset_id": "rainy_rush"})
        assert switched.status_code == 200
        state = client.get("/api/state").json()
        assert state["dummy_dataset"]["dataset_id"] == "rainy_rush"
        assert state["weather"]["condition"] == "HEAVY_RAIN"
        assert state["packages"]["PKG-001"]["estimated_duration_min"] > 18

        reset = client.post("/api/demo/reset")
        assert reset.status_code == 200
        assert client.get("/api/state").json()["dummy_dataset"]["dataset_id"] == "rainy_rush"

        client.post("/api/demo/dataset", json={"dataset_id": "balanced"})


def test_invalid_dummy_dataset_is_rejected():
    with TestClient(app) as client:
        response = client.post("/api/demo/dataset", json={"dataset_id": "missing_dataset"})
        assert response.status_code == 400


def test_generated_dummy_catalog_counts():
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "data" / "dummy"
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["counts"]["stores"] == 12
    assert manifest["counts"]["customers"] == 36
    assert manifest["counts"]["riders"] == 8
    assert manifest["counts"]["historical_orders"] == 80
    assert manifest["counts"]["scenarios"] == 4


def test_reject_automatically_reoffers_to_next_rider():
    with TestClient(app) as client:
        client.post("/api/demo/dataset", json={"dataset_id": "balanced"})
        initial = client.get("/api/state").json()["packages"]["PKG-001"]
        assert initial["offered_rider_id"] == "R-001"
        assert initial["offer_attempt"] == 1

        response = client.post("/api/rider/R-001/action", json={"action": "reject"})
        assert response.status_code == 200
        package = client.get("/api/state").json()["packages"]["PKG-001"]
        assert package["status"] == "OFFERED"
        assert package["offered_rider_id"] == "R-002"
        assert package["offer_attempt"] == 2
        assert package["rejected_rider_ids"] == ["R-001"]
        assert package["offer_history"][-1]["rider_id"] == "R-002"

        rejected_view = client.get("/api/rider/R-001").json()
        next_view = client.get("/api/rider/R-002").json()
        assert rejected_view["package"]["can_accept"] is False
        assert rejected_view["package"]["was_rejected"] is True
        assert next_view["package"]["can_accept"] is True


def test_only_current_offered_rider_can_accept():
    with TestClient(app) as client:
        client.post("/api/demo/dataset", json={"dataset_id": "balanced"})
        wrong = client.post("/api/rider/R-002/action", json={"action": "accept"})
        assert wrong.status_code == 400
        client.post("/api/rider/R-001/action", json={"action": "reject"})
        accepted = client.post("/api/rider/R-002/action", json={"action": "accept"})
        assert accepted.status_code == 200
        package = client.get("/api/state").json()["packages"]["PKG-001"]
        assert package["rider_id"] == "R-002"
        assert package["status"] == "ASSIGNED"
        assert client.get("/api/rider/R-001").json()["package"]["accepted"] is False
        assert client.get("/api/rider/R-002").json()["package"]["accepted"] is True


def test_reassignment_fallback_after_all_candidates_reject():
    with TestClient(app) as client:
        client.post("/api/demo/dataset", json={"dataset_id": "balanced"})
        for rider_id in ["R-001", "R-002", "R-003", "R-004"]:
            response = client.post(f"/api/rider/{rider_id}/action", json={"action": "reject"})
            assert response.status_code == 200
        package = client.get("/api/state").json()["packages"]["PKG-001"]
        assert package["status"] == "NO_RIDER_AVAILABLE"
        assert package["offered_rider_id"] is None
        assert package["fallback_triggered"] is True
        assert package["rejected_rider_ids"] == ["R-001", "R-002", "R-003", "R-004"]


def test_demo_reject_endpoint_tracks_current_offer():
    with TestClient(app) as client:
        client.post("/api/demo/dataset", json={"dataset_id": "balanced"})
        first = client.post("/api/demo/rider-reject")
        second = client.post("/api/demo/rider-reject")
        assert first.status_code == 200
        assert second.status_code == 200
        package = client.get("/api/state").json()["packages"]["PKG-001"]
        assert package["offer_attempt"] == 3
        assert package["offered_rider_id"] == "R-003"


def test_offer_timeout_automatically_reoffers_to_next_rider():
    with TestClient(app) as client:
        client.post("/api/demo/dataset", json={"dataset_id": "balanced"})
        response = client.post("/api/demo/rider-timeout")
        assert response.status_code == 200
        package = client.get("/api/state").json()["packages"]["PKG-001"]
        assert package["offered_rider_id"] == "R-002"
        assert package["offer_attempt"] == 2
        assert package["timed_out_rider_ids"] == ["R-001"]
        assert package["offer_history"][0]["status"] == "TIMED_OUT"


def test_readme_directory_structure_exists():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    for directory in [
        "stream_processor",
        "sequencing_engine",
        "api",
        "batch",
        "vector_search",
        "common",
    ]:
        assert (root / directory).is_dir()
    assert (root / "api" / "main.py").is_file()
    assert (root / "sequencing_engine" / "dispatch.py").is_file()
