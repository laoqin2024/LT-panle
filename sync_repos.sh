#!/bin/bash

# ============================================
# 自动同步代码到 GitHub 和 Gitee 仓库脚本
# ============================================
# 功能：
#   1. 自动检测 git 仓库状态
#   2. 添加所有更改的文件
#   3. 提交更改（支持自定义提交信息）
#   4. 推送到 GitHub 和 Gitee 两个远程仓库
# 
# 使用方法：
#   ./sync_repos.sh [提交信息] [选项]
#   选项：
#     --skip-github    跳过 GitHub 推送
#     --skip-gitee     跳过 Gitee 推送
#     --github-only    只推送到 GitHub
#     --gitee-only     只推送到 Gitee
# ============================================

# 颜色定义（用于输出美化）
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_info "当前工作目录: $SCRIPT_DIR"

# 检查是否在 git 仓库中
if [ ! -d ".git" ]; then
    print_error "当前目录不是 git 仓库！"
    print_info "正在初始化 git 仓库..."
    git init
    
    # 创建 .gitignore 文件（如果不存在）
    if [ ! -f ".gitignore" ]; then
        print_info "创建 .gitignore 文件..."
        cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
*.egg-info/
dist/
build/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# 环境变量
.env
.env.local
.env.*.local

# 日志
*.log
logs/

# 数据库
*.db
*.sqlite
*.sqlite3

# 临时文件
*.tmp
*.temp
.cache/
EOF
        print_success ".gitignore 文件已创建"
    fi
fi

# 检查远程仓库配置
check_remote() {
    local remote_name=$1
    if git remote get-url "$remote_name" &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# 配置远程仓库（如果不存在）
setup_remotes() {
    print_info "检查远程仓库配置..."
    
    # 检查 GitHub 远程仓库
    if ! check_remote "github"; then
        print_warning "GitHub 远程仓库未配置"
        read -p "请输入 GitHub 仓库地址（留空跳过）: " github_url
        if [ -n "$github_url" ]; then
            git remote add github "$github_url"
            print_success "GitHub 远程仓库已添加: $github_url"
        else
            print_warning "跳过 GitHub 配置"
        fi
    else
        print_success "GitHub 远程仓库已配置: $(git remote get-url github)"
    fi
    
    # 检查 Gitee 远程仓库
    if ! check_remote "gitee"; then
        print_warning "Gitee 远程仓库未配置"
        read -p "请输入 Gitee 仓库地址（留空跳过）: " gitee_url
        if [ -n "$gitee_url" ]; then
            git remote add gitee "$gitee_url"
            print_success "Gitee 远程仓库已添加: $gitee_url"
        else
            print_warning "跳过 Gitee 配置"
        fi
    else
        print_success "Gitee 远程仓库已配置: $(git remote get-url gitee)"
    fi
}

# 显示当前状态
show_status() {
    print_info "当前 git 状态:"
    git status -s
    echo ""
    
    # 显示远程仓库
    print_info "已配置的远程仓库:"
    git remote -v
    echo ""
}

# 解析命令行参数
SKIP_GITHUB=false
SKIP_GITEE=false
COMMIT_MESSAGE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-github)
            SKIP_GITHUB=true
            shift
            ;;
        --skip-gitee)
            SKIP_GITEE=true
            shift
            ;;
        --github-only)
            SKIP_GITEE=true
            shift
            ;;
        --gitee-only)
            SKIP_GITHUB=true
            shift
            ;;
        *)
            if [ -z "$COMMIT_MESSAGE" ]; then
                COMMIT_MESSAGE="$1"
            fi
            shift
            ;;
    esac
done

