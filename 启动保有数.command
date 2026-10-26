#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/share/fnm/aliases/default/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -d "$HOME/.nvm/versions/node" ]; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin; do
    if [ -x "$candidate/node" ] && "$candidate/node" -e 'var v=process.versions.node.split(".").map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=15)?0:1)' >/dev/null 2>&1; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi
if [ "$1" = "--stop" ]; then
  printf '\n保有数 · 停止服务\n\n'
else
  printf '\n保有数 · 一键启动\n个人资料保存在浏览器，本工具不会清除资料。\n\n'
fi
if ! command -v node >/dev/null 2>&1; then
  printf '没有找到 Node.js。请从 https://nodejs.org/ 安装 Node.js 22.15 或更新版本（推荐 26），然后重新双击此文件。\n'
  read -r -p '按回车关闭窗口。' ignored
  exit 1
fi
if ! node -e 'var v=process.versions.node.split(".").map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=15)?0:1)' >/dev/null 2>&1; then
  printf 'Node.js 版本过旧，请安装 22.15 或更新版本（推荐 26），然后重试。\n'
  read -r -p '按回车关闭窗口。' ignored
  exit 1
fi
node scripts/local-launcher.mjs "$@"
launcher_status=$?
if [ "$launcher_status" -ne 0 ]; then
  printf '\n详细日志：%s/.sites-runtime/local-launcher/startup.log\n' "$PWD"
  read -r -p '按回车关闭窗口。' ignored
fi
exit "$launcher_status"
