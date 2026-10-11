
from fastapi import APIRouter

from app.agent.graph import run_host_agent
from app.agent.schemas import AgentRequest
from app.api.routes.inventory import (
    DbSession,
    InventoryReader,
    replenishment_recommendations,
)

router = APIRouter(prefix="/api/v1/agent", tags=["host agent"])


@router.post("/run")
def run_agent(
    payload: AgentRequest,
    db: DbSession,
    actor: InventoryReader,
):
    def get_recommendations(max_days_of_cover: float):
        return replenishment_recommendations(
            db=db,
            actor=actor,
            max_days_of_cover=max_days_of_cover,
            demand_window_days=30,
            safety_stock_days=3,
        )

    result = run_host_agent(
        payload.request,
        recommendations_provider=get_recommendations,
    )

    return result.model_dump()
