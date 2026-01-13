"""
测试 asyncssh SSH终端功能
"""
import asyncio
import asyncssh
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


async def test_asyncssh_connection():
    """测试基本的asyncssh连接"""
    try:
        # 测试连接（请替换为实际的服务器信息）
        conn = await asyncssh.connect(
            '192.168.8.17',  # 替换为实际主机
            port=22,
            username='root',  # 替换为实际用户名
            password='apollo',  # 替换为实际密码或使用client_keys
            known_hosts=None,
        )
        
        logger.info("SSH连接成功")
        
        # 测试执行命令
        result = await conn.run('echo "Hello from asyncssh"')
        logger.info(f"命令输出: {result.stdout}")
        
        # 测试交互式shell - 使用create_process创建交互式shell
        logger.info("创建交互式shell...")
        process = await conn.create_process(
            None,  # None表示创建交互式shell
            term_type='xterm-256color',
            term_size=(80, 24)
        )
        logger.info("交互式shell创建成功")
        
        stdin, stdout, stderr = process.stdin, process.stdout, process.stderr
        
        # 发送命令（stdin.write需要字符串，不是字节）
        stdin.write('echo "Test command"\n')
        await stdin.drain()  # 确保数据已发送
        
        # 读取输出（等待一小段时间让命令执行）
        await asyncio.sleep(0.5)
        try:
            output = await asyncio.wait_for(stdout.read(1024), timeout=2.0)
            logger.info(f"Shell输出: {output}")  # stdout.read()返回字符串，不是字节
        except asyncio.TimeoutError:
            logger.warning("读取输出超时")
        
        # 关闭进程
        process.close()
        # 连接会在process关闭时自动关闭，不需要手动关闭
        logger.info("测试完成")
        
    except asyncssh.Error as e:
        logger.error(f"SSH错误: {e}")
    except Exception as e:
        logger.error(f"其他错误: {e}", exc_info=True)


async def test_asyncssh_shell():
    """测试完整的交互式shell"""
    try:
        conn = await asyncssh.connect(
            'localhost',
            port=22,
            username='test',
            password='test',
            known_hosts=None
        )
        
        # 使用create_process创建交互式shell
        async with conn:
            process = await conn.create_process(
                None,  # None表示创建交互式shell
                term_type='xterm-256color',
                term_size=(80, 24)
            )
            stdin, stdout, stderr = process.stdin, process.stdout, process.stderr
            
            try:
                
                # 启动输出读取任务
                async def read_output():
                    try:
                        while True:
                            data = await stdout.read(1024)
                            if not data:
                                break
                            print(f"输出: {data}")  # stdout.read()返回字符串
                    except Exception as e:
                        logger.error(f"读取输出错误: {e}")
                
                # 启动输入处理任务
                async def handle_input():
                    try:
                        # 发送一些测试命令（stdin.write需要字符串）
                        await asyncio.sleep(0.5)
                        stdin.write('ls -la\n')
                        await asyncio.sleep(1)
                        stdin.write('pwd\n')
                        await asyncio.sleep(1)
                        stdin.write('exit\n')
                    except Exception as e:
                        logger.error(f"输入处理错误: {e}")
                
                # 并发运行
                await asyncio.gather(
                    read_output(),
                    handle_input(),
                    return_exceptions=True
                )
            finally:
                process.close()
        
    except asyncssh.Error as e:
        logger.error(f"SSH错误: {e}")
    except Exception as e:
        logger.error(f"其他错误: {e}", exc_info=True)


if __name__ == "__main__":
    print("测试1: 基本连接和命令执行")
    asyncio.run(test_asyncssh_connection())
    
    print("\n测试2: 交互式shell")
    # asyncio.run(test_asyncssh_shell())  # 取消注释以测试
