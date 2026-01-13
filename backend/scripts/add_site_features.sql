-- 业务站点模块功能扩展 - 数据库迁移脚本
-- 执行时间：2024年
-- 说明：添加检查配置、维护模式和健康度评分字段

-- 添加检查配置字段
ALTER TABLE business_sites 
ADD COLUMN IF NOT EXISTS check_interval INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS check_timeout INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS check_config JSON;

-- 添加维护模式字段
ALTER TABLE business_sites 
ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS maintenance_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS maintenance_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS maintenance_note TEXT;

-- 添加健康度评分字段
ALTER TABLE business_sites 
ADD COLUMN IF NOT EXISTS health_score INTEGER,
ADD COLUMN IF NOT EXISTS health_score_updated_at TIMESTAMP WITH TIME ZONE;

-- 添加注释
COMMENT ON COLUMN business_sites.check_interval IS '检查间隔（秒），默认300秒（5分钟）';
COMMENT ON COLUMN business_sites.check_timeout IS '检查超时时间（秒），默认10秒';
COMMENT ON COLUMN business_sites.check_config IS '其他检查配置（JSON格式，如请求头、请求方法等）';
COMMENT ON COLUMN business_sites.is_maintenance IS '是否处于维护模式';
COMMENT ON COLUMN business_sites.maintenance_start IS '维护开始时间';
COMMENT ON COLUMN business_sites.maintenance_end IS '维护结束时间';
COMMENT ON COLUMN business_sites.maintenance_note IS '维护说明';
COMMENT ON COLUMN business_sites.health_score IS '健康度评分（0-100）';
COMMENT ON COLUMN business_sites.health_score_updated_at IS '健康度评分更新时间';

-- 为常用查询字段添加索引（如果需要）
-- CREATE INDEX IF NOT EXISTS idx_business_sites_health_score ON business_sites(health_score);
-- CREATE INDEX IF NOT EXISTS idx_business_sites_is_maintenance ON business_sites(is_maintenance);
-- CREATE INDEX IF NOT EXISTS idx_business_sites_is_monitored ON business_sites(is_monitored);
