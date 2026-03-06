#!/usr/bin/env python3
"""
工具箱 Flask 服务器
提供静态文件服务和 index.html 主页
"""

from flask import Flask, send_from_directory, make_response
import os

app = Flask(__name__)

# 获取当前目录作为根目录
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))


@app.after_request
def add_security_headers(response):
    """
    添加安全 headers
    """
    # 添加基本安全 headers，但不包括 COEP（避免 CDN 问题）
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response


@app.route('/')
def index():
    """返回 index.html 作为主页"""
    return send_from_directory(ROOT_DIR, 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    """提供静态文件服务（css、js、图片等）"""
    return send_from_directory(ROOT_DIR, filename)


if __name__ == '__main__':
    print("=" * 50)
    print("🧰 工具箱服务器启动中...")
    print("=" * 50)
    print("访问地址: http://127.0.0.1:5000")
    print("按 Ctrl+C 停止服务器")
    print("=" * 50)
    
    # 开启调试模式，方便开发
    app.run(host='0.0.0.0', port=5000, debug=True)
