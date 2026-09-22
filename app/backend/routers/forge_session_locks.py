import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.forge_session_locks import Forge_session_locksService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/forge_session_locks", tags=["forge_session_locks"])


# ---------- Pydantic Schemas ----------
class Forge_session_locksData(BaseModel):
    """Entity data schema (for create/update)"""
    session_token: str
    device_label: str = None
    heartbeat_at: str = None
    released: bool = None


class Forge_session_locksUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    session_token: Optional[str] = None
    device_label: Optional[str] = None
    heartbeat_at: Optional[str] = None
    released: Optional[bool] = None


class Forge_session_locksResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    session_token: str
    device_label: Optional[str] = None
    heartbeat_at: Optional[str] = None
    released: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Forge_session_locksListResponse(BaseModel):
    """List response schema"""
    items: List[Forge_session_locksResponse]
    total: int
    skip: int
    limit: int


class Forge_session_locksBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Forge_session_locksData]


class Forge_session_locksBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Forge_session_locksUpdateData


class Forge_session_locksBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Forge_session_locksBatchUpdateItem]


class Forge_session_locksBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Forge_session_locksListResponse)
async def query_forge_session_lockss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query forge_session_lockss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying forge_session_lockss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Forge_session_locksService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} forge_session_lockss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid forge_session_locks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying forge_session_lockss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Forge_session_locksListResponse)
async def query_forge_session_lockss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query forge_session_lockss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying forge_session_lockss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Forge_session_locksService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} forge_session_lockss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid forge_session_locks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying forge_session_lockss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Forge_session_locksResponse)
async def get_forge_session_locks(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single forge_session_locks by ID (user can only see their own records)"""
    logger.debug(f"Fetching forge_session_locks with id: {id}, fields={fields}")
    
    service = Forge_session_locksService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Forge_session_locks with id {id} not found")
            raise HTTPException(status_code=404, detail="Forge_session_locks not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching forge_session_locks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Forge_session_locksResponse, status_code=201)
async def create_forge_session_locks(
    data: Forge_session_locksData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new forge_session_locks"""
    logger.debug(f"Creating new forge_session_locks with data: {data}")
    
    service = Forge_session_locksService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create forge_session_locks")
        
        logger.info(f"Forge_session_locks created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating forge_session_locks: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating forge_session_locks: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Forge_session_locksResponse], status_code=201)
async def create_forge_session_lockss_batch(
    request: Forge_session_locksBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple forge_session_lockss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} forge_session_lockss")
    
    service = Forge_session_locksService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} forge_session_lockss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Forge_session_locksResponse])
async def update_forge_session_lockss_batch(
    request: Forge_session_locksBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple forge_session_lockss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} forge_session_lockss")
    
    service = Forge_session_locksService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} forge_session_lockss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Forge_session_locksResponse)
async def update_forge_session_locks(
    id: int,
    data: Forge_session_locksUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing forge_session_locks (requires ownership)"""
    logger.debug(f"Updating forge_session_locks {id} with data: {data}")

    service = Forge_session_locksService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Forge_session_locks with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Forge_session_locks not found")
        
        logger.info(f"Forge_session_locks {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating forge_session_locks {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating forge_session_locks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_forge_session_lockss_batch(
    request: Forge_session_locksBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple forge_session_lockss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} forge_session_lockss")
    
    service = Forge_session_locksService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} forge_session_lockss successfully")
        return {"message": f"Successfully deleted {deleted_count} forge_session_lockss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_forge_session_locks(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single forge_session_locks by ID (requires ownership)"""
    logger.debug(f"Deleting forge_session_locks with id: {id}")
    
    service = Forge_session_locksService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Forge_session_locks with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Forge_session_locks not found")
        
        logger.info(f"Forge_session_locks {id} deleted successfully")
        return {"message": "Forge_session_locks deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting forge_session_locks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")