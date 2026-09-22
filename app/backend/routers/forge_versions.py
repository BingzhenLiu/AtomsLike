import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.forge_versions import Forge_versionsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/forge_versions", tags=["forge_versions"])


# ---------- Pydantic Schemas ----------
class Forge_versionsData(BaseModel):
    """Entity data schema (for create/update)"""
    workspace_id: int
    version_index: int
    html: str
    summary: str = None
    prompt: str = None
    revision_prompt: str = None


class Forge_versionsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    workspace_id: Optional[int] = None
    version_index: Optional[int] = None
    html: Optional[str] = None
    summary: Optional[str] = None
    prompt: Optional[str] = None
    revision_prompt: Optional[str] = None


class Forge_versionsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    workspace_id: int
    version_index: int
    html: str
    summary: Optional[str] = None
    prompt: Optional[str] = None
    revision_prompt: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Forge_versionsListResponse(BaseModel):
    """List response schema"""
    items: List[Forge_versionsResponse]
    total: int
    skip: int
    limit: int


class Forge_versionsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Forge_versionsData]


class Forge_versionsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Forge_versionsUpdateData


class Forge_versionsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Forge_versionsBatchUpdateItem]


class Forge_versionsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Forge_versionsListResponse)
async def query_forge_versionss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query forge_versionss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying forge_versionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Forge_versionsService(db)
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
        logger.debug(f"Found {result['total']} forge_versionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid forge_versions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying forge_versionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Forge_versionsListResponse)
async def query_forge_versionss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query forge_versionss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying forge_versionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Forge_versionsService(db)
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
        logger.debug(f"Found {result['total']} forge_versionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid forge_versions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying forge_versionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Forge_versionsResponse)
async def get_forge_versions(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single forge_versions by ID (user can only see their own records)"""
    logger.debug(f"Fetching forge_versions with id: {id}, fields={fields}")
    
    service = Forge_versionsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Forge_versions with id {id} not found")
            raise HTTPException(status_code=404, detail="Forge_versions not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching forge_versions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Forge_versionsResponse, status_code=201)
async def create_forge_versions(
    data: Forge_versionsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new forge_versions"""
    logger.debug(f"Creating new forge_versions with data: {data}")
    
    service = Forge_versionsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create forge_versions")
        
        logger.info(f"Forge_versions created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating forge_versions: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating forge_versions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Forge_versionsResponse], status_code=201)
async def create_forge_versionss_batch(
    request: Forge_versionsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple forge_versionss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} forge_versionss")
    
    service = Forge_versionsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} forge_versionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Forge_versionsResponse])
async def update_forge_versionss_batch(
    request: Forge_versionsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple forge_versionss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} forge_versionss")
    
    service = Forge_versionsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} forge_versionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Forge_versionsResponse)
async def update_forge_versions(
    id: int,
    data: Forge_versionsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing forge_versions (requires ownership)"""
    logger.debug(f"Updating forge_versions {id} with data: {data}")

    service = Forge_versionsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Forge_versions with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Forge_versions not found")
        
        logger.info(f"Forge_versions {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating forge_versions {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating forge_versions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_forge_versionss_batch(
    request: Forge_versionsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple forge_versionss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} forge_versionss")
    
    service = Forge_versionsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} forge_versionss successfully")
        return {"message": f"Successfully deleted {deleted_count} forge_versionss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_forge_versions(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single forge_versions by ID (requires ownership)"""
    logger.debug(f"Deleting forge_versions with id: {id}")
    
    service = Forge_versionsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Forge_versions with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Forge_versions not found")
        
        logger.info(f"Forge_versions {id} deleted successfully")
        return {"message": "Forge_versions deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting forge_versions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")