"""AtomForge cloud sync services: single-active-session lock and workspace snapshots."""

import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.forge_session_locks import Forge_session_locks
from models.forge_versions import Forge_versions
from models.forge_workspaces import Forge_workspaces

logger = logging.getLogger(__name__)

# A lock whose heartbeat is older than this window is considered abandoned.
LOCK_TTL_SECONDS = 90
MAX_HTML_BYTES = 400_000


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _is_stale(lock: Forge_session_locks) -> bool:
    beat = _parse_ts(lock.heartbeat_at)
    if beat is None:
        return True
    return _now() - beat > timedelta(seconds=LOCK_TTL_SECONDS)


class ForgeLockService:
    """Guarantees that only one browser session per account can edit at a time."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _active_lock(self, user_id: str) -> Optional[Forge_session_locks]:
        rows = await self.db.scalars(
            select(Forge_session_locks)
            .where(Forge_session_locks.user_id == user_id)
            .order_by(Forge_session_locks.id.desc())
            .limit(20)
        )
        for lock in rows.all():
            if not lock.released and not _is_stale(lock):
                return lock
        return None

    async def acquire(
        self, user_id: str, device_label: str, takeover: bool
    ) -> Dict[str, Any]:
        """Acquire the edit lock, optionally forcing takeover of another session."""
        active = await self._active_lock(user_id)
        if active and not takeover:
            await self.db.commit()
            return {
                "granted": False,
                "session_token": "",
                "holder_device": active.device_label or "另一台设备",
                "holder_since": active.heartbeat_at or "",
                "reason": "locked",
            }

        if active and takeover:
            active.released = True

        token = secrets.token_urlsafe(24)
        lock = Forge_session_locks(
            user_id=user_id,
            session_token=token,
            device_label=device_label or "未知设备",
            heartbeat_at=_now().isoformat(),
            released=False,
        )
        self.db.add(lock)
        await self.db.commit()
        return {
            "granted": True,
            "session_token": token,
            "holder_device": lock.device_label,
            "holder_since": lock.heartbeat_at,
            "reason": "acquired",
        }

    async def heartbeat(self, user_id: str, session_token: str) -> Dict[str, Any]:
        """Refresh the lock; report eviction when another session took over."""
        lock = await self.db.scalar(
            select(Forge_session_locks).where(
                Forge_session_locks.user_id == user_id,
                Forge_session_locks.session_token == session_token,
            )
        )
        if lock is None or lock.released:
            active = await self._active_lock(user_id)
            holder = active.device_label if active else ""
            await self.db.commit()
            return {"valid": False, "holder_device": holder or "另一台设备"}

        lock.heartbeat_at = _now().isoformat()
        await self.db.commit()
        return {"valid": True, "holder_device": lock.device_label or ""}

    async def release(self, user_id: str, session_token: str) -> Dict[str, Any]:
        lock = await self.db.scalar(
            select(Forge_session_locks).where(
                Forge_session_locks.user_id == user_id,
                Forge_session_locks.session_token == session_token,
            )
        )
        if lock is not None:
            lock.released = True
        await self.db.commit()
        return {"released": True}


def _version_payload(row: Forge_versions) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "index": row.version_index,
        "html": row.html or "",
        "summary": row.summary or "",
        "prompt": row.prompt or "",
        "revision": (
            {
                "id": f"rev_{row.id}",
                "prompt": row.revision_prompt,
                "createdAt": int(row.created_at.timestamp() * 1000) if row.created_at else 0,
            }
            if row.revision_prompt
            else None
        ),
        "createdAt": int(row.created_at.timestamp() * 1000) if row.created_at else 0,
    }


class ForgeWorkspaceService:
    """Persists the per-account workspace snapshot so any device sees the same history."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _current(self, user_id: str) -> Optional[Forge_workspaces]:
        return await self.db.scalar(
            select(Forge_workspaces)
            .where(Forge_workspaces.user_id == user_id)
            .order_by(Forge_workspaces.id.desc())
            .limit(1)
        )

    async def _versions(self, user_id: str, workspace_id: int) -> List[Forge_versions]:
        rows = await self.db.scalars(
            select(Forge_versions)
            .where(
                Forge_versions.user_id == user_id,
                Forge_versions.workspace_id == workspace_id,
            )
            .order_by(Forge_versions.version_index.asc())
        )
        return list(rows.all())

    async def load(self, user_id: str) -> Dict[str, Any]:
        workspace = await self._current(user_id)
        if workspace is None:
            await self.db.commit()
            return {"workspace": None}

        versions = await self._versions(user_id, workspace.id)
        plan = None
        if workspace.plan_json:
            try:
                plan = json.loads(workspace.plan_json)
            except json.JSONDecodeError:
                plan = None

        payload = {
            "workspace": {
                "id": str(workspace.id),
                "title": workspace.title or "",
                "prompt": workspace.prompt or "",
                "mode": workspace.mode or "live",
                "plan": plan,
                "pendingRevision": workspace.pending_revision or None,
                "activeVersionId": (
                    str(workspace.active_version_id) if workspace.active_version_id else None
                ),
                "versions": [_version_payload(row) for row in versions],
            }
        }
        await self.db.commit()
        return payload

    async def save(self, user_id: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        """Upsert the workspace and append any versions that are not stored yet."""
        versions = snapshot.get("versions") or []
        for item in versions:
            html = item.get("html") or ""
            if len(html.encode("utf-8")) > MAX_HTML_BYTES:
                raise ValueError("生成结果过大，无法同步到云端")

        workspace = await self._current(user_id)
        plan_json = json.dumps(snapshot.get("plan"), ensure_ascii=False) if snapshot.get("plan") else ""
        title = (snapshot.get("title") or snapshot.get("prompt") or "未命名工作区")[:120]

        if workspace is None:
            workspace = Forge_workspaces(
                user_id=user_id,
                title=title,
                prompt=snapshot.get("prompt") or "",
                mode=snapshot.get("mode") or "live",
                plan_json=plan_json,
                pending_revision=snapshot.get("pendingRevision") or "",
                active_version_id=None,
                version_count=0,
            )
            self.db.add(workspace)
            await self.db.commit()
        else:
            workspace.title = title
            workspace.prompt = snapshot.get("prompt") or ""
            workspace.mode = snapshot.get("mode") or "live"
            workspace.plan_json = plan_json
            workspace.pending_revision = snapshot.get("pendingRevision") or ""
            await self.db.commit()

        stored = await self._versions(user_id, workspace.id)
        known = {row.version_index for row in stored}
        appended = False
        for item in versions:
            index = item.get("index")
            if not isinstance(index, int) or index in known:
                continue
            self.db.add(
                Forge_versions(
                    user_id=user_id,
                    workspace_id=workspace.id,
                    version_index=index,
                    html=item.get("html") or "",
                    summary=item.get("summary") or "",
                    prompt=item.get("prompt") or "",
                    revision_prompt=((item.get("revision") or {}).get("prompt") or ""),
                )
            )
            known.add(index)
            appended = True
        if appended:
            await self.db.commit()

        final_versions = await self._versions(user_id, workspace.id)
        workspace.version_count = len(final_versions)
        if final_versions:
            workspace.active_version_id = final_versions[-1].id
        await self.db.commit()

        return await self.load(user_id)

    async def reset(self, user_id: str) -> Dict[str, Any]:
        workspace = await self._current(user_id)
        if workspace is None:
            await self.db.commit()
            return {"cleared": True}
        for row in await self._versions(user_id, workspace.id):
            await self.db.delete(row)
        await self.db.delete(workspace)
        await self.db.commit()
        return {"cleared": True}
