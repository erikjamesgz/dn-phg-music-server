#!/bin/bash

# 洛雪音乐后台 Deno Deploy 部署脚本

set -e

echo "🚀 开始部署洛雪音乐第三方音源后台到 Deno Deploy..."

# 检查是否安装了 deno
if ! command -v deno &> /dev/null; then
    echo "❌ 未找到 deno 命令，请先安装 Deno:"
    echo "   curl -fsSL https://deno.land/x/install/install.sh | sh"
    exit 1
fi

# 检查 deployctl 是否安装
if ! command -v deployctl &> /dev/null; then
    echo "📦 正在安装 deployctl..."
    deno install -A -f -n deployctl https://deno.land/x/deploy/deployctl.ts
fi

# 项目路径
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 检查主文件是否存在
if [ ! -f "main.ts" ]; then
    echo "❌ 未找到 main.ts 文件"
    exit 1
fi

echo "📁 项目路径: $PROJECT_DIR"

# 尝试获取项目名称
if [ -f "deno.json" ]; then
    PROJECT_NAME=$(grep -o '"name": *"[^"]*"' deno.json | cut -d'"' -f4)
else
    PROJECT_NAME="dn-music-server"
fi

echo "📦 项目名称: $PROJECT_NAME"

# 检查环境变量
if [ -z "$DENO_DEPLOY_TOKEN" ]; then
    echo "⚠️  未设置 DENO_DEPLOY_TOKEN 环境变量"
    echo "   请设置: export DENO_DEPLOY_TOKEN='your-token'"
    echo "   获取方式: https://dash.deno.com/account#access-tokens"
fi

# 部署到 Deno Deploy
echo "🌐 开始部署到 Deno Deploy..."

if [ -n "$DENO_DEPLOY_TOKEN" ]; then
    deployctl deploy \
        --project="$PROJECT_NAME" \
        --token="$DENO_DEPLOY_TOKEN" \
        main.ts
else
    echo "ℹ️  使用交互式部署模式..."
    deployctl deploy --project="$PROJECT_NAME" main.ts
fi

echo ""
echo "✅ 部署完成!"
echo ""
echo "📝 API 测试命令:"
echo ""
echo "1. 检查服务状态:"
echo "   curl https://${PROJECT_NAME}.deno.dev/api/status"
echo ""
echo "2. 获取默认音源:"
echo "   curl https://${PROJECT_NAME}.deno.dev/api/scripts/default"
echo ""
echo "3. 从URL导入脚本:"
echo "   curl -X POST https://${PROJECT_NAME}.deno.dev/api/scripts/import/url \"
echo "     -H 'Content-Type: application/json' \"
echo "     -d '{\"url\":\"https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js\"}'"
echo ""
echo "4. 获取音乐播放URL:"
echo "   curl -X POST https://${PROJECT_NAME}.deno.dev/api/music/url \"
echo "     -H 'Content-Type: application/json' \"
echo "     -d '{\"source\":\"kw\",\"songmid\":\"test123\",\"name\":\"测试歌曲\",\"singer\":\"测试歌手\",\"quality\":\"320k\"}'"
echo ""
echo "5. 获取已加载音源列表:"
echo "   curl https://${PROJECT_NAME}.deno.dev/api/scripts/loaded"
