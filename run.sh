#!/bin/bash
# 工具箱 Flask 服务器启动脚本

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 检查虚拟环境是否存在
if [ ! -d ".venv" ]; then
    echo "正在创建虚拟环境..."
    python3 -m venv .venv
fi

# 激活虚拟环境
source .venv/bin/activate

# 检查 Flask 是否安装
if ! python3 -c "import flask" 2>/dev/null; then
    echo "正在安装 Flask..."
    pip install flask
fi

# 启动服务器
echo "=========================================="
echo "🧰 工具箱服务器启动中..."
echo "=========================================="
echo "访问地址: http://127.0.0.1:5000"
echo "按 Ctrl+C 停止服务器"
echo "=========================================="

python3 app.py
