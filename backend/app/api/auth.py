"""
认证相关API路由
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.models.user import User, UserSession, Role
from app.api.schemas import (
    LoginRequest,
    LoginResponse,
    TokenResponse,
    UserResponse,
    RefreshTokenRequest,
    MessageResponse,
)
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", summary="用户登录")
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    用户登录接口
    
    支持JSON和表单数据两种格式：
    - JSON: {"username": "admin", "password": "password"}
    - Form: username=admin&password=password
    
    - **username**: 用户名
    - **password**: 密码
    
    返回access_token和用户信息
    """
    try:
        # 查询用户（支持用户名或邮箱登录），同时加载角色关系
        result = await db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(
                (User.username == login_data.username) | 
                (User.email == login_data.username)
            )
        )
        user = result.scalar_one_or_none()
        
        # 验证用户
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户已被禁用"
            )
        
        # 验证密码
        if not verify_password(login_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        # 更新最后登录时间
        user.last_login = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
        
        # 创建token
        token_data = {
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        # 创建用户会话记录
        try:
            # 获取客户端IP和User-Agent
            client_ip = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")
            
            # 计算过期时间
            expires_at = datetime.utcnow() + timedelta(days=7)
            
            session = UserSession(
                user_id=user.id,
                token=access_token,
                ip_address=client_ip,
                user_agent=user_agent,
                expires_at=expires_at,
            )
            db.add(session)
            await db.commit()
        except Exception as e:
            # 会话创建失败不影响登录，只记录错误
            print(f"创建用户会话失败: {e}")
        
        # 获取角色名称
        role_name = None
        try:
            # 确保角色关系已加载
            if hasattr(user, 'role') and user.role:
                role_name = user.role.name
            else:
                # 如果关系未加载，手动查询
                role_result = await db.execute(
                    select(Role).where(Role.id == user.role_id)
                )
                role = role_result.scalar_one_or_none()
                if role:
                    role_name = role.name
        except Exception as e:
            print(f"获取角色名称失败: {e}")
            role_name = None
        
        # 构建响应
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role_id=user.role_id,
            role_name=role_name,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            last_login=user.last_login,
            created_at=user.created_at,
        )
        
        # 构建响应（前端期望 token 和 user）
        # 使用model_dump()（Pydantic v2）或dict()（Pydantic v1）
        try:
            user_dict = user_response.model_dump() if hasattr(user_response, 'model_dump') else user_response.dict()
        except Exception:
            # 如果都不可用，直接使用对象（FastAPI会自动序列化）
            user_dict = user_response
        
        response_data = {
            "token": access_token,  # 前端使用这个字段
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": user_dict,
        }
        
        # 返回字典（FastAPI会自动序列化）
        return response_data
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        # 记录详细错误信息
        import traceback
        error_detail = traceback.format_exc()
        print(f"登录接口错误: {e}")
        print(error_detail)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"登录失败: {str(e)}"
        )

