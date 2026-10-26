#!/bin/bash
cd "$(dirname "$0")" || exit 1
exec bash ./启动保有数.command --stop
