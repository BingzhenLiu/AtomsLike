"""AtomForge cloud sync API: account-scoped history and single-active-session lock."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.forge_sync import ForgeLockService, ForgeWorkspaceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/forge", tags=["forge"])


class AcquireLockRequest(BaseModel):
    device_label: str = ""
    takeover: bool = False


class LockStateResponse(BaseModel):
    granted: bool
    session_token: str
    holder_device: str
    holder_since: str
    reason: str


class TokenRequest(BaseModel):
    session_token: str


class HeartbeatResponse(BaseModel):
    valid: bool
    holder_device: str


class ReleaseResponse(BaseModel):
    released: bool


class VersionSnapshot(BaseModel):
    index: int
    html: str
    summary: str = ""
    prompt: str = ""
    revision: Optional[Dict[str, Any]] = None


class SaveWorkspaceRequest(BaseModel):
    session_token: str
    title: str = ""
    prompt: str = ""
    mode: str = "live"
    plan: Optional[Dict[str, Any]] = None
    pendingRevision: Optional[str] = None
    versions: List[VersionSnapshot] = []


@router.post("/lock/acquire", response_model=LockStateResponse)
async def acquire_lock(
    data: AcquireLockRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim the account edit lock so concurrent sessions cannot conflict."""
    service = ForgeLockService(db)
    result = await service.acquire(current_user.id, data.device_label, data.takeover)
    return LockStateResponse(**result)


@router.post("/lock/heartbeat", response_model=HeartbeatResponse)
async def heartbeat_lock(
    data: TokenRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Keep the lock alive and detect eviction by another session."""
    service = ForgeLockService(db)
    result = await service.heartbeat(current_user.id, data.session_token)
    return HeartbeatResponse(**result)


@router.post("/lock/release", response_model=ReleaseResponse)
async def release_lock(
    data: TokenRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ForgeLockService(db)
    result = await service.release(current_user.id, data.session_token)
    return ReleaseResponse(**result)


@router.post("/workspace/load")
async def load_workspace(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the account-scoped workspace snapshot for any logged-in device."""
    service = ForgeWorkspaceService(db)
    return await service.load(current_user.id)


@router.post("/workspace/save")
async def save_workspace(
    data: SaveWorkspaceRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist the workspace snapshot; only the lock holder may write."""
    lock_service = ForgeLockService(db)
    lock_state = await lock_service.heartbeat(current_user.id, data.session_token)
    if not lock_state["valid"]:
        raise HTTPException(
            status_code=409,
            detail=f"当前账号已在「{lock_state['holder_device']}」上打开，本会话为只读状态",
        )

    workspace_service = ForgeWorkspaceService(db)
    try:
        return await workspace_service.save(current_user.id, data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Forge workspace save failed: %s", exc)
        raise HTTPException(status_code=500, detail="同步工作区失败，请稍后重试") from exc


@router.post("/workspace/reset")
async def reset_workspace(
    data: TokenRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the account workspace history; only the lock holder may clear."""
    lock_service = ForgeLockService(db)
    lock_state = await lock_service.heartbeat(current_user.id, data.session_token)
    if not lock_state["valid"]:
        raise HTTPException(
            status_code=409,
            detail=f"当前账号已在「{lock_state['holder_device']}」上打开，本会话为只读状态",
        )
    service = ForgeWorkspaceService(db)
    return await service.reset(current_user.id)
