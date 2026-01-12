#!/bin/bash

# ============================================
# 自动同步代码到 GitHub 和 Gitee 仓库脚本
# ============================================
# 功能：
#   1. 自动检测 git 仓库状态
#   2. 添加所有更改的文件
#   3. 提交更改（支持自定义提交信息）
#   4. 推送到 GitHub 和 Gitee 两个远程仓库
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

# 主函数
main() {
    print_info "========================================="
    print_info "开始同步代码到 GitHub 和 Gitee"
    print_info "========================================="
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
        if [ -z "$1" ]; then
            # 如果没有提供提交信息，则提示输入
            print_info "请输入提交信息:"
            read -p "> " commit_message
        else
            commit_message="$1"
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
    
    # 推送到 GitHub
    if check_remote "github"; then
        print_info "推送到 GitHub..."
        git push github main 2>/dev/null || git push github master 2>/dev/null || {
            # 如果 main 和 master 都不存在，尝试创建并推送
            current_branch=$(git branch --show-current)
            if [ -n "$current_branch" ]; then
                git push -u github "$current_branch"
            else
                print_error "无法确定当前分支"
            fi
        }
        
        if [ $? -eq 0 ]; then
            print_success "GitHub 推送成功"
        else
            print_error "GitHub 推送失败"
        fi
    else
        print_warning "GitHub 远程仓库未配置，跳过"
    fi
    
    # 推送到 Gitee
    if check_remote "gitee"; then
        print_info "推送到 Gitee..."
        git push gitee main 2>/dev/null || git push gitee master 2>/dev/null || {
            # 如果 main 和 master 都不存在，尝试创建并推送
            current_branch=$(git branch --show-current)
            if [ -n "$current_branch" ]; then
                git push -u gitee "$current_branch"
            else
                print_error "无法确定当前分支"
            fi
        }
        
        if [ $? -eq 0 ]; then
            print_success "Gitee 推送成功"
        else
            print_error "Gitee 推送失败"
        fi
    else
        print_warning "Gitee 远程仓库未配置，跳过"
    fi
    
    echo ""
    print_info "========================================="
    print_success "同步完成！"
    print_info "========================================="
}

# 执行主函数
# 如果提供了参数，则作为提交信息使用
main "$@"
