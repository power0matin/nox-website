import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from itsdangerous import BadSignature, URLSafeSerializer
from passlib.hash import argon2
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import DateTime, ForeignKey, String, create_engine, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-internal-key")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

FRONTEND_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required")

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

signer = URLSafeSerializer(SESSION_SECRET, salt="nox-session")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[str] = mapped_column(String(5), nullable=False, default="false")
    is_banned: Mapped[str] = mapped_column(String(5), nullable=False, default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    subscription: Mapped[Optional["Subscription"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False
    )
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="basic")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="subscription")


class AuthPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class SignupPayload(AuthPayload):
    name: str = Field(min_length=2, max_length=120)


class ProfilePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr


class CheckoutPayload(BaseModel):
    plan: str


class ChangePasswordPayload(BaseModel):
    current_password: str = Field(min_length=8)
    new_password: str = Field(min_length=8)


class AdminSubscriptionPayload(BaseModel):
    plan: str
    status: str = "active"


class AdminBanPayload(BaseModel):
    is_banned: bool


app = FastAPI(title="NOX API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "NOX API",
        "status": "running",
        "docs": "/docs",
    }


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


def db_session():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def plan_priority(plan: str) -> str:
    priorities = {
        "basic": "اولویت معمولی",
        "priority": "اولویت بالاتر در صف",
        "elite": "بالاترین اولویت صف",
    }

    return priorities.get(plan, priorities["basic"])


def queue_priority_number(plan: str, status: str) -> int:
    if status != "active":
        return 0

    priorities = {
        "basic": 0,
        "priority": 50,
        "elite": 100,
    }

    return priorities.get(plan, 0)


def subscription_is_expired(subscription: Subscription) -> bool:
    period_end = normalize_datetime(subscription.current_period_end)

    if period_end is None:
        return False

    return period_end < utc_now()


def ensure_subscription(user: User, db: Session) -> Subscription:
    if user.subscription:
        return user.subscription

    user.subscription = Subscription(
        id=str(uuid.uuid4()),
        user_id=user.id,
        plan="basic",
        status="free",
        current_period_end=None,
    )

    db.commit()
    db.refresh(user)

    return user.subscription


def public_user(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "isAdmin": user.is_admin == "true",
        "isBanned": user.is_banned == "true",
        "createdAt": user.created_at.isoformat(),
    }


def public_subscription(subscription: Subscription):
    if subscription_is_expired(subscription):
        subscription.status = "expired"

    current_period_end = normalize_datetime(subscription.current_period_end)

    return {
        "plan": subscription.plan,
        "status": subscription.status,
        "priority": plan_priority(subscription.plan),
        "queuePriority": queue_priority_number(subscription.plan, subscription.status),
        "updatedAt": subscription.updated_at.isoformat(),
        "currentPeriodEnd": (
            current_period_end.isoformat() if current_period_end else None
        ),
    }


def auth_response(user: User):
    return {
        "user": public_user(user),
        "subscription": public_subscription(user.subscription),
    }


def set_session_cookie(response: Response, user_id: str):
    token = signer.dumps({"user_id": user_id})

    response.set_cookie(
        key="nox_session",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )


def clear_session_cookie(response: Response):
    response.delete_cookie("nox_session", path="/")


def get_current_user(
    request: Request,
    db: Session = Depends(db_session),
) -> User:
    token = request.cookies.get("nox_session")

    if not token:
        raise HTTPException(status_code=401, detail="وارد حساب نشده‌اید.")

    try:
        payload = signer.loads(token)
    except BadSignature:
        raise HTTPException(status_code=401, detail="نشست کاربری معتبر نیست.")

    user_id = payload.get("user_id")

    user = db.scalar(select(User).where(User.id == user_id))

    if not user:
        raise HTTPException(status_code=401, detail="کاربر پیدا نشد.")

    if user.is_banned == "true":
        raise HTTPException(status_code=403, detail="حساب شما مسدود شده است.")

    ensure_subscription(user, db)

    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.is_admin != "true":
        raise HTTPException(status_code=403, detail="دسترسی ادمین ندارید.")

    return user


def verify_internal_key(request: Request):
    api_key = request.headers.get("X-Internal-API-Key")

    if api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Internal API key invalid.")


@app.post("/api/auth/signup")
def signup(
    payload: SignupPayload,
    response: Response,
    db: Session = Depends(db_session),
):
    email = normalize_email(payload.email)

    existing = db.scalar(select(User).where(User.email == email))

    if existing:
        raise HTTPException(
            status_code=409,
            detail="با این ایمیل قبلاً حساب ساخته شده است.",
        )

    user = User(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        email=email,
        password_hash=argon2.hash(payload.password),
        is_admin="true" if ADMIN_EMAIL and email == ADMIN_EMAIL else "false",
        is_banned="false",
    )

    subscription = Subscription(
        id=str(uuid.uuid4()),
        user=user,
        plan="basic",
        status="free",
        current_period_end=None,
    )

    db.add(user)
    db.add(subscription)
    db.commit()
    db.refresh(user)

    set_session_cookie(response, user.id)

    return auth_response(user)


@app.post("/api/auth/login")
def login(
    payload: AuthPayload,
    response: Response,
    db: Session = Depends(db_session),
):
    email = normalize_email(payload.email)

    user = db.scalar(select(User).where(User.email == email))

    if not user or not argon2.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="ایمیل یا رمز عبور درست نیست.")

    if user.is_banned == "true":
        raise HTTPException(status_code=403, detail="حساب شما مسدود شده است.")

    ensure_subscription(user, db)

    set_session_cookie(response, user.id)

    return auth_response(user)


