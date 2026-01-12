-- 创建默认管理员用户
-- 密码: admin123
-- 这个哈希值需要在实际使用时通过 Python 生成

-- 方法1: 使用 Python 生成正确的哈希
-- python3 -c "import bcrypt; print(bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode())"

-- 方法2: 直接插入（需要先运行 Python 生成哈希）
INSERT INTO users (username, email, password_hash, full_name, role_id, is_active, is_superuser)
VALUES (
    'admin',
    'admin@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJqJqJqJq',  -- 需要替换为正确的哈希
    '系统管理员',
    1,  -- admin role_id
    true,
    true
)
ON CONFLICT (username) DO NOTHING;

