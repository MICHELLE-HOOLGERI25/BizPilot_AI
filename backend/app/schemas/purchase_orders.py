
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PurchaseOrderItemCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    quantity: int = Field(gt=0, le=100000)


class PurchaseOrderCreate(BaseModel):
    supplier_id: int = Field(gt=0)
    store_code: str = Field(min_length=1, max_length=20)
    items: list[PurchaseOrderItemCreate] = Field(min_length=1, max_length=100)


class PurchaseOrderItemResponse(BaseModel):
    product_id: int
    sku: str
    product_name: str
    quantity: int
    unit_cost: Decimal

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderResponse(BaseModel):
    id: int
    order_number: str
    supplier_id: int
    supplier_name: str
    store_id: int
    store_code: str
    status: str
    created_at: datetime
    items: list[PurchaseOrderItemResponse]


class PurchaseOrderListResponse(BaseModel):
    data: list[PurchaseOrderResponse]
    total: int
