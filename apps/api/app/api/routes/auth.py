"""
BhuSetu 3D Authentication & Authorization Endpoints
Identity verification, profile retrieval, and role authorization.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.database.connection import get_db
from app.core.security import create_access_token
from app.schemas.auth import (
    AuthenticatedUserResponse,
    RolesListResponse,
    AppRole,
)
from app.services.auth_service import AuthService
from app.dependencies.auth import (
    get_current_user,
    require_role,
    require_any_role,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Authorization"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthenticatedUserResponse


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate platform credentials",
    description="Validates credentials against platform users and issues a signed Bearer token."
)
async def login_user(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
) -> LoginResponse:
    """Authenticates platform user and generates a bearer token."""
    user = await AuthService.authenticate_user(
        db=db,
        email=credentials.email,
        password=credentials.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=AuthService.map_user_to_response(user)
    )


@router.get(
    "/me",
    response_model=AuthenticatedUserResponse,
    summary="Get authenticated application user profile and roles",
    description="Resolves authenticated identity against public.users and returns the user's role."
)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
) -> AuthenticatedUserResponse:
    """Returns the authenticated user's authoritative profile and role assignments."""
    return AuthService.map_user_to_response(current_user)


@router.get(
    "/roles",
    response_model=RolesListResponse,
    summary="List canonical platform roles and permissions",
    description="Returns metadata for the canonical application roles in BhuSetu 3D."
)
async def list_roles() -> RolesListResponse:
    """Returns list of canonical platform roles."""
    roles = AuthService.get_role_definitions()
    return RolesListResponse(roles=roles)


@router.get(
    "/verify-role/{role_name}",
    response_model=Dict[str, Any],
    summary="Probe endpoint for testing role authorization",
    description="Verifies if the currently authenticated user possesses the specified role."
)
async def verify_user_role(
    role_name: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Verification probe for role authorization testing."""
    has_permission = (current_user.role == "ADMIN") or (current_user.role == role_name.upper())
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Restricted: Your role '{current_user.role}' is not authorized for '{role_name}'."
        )
    return {
        "status": "authorized",
        "user_id": str(current_user.id),
        "user_email": current_user.email,
        "user_role": current_user.role,
        "tested_role": role_name.upper()
    }


class EvaluatorCreateRequest(BaseModel):
    name: str
    email: str
    role: str
    department: str
    clearance: Optional[str] = None


class EvaluatorResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: str
    clearance: str
    status: str
    badgeColor: str
    capabilities: str


@router.get(
    "/evaluators",
    response_model=List[EvaluatorResponse],
    summary="List persistent platform evaluators",
    description="Returns all registered evaluators from public.users."
)
async def list_evaluators(
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
) -> List[EvaluatorResponse]:
    """Retrieves all platform evaluators from public.users table."""
    return await AuthService.list_all_evaluators(db)


@router.post(
    "/evaluators",
    response_model=EvaluatorResponse,
    summary="Provision a new persistent evaluator account",
    description="Provisions a user in Supabase Auth and persists the institutional profile in public.users."
)
async def create_evaluator(
    payload: EvaluatorCreateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
) -> EvaluatorResponse:
    """Creates a new evaluator in Supabase Auth and public.users."""
    return await AuthService.create_evaluator(
        db=db,
        name=payload.name,
        email=payload.email,
        role=payload.role,
        department=payload.department,
        clearance=payload.clearance
    )

