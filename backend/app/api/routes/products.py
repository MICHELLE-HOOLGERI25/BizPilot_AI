import json
import re
from typing import Annotated
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import Actor, require_permission
from app.db.models import AuditLog, Category, Product
from app.db.session import SessionLocal
from app.schemas.products import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)

router = APIRouter(prefix="/api/v1/products", tags=["products"])

READ_PERMISSION = "products:read"
WRITE_PERMISSION = "products:write"


def get_db():
    with SessionLocal() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]


def request_id_for(request: Request) -> str:
    supplied = request.headers.get("X-Request-ID", "").strip()

    if supplied and len(supplied) <= 100 and re.fullmatch(
        r"[A-Za-z0-9_.-]+", supplied
    ):
        return supplied

    return str(uuid4())


def write_audit(
    db: Session,
    *,
    actor: Actor,
    request_id: str,
    action: str,
    outcome: str,
    entity_id: str | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.actor_id,
            tenant_id=actor.tenant_id,
            request_id=request_id,
            action=action,
            entity_type="product",
            entity_id=entity_id,
            outcome=outcome,
            details=(
                json.dumps(details, sort_keys=True, default=str)
                if details
                else None
            ),
        )
    )


def get_or_create_category(
    db: Session,
    name: str,
    tenant_id: str,
) -> Category:
    """Find or create a category within the authenticated tenant."""
    normalized_name = name.strip()

    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Category cannot be empty",
        )

    category = db.scalar(
        select(Category).where(
            Category.tenant_id == tenant_id,
            func.lower(Category.name) == normalized_name.lower(),
        )
    )

    if category is None:
        category = Category(
            tenant_id=tenant_id,
            name=normalized_name,
        )
        db.add(category)
        db.flush()

    return category


def get_product_or_404(
    db: Session,
    sku: str,
    tenant_id: str,
) -> Product:
    """Return a product belonging to the requested tenant only."""
    product = db.scalar(
        select(Product).where(
            Product.tenant_id == tenant_id,
            Product.sku == sku,
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return product


@router.get("", response_model=ProductListResponse)
def list_products(
    request: Request,
    db: DbSession,
    actor: Annotated[
        Actor, Depends(require_permission(READ_PERMISSION))
    ],
    q: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=100),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    filters = [
    Product.tenant_id == actor.tenant_id,
    Product.deleted_at.is_(None),
    ]

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        filters.append(
            or_(
                Product.sku.ilike(search_term),
                Product.name.ilike(search_term),
            )
        )

    if category and category.strip():
        filters.append(
            func.lower(Product.category) == category.strip().lower()
        )

    if is_active is not None:
        filters.append(Product.is_active == is_active)

    total = db.scalar(
        select(func.count())
        .select_from(Product)
        .where(*filters)
    ) or 0

    products = db.scalars(
        select(Product)
        .where(*filters)
        .order_by(Product.sku.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return ProductListResponse(
        data=[
            ProductResponse.model_validate(product)
            for product in products
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{sku}", response_model=ProductResponse)
def get_product(
    sku: str,
    db: DbSession,
    actor: Annotated[
        Actor, Depends(require_permission(READ_PERMISSION))
    ],
):
    return get_product_or_404(db, sku, actor.tenant_id)


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    payload: ProductCreate,
    request: Request,
    response: Response,
    db: DbSession,
    actor: Annotated[
        Actor, Depends(require_permission(WRITE_PERMISSION))
    ],
):
    request_id = request_id_for(request)
    tenant_id = actor.tenant_id
    sku = payload.sku.strip()

    existing = db.scalar(
        select(Product).where(
            Product.tenant_id == tenant_id,
            Product.sku == sku,
        )
    )

    if existing is not None:
        write_audit(
            db,
            actor=actor,
            request_id=request_id,
            action="product.create",
            outcome="denied",
            entity_id=sku,
            details={"reason": "duplicate_sku"},
        )
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product SKU '{sku}' already exists",
        )

    try:
        category = get_or_create_category(
            db,
            payload.category,
            tenant_id,
        )

        product = Product(
            tenant_id=tenant_id,
            sku=sku,
            name=payload.name,
            description=payload.description,
            category=category.name,
            category_id=category.id,
            retail_price=payload.retail_price,
            cost_price=payload.cost_price,
            is_active=payload.is_active,
        )

        db.add(product)
        db.flush()

        write_audit(
            db,
            actor=actor,
            request_id=request_id,
            action="product.create",
            outcome="success",
            entity_id=sku,
            details={"product_id": product.id},
        )

        db.commit()
        db.refresh(product)

        response.headers["X-Request-ID"] = request_id
        return product

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product could not be created because of a data conflict",
        ) from None

    except Exception:
        db.rollback()
        raise


@router.patch("/{sku}", response_model=ProductResponse)
def update_product(
    sku: str,
    payload: ProductUpdate,
    request: Request,
    response: Response,
    db: DbSession,
    actor: Annotated[
        Actor, Depends(require_permission(WRITE_PERMISSION))
    ],
):
    request_id = request_id_for(request)
    tenant_id = actor.tenant_id

    try:
        product = get_product_or_404(db, sku, tenant_id)

    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            write_audit(
                db,
                actor=actor,
                request_id=request_id,
                action="product.update",
                outcome="denied",
                entity_id=sku,
                details={"reason": "not_found"},
            )
            db.commit()

        raise

    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        write_audit(
            db,
            actor=actor,
            request_id=request_id,
            action="product.update",
            outcome="denied",
            entity_id=sku,
            details={"reason": "empty_update"},
        )
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one field to update",
        )

    for field in (
        "name",
        "category",
        "retail_price",
        "cost_price",
        "is_active",
    ):
        if field in changes and changes[field] is None:
            write_audit(
                db,
                actor=actor,
                request_id=request_id,
                action="product.update",
                outcome="denied",
                entity_id=sku,
                details={"reason": "null_field", "field": field},
            )
            db.commit()

            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"'{field}' cannot be null",
            )

    try:
        if "category" in changes:
            category_name = changes.pop("category")

            category = get_or_create_category(
                db,
                category_name,
                tenant_id,
            )

            product.category = category.name
            product.category_id = category.id

        for field, value in changes.items():
            setattr(product, field, value)

        write_audit(
            db,
            actor=actor,
            request_id=request_id,
            action="product.update",
            outcome="success",
            entity_id=sku,
            details={
                "updated_fields": sorted(payload.model_fields_set)
            },
        )

        db.commit()
        db.refresh(product)

        response.headers["X-Request-ID"] = request_id
        return product

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product could not be updated because of a data conflict",
        ) from None

    except Exception:
        db.rollback()
        raise

@router.delete("/{sku}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    sku: str,
    request: Request,
    response: Response,
    db: DbSession,
    actor: Annotated[
        Actor, Depends(require_permission(WRITE_PERMISSION))
    ],
):
    """Soft-delete a product while preserving historical records."""
    request_id = request_id_for(request)
    tenant_id = actor.tenant_id

    try:
        product = db.scalar(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.sku == sku,
                Product.deleted_at.is_(None),
            )
        )

        if product is None:
            write_audit(
                db,
                actor=actor,
                request_id=request_id,
                action="product.delete",
                outcome="denied",
                entity_id=sku,
                details={"reason": "not_found"},
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )

        product.deleted_at = func.now()

        write_audit(
            db,
            actor=actor,
            request_id=request_id,
            action="product.delete",
            outcome="success",
            entity_id=sku,
            details={"product_id": product.id},
        )

        db.commit()
        response.headers["X-Request-ID"] = request_id

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers={"X-Request-ID": request_id},
    )