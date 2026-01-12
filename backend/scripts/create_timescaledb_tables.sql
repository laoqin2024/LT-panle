-- TimescaleDB 时序数据表创建脚本
-- 需要在PostgreSQL中启用TimescaleDB扩展后执行

-- 启用TimescaleDB扩展
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 服务器监控指标表
CREATE TABLE IF NOT EXISTS server_metrics (
    time TIMESTAMPTZ NOT NULL,
    server_id INTEGER NOT NULL,
    cpu_percent DOUBLE PRECISION,
    memory_used BIGINT,
    memory_total BIGINT,
    memory_cached BIGINT,
    memory_swap BIGINT,
    disk_used BIGINT,
    disk_total BIGINT,
    disk_io_read BIGINT,
    disk_io_write BIGINT,
    network_in BIGINT,
    network_out BIGINT,
    load_avg_1m DOUBLE PRECISION,
    load_avg_5m DOUBLE PRECISION,
    load_avg_15m DOUBLE PRECISION
);

-- 转换为超表（Hypertable）
SELECT create_hypertable('server_metrics', 'time', if_not_exists => TRUE);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_server_metrics_server_time ON server_metrics (server_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_server_metrics_time ON server_metrics (time DESC);

-- 网络设备监控指标表
CREATE TABLE IF NOT EXISTS device_metrics (
    time TIMESTAMPTZ NOT NULL,
    device_id INTEGER NOT NULL,
    interface_name VARCHAR(100),
    interface_status VARCHAR(20),
    bytes_in BIGINT,
    bytes_out BIGINT,
    packets_in BIGINT,
    packets_out BIGINT,
    errors_in BIGINT,
    errors_out BIGINT,
    cpu_percent DOUBLE PRECISION,
    memory_percent DOUBLE PRECISION,
    temperature INTEGER
);

SELECT create_hypertable('device_metrics', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_device_metrics_device_time ON device_metrics (device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_device_metrics_time ON device_metrics (time DESC);

-- 站点可用性监控表
CREATE TABLE IF NOT EXISTS site_availability (
    time TIMESTAMPTZ NOT NULL,
    site_id INTEGER NOT NULL,
    status_code INTEGER,
    response_time INTEGER,  -- 毫秒
    dns_time INTEGER,       -- DNS解析时间（毫秒）
    ssl_time INTEGER,       -- SSL握手时间（毫秒）
    is_available BOOLEAN,
    error_message TEXT
);

SELECT create_hypertable('site_availability', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_site_availability_site_time ON site_availability (site_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_site_availability_time ON site_availability (time DESC);

-- 数据库监控指标表
CREATE TABLE IF NOT EXISTS database_metrics (
    time TIMESTAMPTZ NOT NULL,
    database_id INTEGER NOT NULL,
    connections_current INTEGER,
    connections_max INTEGER,
    queries_per_second DOUBLE PRECISION,
    slow_queries INTEGER,
    cache_hit_rate DOUBLE PRECISION,
    database_size BIGINT,
    table_count INTEGER,
    lock_wait_count INTEGER
);

SELECT create_hypertable('database_metrics', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_database_metrics_db_time ON database_metrics (database_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_database_metrics_time ON database_metrics (time DESC);

-- 设置数据保留策略（可选）
-- 保留90天的数据
SELECT add_retention_policy('server_metrics', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('device_metrics', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('site_availability', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('database_metrics', INTERVAL '90 days', if_not_exists => TRUE);