# 主函数
main() {
    print_info "========================================="
    print_info "开始同步代码到 GitHub 和 Gitee"
    print_info "========================================="
    if [ "$SKIP_GITHUB" = true ]; then
        print_warning "将跳过 GitHub 推送"
    fi
    if [ "$SKIP_GITEE" = true ]; then
        print_warning "将跳过 Gitee 推送"
    fi
    echo ""
    
    # 显示当前状态
    show_status
    
    # 检查是否有未提交的更改
    if [ -z "$(git status -s)" ]; then
        print_warning "没有需要提交的更改"
        read -p "是否仍然推送到远程仓库？(y/n): " push_anyway
        if [ "$push_anyway" != "y" ] && [ "$push_anyway" != "Y" ]; then
            print_info "已取消操作"
            exit 0
        fi
    else
        # 添加所有更改
        print_info "添加所有更改的文件..."
        git add .
        
        # 获取提交信息
        if [ -z "$COMMIT_MESSAGE" ]; then
            # 如果没有提供提交信息，则提示输入
            print_info "请输入提交信息:"
            read -p "> " commit_message
        else
            commit_message="$COMMIT_MESSAGE"
        fi
        
        # 如果提交信息为空，使用默认信息
        if [ -z "$commit_message" ]; then
            commit_message="Update: $(date '+%Y-%m-%d %H:%M:%S')"
            print_warning "使用默认提交信息: $commit_message"
        fi
        
        # 提交更改
        print_info "提交更改..."
        git commit -m "$commit_message"
        
        if [ $? -eq 0 ]; then
            print_success "提交成功"
        else
            print_error "提交失败"
            exit 1
        fi
    fi
    
    # 配置远程仓库（如果需要）
    setup_remotes
    
    # 推送到远程仓库
    print_info "========================================="
    print_info "开始推送到远程仓库"
    print_info "========================================="
    
    # 获取当前分支
    current_branch=$(git branch --show-current)
    if [ -z "$current_branch" ]; then
        print_error "无法确定当前分支，请先创建并切换到分支"
        exit 1
    fi
    print_info "当前分支: $current_branch"
    echo ""
    
    # 推送到 GitHub
    if [ "$SKIP_GITHUB" = false ] && check_remote "github"; then
        print_info "推送到 GitHub ($current_branch)..."
        github_url=$(git remote get-url github)
        print_info "远程地址: $github_url"
        
        # 尝试推送到当前分支
        if git push -u github "$current_branch" 2>&1; then
            print_success "GitHub 推送成功"
        else
            push_exit_code=$?
            if [ $push_exit_code -eq 128 ]; then
                print_error "GitHub 推送失败: 认证失败或网络错误"
                print_warning "请检查："
                print_warning "  1. SSH 密钥或 Personal Access Token 是否配置正确"
                print_warning "  2. 网络连接是否正常"
                print_warning "  3. 仓库地址是否正确"
            else
                print_error "GitHub 推送失败 (退出码: $push_exit_code)"
            fi
        fi
        echo ""
    else
        print_warning "GitHub 远程仓库未配置，跳过"
    fi
    
    # 推送到 Gitee
    if [ "$SKIP_GITEE" = false ] && check_remote "gitee"; then
        print_info "推送到 Gitee ($current_branch)..."
        gitee_url=$(git remote get-url gitee)
        print_info "远程地址: $gitee_url"
        print_warning "如果推送卡住，可能是需要输入密码或 token"
        print_warning "请确保已配置 SSH 密钥或使用 HTTPS + Personal Access Token"
        echo ""
        
        # 尝试推送到当前分支（显示详细输出）
        if git push -u gitee "$current_branch" 2>&1; then
            print_success "Gitee 推送成功"
        else
            push_exit_code=$?
            if [ $push_exit_code -eq 128 ]; then
                print_error "Gitee 推送失败: 认证失败或网络错误"
                print_warning "请检查："
                print_warning "  1. SSH 密钥或 Personal Access Token 是否配置正确"
                print_warning "  2. 网络连接是否正常（Gitee 可能需要特殊网络环境）"
                print_warning "  3. 仓库地址是否正确"
                print_warning "  4. 如果使用 HTTPS，请确保已配置凭据存储"
            else
                print_error "Gitee 推送失败 (退出码: $push_exit_code)"
            fi
        fi
        echo ""
    else
        print_warning "Gitee 远程仓库未配置，跳过"
    fi
    
    echo ""
    print_info "========================================="
    print_success "同步完成！"
    print_info "========================================="
}

# 执行主函数
main
