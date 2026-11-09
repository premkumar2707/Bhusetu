"""
BhuSetu 3D Authentication Service
User identity resolution, credential authentication, evaluator provisioning, and role mapping.
"""
import uuid
import httpx
import asyncio
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.auth import AuthenticatedUserResponse, RoleInfo, AppRole
from app.core.config import settings
from app.core.logging import logger


ROLE_CONFIGS: Dict[str, Dict[str, str]] = {
    "ADMIN": {
        "badge": "bg-[#B56E48]/20 text-[#E09F67] border-[#B56E48]/40",
        "clearance": "Level 4 (Super Admin)",
        "capabilities": "Full system administration, user management, audit trails, GIS parameters, and all module access.",
    },
    "GOVERNMENT_OFFICER": {
        "badge": "bg-[#176C68]/20 text-[#2EB8B0] border-[#176C68]/40",
        "clearance": "Level 3 (Review & Seal)",
        "capabilities": "Statutory verification review, KMC Section 321 enforcement notices, evidence review, and legal sign-offs.",
    },
    "SURVEYOR": {
        "badge": "bg-[#2A443B]/30 text-[#4ADE80] border-[#2A443B]/60",
        "clearance": "Level 2 (Field Operations)",
        "capabilities": "Cadastral field survey capture, terrestrial laser scanning, drone photogrammetry upload, and field verification notes.",
    },
    "ANALYST": {
        "badge": "bg-[#253248]/30 text-[#60A5FA] border-[#253248]/60",
        "clearance": "Level 2 (Spatial Analytics)",
        "capabilities": "Topological conflict analysis, AI spatial investigator, 4D temporal changes, and explainable quality scoring.",
    },
}


