
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.inventory import router as inventory_router
from app.api.routes.products import router as products_router
from app.api.routes.purchase_orders import router as purchase_orders_router
from app.api.routes.sales import router as sales_router
from app.api.routes.suppliers import router as suppliers_router
from app.api.routes.agent import router as agent_router
from app.api.routes.metadata import router as metadata_router


app = FastAPI(
    title="BizPilot AI API",
    version="0.1.0",
    description=(
        "Operational backend for BizPilot AI. "
        "The current Velora dataset includes synthetic demo records."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
          "http://localhost:5173",
          "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-Request-ID",
        "X-Confirmation-Token",
        "X-Demo-Actor-Id",
        "X-Demo-Tenant-Id",
        "X-Demo-Role",
    ],
)

app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(purchase_orders_router)
app.include_router(sales_router)
app.include_router(suppliers_router)
app.include_router(agent_router)
app.include_router(metadata_router)


@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "service": "bizpilot-ai-backend",
        "data_mode": "synthetic_demo",
    }
