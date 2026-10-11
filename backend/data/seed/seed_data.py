
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db.models import (
    Category,
    Inventory,
    Product,
    SalesItem,
    SalesOrder,
    Store,
    Supplier,
    SupplierProduct,
)
from app.db.session import SessionLocal


CATEGORIES = ["Accessories", "Fashion", "Beauty", "Lifestyle"]

STORES = [
    {"code": "VIE", "name": "Vienna Flagship"},
    {"code": "PAR", "name": "Paris Boutique"},
    {"code": "MIL", "name": "Milan Store"},
]

PRODUCTS = [
    {"sku": "VEL-201", "name": "Signature Leather Tote", "category": "Accessories", "price": "249.00", "cost": "110.00", "active": True},
    {"sku": "VEL-305", "name": "Silk Evening Scarf", "category": "Fashion", "price": "89.00", "cost": "32.00", "active": True},
    {"sku": "VEL-412", "name": "Premium Skincare Set", "category": "Beauty", "price": "135.00", "cost": "58.00", "active": True},
    {"sku": "VEL-508", "name": "Velora Eau de Parfum", "category": "Beauty", "price": "125.00", "cost": "45.00", "active": True},
    {"sku": "VEL-609", "name": "Cashmere Wrap", "category": "Fashion", "price": "320.00", "cost": "155.00", "active": True},
    {"sku": "VEL-710", "name": "Artisan Ceramic Collection", "category": "Lifestyle", "price": "175.00", "cost": "72.00", "active": True},
    {"sku": "VEL-811", "name": "Classic Gold-Tone Watch", "category": "Accessories", "price": "295.00", "cost": "130.00", "active": True},
    {"sku": "VEL-912", "name": "Linen Summer Ensemble", "category": "Fashion", "price": "185.00", "cost": "75.00", "active": False},
]

INVENTORY = [
    {"sku": "VEL-201", "store": "VIE", "on_hand": 5, "reserved": 2, "reorder_point": 10},
    {"sku": "VEL-305", "store": "VIE", "on_hand": 8, "reserved": 3, "reorder_point": 15},
    {"sku": "VEL-412", "store": "PAR", "on_hand": 2, "reserved": 2, "reorder_point": 8},
    {"sku": "VEL-508", "store": "MIL", "on_hand": 45, "reserved": 4, "reorder_point": 12},
    {"sku": "VEL-609", "store": "PAR", "on_hand": 24, "reserved": 1, "reorder_point": 9},
    {"sku": "VEL-710", "store": "MIL", "on_hand": 18, "reserved": 3, "reorder_point": 7},
    {"sku": "VEL-811", "store": "VIE", "on_hand": 12, "reserved": 3, "reorder_point": 10},
    {"sku": "VEL-912", "store": "MIL", "on_hand": 32, "reserved": 4, "reorder_point": 12},
]

SUPPLIERS = [
    {
        "name": "Atelier Firenze",
        "email": "orders@atelier-firenze.example",
        "phone": "+39 055 000 1001",
        "lead_time_days": 14,
        "on_time_delivery_rate": 96,
        "active": True,
        "skus": ["VEL-201", "VEL-811"],
    },
    {
        "name": "Maison Soie",
        "email": "trade@maison-soie.example",
        "phone": "+33 1 00 00 1002",
        "lead_time_days": 12,
        "on_time_delivery_rate": 91,
        "active": True,
        "skus": ["VEL-305", "VEL-609"],
    },
    {
        "name": "Lumina Laboratories",
        "email": "supply@lumina-labs.example",
        "phone": "+43 1 000 1003",
        "lead_time_days": 9,
        "on_time_delivery_rate": 98,
        "active": True,
        "skus": ["VEL-412", "VEL-508"],
    },
    {
        "name": "Nordic Form Studio",
        "email": "sales@nordic-form.example",
        "phone": "+46 8 000 1004",
        "lead_time_days": 20,
        "on_time_delivery_rate": 84,
        "active": True,
        "skus": ["VEL-710"],
    },
    {
        "name": "Linen & Loom",
        "email": "hello@linen-loom.example",
        "phone": "+351 21 000 1005",
        "lead_time_days": 16,
        "on_time_delivery_rate": 89,
        "active": False,
        "skus": ["VEL-912"],
    },
]

# Synthetic demo sales for validating demand calculations.
# These are test fixtures, not actual business transactions.
SALES_FIXTURES = [
    {
        "order_number": "DEMO-SALE-VIE-001",
        "store": "VIE",
        "days_ago": 3,
        "items": [
            {"sku": "VEL-201", "quantity": 4},
            {"sku": "VEL-305", "quantity": 2},
        ],
    },
    {
        "order_number": "DEMO-SALE-VIE-002",
        "store": "VIE",
        "days_ago": 10,
        "items": [
            {"sku": "VEL-201", "quantity": 5},
            {"sku": "VEL-811", "quantity": 3},
        ],
    },
    {
        "order_number": "DEMO-SALE-VIE-003",
        "store": "VIE",
        "days_ago": 18,
        "items": [
            {"sku": "VEL-305", "quantity": 4},
            {"sku": "VEL-811", "quantity": 2},
        ],
    },
    {
        "order_number": "DEMO-SALE-PAR-001",
        "store": "PAR",
        "days_ago": 5,
        "items": [
            {"sku": "VEL-412", "quantity": 6},
        ],
    },
    {
        "order_number": "DEMO-SALE-PAR-002",
        "store": "PAR",
        "days_ago": 14,
        "items": [
            {"sku": "VEL-412", "quantity": 3},
            {"sku": "VEL-609", "quantity": 2},
        ],
    },
    {
        "order_number": "DEMO-SALE-MIL-001",
        "store": "MIL",
        "days_ago": 7,
        "items": [
            {"sku": "VEL-508", "quantity": 2},
            {"sku": "VEL-710", "quantity": 1},
        ],
    },
]