class AuthService:
    """Orchestrates user identity resolution and role mapping against Supabase PostgreSQL."""

    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        email: str,
        password: str
    ) -> Optional[User]:
        """
        Authenticates a user against Supabase Auth gateway, resolving their authoritative public.users profile.
        """
        clean_email = email.lower().strip()
        if not clean_email or not password:
            return None

        # 1. Authenticate against Supabase Auth gateway
        auth_user_id: Optional[str] = None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password",
                    headers={
                        "apikey": settings.SUPABASE_PUBLISHABLE_KEY,
                        "Content-Type": "application/json"
                    },
                    json={"email": clean_email, "password": password}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    auth_user_id = data.get("user", {}).get("id")
        except Exception as e:
            logger.warning(f"Supabase Auth gateway authentication attempt failed: {e}")

        # 2. Resolve user from public.users database
        try:
            conditions = [User.email == clean_email]
            if auth_user_id:
                try:
                    p_uuid = uuid.UUID(auth_user_id)
                    conditions.append(User.auth_user_id == p_uuid)
                    conditions.append(User.id == p_uuid)
                except Exception:
                    pass

            stmt = select(User).where(or_(*conditions))
            result = await db.execute(stmt)
            user: Optional[User] = result.scalars().first()

            if user and user.is_active:
                if auth_user_id and user.auth_user_id is None:
                    try:
                        user.auth_user_id = uuid.UUID(auth_user_id)
                        await db.commit()
                        await db.refresh(user)
                    except Exception:
                        await db.rollback()
                return user
        except Exception as exc:
            logger.warning(f"Database query error in authenticate_user ({exc})")

        return None

    @staticmethod
    async def resolve_application_user(
        db: AsyncSession,
        auth_user_id: str,
        email: str
    ) -> User:
        """
        Resolves the authenticated Supabase user against the canonical public.users record.
        Enforces account active status and links the Auth UUID if not yet bound.
        """
        clean_email = email.lower().strip()
        parsed_uuid: Optional[uuid.UUID] = None
        try:
            parsed_uuid = uuid.UUID(auth_user_id)
        except (ValueError, TypeError):
            logger.warning(f"Could not parse auth_user_id as UUID: {auth_user_id}")

        # Query authoritative database for user with transient retry
        conditions = [User.email == clean_email]
        if parsed_uuid:
            conditions.append(User.auth_user_id == parsed_uuid)
            conditions.append(User.id == parsed_uuid)

        user: Optional[User] = None
        for attempt in range(3):
            try:
                stmt = select(User).where(or_(*conditions))
                result = await db.execute(stmt)
                user = result.scalars().first()
                break
            except HTTPException:
                raise
            except Exception as exc:
                logger.warning(f"Database query attempt {attempt + 1} in resolve_application_user: {exc}")
                if attempt < 2:
                    await asyncio.sleep(0.3)
                else:
                    logger.error(f"Exhausted DB retries in resolve_application_user: {exc}")
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Database connection temporarily interrupted. Please retry."
                    )

        if user:
            if not user.is_active:
                logger.warning(f"Deactivated user attempted access: {user.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been deactivated. Please contact your administrator."
                )

            if parsed_uuid and user.auth_user_id is None:
                user.auth_user_id = parsed_uuid
                try:
                    await db.commit()
                    await db.refresh(user)
                    logger.info(f"Bound auth_user_id {parsed_uuid} to public.users record for {user.email}")
                except Exception as e:
                    await db.rollback()
                    logger.error(f"Error binding auth_user_id to user {user.id}: {e}")

            return user

        # Auto-provision from authentic Supabase Auth record if valid
        if parsed_uuid and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{auth_user_id}",
                        headers={
                            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                        }
                    )
                    if resp.status_code == 200:
                        meta = resp.json().get("user_metadata", {})
                        new_user = User(
                            id=parsed_uuid,
                            auth_user_id=parsed_uuid,
                            email=clean_email,
                            full_name=meta.get("full_name") or clean_email.split("@")[0],
                            role=meta.get("role") or "PUBLIC_USER",
                            department=meta.get("department") or "Municipal Directorate",
                            is_active=True
                        )
                        db.add(new_user)
                        try:
                            await db.commit()
                            await db.refresh(new_user)
                            logger.info(f"Auto-provisioned profile in public.users for authentic Supabase user: {clean_email}")
                            return new_user
                        except IntegrityError:
                            await db.rollback()
                            stmt = select(User).where(or_(*conditions))
                            res = await db.execute(stmt)
                            existing_user = res.scalars().first()
                            if existing_user:
                                return existing_user
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Could not auto-provision public.users record: {e}")

        logger.warning(f"User not authorized in public.users: {clean_email} ({auth_user_id})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is authenticated, but is not yet authorized for BhuSetu 3D."
        )

    @staticmethod
    async def list_all_evaluators(db: AsyncSession) -> List[Dict[str, Any]]:
        """Retrieves all registered evaluators from public.users table with transient retry."""
        users = []
        for attempt in range(3):
            try:
                stmt = select(User).order_by(User.created_at.asc())
                result = await db.execute(stmt)
                users = result.scalars().all()
                break
            except Exception as exc:
                logger.warning(f"Database query attempt {attempt + 1} in list_all_evaluators: {exc}")
                if attempt < 2:
                    await asyncio.sleep(0.3)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Database connection temporarily interrupted. Please retry."
                    )

        evaluators = []
        for u in users:
            config = ROLE_CONFIGS.get(u.role, {
                "badge": "bg-[#3B2D54]/30 text-[#C084FC] border-[#7E22CE]/40",
                "clearance": "Custom Clearance",
                "capabilities": f"Institutional access for {u.department or 'Municipal Governance'}.",
            })
            evaluators.append({
                "id": str(u.id),
                "name": u.full_name,
                "email": u.email,
                "role": u.role,
                "department": u.department or "Municipal Governance",
                "clearance": config["clearance"],
                "status": "Active Institutional" if u.is_active else "Deactivated",
                "badgeColor": config["badge"],
                "capabilities": config["capabilities"],
            })
        return evaluators

    @staticmethod
    async def create_evaluator(
        db: AsyncSession,
        name: str,
        email: str,
        role: str,
        department: str,
        clearance: Optional[str] = None
    ) -> Dict[str, Any]:
        """Provisions a new evaluator in Supabase Auth and persists the institutional profile in public.users."""
        clean_email = email.lower().strip()
        clean_name = name.strip()
        clean_role = role.strip()
        clean_dept = department.strip()

        # Check existing in public.users
        stmt = select(User).where(User.email == clean_email)
        result = await db.execute(stmt)
        if result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An evaluator account with email '{clean_email}' already exists."
            )

        auth_user_uuid: Optional[uuid.UUID] = None
        # Provision in Supabase Auth via admin API
        if settings.SUPABASE_SERVICE_ROLE_KEY and settings.SUPABASE_URL:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users",
                        headers={
                            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "email": clean_email,
                            "email_confirm": True,
                            "user_metadata": {
                                "full_name": clean_name,
                                "role": clean_role,
                                "department": clean_dept,
                            }
                        }
                    )
                    if resp.status_code in (200, 201):
                        auth_user_uuid = uuid.UUID(resp.json().get("id"))
                    elif resp.status_code == 422:
                        # User already exists in auth.users, fetch their UUID
                        list_resp = await client.get(
                            f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users",
                            headers={
                                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                            }
                        )
                        if list_resp.status_code == 200:
                            for au in list_resp.json().get("users", []):
                                if au.get("email", "").lower() == clean_email:
                                    auth_user_uuid = uuid.UUID(au["id"])
                                    break
            except Exception as e:
                logger.error(f"Error provisioning user in Supabase Auth: {e}")

        new_user = User(
            id=auth_user_uuid or uuid.uuid4(),
            auth_user_id=auth_user_uuid,
            email=clean_email,
            full_name=clean_name,
            role=clean_role,
            department=clean_dept,
            is_active=True
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        logger.info(f"Persisted evaluator profile in public.users: {new_user.email} ({new_user.id})")

        config = ROLE_CONFIGS.get(clean_role, {
            "badge": "bg-[#3B2D54]/30 text-[#C084FC] border-[#7E22CE]/40",
            "clearance": clearance or "Custom Clearance",
            "capabilities": f"Institutional access for {clean_dept}.",
        })

        return {
            "id": str(new_user.id),
            "name": new_user.full_name,
            "email": new_user.email,
            "role": new_user.role,
            "department": new_user.department or clean_dept,
            "clearance": config["clearance"],
            "status": "Active Institutional",
            "badgeColor": config["badge"],
            "capabilities": config["capabilities"],
        }

    @staticmethod
    def map_user_to_response(user: User) -> AuthenticatedUserResponse:
        """Transforms database User model into the public authenticated user schema."""
        return AuthenticatedUserResponse(
            id=str(user.id),
            email=user.email,
            name=user.full_name,
            roles=[user.role],
            department=user.department,
            is_active=user.is_active
        )

    @staticmethod
    def get_role_definitions() -> List[RoleInfo]:
        """Provides metadata for the canonical application roles."""
        return [
            RoleInfo(
                role=AppRole.ADMIN,
                label="System Administrator",
                description="Platform administration, user management, and system configuration.",
                allowed_modules=["*"]
            ),
            RoleInfo(
                role=AppRole.SURVEYOR,
                label="Cadastral Surveyor",
                description="Field survey workflows, geometry submission, and evidence documentation.",
                allowed_modules=["overview", "properties", "evidence", "city-3d"]
            ),
            RoleInfo(
                role=AppRole.GOVERNMENT_OFFICER,
                label="Government Officer",
                description="Statutory land approvals, conflict resolution, and verification reviews.",
                allowed_modules=["overview", "properties", "conflicts", "verification", "history", "evidence"]
            ),
            RoleInfo(
                role=AppRole.PLANNER,
                label="Urban Planner",
                description="Zoning guidelines, 3D envelope compliance, and municipal infrastructure planning.",
                allowed_modules=["overview", "city-3d", "spatial-analysis", "properties"]
            ),
            RoleInfo(
                role=AppRole.ANALYST,
                label="Spatial Data Analyst",
                description="Multi-epoch trend analytics, data quality intelligence, and metric reports.",
                allowed_modules=["overview", "spatial-analysis", "history", "properties"]
            ),
            RoleInfo(
                role=AppRole.PUBLIC_USER,
                label="Public Citizen / Applicant",
                description="Restricted public portal access, ULPIN search, and certificate downloads.",
                allowed_modules=["overview", "properties"]
            ),
        ]
