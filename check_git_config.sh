#!/bin/bash

# ============================================
# Git 配置检查脚本
# ============================================
# 功能：检查 Git 配置、远程仓库、认证等
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
print_info "========================================="
print_info "Git 配置检查"
print_info "========================================="
echo ""

# 1. 检查是否在 git 仓库中
print_info "1. 检查 Git 仓库状态..."
if [ -d ".git" ]; then
    print_success "当前目录是 Git 仓库"
else
    print_error "当前目录不是 Git 仓库"
    exit 1
fi
echo ""

# 2. 检查用户配置
print_info "2. 检查 Git 用户配置..."
user_name=$(git config user.name)
user_email=$(git config user.email)
if [ -n "$user_name" ] && [ -n "$user_email" ]; then
    print_success "用户名: $user_name"
    print_success "邮箱: $user_email"
else
    print_warning "Git 用户信息未配置"
    print_warning "请运行: git config --global user.name '你的名字'"
    print_warning "请运行: git config --global user.email '你的邮箱'"
fi
echo ""

# 3. 检查当前分支
print_info "3. 检查当前分支..."
current_branch=$(git branch --show-current)
if [ -n "$current_branch" ]; then
    print_success "当前分支: $current_branch"
else
    print_warning "无法确定当前分支"
    print_info "所有分支:"
    git branch -a
fi
echo ""

# 4. 检查远程仓库
print_info "4. 检查远程仓库配置..."
if git remote | grep -q .; then
    print_success "已配置的远程仓库:"
    git remote -v | while read line; do
        echo "  $line"
    done
else
    print_warning "未配置任何远程仓库"
fi
echo ""

# 5. 检查 GitHub 远程仓库
print_info "5. 检查 GitHub 远程仓库..."
if git remote | grep -q "^github$"; then
    github_url=$(git remote get-url github)
    print_success "GitHub 远程仓库已配置: $github_url"
    
    # 测试连接
    print_info "测试 GitHub 连接..."
    if git ls-remote github &>/dev/null; then
        print_success "GitHub 连接正常"
    else
        print_error "GitHub 连接失败"
        print_warning "可能的原因："
        print_warning "  - 网络问题"
        print_warning "  - 认证失败（需要配置 SSH 密钥或 Personal Access Token）"
        print_warning "  - 仓库地址错误"
    fi
else
    print_warning "GitHub 远程仓库未配置"
fi
echo ""

# 6. 检查 Gitee 远程仓库
print_info "6. 检查 Gitee 远程仓库..."
if git remote | grep -q "^gitee$"; then
    gitee_url=$(git remote get-url gitee)
    print_success "Gitee 远程仓库已配置: $gitee_url"
    
    # 测试连接
    print_info "测试 Gitee 连接..."
    if timeout 10 git ls-remote gitee &>/dev/null; then
        print_success "Gitee 连接正常"
    else
        print_error "Gitee 连接失败或超时"
        print_warning "可能的原因："
        print_warning "  - 网络问题（Gitee 可能需要特殊网络环境）"
        print_warning "  - 认证失败（需要配置 SSH 密钥或 Personal Access Token）"
        print_warning "  - 仓库地址错误"
        print_warning "  - 连接超时（网络较慢）"
    fi
else
    print_warning "Gitee 远程仓库未配置"
fi
echo ""

# 7. 检查 SSH 密钥
print_info "7. 检查 SSH 密钥配置..."
if [ -f ~/.ssh/id_rsa ] || [ -f ~/.ssh/id_ed25519 ] || [ -f ~/.ssh/id_ecdsa ]; then
    print_success "检测到 SSH 密钥"
    
    # 测试 GitHub SSH 连接
    if git remote | grep -q "^github$"; then
        github_url=$(git remote get-url github)
        if [[ "$github_url" == git@* ]]; then
            print_info "测试 GitHub SSH 连接..."
            if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
                print_success "GitHub SSH 认证成功"
            else
                print_warning "GitHub SSH 认证失败，请检查 SSH 密钥是否已添加到 GitHub"
            fi
        fi
    fi
    
    # 测试 Gitee SSH 连接
    if git remote | grep -q "^gitee$"; then
        gitee_url=$(git remote get-url gitee)
        if [[ "$gitee_url" == git@* ]]; then
            print_info "测试 Gitee SSH 连接..."
            if timeout 10 ssh -T git@gitee.com 2>&1 | grep -q "successfully"; then
                print_success "Gitee SSH 认证成功"
            else
                print_warning "Gitee SSH 认证失败，请检查 SSH 密钥是否已添加到 Gitee"
            fi
        fi
    fi
else
    print_warning "未检测到 SSH 密钥"
    print_info "如果使用 HTTPS，需要配置 Personal Access Token"
fi
echo ""

# 8. 检查工作区状态
print_info "8. 检查工作区状态..."
if [ -z "$(git status -s)" ]; then
    print_success "工作区干净，没有未提交的更改"
else
    print_warning "工作区有未提交的更改:"
    git status -s
fi
echo ""

# 9. 检查本地和远程分支的差异
print_info "9. 检查本地和远程分支的差异..."
if [ -n "$current_branch" ]; then
    if git remote | grep -q "^github$"; then
        print_info "GitHub ($current_branch):"
        ahead=$(git rev-list --count github/$current_branch..HEAD 2>/dev/null || echo "0")
        behind=$(git rev-list --count HEAD..github/$current_branch 2>/dev/null || echo "0")
        if [ "$ahead" -gt 0 ] || [ "$behind" -gt 0 ]; then
            if [ "$ahead" -gt 0 ]; then
                print_warning "  本地领先 $ahead 个提交（需要推送）"
            fi
            if [ "$behind" -gt 0 ]; then
                print_warning "  本地落后 $behind 个提交（需要拉取）"
            fi
        else
            print_success "  本地和远程同步"
        fi
    fi
    
    if git remote | grep -q "^gitee$"; then
        print_info "Gitee ($current_branch):"
        ahead=$(git rev-list --count gitee/$current_branch..HEAD 2>/dev/null || echo "0")
        behind=$(git rev-list --count HEAD..gitee/$current_branch 2>/dev/null || echo "0")
        if [ "$ahead" -gt 0 ] || [ "$behind" -gt 0 ]; then
            if [ "$ahead" -gt 0 ]; then
                print_warning "  本地领先 $ahead 个提交（需要推送）"
            fi
            if [ "$behind" -gt 0 ]; then
                print_warning "  本地落后 $behind 个提交（需要拉取）"
            fi
        else
            print_success "  本地和远程同步"
        fi
    fi
fi
echo ""

# 总结
print_info "========================================="
print_info "检查完成"
print_info "========================================="
echo ""
print_info "如果推送失败，建议："
print_info "1. 检查网络连接"
print_info "2. 配置 SSH 密钥或使用 Personal Access Token"
print_info "3. 确认远程仓库地址正确"
print_info "4. 对于 Gitee，可能需要使用国内网络环境"
echo ""