def seed_database() -> None:
    with SessionLocal() as session:
        try:
            # Categories
            categories_by_name = {}
            for name in CATEGORIES:
                category = session.scalar(
                    select(Category).where(Category.name == name)
                )
                if category is None:
                    category = Category(name=name)
                    session.add(category)
                categories_by_name[name] = category

            session.flush()

            # Stores
            stores_by_code = {}
            for item in STORES:
                store = session.scalar(
                    select(Store).where(Store.code == item["code"])
                )
                if store is None:
                    store = Store(**item)
                    session.add(store)
                else:
                    store.name = item["name"]
                stores_by_code[item["code"]] = store

            # Products
            products_by_sku = {}
            for item in PRODUCTS:
                category = categories_by_name[item["category"]]
                product = session.scalar(
                    select(Product).where(Product.sku == item["sku"])
                )
                values = {
                    "name": item["name"],
                    "category": item["category"],
                    "category_id": category.id,
                    "retail_price": Decimal(item["price"]),
                    "cost_price": Decimal(item["cost"]),
                    "is_active": item["active"],
                }

                if product is None:
                    product = Product(sku=item["sku"], **values)
                    session.add(product)
                else:
                    for key, value in values.items():
                        setattr(product, key, value)

                products_by_sku[item["sku"]] = product

            session.flush()

            # Inventory
            for item in INVENTORY:
                product = products_by_sku[item["sku"]]
                store = stores_by_code[item["store"]]

                inventory = session.scalar(
                    select(Inventory).where(
                        Inventory.product_id == product.id,
                        Inventory.store_id == store.id,
                    )
                )

                values = {
                    "on_hand": item["on_hand"],
                    "reserved": item["reserved"],
                    "reorder_point": item["reorder_point"],
                }

                if inventory is None:
                    session.add(
                        Inventory(
                            product_id=product.id,
                            store_id=store.id,
                            **values,
                        )
                    )
                else:
                    for key, value in values.items():
                        setattr(inventory, key, value)

            # Suppliers and product coverage
            for item in SUPPLIERS:
                supplier = session.scalar(
                    select(Supplier).where(
                        Supplier.name == item["name"]
                    )
                )

                values = {
                    "email": item["email"],
                    "phone": item["phone"],
                    "lead_time_days": item["lead_time_days"],
                    "on_time_delivery_rate": item[
                        "on_time_delivery_rate"
                    ],
                    "is_active": item["active"],
                }

                if supplier is None:
                    supplier = Supplier(name=item["name"], **values)
                    session.add(supplier)
                else:
                    for key, value in values.items():
                        setattr(supplier, key, value)

                session.flush()

                for sku in item["skus"]:
                    product = products_by_sku[sku]

                    link = session.scalar(
                        select(SupplierProduct).where(
                            SupplierProduct.supplier_id == supplier.id,
                            SupplierProduct.product_id == product.id,
                        )
                    )

                    if link is None:
                        session.add(
                            SupplierProduct(
                                supplier_id=supplier.id,
                                product_id=product.id,
                                unit_cost=product.cost_price,
                            )
                        )
                    else:
                        link.unit_cost = product.cost_price

            # Demo sales orders. Upsert only our named demo orders.
            now = datetime.now(timezone.utc)

            for fixture in SALES_FIXTURES:
                store = stores_by_code[fixture["store"]]
                sold_at = now - timedelta(days=fixture["days_ago"])

                order = session.scalar(
                    select(SalesOrder).where(
                        SalesOrder.order_number
                        == fixture["order_number"]
                    )
                )

                if order is None:
                    order = SalesOrder(
                        order_number=fixture["order_number"],
                        store_id=store.id,
                        status="completed",
                        sold_at=sold_at,
                    )
                    session.add(order)
                    session.flush()
                else:
                    order.store_id = store.id
                    order.status = "completed"
                    order.sold_at = sold_at

                # Replace items belonging to this demo order only.
                order.items.clear()

                for item in fixture["items"]:
                    product = products_by_sku[item["sku"]]
                    order.items.append(
                        SalesItem(
                            product_id=product.id,
                            quantity=item["quantity"],
                            unit_price=product.retail_price,
                            unit_cost=product.cost_price,
                            discount_amount=Decimal("0.00"),
                            returned_units=0,
                        )
                    )

            session.commit()

            print("Velora demo data seeded successfully.")
            print(f"Categories: {len(CATEGORIES)}")
            print(f"Stores: {len(STORES)}")
            print(f"Products: {len(PRODUCTS)}")
            print(f"Inventory records: {len(INVENTORY)}")
            print(f"Suppliers: {len(SUPPLIERS)}")
            print(f"Demo sales orders: {len(SALES_FIXTURES)}")

        except Exception:
            session.rollback()
            raise


if __name__ == "__main__":
    seed_database()
