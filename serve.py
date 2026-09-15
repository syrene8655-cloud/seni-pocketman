#!/usr/bin/env python3
"""Launch the same local server used by npm start."""
import os
from pathlib import Path
import shutil
import subprocess
root=Path(__file__).resolve().parent
node=shutil.which('node')
if not node:
    raise SystemExit('需要 Node.js 22 或以上。安装后重新打开 启动.command。')
if not (root/'node_modules/@neteasecloudmusicapienhanced/api/main.js').exists():
    npm=shutil.which('npm')
    if not npm: raise SystemExit('未找到 npm，请安装 Node.js 后重试。')
    print('首次启动：正在安装网易云接入依赖…', flush=True)
    subprocess.run([npm,'ci','--ignore-scripts','--no-fund','--no-audit'],cwd=root,check=True)
os.chdir(root)
os.execv(node,[node,str(root/'server.cjs'),'--open'])
