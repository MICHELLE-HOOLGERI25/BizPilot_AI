
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    description: str | None = None
    category: str | None = None
    retail_price: Decimal
    cost_price: Decimal
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ProductListResponse(BaseModel):
    data: list[ProductResponse]
    page: int
    page_size: int
    total: int


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: str = Field(min_length=1, max_length=100)
    retail_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    cost_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    is_active: bool = True

    @field_validator("sku", "name", "category")
    @classmethod
    def strip_required_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    retail_price: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    cost_price: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    is_active: bool | None = None

    @field_validator("name", "category")
    @classmethod
    def strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value
