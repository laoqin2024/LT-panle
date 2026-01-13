// ============================================
// asyncssh SSH终端 WebSocket 测试代码
// 在浏览器控制台中运行
// ============================================

// 步骤1: 先登录获取token（如果还没有）
async function loginAndGetToken() {
    const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'username=admin&password=your_password'  // 替换为实际密码（注意：密码是admin123）
    });
    
    if (!response.ok) {
        console.error('登录失败:', await response.text());
        return null;
    }
    
    const data = await response.json();
    console.log('✅ 登录成功，Token已获取');
    return data.access_token;
}

// 步骤2: 建立WebSocket连接
async function testSSHTerminal() {
    // 获取token
    const token = await loginAndGetToken();
    if (!token) {
        console.error('❌ 无法获取token');
        return;
    }
    
    // 设置服务器参数（根据实际情况修改）
    const serverId = 2;  // 替换为实际的服务器ID
    const credentialId = 3;  // 替换为实际的凭据ID
    
    // 建立WebSocket连接（注意：URL需要用引号包裹）
    const wsUrl = `ws://localhost:8000/api/servers/${serverId}/ssh/terminal/asyncssh?credential_id=${credentialId}&token=${token}`;
    console.log('🔗 连接URL:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    // 连接打开
    ws.onopen = () => {
        console.log('✅ WebSocket连接已建立');
    };
    
    // 接收消息
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 收到消息:', data);
            
            if (data.type === 'connected') {
                console.log('✅ SSH终端已连接');
                // 连接成功后，发送测试命令
                setTimeout(() => {
                    console.log('📤 发送测试命令: ls -la');
                    ws.send(JSON.stringify({
                        type: 'input',
                        data: 'ls -la\n'
                    }));
                }, 500);
            } else if (data.type === 'output') {
                console.log('📤 SSH输出:', data.data);
            } else if (data.type === 'error') {
                console.error('❌ 错误:', data.message);
            }
        } catch (e) {
            console.error('❌ 解析消息失败:', e, event.data);
        }
    };
    
    // 连接错误
    ws.onerror = (error) => {
        console.error('❌ WebSocket错误:', error);
    };
    
    // 连接关闭
    ws.onclose = (event) => {
        console.log('🔌 WebSocket连接已关闭', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });
    };
    
    // 返回WebSocket对象，方便后续操作
    return ws;
}

// 步骤3: 运行测试
// 在控制台中运行: testSSHTerminal()

// ============================================
// 快速测试（一行代码）
// ============================================
// 复制以下代码到控制台，替换参数后运行：

/*
(async () => {
    const token = (await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'username=admin&password=your_password'
    }).then(r => r.json())).access_token;
    
    const ws = new WebSocket(`ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=${token}`);
    ws.onopen = () => console.log('✅ 连接成功');
    ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        console.log(d.type === 'output' ? d.data : d);
        if (d.type === 'connected') {
            setTimeout(() => ws.send(JSON.stringify({type: 'input', data: 'ls -la\n'})), 500);
        }
    };
    ws.onerror = e => console.error('❌ 错误:', e);
    ws.onclose = e => console.log('🔌 关闭:', e.code);
})();
*/
