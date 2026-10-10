from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "name",
            name="uq_categories_tenant_name",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    products: Mapped[list["Product"]] = relationship(
        back_populates="category_ref"
    )


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "sku",
            name="uq_products_tenant_sku",
        ),
        CheckConstraint(
            "retail_price >= 0",
            name="ck_products_retail_price_nonnegative",
        ),
        CheckConstraint(
            "cost_price >= 0",
            name="ck_products_cost_price_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    sku: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    # Retained for compatibility with the existing frontend.
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    retail_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    cost_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    category_ref: Mapped["Category | None"] = relationship(
        back_populates="products"
    )
    inventory: Mapped[list["Inventory"]] = relationship(
        back_populates="product"
    )
    supplier_links: Mapped[list["SupplierProduct"]] = relationship(
        back_populates="product"
    )


class Store(Base):
    __tablename__ = "stores"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "code",
            name="uq_stores_tenant_code",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    inventory: Mapped[list["Inventory"]] = relationship(
        back_populates="store"
    )


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint(
            "store_id",
            "product_id",
            name="uq_inventory_store_product",
        ),
        CheckConstraint(
            "on_hand >= 0",
            name="ck_inventory_on_hand_nonnegative",
        ),
        CheckConstraint(
            "reserved >= 0",
            name="ck_inventory_reserved_nonnegative",
        ),
        CheckConstraint(
            "reserved <= on_hand",
            name="ck_inventory_reserved_lte_on_hand",
        ),
        CheckConstraint(
            "reorder_point >= 0",
            name="ck_inventory_reorder_point_nonnegative",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_inventory_version_positive",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False
    )
    on_hand: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    reserved: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    reorder_point: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )

    store: Mapped["Store"] = relationship(back_populates="inventory")
    product: Mapped["Product"] = relationship(back_populates="inventory")

    @property
    def available_qty(self) -> int:
        return self.on_hand - self.reserved


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    inventory_id: Mapped[int] = mapped_column(
        ForeignKey("inventory.id"), nullable=False
    )
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint(
            "lead_time_days >= 0",
            name="ck_suppliers_lead_time_nonnegative",
        ),
        CheckConstraint(
            "on_time_delivery_rate >= 0 "
            "AND on_time_delivery_rate <= 100",
            name="ck_suppliers_delivery_rate_range",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    phone: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    lead_time_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=7
    )
    on_time_delivery_rate: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    products: Mapped[list["SupplierProduct"]] = relationship(
        back_populates="supplier"
    )


class SupplierProduct(Base):
    __tablename__ = "supplier_products"
    __table_args__ = (
        UniqueConstraint(
            "supplier_id",
            "product_id",
            name="uq_supplier_product",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="ck_supplier_product_cost_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False
    )
    supplier_sku: Mapped[str | None] = mapped_column(
        String(80), nullable=True
    )
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    supplier: Mapped["Supplier"] = relationship(
        back_populates="products"
    )
    product: Mapped["Product"] = relationship(
        back_populates="supplier_links"
    )


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "order_number",
            name="uq_sales_orders_tenant_order_number",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    order_number: Mapped[str] = mapped_column(
        String(60), nullable=False
    )
    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="completed"
    )
    sold_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    items: Mapped[list["SalesItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )


class SalesItem(Base):
    __tablename__ = "sales_items"
    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_sales_item_quantity_positive",
        ),
        CheckConstraint(
            "unit_price >= 0",
            name="ck_sales_item_price_nonnegative",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="ck_sales_item_cost_nonnegative",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_item_discount_nonnegative",
        ),
        CheckConstraint(
            "returned_units >= 0 AND returned_units <= quantity",
            name="ck_sales_item_returned_units_valid",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    returned_units: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    order: Mapped["SalesOrder"] = relationship(
        back_populates="items"
    )


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "order_number",
            name="uq_purchase_orders_tenant_order_number",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(
        String(60), nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False
    )
    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="draft"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_po_item_quantity_positive",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="ck_po_item_cost_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    order: Mapped["PurchaseOrder"] = relationship(
        back_populates="items"
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    request_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    entity_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    outcome: Mapped[str] = mapped_column(
        String(30), nullable=False
    )
    details: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class ActionConfirmation(Base):
    __tablename__ = "action_confirmations"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    actor_id: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    operation: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    payload_hash: Mapped[str] = mapped_column(
        String(64), nullable=False
    )
    expected_version: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "actor_id",
            "operation",
            "idempotency_key",
            name="uq_idempotency_actor_operation_key",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    actor_id: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    operation: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(200), nullable=False
    )
    payload_hash: Mapped[str] = mapped_column(
        String(64), nullable=False
    )
    response_status: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    response_body: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )