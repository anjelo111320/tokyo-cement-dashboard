import uuid
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.db.database import get_db
from backend.db.models.notification import Notification
from backend.db.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/me")
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifs = result.scalars().all()
    return {"success": True, "data": [
        {"id": str(n.id), "type": n.type, "title": n.title,
         "body": n.body, "is_read": n.is_read, "created_at": n.created_at.isoformat()}
        for n in notifs
    ]}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == uuid.UUID(notification_id),
            Notification.user_id == user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"success": True}


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket):
    """Stub WebSocket — architecture ready, not wired to events yet."""
    import asyncio
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
