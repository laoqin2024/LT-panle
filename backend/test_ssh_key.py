#!/usr/bin/env python3
"""
测试SSH私钥加载和连接
用于调试SSH连接问题
"""
import sys
import os
from io import StringIO
import paramiko

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 测试私钥内容
TEST_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
MIIJKgIBAAKCAgEAvizaMXSFqyCrYDvqcNRq7KzTc5e65C8T7tvsoKPwVEC+w6WB
/dx/twwqToFClK2CsGvj7uWrqcHM889nLZOPJVx3DBdn+nRnnVYSwSUjlyyxdVWa
OzW+2XOtfy9AYN89xOfJHZXzTSgKvWPPgPCLjslWR2lwSUmG+Aq2rLHnrvmpyx5V
C85kPPrvzy1v3TVcNjoJm07EvxKP07kluTYeEMgOYsdFrGq3OJk0Zz6r1kZ7KVGE
tcnGwlpq9yxgVYVLNvqtxNltNxAiagi+hBA9CFCEPvfXNw5RnuHLGtIDbiqiau/F
ePeAdHJes+0QJGBP+QLroeREdvG05dEwK72v22o4KRpnaFoGv4cKTOrersLlHa8Q
InjipcM4m0rw2u9W3DeWi0fENAnAxITkrT4L71dAgpXORSBB9UGUD9eACs5LDZDO
TcTvuql2UWX/zs0vzEXVZ3RMfnnQZTOxtYDAoxMkSKjvnzYpO7oHo2wRa2HenSVk
E79x4L6Nb2zavkb3dL4hXfjgWRa2X1hJHsoKQc6jAv/i4MPoSkYTwCPUHGZOKspH
1TmpqdI8TfjPUzBXrlcIrQapU0b/durktxsIrg5aISYF4jL5XtH54Y7gZGT8vHFx
7VPfAFwvVdE3sUM4EoRr9zGWgnnWneKTfVQRvWTnVxuCh+Zdy5gWbWI3rfkCAwEA
AQKCAgEAr9lZiRFt6Gc1EK9WgS5qEJ9ehyxuLEE79Up267OrrryPqOmJ4evaTLB7
DkyH/GLUzb117pmAul/x3CCUD5i6bJmrmwqpovWwOdQ1U1O8LTWuggi9rLJt3zUP
4OMYbHsA6upJFYpqh5XXGHkKjvfelBGoLjBZG+tZWlLNx7JZwXoqfx91FI2sMpb2
2GPzZGDK+3l/GJUlaGkJhYVWVISuGGZkpwIMcvnaogNIaY+R5XkWuYYfaNlDaMOi
1Ru7mFjAy/3QYI2MZ7YLnHCpegRp6x5IqtERuF8NKhUvcYVwlpXlyWwc9VYm+YYn
+8fhfUFxsZf5uqEQjcvCsh9Uo52q1WilMtIKTqepb1YHxmHytuY5vWZMvijLvOND
qORT3oevWeUZYjUS9qr2NXFNZEikgiJG8MszGJ0Tqf4UERDSk+ErR4hUFbF+eqye
A+++V/0a4DkCtPu9/hlbfYbeWZQqcb7aBhL23grnVLKNSp3XvFv3CxfCNym8ehbT
hL48xp/zkmm96ZmmV4/dxdAIwfKDLc7kO/Mqmur3aHGANMo4Em8QDxDujdVkqDSk
3IvvRjCB+N8VKiuQL6/n7OJlpCzKtFT8PEssfA6eYobFnw2JVS0rBv1IoXpzme83
d3b9kZpx7wecmeGkug0/fk+ly2JX1KhQHU0nWEnJJkChQ/jGb+ECggEBAOFY2oyn
yNh9Qom+DlQId+f/+5K0cd8PK473BQLozvINlNadCJ3rY5CSTPf1462p4ScwkwZ6
nLcdojtAslEjBtJHQBfXj5pcdzzp4L1RNEw6ybtSK2p23BX/fMZIAI+oTH2ifGne
GV/M95B9vYKjdb5M8B3yAoqFdDC5V6eKN0WrMW7jL1IWDlb9QMaJykI9YqDdGIgm
gMfPRTAVobCHwNrlWNP7WOAkCjGK3my5xIOlcQzZ4MiZkQr3PRvdE56UzODFfRN1
fM7mIqhDi+ccs2QJCNNyDlP9SCfiX3nKqGUL9fdSAVL77jLlHrW7/h0YmolE+GFD
+wGwzjKKceso3+sCggEBANgLOehvBKWynxdbmk12XfPMrxI140VDFFlceHlRm3g1
gHllFYLKmr9amiAQ3QEwTAEu+xM2toCt4BzxZWmN5coRnzmmWhvBV7jSZOhXyMnx
Z7VAXKhSgB/He9U3SD7GDiewng+QqCHWKvoMOZwYg/gtpULehWmPtQf5n9t6WHLo
n8j49IZ7aJBjFg/pXP/R30V9JHaPIYqJEikviPaSoeBcSjxVNc1UBaaEr4S8Bj5a
iNoO2xv8YVe++JLlrie7fL1PWt/M01BuASsQPU8vYsYUXTwhMtU14qOvLV3tWmqC
c9aOpknxntjDjcdE8oYkZgI+AgEpRSQR3m69vlITVKsCggEBAKyozdtTe1oUr3Sm
gIf2bRj/U5xWUaFdGDzUG6zdACMKMO43J7EH+CN/VSXv6uDW9sJ2P1CJhaXwOKs5
qObt9X4MRZl++nKFQn8Tm7SykWWO7Z5vGQDbzUm1lb6+0F9Bzkm8w6LCH6L9gvnc
veVopQCIJrprAXNtSVdDy1t9VVg2EQwrWciFSbtxE76LOMOEERu8C93V0npF33c2
O8rsWOHfNC5HuRMTyhOnmUCpHV7Y1kPIdKh+sVk7kkDVJQEudcQKzQipzlUgk5Fl
H76WiQSuv2pzS3Mi77RPiGPi2R+DCJTU6lrQ2PN6Bgus3MkiXtWqWLz9v0bOV072
MM7DZL0CggEBANQJ4KHyJDuEnoRMUZtpazjXUZSr8w2NkrFKAqv/nnlS+W8r+PrP
YyYgBFkoc+CwyEf5Fk97SY/uF6IQgpogvMGgngf070eCcVhilss7LUSWfFT2gHpr
znhiT3Wqtmt183qc6+UW8w2Sp8eWrAw6O3wfQK3qvEIo22Kia3T8FUdibUDQpx4+
jRf5SDQBtFcYYuxOsLT0MdVIRtzJXMG0lNAhhHLGpvGJX6pZW/MIn5AfR2XNYtuK
zvdR5aI3bsBsUTd0ZRp2a4frD5Z2b9YCCg2i+wcDBmMgafqA+iPPywfyVULl6ut0
C5VwCPzk/KsPmlblCQ6etM98AjXqYJspgdUCggEAdIHl35favth90LIK3vUsCbru
/x5LQRahknuGKC9nNxvCHkseRIEKW678i4Fk/C1nvncTryc8mlc5QGMaUkmqs0s7
TWF4RVDlM/WkUxsjszmrYdIlNDY5Iyyv9I+K8vKSDdxKrdZy0sE3MFfJCJMo2VjR
EhkwOvI6TzVX3klS6A1oLPstNkMea+VFuTMAi8Nj9vsS2CEiAv1mauOL9R4/hh9H
r5kfglw6uPh7anypKef0h4SZ1O+n0vNDRmOWzSY5zCsyqLX8NMZg768OFkvD13f3
7o1gGPvC93I81ndBlaVsrkFgLfyZgZMvYBYbGuAH4JtydE8of+WqyljLcPLZjw==
-----END RSA PRIVATE KEY-----"""

def test_key_loading():
    """测试私钥加载"""
    print("=" * 60)
    print("测试SSH私钥加载")
    print("=" * 60)
    
    # 清理私钥内容
    private_key_content = TEST_PRIVATE_KEY.strip()
    print(f"\n私钥长度: {len(private_key_content)} 字符")
    print(f"私钥前3行:\n{chr(10).join(private_key_content.split(chr(10))[:3])}")
    
    # 尝试加载RSA私钥
    key_file = StringIO(private_key_content)
    
    try:
        pkey = paramiko.RSAKey.from_private_key(key_file)
        print("\n✅ 成功加载RSA私钥!")
        print(f"密钥类型: {type(pkey).__name__}")
        print(f"密钥大小: {pkey.get_bits()} bits")
        return pkey
    except Exception as e:
        print(f"\n❌ RSA私钥加载失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_ssh_connection(pkey):
    """测试SSH连接"""
    if not pkey:
        print("\n跳过SSH连接测试（私钥加载失败）")
        return
    
    print("\n" + "=" * 60)
    print("测试SSH连接")
    print("=" * 60)
    
    hostname = "192.168.8.95"
    username = "root"
    port = 22
    
    print(f"\n连接参数:")
    print(f"  主机: {hostname}")
    print(f"  端口: {port}")
    print(f"  用户: {username}")
    print(f"  认证: SSH密钥")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print("\n正在连接...")
        ssh.connect(
            hostname=hostname,
            port=port,
            username=username,
            pkey=pkey,
            timeout=10,
            look_for_keys=False,
            allow_agent=False
        )
        print("✅ SSH连接成功!")
        
        # 执行测试命令
        print("\n执行测试命令: echo 'Connection test successful'")
        stdin, stdout, stderr = ssh.exec_command("echo 'Connection test successful'", timeout=5)
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8', errors='ignore')
        
        print(f"退出状态: {exit_status}")
        print(f"输出: {output.strip()}")
        
        ssh.close()
        print("\n✅ 连接测试完成!")
        
    except paramiko.AuthenticationException as e:
        print(f"\n❌ SSH认证失败: {str(e)}")
        print("\n可能的原因:")
        print("  1. 私钥与服务器上的公钥不匹配")
        print("  2. 用户名不正确")
        print("  3. 服务器未配置该公钥")
        import traceback
        traceback.print_exc()
    except paramiko.SSHException as e:
        print(f"\n❌ SSH连接错误: {str(e)}")
        import traceback
        traceback.print_exc()
    except Exception as e:
        print(f"\n❌ 连接失败: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("SSH私钥连接测试工具")
    print("=" * 60)
    
    # 测试私钥加载
    pkey = test_key_loading()
    
    # 测试SSH连接
    if pkey:
        test_ssh_connection(pkey)
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