@app.post("/api/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)

    return {"ok": True}


@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return auth_response(user)


@app.patch("/api/me")
def update_me(
    payload: ProfilePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(db_session),
):
    email = normalize_email(payload.email)

    existing = db.scalar(select(User).where(User.email == email, User.id != user.id))

    if existing:
        raise HTTPException(
            status_code=409,
            detail="این ایمیل برای حساب دیگری ثبت شده است.",
        )

    user.name = payload.name.strip()
    user.email = email

    db.commit()
    db.refresh(user)

    return auth_response(user)


@app.patch("/api/me/password")
def change_password(
    payload: ChangePasswordPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(db_session),
):
    if not argon2.verify(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="رمز عبور فعلی درست نیست.")

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.",
        )

    user.password_hash = argon2.hash(payload.new_password)

    db.commit()

    return {
        "ok": True,
        "message": "رمز عبور با موفقیت تغییر کرد.",
    }


@app.get("/api/subscription")
def get_subscription(user: User = Depends(get_current_user)):
    return {
        "subscription": public_subscription(user.subscription),
    }


@app.post("/api/subscription/checkout")
def create_checkout(
    payload: CheckoutPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(db_session),
):
    allowed_plans = {"basic", "priority", "elite"}

    if payload.plan not in allowed_plans:
        raise HTTPException(status_code=400, detail="پلن انتخابی معتبر نیست.")

    ensure_subscription(user, db)

    now = utc_now()

    if payload.plan == "basic":
        user.subscription.plan = "basic"
        user.subscription.status = "free"
        user.subscription.updated_at = now
        user.subscription.current_period_end = None

        db.commit()
        db.refresh(user)

        return {
            "subscription": public_subscription(user.subscription),
        }

    # Temporary testing mode:
    # This directly activates Priority / Elite without real payment.
    # Good for local testing only. Do not use this for real paid production.
    user.subscription.plan = payload.plan
    user.subscription.status = "active"
    user.subscription.updated_at = now
    user.subscription.current_period_end = now + timedelta(days=30)

    db.commit()
    db.refresh(user)

    return {
        "subscription": public_subscription(user.subscription),
    }


@app.get("/api/admin/users")
def admin_list_users(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(db_session),
):
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()

    return {
        "users": [
            {
                "id": item.id,
                "name": item.name,
                "email": item.email,
                "isAdmin": item.is_admin == "true",
                "isBanned": item.is_banned == "true",
                "createdAt": item.created_at.isoformat(),
                "subscription": (
                    public_subscription(item.subscription)
                    if item.subscription
                    else None
                ),
            }
            for item in users
        ]
    }


@app.patch("/api/admin/users/{user_id}/subscription")
def admin_update_subscription(
    user_id: str,
    payload: AdminSubscriptionPayload,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(db_session),
):
    allowed_plans = {"basic", "priority", "elite"}
    allowed_statuses = {"free", "active", "expired", "cancelled"}

    if payload.plan not in allowed_plans:
        raise HTTPException(status_code=400, detail="پلن معتبر نیست.")

    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="وضعیت معتبر نیست.")

    target = db.scalar(select(User).where(User.id == user_id))

    if not target:
        raise HTTPException(status_code=404, detail="کاربر پیدا نشد.")

    ensure_subscription(target, db)

    now = utc_now()

    target.subscription.plan = payload.plan
    target.subscription.status = payload.status
    target.subscription.updated_at = now

    if payload.plan == "basic" or payload.status != "active":
        target.subscription.current_period_end = None
    else:
        target.subscription.current_period_end = now + timedelta(days=30)

    db.commit()
    db.refresh(target)

    return {
        "user": public_user(target),
        "subscription": public_subscription(target.subscription),
    }


@app.patch("/api/admin/users/{user_id}/ban")
def admin_ban_user(
    user_id: str,
    payload: AdminBanPayload,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(db_session),
):
    target = db.scalar(select(User).where(User.id == user_id))

    if not target:
        raise HTTPException(status_code=404, detail="کاربر پیدا نشد.")

    if target.id == admin.id and payload.is_banned:
        raise HTTPException(
            status_code=400,
            detail="نمی‌توانید حساب خودتان را مسدود کنید.",
        )

    target.is_banned = "true" if payload.is_banned else "false"

    db.commit()
    db.refresh(target)

    return {
        "user": public_user(target),
    }


@app.get("/api/internal/entitlement/{user_id}")
def internal_entitlement(
    user_id: str,
    request: Request,
    db: Session = Depends(db_session),
):
    verify_internal_key(request)

    user = db.scalar(select(User).where(User.id == user_id))

    if not user or not user.subscription:
        raise HTTPException(status_code=404, detail="User not found.")

    sub = user.subscription

    expired = subscription_is_expired(sub)
    status = "expired" if expired else sub.status

    return {
        "userId": user.id,
        "email": user.email,
        "plan": sub.plan,
        "status": status,
        "queuePriority": queue_priority_number(sub.plan, status),
        "currentPeriodEnd": (
            normalize_datetime(sub.current_period_end).isoformat()
            if sub.current_period_end
            else None
        ),
    }
