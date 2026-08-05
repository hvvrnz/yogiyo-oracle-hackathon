from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MerchantActionRequest(BaseModel):
    action: Literal["accept", "start", "delay", "ready"]
    delay_min: int = Field(default=0, ge=0, le=30)


class RiderActionRequest(BaseModel):
    action: Literal["accept", "reject", "complete_step"]


class WeatherRequest(BaseModel):
    condition: Literal["CLEAR", "RAIN"]


class SimulationRequest(BaseModel):
    running: bool


class RouteStrategyRequest(BaseModel):
    strategy: Literal["optimized", "pickup_first"]


class DummyDatasetRequest(BaseModel):
    dataset_id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")


class ExplanationReason(BaseModel):
    title: str
    description: str
    metric: str


class RoleExplanation(BaseModel):
    role: Literal["customer", "merchant", "rider"]
    headline: str
    summary: str
    reasons: list[ExplanationReason]
    note: str
    source: str = "rule"
